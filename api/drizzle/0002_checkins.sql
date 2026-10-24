CREATE TABLE "heartfulness_sitting"."checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"abhyasi_id" uuid NOT NULL,
	"day" date NOT NULL,
	"mood" smallint NOT NULL,
	"practices" text[] DEFAULT '{}'::text[] NOT NULL,
	"insert_time" timestamp with time zone DEFAULT now() NOT NULL,
	"update_time" timestamp with time zone DEFAULT now() NOT NULL,
	"inserted_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "heartfulness_sitting"."checkins" ADD CONSTRAINT "checkins_abhyasi_id_users_id_fk" FOREIGN KEY ("abhyasi_id") REFERENCES "heartfulness_sitting"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "checkins_abhyasi_day_unique" ON "heartfulness_sitting"."checkins" USING btree ("abhyasi_id","day");