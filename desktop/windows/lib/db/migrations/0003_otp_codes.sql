CREATE TABLE "OtpCode" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(254) NOT NULL,
	"codeHash" varchar(64) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"usedAt" timestamp,
	"attempts" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "OtpCode_email_created_idx" ON "OtpCode" USING btree ("email","createdAt");
