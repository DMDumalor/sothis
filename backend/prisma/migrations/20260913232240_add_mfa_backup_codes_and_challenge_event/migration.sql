-- AlterEnum
ALTER TYPE "SecurityEventType" ADD VALUE 'MFA_CHALLENGE_FAILED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mfaBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];
