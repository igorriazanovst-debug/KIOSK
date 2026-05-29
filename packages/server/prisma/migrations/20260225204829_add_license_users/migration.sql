-- CreateEnum
CREATE TYPE "LicenseUserRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateTable
CREATE TABLE "license_users" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "LicenseUserRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "license_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "license_users_email_key" ON "license_users"("email");

-- CreateIndex
CREATE INDEX "license_users_email_idx" ON "license_users"("email");

-- CreateIndex
CREATE INDEX "license_users_licenseId_idx" ON "license_users"("licenseId");

-- AddForeignKey
ALTER TABLE "license_users" ADD CONSTRAINT "license_users_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "licenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
