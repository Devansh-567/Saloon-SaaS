-- Copyright (c) 2026 Devansh Singh
-- All Rights Reserved.
--
-- This software and its source code are proprietary
-- and confidential property of Guru AI Technologies.
--
-- Unauthorized copying, modification, distribution,
-- or use of this software, in whole or in part,
-- is strictly prohibited without prior written
-- permission from Guru AI Technologies.
--
-- Copyright (c) 2026 Devansh Singh
-- All Rights Reserved.
--
-- This software and its source code are proprietary
-- and confidential property of Guru AI Technologies.
--
-- Unauthorized copying, modification, distribution,
-- or use of this software, in whole or in part,
-- is strictly prohibited without prior written
-- permission from Guru AI Technologies.
--
CREATE OR REPLACE FUNCTION check_appointment_overlap() RETURNS trigger AS $$
BEGIN
  IF NEW."status" IN ('SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS') THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW."staffMembershipId"));
    IF EXISTS (
      SELECT 1 FROM "Appointment" a
      WHERE a."staffMembershipId" = NEW."staffMembershipId"
        AND a."id" <> NEW."id"
        AND a."status" IN ('SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
        AND a."startAt" < NEW."endAt"
        AND a."endAt" > NEW."startAt"
    ) THEN
      RAISE EXCEPTION 'appointment_overlap' USING ERRCODE = '23P01';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER appointment_no_overlap
BEFORE INSERT OR UPDATE OF "startAt", "endAt", "staffMembershipId", "status" ON "Appointment"
FOR EACH ROW EXECUTE FUNCTION check_appointment_overlap();
