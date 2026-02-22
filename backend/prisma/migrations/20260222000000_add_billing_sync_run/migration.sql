-- CreateTable
CREATE TABLE "billing_sync_run" (
    "id" SERIAL NOT NULL,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by" INTEGER,
    "excel_filename" TEXT NOT NULL,
    "excel_file" BYTEA NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "summary_json" JSONB NOT NULL,
    "changes_json" JSONB NOT NULL,
    "staffing_links_json" JSONB,
    "error_message" TEXT,

    CONSTRAINT "billing_sync_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_sync_run_uploaded" ON "billing_sync_run"("uploaded_at" DESC);

-- AddForeignKey
ALTER TABLE "billing_sync_run" ADD CONSTRAINT "billing_sync_run_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
