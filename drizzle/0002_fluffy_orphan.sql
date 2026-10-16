ALTER TABLE "users" ADD COLUMN "salary" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "support_salary" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "overtime_salary" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pocket_money" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bank" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_number" varchar(50);--> statement-breakpoint
UPDATE "users" SET "bank" = '' WHERE "bank" IS NULL;--> statement-breakpoint
UPDATE "users" SET "account_number" = '' WHERE "account_number" IS NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "bank" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "account_number" SET NOT NULL;
