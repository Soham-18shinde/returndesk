export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const STATUS_VALUES = ["Open", "InReview", "Approved", "Rejected", "Completed"];
export const REASON_VALUES = ["Damaged", "WrongItem", "SizeIssue", "NotAsDescribed", "ChangedMind"];
export const RESOLUTION_VALUES = ["Refund", "Replacement", "StoreCredit"];
export const RESOLUTION_LABELS = {
  Refund: "Refund",
  Replacement: "Replacement",
  StoreCredit: "Store Credit",
};

export const STATUS_LABELS = {
  Open: "Open",
  InReview: "In Review",
  Approved: "Approved",
  Rejected: "Rejected",
  Completed: "Completed",
};

export const REASON_LABELS = {
  Damaged: "Damaged",
  WrongItem: "Wrong Item",
  SizeIssue: "Size Issue",
  NotAsDescribed: "Not As Described",
  ChangedMind: "Changed Mind",
};

const STATUS_INPUTS = Object.fromEntries(
  Object.entries(STATUS_LABELS).flatMap(([value, label]) => [[value, value], [label, value]])
);
const REASON_INPUTS = Object.fromEntries(
  Object.entries(REASON_LABELS).flatMap(([value, label]) => [[value, value], [label, value]])
);
const DETAIL_FIELDS = [
  "customerName",
  "customerContact",
  "orderNumber",
  "itemName",
  "quantity",
  "reason",
];
const PATCH_FIELDS = new Set([...DETAIL_FIELDS, "status", "resolution", "refundAmount"]);
const CREATE_FIELDS = new Set([
  "customerName",
  "customerContact",
  "orderNumber",
  "itemName",
  "quantity",
  "reason",
]);
const TRANSITIONS = {
  Open: ["InReview"],
  InReview: ["Approved", "Rejected"],
  Approved: ["Completed"],
  Rejected: [],
  Completed: [],
};

function requireObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "INVALID_BODY", "The request body must be a JSON object.");
  }
  return value;
}

function rejectUnknownFields(body, allowedFields) {
  const unknown = Object.keys(body).filter((key) => !allowedFields.has(key));
  if (unknown.length) {
    throw new ApiError(400, "UNKNOWN_FIELD", `Unsupported field: ${unknown[0]}.`);
  }
}

function requiredText(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(422, "INVALID_FIELD", `${field} must be a non-empty string.`);
  }
  return value.trim();
}

export function normalizeStatus(value) {
  const status = typeof value === "string" ? STATUS_INPUTS[value.trim()] : undefined;
  if (!status) {
    throw new ApiError(422, "INVALID_STATUS", "Status must be Open, In Review, Approved, Rejected, or Completed.");
  }
  return status;
}

export function normalizeReason(value) {
  const reason = typeof value === "string" ? REASON_INPUTS[value.trim()] : undefined;
  if (!reason) {
    throw new ApiError(422, "INVALID_REASON", "Reason must be Damaged, Wrong Item, Size Issue, Not As Described, or Changed Mind.");
  }
  return reason;
}

function parseResolution(value) {
  if (value === null) return null;
  if (value === "Store Credit") return "StoreCredit";
  if (typeof value !== "string" || !RESOLUTION_VALUES.includes(value)) {
    throw new ApiError(422, "INVALID_RESOLUTION", "Resolution must be Refund, Replacement, or Store Credit.");
  }
  return value;
}

function parseRefundAmount(value) {
  if (value === null) return null;
  if ((typeof value !== "number" && typeof value !== "string") || String(value).trim() === "") {
    throw new ApiError(422, "INVALID_REFUND_AMOUNT", "Refund amount must be a positive number or null.");
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 99999999.99 || !/^\d+(\.\d{1,2})?$/.test(String(value))) {
    throw new ApiError(422, "INVALID_REFUND_AMOUNT", "Refund amount must be positive and have no more than two decimal places.");
  }
  return String(value);
}

export function validateResolutionPair(status, resolution, refundAmount) {
  if ((status === "Approved" || status === "Completed") && !resolution) {
    throw new ApiError(422, "RESOLUTION_REQUIRED", "Approval requires a resolution.");
  }
  if (resolution === "Refund") {
    if (refundAmount === null || Number(refundAmount) <= 0) {
      throw new ApiError(422, "REFUND_AMOUNT_REQUIRED", "Refund resolution requires an amount greater than zero.");
    }
  } else if (refundAmount !== null) {
    throw new ApiError(422, "REFUND_AMOUNT_NOT_ALLOWED", "Only a Refund resolution may have a refund amount.");
  }
}

