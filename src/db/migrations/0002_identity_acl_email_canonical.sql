DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.users
    GROUP BY lower(btrim(email))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'public.users contains duplicate canonical emails; run identity ACL repair before applying unique_users_email_lower';
  END IF;
END $$;
--> statement-breakpoint
UPDATE public.users
SET email = lower(btrim(email))
WHERE email <> lower(btrim(email));
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_users_email_lower" ON "users" USING btree (lower("email"));
