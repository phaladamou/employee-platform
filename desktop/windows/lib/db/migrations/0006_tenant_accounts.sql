-- 0006_tenant_accounts : isolation multi-tenant stricte.
-- Les employes demo existants n'ont aucun proprietaire attribuable :
-- la regle tenant interdit les lignes globales, ils sont supprimes
-- (recrees proprement par provisioning/recrutement, scopes par compte).
DELETE FROM "Employee";
--> statement-breakpoint
DELETE FROM "Department" WHERE "id" IN ('marketing', 'research');
--> statement-breakpoint
INSERT INTO "Department" ("id") VALUES ('research-data'), ('operations');
--> statement-breakpoint
CREATE TABLE "Account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Mission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accountId" uuid NOT NULL,
	"employeeId" uuid NOT NULL,
	"title" text NOT NULL,
	"prompt" text NOT NULL,
	"status" varchar(24) DEFAULT 'queued' NOT NULL,
	"report" text,
	"kernelJobId" text,
	"expectFile" text,
	"expectTest" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "TalentProfile" (
	"spec" text PRIMARY KEY NOT NULL,
	"version" varchar(24) NOT NULL,
	"name" varchar(120) NOT NULL,
	"role" varchar(120) NOT NULL,
	"departmentId" text NOT NULL,
	"background" text NOT NULL,
	"allowedTools" json DEFAULT '[]'::json NOT NULL,
	"technologies" json DEFAULT '[]'::json NOT NULL,
	"createdBy" varchar(120) DEFAULT 'Cofoundator' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Employee" ADD COLUMN "accountId" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "Employee" ADD COLUMN "kind" varchar(16) DEFAULT 'hired' NOT NULL;--> statement-breakpoint
ALTER TABLE "Employee" ADD COLUMN "talentSpec" text;--> statement-breakpoint
ALTER TABLE "Employee" ADD COLUMN "specVersion" varchar(24);--> statement-breakpoint
ALTER TABLE "Employee" ADD COLUMN "kernelEmployeeId" uuid;--> statement-breakpoint
ALTER TABLE "Employee" ADD COLUMN "background" text;--> statement-breakpoint
ALTER TABLE "Employee" ADD COLUMN "createdBy" varchar(120);--> statement-breakpoint
ALTER TABLE "Employee" ADD COLUMN "technologies" json DEFAULT '[]'::json NOT NULL;--> statement-breakpoint
ALTER TABLE "Employee" ADD COLUMN "hiredAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
-- User.accountId en trois temps (les utilisateurs sont reels, pas des demos) :
-- colonne nullable, backfill un-compte-par-utilisateur, puis NOT NULL.
ALTER TABLE "User" ADD COLUMN "accountId" uuid;--> statement-breakpoint
UPDATE "User" SET "accountId" = gen_random_uuid() WHERE "accountId" IS NULL;--> statement-breakpoint
INSERT INTO "Account" ("id", "name") SELECT "accountId", "email" FROM "User";--> statement-breakpoint
ALTER TABLE "User" ALTER COLUMN "accountId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_accountId_Account_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_employeeId_Employee_id_fk" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TalentProfile" ADD CONSTRAINT "TalentProfile_departmentId_Department_id_fk" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "Mission_account_idx" ON "Mission" USING btree ("accountId");--> statement-breakpoint
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_accountId_Account_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "User" ADD CONSTRAINT "User_accountId_Account_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "Employee_account_idx" ON "Employee" USING btree ("accountId");--> statement-breakpoint
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_account_talent_uniq" UNIQUE("accountId","talentSpec");
