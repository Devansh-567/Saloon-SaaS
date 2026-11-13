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
-- Razorpay payment link remembered on the bill so the same link is reused.
ALTER TABLE "Invoice" ADD COLUMN "onlineLinkId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "onlineLinkUrl" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "onlineLinkAmount" DECIMAL(12,2);
