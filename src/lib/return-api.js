import { randomBytes } from "node:crypto";
import { ApiError, REASON_LABELS, RESOLUTION_LABELS, STATUS_LABELS } from "./return-validation.js";

export function jsonError(status, code, message) {
  return Response.json({ error: { code, message } }, { status });
}

export function errorResponse(error) {
  if (error instanceof ApiError) {
    return jsonError(error.status, error.code, error.message);
  }

  if (error?.code === "P2002") {
    return jsonError(409, "CONFLICT", "A request conflicts with an existing record.");
  }
  if (error?.code === "P2025") {
    return jsonError(404, "NOT_FOUND", "The requested record was not found.");
  }
  if (error?.code === "P2004") {
    return jsonError(409, "BUSINESS_RULE_VIOLATION", "The requested change violates a return request rule.");
  }
  if (error?.code === "P2003") {
    return jsonError(409, "RELATED_RECORD_CONFLICT", "The request conflicts with a related record.");
  }

  const message = String(error?.message || "");
  const sqlState = error?.meta?.code || error?.cause?.code || message.match(/PostgresError \{ code: "([0-9A-Z]+)"/)?.[1];
  if (sqlState === "23514") {
    return jsonError(409, "BUSINESS_RULE_VIOLATION", "The requested change violates a return request rule.");
  }
  if (sqlState === "23505") {
    return jsonError(409, "CONFLICT", "A request conflicts with an existing record.");
  }
  if (sqlState === "23503") {
    return jsonError(409, "RELATED_RECORD_CONFLICT", "The request conflicts with a related record.");
  }

  return jsonError(500, "INTERNAL_SERVER_ERROR", "The server could not complete the request.");
}

export async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body must contain valid JSON.");
  }
}

export function newRequestReference() {
  const date = new Date();
  const datePart = [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("");
  const randomPart = randomBytes(3).toString("hex").toUpperCase();
  return `RET-${datePart}-${randomPart}`;
}

export function activeRequestWhere(identifier) {
  return {
    deletedAt: null,
    OR: [{ id: identifier }, { reference: identifier }],
  };
}

export function orderedNotes() {
  return { orderBy: [{ createdAt: "asc" }, { id: "asc" }] };
}

export function serializeRequest(request) {
  return {
    ...request,
    status: STATUS_LABELS[request.status] || request.status,
    reason: REASON_LABELS[request.reason] || request.reason,
    resolution: RESOLUTION_LABELS[request.resolution] || request.resolution,
    ...(request.notes ? { notes: request.notes } : {}),
  };
}
