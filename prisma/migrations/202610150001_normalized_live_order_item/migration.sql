DO $$
DECLARE
  duplicate_groups BIGINT;
BEGIN
  SELECT count(*)
  INTO duplicate_groups
  FROM (
    SELECT 1
    FROM "return_requests"
    WHERE "deletedAt" IS NULL
      AND "status" NOT IN ('Rejected', 'Completed')
    GROUP BY
      lower(regexp_replace("orderNumber", '^[[:space:]]+|[[:space:]]+$', '', 'g')),
      lower(regexp_replace("itemName", '^[[:space:]]+|[[:space:]]+$', '', 'g'))
    HAVING count(*) > 1
  ) AS duplicate_pairs;

  IF duplicate_groups > 0 THEN
    RAISE EXCEPTION
      'Cannot add normalized active order/item uniqueness: % duplicate group(s) already exist. Resolve conflicts before retrying.',
      duplicate_groups
      USING ERRCODE = '23505';
  END IF;
END;
$$;

CREATE UNIQUE INDEX "return_requests_one_live_order_item_normalized"
  ON "return_requests" (
    lower(regexp_replace("orderNumber", '^[[:space:]]+|[[:space:]]+$', '', 'g')),
    lower(regexp_replace("itemName", '^[[:space:]]+|[[:space:]]+$', '', 'g'))
  )
  WHERE "deletedAt" IS NULL AND "status" NOT IN ('Rejected', 'Completed');

DROP INDEX "return_requests_one_live_order_item";
