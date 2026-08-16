-- Accounts and sessions.
--
-- Kept apart from `staff` and `members`: those describe people the gym deals
-- with and outlive any login, whereas an account is a credential that can be
-- revoked without erasing a departed trainer's classes or a cancelled member's
-- payments.
--
-- `role` carries one of the four values the shell already reshapes itself
-- around — owner, front_desk, trainer, member — so a signed-in account lands on
-- the screen the role switcher would have shown.
--
-- Apply BEFORE deploying the code that reads these tables:
--   pnpm wrangler d1 execute flexfit-studio --remote --file=./server/db/migrations/0005_accounts.sql

CREATE TABLE IF NOT EXISTS `accounts` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `name` text NOT NULL,
  `role` text NOT NULL,
  `password_hash` text NOT NULL,
  `password_salt` text NOT NULL,
  `gym` text,
  `created_at` text NOT NULL
);

-- Unique, not merely indexed: this constraint is what makes a duplicate signup
-- fail at the storage layer rather than in a check-then-insert race.
CREATE UNIQUE INDEX IF NOT EXISTS `accounts_email_idx` ON `accounts` (`email`);

CREATE TABLE IF NOT EXISTS `sessions` (
  `token` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `created_at` text NOT NULL,
  `expires_at` text NOT NULL,
  FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `sessions_account_idx` ON `sessions` (`account_id`);
