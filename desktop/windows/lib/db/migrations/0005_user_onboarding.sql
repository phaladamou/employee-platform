ALTER TABLE "User" ADD COLUMN "onboarded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "intent" varchar(24);--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "company" text;--> statement-breakpoint
UPDATE "User" SET "onboarded" = true;
