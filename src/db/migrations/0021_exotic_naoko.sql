CREATE TYPE "public"."tenant_payment_method" AS ENUM('mpesa', 'bank', 'cash', 'cheque');--> statement-breakpoint
CREATE TYPE "public"."tenant_payment_status" AS ENUM('pending', 'confirmed', 'failed', 'reversed');--> statement-breakpoint
CREATE TABLE "tenant_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"lease_id" uuid NOT NULL,
	"tenant_contact_id" uuid NOT NULL,
	"method" "tenant_payment_method" DEFAULT 'mpesa' NOT NULL,
	"amount_kes" numeric(14, 2) NOT NULL,
	"phone_number" text,
	"status" "tenant_payment_status" DEFAULT 'pending' NOT NULL,
	"checkout_request_id" text,
	"merchant_request_id" text,
	"external_ref" text,
	"reconciled_transaction_id" uuid,
	"confirmed_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_payments_checkout_request_id_unique" UNIQUE("checkout_request_id")
);
--> statement-breakpoint
ALTER TABLE "tenant_payments" ADD CONSTRAINT "tenant_payments_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_payments" ADD CONSTRAINT "tenant_payments_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_payments" ADD CONSTRAINT "tenant_payments_tenant_contact_id_contacts_id_fk" FOREIGN KEY ("tenant_contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_payments" ADD CONSTRAINT "tenant_payments_reconciled_transaction_id_transactions_id_fk" FOREIGN KEY ("reconciled_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_payments_entity_idx" ON "tenant_payments" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "tenant_payments_lease_idx" ON "tenant_payments" USING btree ("lease_id");--> statement-breakpoint
CREATE INDEX "tenant_payments_tenant_contact_idx" ON "tenant_payments" USING btree ("tenant_contact_id");--> statement-breakpoint
CREATE INDEX "tenant_payments_status_idx" ON "tenant_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tenant_payments_checkout_request_idx" ON "tenant_payments" USING btree ("checkout_request_id");