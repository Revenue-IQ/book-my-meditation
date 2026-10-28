CREATE TABLE "heartfulness_sitting"."email_pref" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"receive_announcement" boolean DEFAULT true NOT NULL,
	"receive_confirmation" boolean DEFAULT true NOT NULL,
	"receive_cancellation" boolean DEFAULT true NOT NULL,
	"receive_reminder" boolean DEFAULT true NOT NULL,
	"insert_time" timestamp with time zone DEFAULT now() NOT NULL,
	"update_time" timestamp with time zone DEFAULT now() NOT NULL,
	"inserted_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "email_pref_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "heartfulness_sitting"."bookings" ADD COLUMN "reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "heartfulness_sitting"."bookings" ADD COLUMN "action_token" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "heartfulness_sitting"."preceptor_pref" ADD COLUMN "home_timezone" text DEFAULT 'Asia/Kolkata' NOT NULL;--> statement-breakpoint
ALTER TABLE "heartfulness_sitting"."preceptor_pref" ADD COLUMN "send_announcement" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "heartfulness_sitting"."preceptor_pref" ADD COLUMN "send_confirmation" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "heartfulness_sitting"."preceptor_pref" ADD COLUMN "send_cancellation" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "heartfulness_sitting"."preceptor_pref" ADD COLUMN "send_reminder" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "heartfulness_sitting"."slots" ADD COLUMN "announced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "heartfulness_sitting"."email_pref" ADD CONSTRAINT "email_pref_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "heartfulness_sitting"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartfulness_sitting"."bookings" ADD CONSTRAINT "bookings_action_token_unique" UNIQUE("action_token");