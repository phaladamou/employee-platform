ALTER TABLE "WorkspaceFile" DROP CONSTRAINT "WorkspaceFile_account_employee_path_uniq";--> statement-breakpoint
DROP INDEX "WorkspaceFile_account_employee_idx";--> statement-breakpoint
ALTER TABLE "WorkspaceFile" ADD COLUMN "chatId" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "WorkspaceFile" ADD CONSTRAINT "WorkspaceFile_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "WorkspaceFile_account_employee_chat_idx" ON "WorkspaceFile" USING btree ("accountId","employeeId","chatId");--> statement-breakpoint
ALTER TABLE "WorkspaceFile" ADD CONSTRAINT "WorkspaceFile_account_employee_chat_path_uniq" UNIQUE("accountId","employeeId","chatId","path");