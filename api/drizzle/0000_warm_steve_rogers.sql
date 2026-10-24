CREATE SCHEMA "heartfulness_sitting";
--> statement-breakpoint
CREATE TYPE "heartfulness_sitting"."booking_status" AS ENUM('booked', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "heartfulness_sitting"."cancelled_by" AS ENUM('abhyasi', 'preceptor');--> statement-breakpoint
CREATE TYPE "heartfulness_sitting"."role" AS ENUM('admin', 'preceptor', 'abhyasi');--> statement-breakpoint
CREATE TYPE "heartfulness_sitting"."visibility" AS ENUM('all', 'restricted');--> statement-breakpoint
CREATE TABLE "heartfulness_sitting"."bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slot_id" uuid NOT NULL,
	"abhyasi_id" uuid NOT NULL,
	"status" "heartfulness_sitting"."booking_status" DEFAULT 'booked' NOT NULL,
	"cancelled_by" "heartfulness_sitting"."cancelled_by",
	"insert_time" timestamp with time zone DEFAULT now() NOT NULL,
	"update_time" timestamp with time zone DEFAULT now() NOT NULL,
	"inserted_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "heartfulness_sitting"."preceptor_abhyasi_links" (
	"preceptor_id" uuid NOT NULL,
	"abhyasi_id" uuid NOT NULL,
	"insert_time" timestamp with time zone DEFAULT now() NOT NULL,
	"update_time" timestamp with time zone DEFAULT now() NOT NULL,
	"inserted_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "preceptor_abhyasi_links_preceptor_id_abhyasi_id_pk" PRIMARY KEY("preceptor_id","abhyasi_id")
);
--> statement-breakpoint
CREATE TABLE "heartfulness_sitting"."preceptor_pref" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"preceptor_id" uuid NOT NULL,
	"reminder_lead_hours" integer DEFAULT 8 NOT NULL,
	"insert_time" timestamp with time zone DEFAULT now() NOT NULL,
	"update_time" timestamp with time zone DEFAULT now() NOT NULL,
	"inserted_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "preceptor_pref_preceptor_id_unique" UNIQUE("preceptor_id")
);
--> statement-breakpoint
CREATE TABLE "heartfulness_sitting"."slot_visibility" (
	"slot_id" uuid NOT NULL,
	"abhyasi_id" uuid NOT NULL,
	"insert_time" timestamp with time zone DEFAULT now() NOT NULL,
	"update_time" timestamp with time zone DEFAULT now() NOT NULL,
	"inserted_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "slot_visibility_slot_id_abhyasi_id_pk" PRIMARY KEY("slot_id","abhyasi_id")
);
--> statement-breakpoint
CREATE TABLE "heartfulness_sitting"."slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"preceptor_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 45 NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"visibility" "heartfulness_sitting"."visibility" DEFAULT 'all' NOT NULL,
	"insert_time" timestamp with time zone DEFAULT now() NOT NULL,
	"update_time" timestamp with time zone DEFAULT now() NOT NULL,
	"inserted_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "heartfulness_sitting"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "heartfulness_sitting"."role" NOT NULL,
	"insert_time" timestamp with time zone DEFAULT now() NOT NULL,
	"update_time" timestamp with time zone DEFAULT now() NOT NULL,
	"inserted_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "heartfulness_sitting"."bookings" ADD CONSTRAINT "bookings_slot_id_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "heartfulness_sitting"."slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartfulness_sitting"."bookings" ADD CONSTRAINT "bookings_abhyasi_id_users_id_fk" FOREIGN KEY ("abhyasi_id") REFERENCES "heartfulness_sitting"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartfulness_sitting"."preceptor_abhyasi_links" ADD CONSTRAINT "preceptor_abhyasi_links_preceptor_id_users_id_fk" FOREIGN KEY ("preceptor_id") REFERENCES "heartfulness_sitting"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartfulness_sitting"."preceptor_abhyasi_links" ADD CONSTRAINT "preceptor_abhyasi_links_abhyasi_id_users_id_fk" FOREIGN KEY ("abhyasi_id") REFERENCES "heartfulness_sitting"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartfulness_sitting"."preceptor_pref" ADD CONSTRAINT "preceptor_pref_preceptor_id_users_id_fk" FOREIGN KEY ("preceptor_id") REFERENCES "heartfulness_sitting"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartfulness_sitting"."slot_visibility" ADD CONSTRAINT "slot_visibility_slot_id_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "heartfulness_sitting"."slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartfulness_sitting"."slot_visibility" ADD CONSTRAINT "slot_visibility_abhyasi_id_users_id_fk" FOREIGN KEY ("abhyasi_id") REFERENCES "heartfulness_sitting"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartfulness_sitting"."slots" ADD CONSTRAINT "slots_preceptor_id_users_id_fk" FOREIGN KEY ("preceptor_id") REFERENCES "heartfulness_sitting"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_active_unique" ON "heartfulness_sitting"."bookings" USING btree ("slot_id","abhyasi_id") WHERE "heartfulness_sitting"."bookings"."status" <> 'cancelled';