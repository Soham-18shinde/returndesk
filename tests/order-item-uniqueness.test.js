import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const testDatabaseUrl = process.env.RETURNDESK_TEST_DATABASE_URL;
const skipReason = testDatabaseUrl
  ? false
  : "Set RETURNDESK_TEST_DATABASE_URL to a separate PostgreSQL test database with migrations applied.";

function databaseIdentity(value) {
  const url = new URL(value);
  const host = url.hostname.replace(/-pooler(?=\.)/, "");
  return [host, url.port, decodeURIComponent(url.pathname), url.searchParams.get("schema") || "public"].join("|");
}

test("the database enforces normalized live order/item uniqueness", { skip: skipReason }, async (t) => {
  const productionUrls = [process.env.DATABASE_URL, process.env.DIRECT_URL].filter(Boolean);
  assert.ok(
    productionUrls.every((url) => databaseIdentity(url) !== databaseIdentity(testDatabaseUrl)),
    "RETURNDESK_TEST_DATABASE_URL must identify a different database from DATABASE_URL and DIRECT_URL."
  );

  const prisma = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: testDatabaseUrl }),
  });
  const suiteId = randomUUID().replaceAll("-", "").toUpperCase();
  let requestNumber = 0;

  async function createRequest(orderNumber, itemName) {
    requestNumber += 1;
    return prisma.returnRequest.create({
      data: {
        reference: `TEST-${suiteId}-${requestNumber}`,
        customerName: "ReturnDesk automated test",
        customerContact: "test@example.invalid",
        orderNumber,
        itemName,
        quantity: 1,
        reason: "Damaged",
      },
    });
  }

  async function expectDuplicate(orderNumber, itemName) {
    await assert.rejects(createRequest(orderNumber, itemName), (error) => error?.code === "P2002");
  }

  try {
    const indexes = await prisma.$queryRaw`
      SELECT indexname::text AS name
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename = 'return_requests'
        AND indexname = 'return_requests_one_live_order_item_normalized'
    `;
    assert.equal(indexes.length, 1, "Apply migrations to the isolated test database before running these cases.");

    await t.test("exact duplicate active request is rejected", async () => {
      const order = `RD-TEST-${suiteId}-EXACT`;
      const item = "Frido Seat Cushion";
      await createRequest(order, item);
      await expectDuplicate(order, item);
    });

    await t.test("different capitalization is rejected", async () => {
      const order = `RD-TEST-${suiteId}-CASE`;
      await createRequest(order, "Frido seat Cushion");
      await expectDuplicate(order.toLowerCase(), "FRIDO SEAT CUSHION");
    });

    await t.test("leading and trailing whitespace is rejected", async () => {
      const order = `RD-TEST-${suiteId}-SPACE`;
      await createRequest(`  ${order}  `, "  Frido Seat Cushion  ");
      await expectDuplicate(order, "Frido Seat Cushion");
    });

    await t.test("same order with a different item is allowed", async () => {
      const order = `RD-TEST-${suiteId}-ITEM`;
      await createRequest(order, "Seat Cushion");
      await assert.doesNotReject(createRequest(order, "Back Support"));
    });

    await t.test("same item with a different order is allowed", async () => {
      const item = "Seat Cushion";
      await createRequest(`RD-TEST-${suiteId}-ORDER-A`, item);
      await assert.doesNotReject(createRequest(`RD-TEST-${suiteId}-ORDER-B`, item));
    });

    await t.test("Rejected request no longer blocks a matching request", async () => {
      const order = `RD-TEST-${suiteId}-REJECTED`;
      const item = "Seat Cushion";
      const prior = await createRequest(order, item);
      await prisma.returnRequest.update({ where: { id: prior.id }, data: { status: "InReview" } });
      await prisma.returnRequest.update({ where: { id: prior.id }, data: { status: "Rejected" } });
      await assert.doesNotReject(createRequest(order, item));
    });

    await t.test("Completed request no longer blocks a matching request", async () => {
      const order = `RD-TEST-${suiteId}-COMPLETED`;
      const item = "Seat Cushion";
      const prior = await createRequest(order, item);
      await prisma.returnRequest.update({ where: { id: prior.id }, data: { status: "InReview" } });
      await prisma.returnRequest.update({
        where: { id: prior.id },
        data: { status: "Approved", resolution: "Replacement" },
      });
      await prisma.returnRequest.update({ where: { id: prior.id }, data: { status: "Completed" } });
      await assert.doesNotReject(createRequest(order, item));
    });

    await t.test("soft-deleted request no longer blocks a matching request", async () => {
      const order = `RD-TEST-${suiteId}-DELETED`;
      const item = "Seat Cushion";
      const prior = await createRequest(order, item);
      await prisma.returnRequest.update({ where: { id: prior.id }, data: { deletedAt: new Date() } });
      await assert.doesNotReject(createRequest(order, item));
    });

    await t.test("concurrent matching creates allow at most one request", async () => {
      const order = `RD-TEST-${suiteId}-RACE`;
      const item = "Seat Cushion";
      const outcomes = await Promise.allSettled([
        createRequest(order, item),
        createRequest(order, item),
      ]);
      assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
      const rejected = outcomes.find((outcome) => outcome.status === "rejected");
      assert.equal(rejected?.reason?.code, "P2002");

      const matches = await prisma.$queryRaw`
        SELECT count(*)::int AS count
        FROM "return_requests"
        WHERE "deletedAt" IS NULL
          AND "status" NOT IN ('Rejected', 'Completed')
          AND lower(regexp_replace("orderNumber", '^[[:space:]]+|[[:space:]]+$', '', 'g')) = lower(${order})
          AND lower(regexp_replace("itemName", '^[[:space:]]+|[[:space:]]+$', '', 'g')) = lower(${item})
      `;
      assert.equal(matches[0].count, 1);
    });
  } finally {
    await prisma.$disconnect();
  }
});
