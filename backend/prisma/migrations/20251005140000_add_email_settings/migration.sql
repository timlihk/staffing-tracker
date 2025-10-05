-- CreateTable
CREATE TABLE "email_settings" (
    "id" SERIAL NOT NULL,
    "email_notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
    "notify_partner" BOOLEAN NOT NULL DEFAULT true,
    "notify_associate" BOOLEAN NOT NULL DEFAULT true,
    "notify_junior_flic" BOOLEAN NOT NULL DEFAULT true,
    "notify_senior_flic" BOOLEAN NOT NULL DEFAULT true,
    "notify_intern" BOOLEAN NOT NULL DEFAULT true,
    "notify_bc_working_attorney" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" INTEGER,

    CONSTRAINT "email_settings_pkey" PRIMARY KEY ("id")
);
