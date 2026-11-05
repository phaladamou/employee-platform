ALTER TABLE "Employee" RENAME COLUMN "releasedAt" TO "terminatedAt";
--> statement-breakpoint
UPDATE "Employee" SET "status" = 'terminated' WHERE "status" = 'released';
