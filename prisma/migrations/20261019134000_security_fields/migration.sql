-- AlterEnum
BEGIN;
CREATE TYPE "NotificationStatus_new" AS ENUM ('QUEUED', 'ACCEPTED', 'FAILED', 'SKIPPED');
ALTER TABLE "public"."NotificationLog" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "NotificationLog" ALTER COLUMN "status" TYPE "NotificationStatus_new" USING ("status"::text::"NotificationStatus_new");
ALTER TYPE "NotificationStatus" RENAME TO "NotificationStatus_old";
ALTER TYPE "NotificationStatus_new" RENAME TO "NotificationStatus";
DROP TYPE "public"."NotificationStatus_old";
ALTER TABLE "NotificationLog" ALTER COLUMN "status" SET DEFAULT 'QUEUED';
COMMIT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
