CREATE TABLE "WorkspaceFile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accountId" uuid NOT NULL,
	"employeeId" uuid NOT NULL,
	"path" text NOT NULL,
	"content" text NOT NULL,
	"size" integer NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"missionId" uuid,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "WorkspaceFile_account_employee_path_uniq" UNIQUE("accountId","employeeId","path")
);
--> statement-breakpoint
ALTER TABLE "WorkspaceFile" ADD CONSTRAINT "WorkspaceFile_accountId_Account_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "WorkspaceFile" ADD CONSTRAINT "WorkspaceFile_employeeId_Employee_id_fk" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "WorkspaceFile" ADD CONSTRAINT "WorkspaceFile_missionId_Mission_id_fk" FOREIGN KEY ("missionId") REFERENCES "public"."Mission"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "WorkspaceFile_account_employee_idx" ON "WorkspaceFile" USING btree ("accountId","employeeId");