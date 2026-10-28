-- No data backfill: the database is wiped and re-created fresh at cutover (user decision, Oct 2026).
ALTER TABLE "heartfulness_sitting"."users" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "heartfulness_sitting"."users" ADD COLUMN "first_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "heartfulness_sitting"."users" ADD COLUMN "last_name" text;--> statement-breakpoint
ALTER TABLE "heartfulness_sitting"."users" ADD COLUMN "deactivated_at" timestamp with time zone;