CREATE TABLE IF NOT EXISTS "link_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_slug" varchar(50) NOT NULL,
	"base_revision" integer NOT NULL,
	"proposer_id" uuid,
	"anonymous_hash" varchar(64),
	"proposer" text NOT NULL,
	"before" jsonb NOT NULL,
	"after" jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp(3) with time zone,
	"reviewer_id" uuid,
	"reviewer" text,
	"reason" text,
	"ip_hash" varchar(64) NOT NULL,
	"request_metadata" jsonb,
	CONSTRAINT "proposal_status" CHECK ("link_proposals"."status" in ('pending', 'approved', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "link_proposals" ADD CONSTRAINT "link_proposals_link_slug_links_slug_fk" FOREIGN KEY ("link_slug") REFERENCES "public"."links"("slug") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "link_proposals" ADD CONSTRAINT "link_proposals_proposer_id_users_id_fk" FOREIGN KEY ("proposer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "link_proposals" ADD CONSTRAINT "link_proposals_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_proposals_link_time" ON "link_proposals" USING btree ("link_slug","submitted_at","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_proposals_ip_time" ON "link_proposals" USING btree ("ip_hash","submitted_at");--> statement-breakpoint
CREATE FUNCTION bump_link_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.url, NEW.metadata, NEW.owner_id, NEW.deleted_at, NEW.is_public)
     IS DISTINCT FROM ROW(OLD.url, OLD.metadata, OLD.owner_id, OLD.deleted_at, OLD.is_public) THEN
    NEW.revision := OLD.revision + 1;
  ELSE
    NEW.revision := OLD.revision;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER links_revision BEFORE UPDATE ON links
FOR EACH ROW EXECUTE FUNCTION bump_link_revision();
--> statement-breakpoint
-- 提议仅由服务端数据库连接访问，Supabase 浏览器角色不能绕过 API 读私有详情。
ALTER TABLE link_proposals ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
DECLARE browser_role text;
BEGIN
  FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = browser_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE link_proposals FROM %I', browser_role);
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON TABLE users FROM %I', browser_role);
    END IF;
  END LOOP;
END;
$$;
