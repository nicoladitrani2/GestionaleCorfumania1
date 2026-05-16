-- Drop unique constraint on user email to allow multiple accounts with the same email
DROP INDEX IF EXISTS "User_email_key";

-- Non-unique index for lookup performance
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");
