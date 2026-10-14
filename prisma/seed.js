require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const { PrismaNeon } = require("@prisma/adapter-neon");

if (!process.env.DATABASE_URL) {
  throw new Error("Set DATABASE_URL before running the seed script.");
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

const customers = [
  "Aditi Kulkarni",
  "Rohan Mehta",
  "Priya Nair",
  "Arjun Deshmukh",
  "Kavya Iyer",
  "Ishaan Shah",
  "Meera Joshi",
  "Vivaan Rao",
  "Ananya Menon",
  "Kabir Malhotra",
  "Sana Qureshi",
  "Dev Patel",
  "Nisha Reddy",
  "Aditya Bansal",
  "Tara Mukherjee",
  "Neel Chawla",
  "Ira Sethi",
  "Karan Kapoor",
  "Diya Pillai",
  "Rehan Siddiqui",
  "Mira Ghosh",
  "Yash Verma",
  "Pooja Shetty",
  "Aarav Khanna",
  "Leela Krishnan",
  "Sameer Anand",
  "Rhea Dutta",
  "Omkar Patil",
  "Farah Contractor",
  "Siddharth Bose",
];

const products = [
  "Indigo Cotton Kurta Set",
  "TrailFlex Running Shoes",
  "AeroBeat Wireless Headphones",
  "CopperSip Insulated Bottle",
  "Everyday Linen Bedsheet Set",
  "StudioPro Bluetooth Keyboard",
  "MonsoonGuard Travel Backpack",
  "BrewMate French Press",
  "Classic Fit Denim Jacket",
  "GlowCare Ceramic Hair Dryer",
  "UrbanRide Helmet",
  "SoftStep Memory Foam Slippers",
  "BambooWeave Bath Towel Set",
  "ClearView Reading Glasses",
  "MasalaBox Stainless Steel Containers",
];

const reasons = [
  "Damaged",
  "WrongItem",
  "SizeIssue",
  "NotAsDescribed",
  "ChangedMind",
];
const statuses = ["Open", "InReview", "Approved", "Rejected", "Completed"];
const resolutions = ["Refund", "Replacement", "StoreCredit"];
const notesByStatus = {
  Open: "Support: I confirmed receipt of the request and will review the order details.",
  InReview: "Support: I compared the item with the order and am checking the reported issue.",
  Approved: "Support: I shared the approved resolution and the next steps with the customer.",
  Rejected: "Support: I explained the decision and recorded the reason for declining the request.",
  Completed: "Support: The return has been completed and the customer was notified of the outcome.",
};

const requestCount = 30;
const dayInMilliseconds = 24 * 60 * 60 * 1000;
const dateAnchor = new Date("2026-01-01T00:00:00.000Z");
const requests = Array.from({ length: requestCount }, (_, index) => {
  const status = statuses[index % statuses.length];
  const resolution =
    status === "Approved" || status === "Completed"
      ? resolutions[index % resolutions.length]
      : null;
  const createdAt = new Date(
    dateAnchor.getTime() - (requestCount - index) * dayInMilliseconds,
  );

  return {
    reference: `RD-2026-${String(index + 1).padStart(4, "0")}`,
    customerName: customers[index],
    customerContact: `returndesk-demo-${String(index + 1).padStart(3, "0")}@example.invalid`,
    orderNumber: `ORD-IN-2026-${String(50001 + index).padStart(5, "0")}`,
    itemName: products[index % products.length],
    quantity: (index % 3) + 1,
    reason: reasons[Math.floor(index / 6)],
    status,
    resolution,
    refundAmount: resolution === "Refund" ? "24.99" : null,
    createdAt,
    note: index % 4 === 0 ? notesByStatus[status] : null,
    noteCreatedAt: new Date(createdAt.getTime() + 60 * 60 * 1000),
  };
});

function pairKey(orderNumber, itemName) {
  return JSON.stringify([orderNumber, itemName]);
}

async function addNoteIfMissing(tx, requestId, request) {
  if (!request.note) return false;

  const existingNote = await tx.returnNote.findFirst({
    where: { returnRequestId: requestId, body: request.note },
    select: { id: true },
  });
  if (existingNote) return false;

  const latestNote = await tx.returnNote.findFirst({
    where: { returnRequestId: requestId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const createdAt = latestNote
    ? new Date(Math.max(request.noteCreatedAt.getTime(), latestNote.createdAt.getTime() + 1))
    : request.noteCreatedAt;

  await tx.returnNote.create({
    data: {
      returnRequestId: requestId,
      body: request.note,
      createdAt,
    },
  });
  return true;
}

async function seed(tx) {
  const existingRequests = await tx.returnRequest.findMany({
    where: { reference: { in: requests.map((request) => request.reference) } },
    select: {
      id: true,
      reference: true,
      status: true,
      deletedAt: true,
      customerName: true,
      customerContact: true,
      orderNumber: true,
      itemName: true,
      quantity: true,
    },
  });
  const existingByReference = new Map(
    existingRequests.map((request) => [request.reference, request]),
  );
  const eligibleStatuses = ["Open", "InReview"];
  const requestsChangingPairs = requests.filter((request) => {
    const existing = existingByReference.get(request.reference);
    return !existing || (!existing.deletedAt && eligibleStatuses.includes(existing.status));
  });

  const targetPairs = new Set();
  for (const request of requestsChangingPairs) {
    const key = pairKey(request.orderNumber, request.itemName);
    if (targetPairs.has(key)) {
      throw new Error(
        `Seed stopped: two sample requests target the same live order/item pair (${request.orderNumber}, ${request.itemName}).`,
      );
    }
    targetPairs.add(key);
  }

  // Check every target pair before making any writes. The database's partial
  // unique index remains the final protection against concurrent changes.
  if (requestsChangingPairs.length > 0) {
    const livePairMatches = await tx.returnRequest.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ["Rejected", "Completed"] },
        OR: requestsChangingPairs.map(({ orderNumber, itemName }) => ({
          orderNumber,
          itemName,
        })),
      },
      select: { id: true, reference: true, orderNumber: true, itemName: true },
    });
    const targetByPair = new Map(
      requestsChangingPairs.map((request) => [
        pairKey(request.orderNumber, request.itemName),
        request,
      ]),
    );
    const conflicts = livePairMatches.filter((match) => {
      const target = targetByPair.get(pairKey(match.orderNumber, match.itemName));
      const existing = target && existingByReference.get(target.reference);
      return target && (!existing || existing.id !== match.id);
    });

    if (conflicts.length > 0) {
      const details = conflicts
        .map(
          (conflict) =>
            `${conflict.reference} (${conflict.orderNumber}, ${conflict.itemName})`,
        )
        .join("; ");
      throw new Error(`Seed stopped: live order/item conflict with ${details}.`);
    }
  }

  let createdCount = 0;
  let updatedCount = 0;
  let lockedCount = 0;
  let skippedCount = 0;
  let addedNoteCount = 0;

  for (const request of requests) {
    const existing = existingByReference.get(request.reference);

    if (!existing) {
      await tx.returnRequest.create({
        data: {
          reference: request.reference,
          customerName: request.customerName,
          customerContact: request.customerContact,
          orderNumber: request.orderNumber,
          itemName: request.itemName,
          quantity: request.quantity,
          reason: request.reason,
          status: request.status,
          resolution: request.resolution,
          refundAmount: request.refundAmount,
          createdAt: request.createdAt,
          updatedAt: request.createdAt,
          notes: request.note
            ? {
                create: [{ body: request.note, createdAt: request.noteCreatedAt }],
              }
            : undefined,
        },
      });
      createdCount += 1;
      continue;
    }

    if (existing.deletedAt) {
      skippedCount += 1;
      continue;
    }

    if (eligibleStatuses.includes(existing.status)) {
      const detailsChanged =
        existing.customerName !== request.customerName ||
        existing.customerContact !== request.customerContact ||
        existing.orderNumber !== request.orderNumber ||
        existing.itemName !== request.itemName ||
        existing.quantity !== request.quantity;

      if (detailsChanged) {
        const update = await tx.returnRequest.updateMany({
          where: {
            id: existing.id,
            deletedAt: null,
            status: { in: eligibleStatuses },
          },
          data: {
            customerName: request.customerName,
            customerContact: request.customerContact,
            orderNumber: request.orderNumber,
            itemName: request.itemName,
            quantity: request.quantity,
          },
        });

        if (update.count === 0) {
          skippedCount += 1;
          continue;
        }
        updatedCount += 1;
      }
    } else {
      // Approved, Rejected, and Completed request details are locked.
      lockedCount += 1;
    }

    if (await addNoteIfMissing(tx, existing.id, request)) {
      addedNoteCount += 1;
    }
  }

  return { createdCount, updatedCount, lockedCount, skippedCount, addedNoteCount };
}

async function main() {
  const result = await prisma.$transaction((tx) => seed(tx), {
    timeout: 30_000,
  });
  console.info("ReturnDesk sample data:", result);
}

main()
  .catch((error) => {
    console.error("ReturnDesk seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
