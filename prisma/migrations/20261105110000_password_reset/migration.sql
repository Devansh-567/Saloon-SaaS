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
-- Forgot-password links (stored hashed, single use, short lived).
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
