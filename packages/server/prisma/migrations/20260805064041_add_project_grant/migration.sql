-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "projectId" TEXT;

-- CreateTable
CREATE TABLE "project_grants" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "grantedByUserId" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "project_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_grants_licenseId_idx" ON "project_grants"("licenseId");

-- CreateIndex
CREATE INDEX "project_grants_projectId_idx" ON "project_grants"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "project_grants_projectId_licenseId_key" ON "project_grants"("projectId", "licenseId");

-- CreateIndex
CREATE INDEX "devices_projectId_idx" ON "devices"("projectId");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_grants" ADD CONSTRAINT "project_grants_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_grants" ADD CONSTRAINT "project_grants_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_grants" ADD CONSTRAINT "project_grants_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

