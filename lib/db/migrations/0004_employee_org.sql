CREATE TABLE "Department" (
	"id" text PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Employee" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"role" varchar(120) NOT NULL,
	"status" varchar(20) DEFAULT 'idle' NOT NULL,
	"departmentId" text NOT NULL,
	"currentTask" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_Department_id_fk" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "Employee_department_idx" ON "Employee" USING btree ("departmentId");
--> statement-breakpoint
INSERT INTO "Department" ("id") VALUES ('engineering'), ('marketing'), ('research');
--> statement-breakpoint
INSERT INTO "Employee" ("id", "name", "role", "status", "departmentId", "currentTask") VALUES
  ('11111111-1111-4111-8111-111111111111', 'Aria', 'Backend Developer', 'working', 'engineering', 'Refactoring the chat streaming pipeline'),
  ('22222222-2222-4222-8222-222222222222', 'Jules', 'Frontend Developer', 'working', 'engineering', 'Building the design system tokens'),
  ('33333333-3333-4333-8333-333333333333', 'Nova', 'QA Engineer', 'idle', 'engineering', NULL),
  ('44444444-4444-4444-8444-444444444444', 'Milo', 'Content Strategist', 'completed', 'marketing', NULL),
  ('55555555-5555-4555-8555-555555555555', 'Sana', 'SEO Analyst', 'working', 'marketing', 'Auditing landing page keywords'),
  ('66666666-6666-4666-8666-666666666666', 'Theo', 'Research Scientist', 'working', 'research', 'Benchmarking retrieval models'),
  ('77777777-7777-4777-8777-777777777777', 'Lena', 'Data Analyst', 'idle', 'research', NULL);