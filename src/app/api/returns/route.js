import { prisma } from "@/lib/prisma";
import { parseCreatePayload, parseListQuery } from "@/lib/return-validation";
import {
  errorResponse,
  jsonError,
  newRequestReference,
  readJsonBody,
  serializeRequest,
} from "@/lib/return-api";

export async function GET(request) {
  try {
    const query = parseListQuery(new URL(request.url).searchParams);
    const where = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.reason ? { reason: query.reason } : {}),
      ...(query.search
        ? {
            OR: [
              { customerName: { contains: query.search, mode: "insensitive" } },
              { orderNumber: { contains: query.search, mode: "insensitive" } },
              { reference: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [requests, total] = await Promise.all([
      prisma.returnRequest.findMany({
        where,
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: query.sortOrder }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.returnRequest.count({ where }),
    ]);

    return Response.json({
      data: requests.map(serializeRequest),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    const data = parseCreatePayload(await readJsonBody(request));
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const created = await prisma.returnRequest.create({
          data: { ...data, reference: newRequestReference() },
        });
        return Response.json({ data: serializeRequest(created) }, { status: 201 });
      } catch (error) {
        if (!isReferenceCollision(error) || attempt === 2) return errorResponse(error);
      }
    }
    return jsonError(500, "INTERNAL_SERVER_ERROR", "The server could not complete the request.");
  } catch (error) {
    return errorResponse(error);
  }
}

function isReferenceCollision(error) {
  if (error?.code === "P2002") {
    const target = JSON.stringify(error.meta?.target || "").toLowerCase();
    return target.includes("reference");
  }
  return /return_requests_reference_key/i.test(String(error?.message || ""));
}
