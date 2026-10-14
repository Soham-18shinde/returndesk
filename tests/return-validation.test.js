import test from "node:test";
import assert from "node:assert/strict";
import { errorResponse, newRequestReference, serializeRequest } from "../src/lib/return-api.js";
import {
  ApiError,
  isLegalTransition,
  normalizeReason,
  normalizeStatus,
  parseCreatePayload,
  parseListQuery,
  parseNotePayload,
  parsePatchPayload,
  validateResolutionPair,
} from "../src/lib/return-validation.js";

test("status and reason labels normalize to Prisma enum values", () => {
  assert.equal(normalizeStatus("In Review"), "InReview");
  assert.equal(normalizeStatus("InReview"), "InReview");
  assert.equal(normalizeReason("Wrong Item"), "WrongItem");
  assert.equal(normalizeReason("Changed Mind"), "ChangedMind");
});

test("create validation accepts required fields and rejects invalid quantity or unknown fields", () => {
  const request = parseCreatePayload({
    customerName: "Asha Rao",
    customerContact: "asha@example.invalid",
    orderNumber: "ORD-100",
    itemName: "Cotton shirt",
    quantity: 2,
    reason: "Size Issue",
  });
  assert.equal(request.reason, "SizeIssue");
  assert.equal(request.quantity, 2);
  assert.throws(() => parseCreatePayload({ ...request, quantity: 0 }), ApiError);
  assert.throws(() => parseCreatePayload({ ...request, status: "Approved" }), ApiError);
});

test("patch validation accepts status and resolution input and rejects empty updates", () => {
  const patch = parsePatchPayload({ status: "Approved", resolution: "Store Credit" });
  assert.equal(patch.status, "Approved");
  assert.equal(patch.resolution, "StoreCredit");
  assert.throws(() => parsePatchPayload({}), ApiError);
  assert.throws(() => parsePatchPayload({ status: "Unknown" }), ApiError);
});

test("legal transition table permits only the required lifecycle steps", () => {
  assert.equal(isLegalTransition("Open", "InReview"), true);
  assert.equal(isLegalTransition("InReview", "Approved"), true);
  assert.equal(isLegalTransition("InReview", "Rejected"), true);
  assert.equal(isLegalTransition("Approved", "Completed"), true);
  assert.equal(isLegalTransition("Open", "Approved"), false);
  assert.equal(isLegalTransition("Rejected", "Open"), false);
  assert.equal(isLegalTransition("Completed", "InReview"), false);
});

test("resolution validation enforces refund and approval requirements", () => {
  assert.doesNotThrow(() => validateResolutionPair("Approved", "Refund", "12.50"));
  assert.doesNotThrow(() => validateResolutionPair("Approved", "Replacement", null));
  assert.doesNotThrow(() => validateResolutionPair("Completed", "StoreCredit", null));
  assert.throws(() => validateResolutionPair("Approved", null, null), ApiError);
  assert.throws(() => validateResolutionPair("Approved", "Refund", "0"), ApiError);
  assert.throws(() => validateResolutionPair("Approved", "Replacement", "1"), ApiError);
});

test("list validation supports combined server-side filters, sorting, and pagination", () => {
  const query = parseListQuery(new URLSearchParams(
    "search=asha&status=In%20Review&reason=Wrong%20Item&sortBy=reference&sortOrder=asc&page=2&pageSize=25"
  ));
  assert.deepEqual(query, {
    search: "asha",
    status: "InReview",
    reason: "WrongItem",
    sortBy: "reference",
    sortOrder: "asc",
    page: 2,
    pageSize: 25,
  });
  assert.throws(() => parseListQuery(new URLSearchParams("pageSize=500")), ApiError);
  assert.throws(() => parseListQuery(new URLSearchParams("sortBy=untrusted")), ApiError);
});

test("note validation accepts a non-empty body only", () => {
  assert.deepEqual(parseNotePayload({ body: "Customer contacted about replacement." }), {
    body: "Customer contacted about replacement.",
  });
  assert.throws(() => parseNotePayload({ body: "  " }), ApiError);
  assert.throws(() => parseNotePayload({ body: "A note", createdAt: "now" }), ApiError);
});

test("generated references are human-readable and error responses are safe JSON", async () => {
  assert.match(newRequestReference(), /^RET-\d{8}-[A-F0-9]{6}$/);

  const response = errorResponse({
    constructor: { name: "PrismaClientUnknownRequestError" },
    message: 'ConnectorError(PostgresError { code: "23514", message: "private database detail" })',
  });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: {
      code: "BUSINESS_RULE_VIOLATION",
      message: "The requested change violates a return request rule.",
    },
  });
});

test("response serialization uses assignment-friendly labels", () => {
  const value = serializeRequest({
    id: "test-id",
    status: "InReview",
    reason: "NotAsDescribed",
    resolution: "StoreCredit",
  });
  assert.equal(value.status, "In Review");
  assert.equal(value.reason, "Not As Described");
  assert.equal(value.resolution, "Store Credit");
});