export function parseCreatePayload(value) {
  const body = requireObject(value);
  rejectUnknownFields(body, CREATE_FIELDS);
  const quantity = body.quantity;
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new ApiError(422, "INVALID_QUANTITY", "Quantity must be a positive integer.");
  }
  return {
    customerName: requiredText(body.customerName, "customerName"),
    customerContact: requiredText(body.customerContact, "customerContact"),
    orderNumber: requiredText(body.orderNumber, "orderNumber"),
    itemName: requiredText(body.itemName, "itemName"),
    quantity,
    reason: normalizeReason(body.reason),
  };
}

export function parsePatchPayload(value) {
  const body = requireObject(value);
  rejectUnknownFields(body, PATCH_FIELDS);
  if (!Object.keys(body).length) {
    throw new ApiError(400, "EMPTY_UPDATE", "Provide at least one field to update.");
  }

  const patch = {};
  for (const field of ["customerName", "customerContact", "orderNumber", "itemName"]) {
    if (Object.hasOwn(body, field)) patch[field] = requiredText(body[field], field);
  }
  if (Object.hasOwn(body, "quantity")) {
    if (!Number.isInteger(body.quantity) || body.quantity <= 0) {
      throw new ApiError(422, "INVALID_QUANTITY", "Quantity must be a positive integer.");
    }
    patch.quantity = body.quantity;
  }
  if (Object.hasOwn(body, "reason")) patch.reason = normalizeReason(body.reason);
  if (Object.hasOwn(body, "status")) patch.status = normalizeStatus(body.status);
  if (Object.hasOwn(body, "resolution")) patch.resolution = parseResolution(body.resolution);
  if (Object.hasOwn(body, "refundAmount")) patch.refundAmount = parseRefundAmount(body.refundAmount);
  return patch;
}

export function parseNotePayload(value) {
  const body = requireObject(value);
  rejectUnknownFields(body, new Set(["body"]));
  return { body: requiredText(body.body, "body") };
}

export function parseListQuery(searchParams) {
  const allowed = new Set(["search", "status", "reason", "sortBy", "sortOrder", "page", "pageSize"]);
  for (const key of searchParams.keys()) {
    if (!allowed.has(key)) throw new ApiError(400, "UNKNOWN_QUERY", `Unsupported query parameter: ${key}.`);
    if (searchParams.getAll(key).length > 1) throw new ApiError(400, "DUPLICATE_QUERY", `Query parameter ${key} may only be supplied once.`);
  }

  const search = searchParams.get("search")?.trim() || "";
  const status = searchParams.has("status") ? normalizeStatus(searchParams.get("status")) : null;
  const reason = searchParams.has("reason") ? normalizeReason(searchParams.get("reason")) : null;
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortOrder = searchParams.get("sortOrder") || "desc";
  if (!["createdAt", "updatedAt", "reference", "status", "reason", "customerName", "orderNumber"].includes(sortBy)) {
    throw new ApiError(422, "INVALID_SORT", "sortBy is not supported.");
  }
  if (!['asc', 'desc'].includes(sortOrder)) {
    throw new ApiError(422, "INVALID_SORT_ORDER", "sortOrder must be asc or desc.");
  }
  const page = parsePositiveInteger(searchParams.get("page"), 1, "page");
  const pageSize = parsePositiveInteger(searchParams.get("pageSize"), 10, "pageSize");
  if (pageSize > 100) throw new ApiError(422, "INVALID_PAGE_SIZE", "pageSize must be between 1 and 100.");
  if (!Number.isSafeInteger((page - 1) * pageSize)) {
    throw new ApiError(422, "INVALID_PAGINATION", "The requested page is too large.");
  }
  return { search, status, reason, sortBy, sortOrder, page, pageSize };
}

function parsePositiveInteger(value, fallback, field) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
    throw new ApiError(422, "INVALID_PAGINATION", `${field} must be a positive integer.`);
  }
  return Number(value);
}

export function isDetailsField(field) {
  return DETAIL_FIELDS.includes(field);
}

export function isLegalTransition(from, to) {
  return from === to || TRANSITIONS[from]?.includes(to) === true;
}
