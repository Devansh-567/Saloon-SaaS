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
-- New salons default to Indian Rupees.
ALTER TABLE "Salon" ALTER COLUMN "currency" SET DEFAULT 'INR';
ALTER TABLE "Salon" ALTER COLUMN "locale" SET DEFAULT 'en-IN';

-- Existing salons still on the old untouched default (USD / en-US) are switched
-- to Rupees. Only the display currency changes; stored amounts are not altered.
UPDATE "Salon" SET "currency" = 'INR', "locale" = 'en-IN'
WHERE "currency" = 'USD' AND "locale" = 'en-US';
