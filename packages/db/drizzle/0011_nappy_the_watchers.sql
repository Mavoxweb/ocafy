CREATE TABLE "legal_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"document" text NOT NULL,
	"version" text NOT NULL,
	"content_hash" text NOT NULL,
	"context" text NOT NULL,
	"subject" text,
	"accepted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "legal_acceptances_user_idx" ON "legal_acceptances" USING btree ("user_id","document","version");
--> statement-breakpoint
INSERT INTO "feature_flags" ("key", "enabled", "description") VALUES
  ('legal_gate', false, 'Exige novo aceite dos Termos/Política de quem já usa o app (ligar só depois da revisão jurídica)')
ON CONFLICT ("key") DO NOTHING;
