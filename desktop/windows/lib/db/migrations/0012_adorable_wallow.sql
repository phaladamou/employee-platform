ALTER TABLE "Chat" ADD COLUMN "employeeId" uuid;--> statement-breakpoint
ALTER TABLE "Message_v2" ADD COLUMN "missionId" uuid;--> statement-breakpoint
ALTER TABLE "Mission" ADD COLUMN "toolCalls" json DEFAULT '[]'::json NOT NULL;--> statement-breakpoint
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_employeeId_Employee_id_fk" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Message_v2" ADD CONSTRAINT "Message_v2_missionId_Mission_id_fk" FOREIGN KEY ("missionId") REFERENCES "public"."Mission"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_user_employee_uniq" UNIQUE("userId","employeeId");