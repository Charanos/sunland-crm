import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, leases, tenantPayments, transactions } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import type { CallerContext } from "@/lib/services/types";
import { initiateStkPushSchema } from "@/lib/validation/payments";
import { parseInput } from "@/lib/validation/parse";

/**
 * Scaffold for the M-Pesa/Safaricom Daraja paybill integration (client call
 * note 2026-07-17, item 6: "Add paybills for payment integration, especially
 * for tenants"). No live Daraja credentials exist yet - see .env.example.
 * This module deliberately refuses to fabricate a successful payment when
 * unconfigured, rather than pretending the integration is live.
 *
 * There is also no tenant-facing session/auth in this codebase yet (the
 * tenant portal is its own separate, larger initiative - see
 * docs/SUNLAND_TENANT_LANDLORD_PORTALS_SPEC.md). Until that exists,
 * initiateTenantPayment is called by staff on the tenant's behalf (e.g. Front
 * Office recording a phone-initiated payment), not by the tenant directly.
 */
function isConfigured(): boolean {
  return Boolean(
    process.env.MPESA_CONSUMER_KEY &&
      process.env.MPESA_CONSUMER_SECRET &&
      process.env.MPESA_SHORTCODE &&
      process.env.MPESA_PASSKEY,
  );
}

/**
 * Would call Safaricom's OAuth + STK Push (Lipa Na M-Pesa Online) endpoints
 * once real credentials exist. Today it only creates the pending
 * tenant_payments row and stops - there is nothing to actually call.
 */
export async function initiateTenantPayment(ctx: CallerContext, rawInput: unknown) {
  const input = parseInput(initiateStkPushSchema, rawInput);

  const [lease] = await db.select().from(leases).where(eq(leases.id, input.leaseId)).limit(1);
  if (!lease) throw new NotFoundError("Lease not found");

  await authorize(ctx, "finance.transaction.write", lease.entityId);

  if (!isConfigured()) {
    throw new DomainValidationError(
      "M-Pesa paybill integration is not configured yet (MPESA_CONSUMER_KEY/SECRET/SHORTCODE/PASSKEY). " +
        "This payment cannot be initiated until real Safaricom Daraja credentials are provided.",
    );
  }

  // Real integration lands here once configured: request a Daraja OAuth
  // token, POST to /mpesa/stkpush/v1/processrequest with this lease's
  // amountKes/phoneNumber and MPESA_CALLBACK_URL, then persist the returned
  // CheckoutRequestID/MerchantRequestID onto the tenant_payments row created
  // below. Left unimplemented (not stubbed with fake success) because no
  // sandbox or production credentials exist to test against.
  const [payment] = await db
    .insert(tenantPayments)
    .values({
      entityId: lease.entityId,
      leaseId: lease.id,
      tenantContactId: lease.tenantContactId,
      method: "mpesa",
      amountKes: input.amountKes.toFixed(2),
      phoneNumber: input.phoneNumber,
      status: "pending",
    })
    .returning();

  return payment;
}

interface DarajaStkCallback {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{ Name: string; Value?: string | number }>;
      };
    };
  };
}

function extractMetadataValue(callback: DarajaStkCallback["Body"]["stkCallback"], name: string) {
  return callback.CallbackMetadata?.Item.find((item) => item.Name === name)?.Value;
}

/**
 * Safaricom's async STK push result callback. Real Daraja payload shape
 * (Body.stkCallback.{MerchantRequestID,CheckoutRequestID,ResultCode,...}) -
 * matched to the pending tenant_payments row via checkoutRequestId. On
 * success (ResultCode 0), reconciles into the real transactions ledger
 * through the one write path every other revenue transaction goes through
 * (recordTransaction's underlying insert), never a parallel balance.
 */
export async function handleMpesaCallback(rawPayload: unknown) {
  const payload = rawPayload as Partial<DarajaStkCallback>;
  const callback = payload?.Body?.stkCallback;
  if (!callback?.CheckoutRequestID) {
    throw new DomainValidationError("Malformed M-Pesa callback payload - missing Body.stkCallback.CheckoutRequestID.");
  }

  const [payment] = await db
    .select()
    .from(tenantPayments)
    .where(and(eq(tenantPayments.checkoutRequestId, callback.CheckoutRequestID), eq(tenantPayments.status, "pending")));

  if (!payment) {
    throw new NotFoundError(`No pending tenant_payments row found for CheckoutRequestID ${callback.CheckoutRequestID}`);
  }

  if (callback.ResultCode !== 0) {
    await db
      .update(tenantPayments)
      .set({ status: "failed", failureReason: callback.ResultDesc, updatedAt: new Date() })
      .where(eq(tenantPayments.id, payment.id));
    return { status: "failed" as const, reason: callback.ResultDesc };
  }

  const receiptNumber = extractMetadataValue(callback, "MpesaReceiptNumber");
  const confirmedAmount = extractMetadataValue(callback, "Amount");

  return db.transaction(async (tx) => {
    const [tx_] = await tx
      .insert(transactions)
      .values({
        entityId: payment.entityId,
        type: "rent",
        contactId: payment.tenantContactId,
        leaseId: payment.leaseId,
        amountKes: confirmedAmount != null ? String(confirmedAmount) : payment.amountKes,
        occurredAt: new Date(),
        notes: `M-Pesa payment${receiptNumber ? ` - receipt ${receiptNumber}` : ""}`,
      })
      .returning();

    const [updated] = await tx
      .update(tenantPayments)
      .set({
        status: "confirmed",
        externalRef: receiptNumber != null ? String(receiptNumber) : null,
        reconciledTransactionId: tx_.id,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tenantPayments.id, payment.id))
      .returning();

    // Not writeAudit(): this callback is invoked by Safaricom's servers, not
    // an authenticated staff CallerContext, so there's no real ctx.user.id to
    // attribute the action to. activityLogs.actorId is nullable precisely for
    // system-triggered events like this one - inserted directly rather than
    // fabricating a fake user id that would violate the actorId->users FK.
    await tx.insert(activityLogs).values({
      entityId: payment.entityId,
      actorId: null,
      action: "payments.mpesa.confirmed",
      associatedType: "tenant_payment",
      associatedId: payment.id,
      summary: `M-Pesa payment confirmed via Safaricom callback for lease ${payment.leaseId} (KES ${payment.amountKes}, receipt ${receiptNumber ?? "n/a"})`,
      beforeData: payment,
      afterData: updated,
    });

    return { status: "confirmed" as const, payment: updated, transaction: tx_ };
  });
}
