-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CentreStatus" AS ENUM ('ACTIVE', 'PENDING_REVIEW', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('NORMAL', 'SPECIAL');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('RECEIVED', 'FORWARDED_TO_MANAGER', 'MANAGER_APPROVED', 'WAITING_MARKETING_APPROVAL', 'MARKETING_RECOMMENDED', 'FINAL_APPROVED', 'SENT_TO_CENTRE', 'SENT_TO_FINANCE', 'PAID');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('NOT_REQUIRED', 'REQUIRED', 'IN_REVIEW', 'RESOLVED');

-- CreateEnum
CREATE TYPE "BeneficiaryType" AS ENUM ('DOCTOR', 'AMBULANCE_DRIVER', 'KOL', 'HOSPITAL_STAFF', 'OTHER');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('REFERRAL_NOTE', 'CATHLAB_NOTE', 'PRESCRIPTION', 'PTCA_NOTE', 'OTHER');

-- CreateEnum
CREATE TYPE "AttachmentStorageStatus" AS ENUM ('PENDING', 'ARCHIVED', 'FAILED');

-- CreateEnum
CREATE TYPE "AttachmentExtractionStatus" AS ENUM ('PENDING', 'EXTRACTED', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "DetectionMethod" AS ENUM ('RULES', 'AI', 'MANUAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SyncTrigger" AS ENUM ('CRON', 'MANUAL', 'RECOVERY');

-- CreateEnum
CREATE TYPE "SyncRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ExtractionOperation" AS ENUM ('CANDIDATE_CLASSIFICATION', 'REQUEST_EXTRACTION', 'APPROVAL_DETECTION');

-- CreateEnum
CREATE TYPE "ExtractionRunStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExportJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "centres" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "normalized_name" VARCHAR(160) NOT NULL,
    "status" "CentreStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "centres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "centre_aliases" (
    "id" UUID NOT NULL,
    "centre_id" UUID NOT NULL,
    "alias" VARCHAR(160) NOT NULL,
    "normalized_alias" VARCHAR(160) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "centre_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gmail_threads" (
    "id" UUID NOT NULL,
    "gmail_thread_id" VARCHAR(128) NOT NULL,
    "subject" TEXT,
    "latest_gmail_message_id" VARCHAR(128),
    "latest_history_id" VARCHAR(128),
    "last_synced_at" TIMESTAMPTZ(6),
    "raw_metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gmail_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gmail_messages" (
    "id" UUID NOT NULL,
    "gmail_thread_record_id" UUID NOT NULL,
    "gmail_message_id" VARCHAR(128) NOT NULL,
    "internet_message_id" TEXT,
    "from_name" VARCHAR(255),
    "from_address" VARCHAR(320),
    "to_recipients" JSONB,
    "cc_recipients" JSONB,
    "subject" TEXT,
    "sent_at" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL,
    "body_text" TEXT,
    "body_html" TEXT,
    "headers" JSONB,
    "gmail_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gmail_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requests" (
    "id" UUID NOT NULL,
    "gmail_thread_record_id" UUID NOT NULL,
    "source_gmail_message_record_id" UUID NOT NULL,
    "centre_id" UUID,
    "subject" TEXT NOT NULL,
    "centre_raw" VARCHAR(160),
    "patient_name" VARCHAR(255),
    "procedure" VARCHAR(255),
    "procedure_details" TEXT,
    "discharge_date" DATE,
    "payment_type" VARCHAR(100),
    "referral_hospital" VARCHAR(255),
    "referral_detail" TEXT,
    "total_referral_amount" DECIMAL(12,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "request_type" "RequestType",
    "status" "RequestStatus" NOT NULL DEFAULT 'RECEIVED',
    "review_status" "ReviewStatus" NOT NULL DEFAULT 'REQUIRED',
    "extraction_confidence" DECIMAL(5,4),
    "extraction_summary" JSONB,
    "received_at" TIMESTAMPTZ(6) NOT NULL,
    "gmail_url" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficiaries" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "type" "BeneficiaryType" NOT NULL DEFAULT 'OTHER',
    "custom_type" VARCHAR(100),
    "name" VARCHAR(255),
    "contact" VARCHAR(64),
    "referral_amount" DECIMAL(12,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "confidence" DECIMAL(5,4),
    "source_evidence" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "beneficiaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "gmail_message_record_id" UUID NOT NULL,
    "gmail_attachment_id" VARCHAR(255) NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" VARCHAR(255) NOT NULL,
    "size_bytes" INTEGER,
    "sha256" VARCHAR(64),
    "is_inline" BOOLEAN NOT NULL DEFAULT false,
    "type" "AttachmentType" NOT NULL DEFAULT 'OTHER',
    "storage_status" "AttachmentStorageStatus" NOT NULL DEFAULT 'PENDING',
    "extraction_status" "AttachmentExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "google_drive_file_id" VARCHAR(255),
    "preview_available" BOOLEAN NOT NULL DEFAULT false,
    "classification_confidence" DECIMAL(5,4),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "source_gmail_message_record_id" UUID,
    "status" "RequestStatus" NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "detection_method" "DetectionMethod" NOT NULL,
    "confidence" DECIMAL(5,4),
    "evidence" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" UUID NOT NULL,
    "key" VARCHAR(160) NOT NULL,
    "value" JSONB,
    "encrypted_value" TEXT,
    "is_secret" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" UUID NOT NULL,
    "trigger" "SyncTrigger" NOT NULL,
    "status" "SyncRunStatus" NOT NULL DEFAULT 'RUNNING',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "history_cursor_before" VARCHAR(128),
    "history_cursor_after" VARCHAR(128),
    "candidate_count" INTEGER NOT NULL DEFAULT 0,
    "thread_count" INTEGER NOT NULL DEFAULT 0,
    "request_created_count" INTEGER NOT NULL DEFAULT 0,
    "request_updated_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "failed_item_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "error" JSONB,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extraction_runs" (
    "id" UUID NOT NULL,
    "request_id" UUID,
    "gmail_message_record_id" UUID,
    "operation" "ExtractionOperation" NOT NULL,
    "status" "ExtractionRunStatus" NOT NULL DEFAULT 'PENDING',
    "provider" VARCHAR(100) NOT NULL,
    "model" VARCHAR(160),
    "prompt_version" VARCHAR(100),
    "input_hash" VARCHAR(64) NOT NULL,
    "confidence" DECIMAL(5,4),
    "structured_output" JSONB,
    "field_confidence" JSONB,
    "error" JSONB,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "extraction_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_profiles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "template_drive_file_id" VARCHAR(255),
    "configuration" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "export_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_jobs" (
    "id" UUID NOT NULL,
    "export_profile_id" UUID NOT NULL,
    "status" "ExportJobStatus" NOT NULL DEFAULT 'QUEUED',
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "filename" TEXT,
    "google_drive_file_id" VARCHAR(255),
    "checksum" VARCHAR(64),
    "error" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "centres_normalized_name_key" ON "centres"("normalized_name");

-- CreateIndex
CREATE INDEX "centres_status_idx" ON "centres"("status");

-- CreateIndex
CREATE UNIQUE INDEX "centre_aliases_normalized_alias_key" ON "centre_aliases"("normalized_alias");

-- CreateIndex
CREATE INDEX "centre_aliases_centre_id_idx" ON "centre_aliases"("centre_id");

-- CreateIndex
CREATE UNIQUE INDEX "gmail_threads_gmail_thread_id_key" ON "gmail_threads"("gmail_thread_id");

-- CreateIndex
CREATE INDEX "gmail_threads_last_synced_at_idx" ON "gmail_threads"("last_synced_at");

-- CreateIndex
CREATE UNIQUE INDEX "gmail_messages_gmail_message_id_key" ON "gmail_messages"("gmail_message_id");

-- CreateIndex
CREATE INDEX "gmail_messages_gmail_thread_record_id_received_at_idx" ON "gmail_messages"("gmail_thread_record_id", "received_at");

-- CreateIndex
CREATE INDEX "gmail_messages_internet_message_id_idx" ON "gmail_messages"("internet_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "requests_gmail_thread_record_id_key" ON "requests"("gmail_thread_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "requests_source_gmail_message_record_id_key" ON "requests"("source_gmail_message_record_id");

-- CreateIndex
CREATE INDEX "requests_status_received_at_idx" ON "requests"("status", "received_at");

-- CreateIndex
CREATE INDEX "requests_centre_id_received_at_idx" ON "requests"("centre_id", "received_at");

-- CreateIndex
CREATE INDEX "requests_request_type_idx" ON "requests"("request_type");

-- CreateIndex
CREATE INDEX "requests_payment_type_idx" ON "requests"("payment_type");

-- CreateIndex
CREATE INDEX "requests_review_status_idx" ON "requests"("review_status");

-- CreateIndex
CREATE INDEX "requests_total_referral_amount_idx" ON "requests"("total_referral_amount");

-- CreateIndex
CREATE INDEX "beneficiaries_request_id_idx" ON "beneficiaries"("request_id");

-- CreateIndex
CREATE INDEX "beneficiaries_type_idx" ON "beneficiaries"("type");

-- CreateIndex
CREATE INDEX "beneficiaries_referral_amount_idx" ON "beneficiaries"("referral_amount");

-- CreateIndex
CREATE INDEX "attachments_request_id_idx" ON "attachments"("request_id");

-- CreateIndex
CREATE INDEX "attachments_sha256_idx" ON "attachments"("sha256");

-- CreateIndex
CREATE INDEX "attachments_type_idx" ON "attachments"("type");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_gmail_message_record_id_gmail_attachment_id_key" ON "attachments"("gmail_message_record_id", "gmail_attachment_id");

-- CreateIndex
CREATE INDEX "timeline_request_id_occurred_at_idx" ON "timeline"("request_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "timeline_request_id_source_gmail_message_record_id_status_key" ON "timeline"("request_id", "source_gmail_message_record_id", "status");

-- CreateIndex
CREATE INDEX "notes_request_id_created_at_idx" ON "notes"("request_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE INDEX "sync_logs_status_started_at_idx" ON "sync_logs"("status", "started_at");

-- CreateIndex
CREATE INDEX "extraction_runs_request_id_operation_started_at_idx" ON "extraction_runs"("request_id", "operation", "started_at");

-- CreateIndex
CREATE INDEX "extraction_runs_gmail_message_record_id_operation_started_a_idx" ON "extraction_runs"("gmail_message_record_id", "operation", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "export_profiles_name_key" ON "export_profiles"("name");

-- CreateIndex
CREATE INDEX "export_profiles_is_default_idx" ON "export_profiles"("is_default");

-- CreateIndex
CREATE INDEX "export_jobs_status_created_at_idx" ON "export_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "export_jobs_period_start_period_end_idx" ON "export_jobs"("period_start", "period_end");

-- AddForeignKey
ALTER TABLE "centre_aliases" ADD CONSTRAINT "centre_aliases_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "centres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gmail_messages" ADD CONSTRAINT "gmail_messages_gmail_thread_record_id_fkey" FOREIGN KEY ("gmail_thread_record_id") REFERENCES "gmail_threads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_gmail_thread_record_id_fkey" FOREIGN KEY ("gmail_thread_record_id") REFERENCES "gmail_threads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_source_gmail_message_record_id_fkey" FOREIGN KEY ("source_gmail_message_record_id") REFERENCES "gmail_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "centres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries" ADD CONSTRAINT "beneficiaries_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_gmail_message_record_id_fkey" FOREIGN KEY ("gmail_message_record_id") REFERENCES "gmail_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline" ADD CONSTRAINT "timeline_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline" ADD CONSTRAINT "timeline_source_gmail_message_record_id_fkey" FOREIGN KEY ("source_gmail_message_record_id") REFERENCES "gmail_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_runs" ADD CONSTRAINT "extraction_runs_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_runs" ADD CONSTRAINT "extraction_runs_gmail_message_record_id_fkey" FOREIGN KEY ("gmail_message_record_id") REFERENCES "gmail_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_export_profile_id_fkey" FOREIGN KEY ("export_profile_id") REFERENCES "export_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddExtension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- AddConstraint
ALTER TABLE "requests" ADD CONSTRAINT "requests_total_referral_amount_nonnegative" CHECK ("total_referral_amount" IS NULL OR "total_referral_amount" >= 0);
ALTER TABLE "requests" ADD CONSTRAINT "requests_extraction_confidence_range" CHECK ("extraction_confidence" IS NULL OR ("extraction_confidence" >= 0 AND "extraction_confidence" <= 1));
ALTER TABLE "beneficiaries" ADD CONSTRAINT "beneficiaries_referral_amount_nonnegative" CHECK ("referral_amount" IS NULL OR "referral_amount" >= 0);
ALTER TABLE "beneficiaries" ADD CONSTRAINT "beneficiaries_confidence_range" CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1));
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_size_bytes_nonnegative" CHECK ("size_bytes" IS NULL OR "size_bytes" >= 0);
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_classification_confidence_range" CHECK ("classification_confidence" IS NULL OR ("classification_confidence" >= 0 AND "classification_confidence" <= 1));
ALTER TABLE "timeline" ADD CONSTRAINT "timeline_confidence_range" CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1));
ALTER TABLE "extraction_runs" ADD CONSTRAINT "extraction_runs_confidence_range" CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1));
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_period_valid" CHECK ("period_end" >= "period_start");
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_counts_nonnegative" CHECK (
    "candidate_count" >= 0 AND "thread_count" >= 0 AND "request_created_count" >= 0 AND
    "request_updated_count" >= 0 AND "skipped_duplicate_count" >= 0 AND "failed_item_count" >= 0
);

-- CreateIndex
CREATE INDEX "requests_patient_name_trgm_idx" ON "requests" USING GIN ("patient_name" gin_trgm_ops);
CREATE INDEX "requests_procedure_trgm_idx" ON "requests" USING GIN ("procedure" gin_trgm_ops);
CREATE INDEX "requests_referral_hospital_trgm_idx" ON "requests" USING GIN ("referral_hospital" gin_trgm_ops);
CREATE INDEX "beneficiaries_name_trgm_idx" ON "beneficiaries" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "beneficiaries_contact_trgm_idx" ON "beneficiaries" USING GIN ("contact" gin_trgm_ops);
