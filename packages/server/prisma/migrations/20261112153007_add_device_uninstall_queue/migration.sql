-- K2-F4: очередь офлайн-удалений и результат удаления с устройства
-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "pendingUninstall" JSONB;
ALTER TABLE "devices" ADD COLUMN     "uninstallResult" JSONB;
