CREATE TABLE "erp_user_roles" (
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"granted_by_user_id" uuid NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "erp_user_roles_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "erp_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"title" text,
	"password_hash" text NOT NULL,
	"password_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	CONSTRAINT "erp_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "erp_user_roles" ADD CONSTRAINT "erp_user_roles_user_id_erp_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."erp_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_user_roles" ADD CONSTRAINT "erp_user_roles_granted_by_user_id_erp_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."erp_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DROP TYPE "public"."user_role";