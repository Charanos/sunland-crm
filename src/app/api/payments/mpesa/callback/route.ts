import { NextResponse } from "next/server";
import { handleMpesaCallback } from "@/lib/services/payments/mpesa";

/**
 * Safaricom Daraja's STK push result webhook - called by Safaricom's servers,
 * never by an authenticated Sunland user, so this route intentionally does
 * NOT go through requireCallerContext. Scaffold only (no live traffic will
 * reach this until MPESA_CALLBACK_URL is registered with a real Daraja app).
 *
 * Security note for whoever wires this up for real: Daraja does not sign
 * callback payloads, so production deployments should additionally verify
 * the request originates from Safaricom's published IP range and/or embed a
 * hard-to-guess token in MPESA_CALLBACK_URL's path - neither is implemented
 * here since there's no live endpoint to protect yet.
 *
 * Daraja always expects a 200 response with this exact acknowledgment shape
 * regardless of internal outcome - returning anything else causes Safaricom
 * to retry the callback.
 */
export async function POST(request: Request) {
  const ACK = { ResultCode: 0, ResultDesc: "Success" };

  try {
    const payload = await request.json();
    await handleMpesaCallback(payload);
  } catch (error) {
    console.error("M-Pesa callback processing error:", error);
  }

  return NextResponse.json(ACK);
}
