/*
  Warnings:

  - A unique constraint covering the columns `[assemblyId]` on the table `minutes` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "MinutesStatus" AS ENUM ('DRAFT', 'VALIDATED', 'PUBLISHED');

-- AlterTable
ALTER TABLE "minutes" ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "secretaryId" TEXT,
ADD COLUMN     "status" "MinutesStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "validatedAt" TIMESTAMP(3),
ADD COLUMN     "validatedBy" TEXT,
ALTER COLUMN "attendees" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "decisions" SET DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "minutes_assemblyId_key" ON "minutes"("assemblyId");

-- AddForeignKey
ALTER TABLE "minutes" ADD CONSTRAINT "minutes_secretaryId_fkey" FOREIGN KEY ("secretaryId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "minutes" ADD CONSTRAINT "minutes_validatedBy_fkey" FOREIGN KEY ("validatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
