-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "lockoutDurationMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "lockoutMaxAttempts" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "passwordMinLength" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "refreshTokenTtlDays" INTEGER NOT NULL DEFAULT 7;
