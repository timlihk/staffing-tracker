-- CreateTable
CREATE TABLE "project_change_history" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "field_name" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "change_type" TEXT NOT NULL,
    "changed_by" INTEGER,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_change_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_change_history" (
    "id" SERIAL NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "field_name" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "change_type" TEXT NOT NULL,
    "changed_by" INTEGER,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_change_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_change_history_project_id_idx" ON "project_change_history"("project_id");

-- CreateIndex
CREATE INDEX "project_change_history_changed_at_idx" ON "project_change_history"("changed_at" DESC);

-- CreateIndex
CREATE INDEX "staff_change_history_staff_id_idx" ON "staff_change_history"("staff_id");

-- CreateIndex
CREATE INDEX "staff_change_history_changed_at_idx" ON "staff_change_history"("changed_at" DESC);

-- AddForeignKey
ALTER TABLE "project_change_history" ADD CONSTRAINT "project_change_history_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_change_history" ADD CONSTRAINT "project_change_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_change_history" ADD CONSTRAINT "staff_change_history_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_change_history" ADD CONSTRAINT "staff_change_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
