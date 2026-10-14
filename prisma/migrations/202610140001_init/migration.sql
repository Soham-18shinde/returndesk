CREATE TYPE "RequestStatus" AS ENUM ('Open', 'InReview', 'Approved', 'Rejected', 'Completed');
CREATE TYPE "RequestReason" AS ENUM ('Damaged', 'WrongItem', 'SizeIssue', 'NotAsDescribed', 'ChangedMind');
CREATE TYPE "Resolution" AS ENUM ('Refund', 'Replacement', 'StoreCredit');

CREATE TABLE "return_requests" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "customerContact" TEXT NOT NULL,
  "orderNumber" TEXT NOT NULL,
  "itemName" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "reason" "RequestReason" NOT NULL,
  "status" "RequestStatus" NOT NULL DEFAULT 'Open',
  "resolution" "Resolution",
  "refundAmount" DECIMAL(10,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "return_requests_quantity_positive" CHECK ("quantity" > 0),
  CONSTRAINT "return_requests_decision_requires_resolution" CHECK (
    "status" NOT IN ('Approved', 'Completed') OR "resolution" IS NOT NULL
  ),
  CONSTRAINT "return_requests_refund_matches_resolution" CHECK (
    ("resolution" = 'Refund' AND "refundAmount" IS NOT NULL AND "refundAmount" > 0)
    OR ("resolution" IS DISTINCT FROM 'Refund' AND "refundAmount" IS NULL)
  )
);

CREATE UNIQUE INDEX "return_requests_reference_key" ON "return_requests"("reference");
CREATE INDEX "return_requests_deletedAt_createdAt_idx" ON "return_requests"("deletedAt", "createdAt");
CREATE INDEX "return_requests_status_reason_createdAt_idx" ON "return_requests"("status", "reason", "createdAt");
CREATE INDEX "return_requests_orderNumber_itemName_idx" ON "return_requests"("orderNumber", "itemName");
CREATE UNIQUE INDEX "return_requests_one_live_order_item"
  ON "return_requests"("orderNumber", "itemName")
  WHERE "deletedAt" IS NULL AND "status" NOT IN ('Rejected', 'Completed');

CREATE TABLE "return_notes" (
  "id" TEXT NOT NULL,
  "return_request_id" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "return_notes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "return_notes_return_request_id_fkey"
    FOREIGN KEY ("return_request_id") REFERENCES "return_requests"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "return_notes_return_request_id_created_at_idx"
  ON "return_notes"("return_request_id", "created_at");

CREATE FUNCTION "enforce_return_request_rules"() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Return requests cannot be hard-deleted; set deletedAt instead.'
      USING ERRCODE = '23514';
  END IF;

  IF OLD."status" IS DISTINCT FROM NEW."status" AND NOT (
    (OLD."status" = 'Open' AND NEW."status" = 'InReview') OR
    (OLD."status" = 'InReview' AND NEW."status" IN ('Approved', 'Rejected')) OR
    (OLD."status" = 'Approved' AND NEW."status" = 'Completed')
  ) THEN
    RAISE EXCEPTION 'Invalid return request status transition.'
      USING ERRCODE = '23514';
  END IF;

  IF OLD."deletedAt" IS NULL AND NEW."deletedAt" IS NOT NULL AND
     OLD."status" NOT IN ('Open', 'Rejected') THEN
    RAISE EXCEPTION 'Only Open or Rejected requests can be removed.'
      USING ERRCODE = '23514';
  END IF;

  IF (OLD."status" IN ('Approved', 'Rejected', 'Completed') OR
      NEW."status" IN ('Approved', 'Rejected', 'Completed')) AND (
    OLD."customerName" IS DISTINCT FROM NEW."customerName" OR
    OLD."customerContact" IS DISTINCT FROM NEW."customerContact" OR
    OLD."orderNumber" IS DISTINCT FROM NEW."orderNumber" OR
    OLD."itemName" IS DISTINCT FROM NEW."itemName" OR
    OLD."quantity" IS DISTINCT FROM NEW."quantity" OR
    OLD."reason" IS DISTINCT FROM NEW."reason"
  ) THEN
    RAISE EXCEPTION 'Customer and item details are locked after a decision.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "return_requests_rules_trigger"
  BEFORE UPDATE OR DELETE ON "return_requests"
  FOR EACH ROW EXECUTE FUNCTION "enforce_return_request_rules"();

CREATE FUNCTION "prevent_return_note_mutation"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Return notes are append-only.' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "return_notes_append_only_trigger"
  BEFORE UPDATE OR DELETE ON "return_notes"
  FOR EACH ROW EXECUTE FUNCTION "prevent_return_note_mutation"();
