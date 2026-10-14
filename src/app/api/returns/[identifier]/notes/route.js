import { prisma } from "@/lib/prisma";
import { ApiError, parseNotePayload } from "@/lib/return-validation";
import {
  activeRequestWhere,
  errorResponse,
  readJsonBody,
} from "@/lib/return-api";

export async function POST(request, { params }) {
  try {
    const { identifier } = await params;
    const data = parseNotePayload(await readJsonBody(request));
    const note = await prisma.$transaction(async (tx) => {
      const parent = await tx.returnRequest.findFirst({
        where: activeRequestWhere(identifier),
        select: { id: true },
      });
      if (!parent) throw new ApiError(404, "NOT_FOUND", "The requested return request was not found.");
      return tx.returnNote.create({ data: { ...data, returnRequestId: parent.id } });
    });
    return Response.json({ data: note }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
