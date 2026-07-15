-- Gmail attachment IDs are opaque and may be longer than 255 characters.
ALTER TABLE "attachments"
  ALTER COLUMN "gmail_attachment_id" TYPE TEXT;
