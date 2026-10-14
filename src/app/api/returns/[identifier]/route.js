import { prisma } from "@/lib/prisma";
import {
  ApiError,
  isDetailsField,
  isLegalTransition,
  parsePatchPayload,
  validateResolutionPair,
} from "@/lib/return-validation";
import {
  activeRequestWhere,
  errorResponse,
  jsonError,
  orderedNotes,
  readJsonBody,
  serializeRequest,
} from "@/lib/return-api";

const FINAL_STATUSES = new Set(["Approved", "Rejected", "Completed"]);

export async function GET(_request, { params }) {
  try {
    const { identifier } = await params;
    const request = await prisma.returnRequest.findFirst({
      where: activeRequestWhere(identifier),
      include: { notes: orderedNotes() },
    });
    if (!request) return jsonError(404, "NOT_FOUND", "The requested return request was not found.");
    return Response.json({ data: serializeRequest(request) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { identifier } = await params;
    const patch = parsePatchPayload(await readJsonBody(request));
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.returnRequest.findFirst({ where: activeRequestWhere(identifier) });
      if (!current) throw new ApiError(404, "NOT_FOUND", "The requested return request was not found.");

      const nextStatus = patch.status ?? current.status;
      if (patch.status && !isLegalTransition(current.status, nextStatus)) {
        throw new ApiError(409, "INVALID_TRANSITION", "That status transition is not allowed.");
      }

      const detailsChanged = Object.keys(patch).some(
        (field) => isDetailsField(field) && patch[field] !== current[field]
      );
      if (detailsChanged && (FINAL_STATUSES.has(current.status) || FINAL_STATUSES.has(nextStatus))) {
        throw new ApiError(409, "DETAILS_LOCKED", "Customer and item details cannot be changed after a decision.");
      }

      const resolution = Object.hasOwn(patch, "resolution") ? patch.resolution : current.resolution;
      const refundAmount = Object.hasOwn(patch, "refundAmount")
        ? patch.refundAmount
        : current.refundAmount?.toString() ?? null;
      validateResolutionPair(nextStatus, resolution, refundAmount);

      return tx.returnRequest.update({
        where: { id: current.id },
        data: patch,
        include: { notes: orderedNotes() },
      });
    });
    return Response.json({ data: serializeRequest(updated) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { identifier } = await params;
    const removed = await prisma.$transaction(async (tx) => {
      const current = await tx.returnRequest.findFirst({ where: activeRequestWhere(identifier) });
      if (!current) throw new ApiError(404, "NOT_FOUND", "The requested return request was not found.");
      if (current.status !== "Open" && current.status !== "Rejected") {
        throw new ApiError(409, "REMOVAL_NOT_ALLOWED", "Only Open or Rejected requests can be removed.");
      }
      return tx.returnRequest.update({
        where: { id: current.id },
        data: { deletedAt: new Date() },
        select: { id: true, reference: true, deletedAt: true },
      });
    });
    return Response.json({ data: removed });
  } catch (error) {
    return errorResponse(error);
  }
}
