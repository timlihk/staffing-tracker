-- CreateTable
CREATE TABLE IF NOT EXISTS "app_settings" (
    "id" SERIAL NOT NULL,
    "enable_data_export" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" INTEGER,
    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);
