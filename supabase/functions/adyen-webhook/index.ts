// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type NotificationRequestItem = {
  pspReference?: string;
  originalReference?: string;
  merchantAccountCode?: string;
  merchantReference?: string;
  amount?: { value?: number | string; currency?: string };
  eventCode?: string;
  success?: string | boolean;
  additionalData?: { hmacSignature?: string; [key: string]: unknown };
  [key: string]: unknown;
};

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value;
}

function acceptedResponse(): Response {
  return new Response("[accepted]", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error("ADYEN_HMAC_KEY is not a valid hex string");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

// Compares every byte even after a mismatch, so timing doesn't reveal how
// much of the signature was correct.
function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = aBytes.length ^ bBytes.length;
  const length = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < length; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

function signingString(item: NotificationRequestItem): string {
  return [
    item.pspReference,
    item.originalReference,
    item.merchantAccountCode,
    item.merchantReference,
    item.amount?.value,
    item.amount?.currency,
    item.eventCode,
    item.success,
  ]
    .map((value) =>
      String(value ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/:/g, "\\:"),
    )
    .join(":");
}

async function computeSignature(
  item: NotificationRequestItem,
  hmacKey: CryptoKey,
): Promise<string> {
  const signature = await crypto.subtle.sign(
    "HMAC",
    hmacKey,
    new TextEncoder().encode(signingString(item)),
  );
  return bytesToBase64(new Uint8Array(signature));
}

// Returns false only for a genuine processing failure (a database error),
// which makes the batch answer 500 so Adyen retries it. Expected outcomes —
// bad signature, unknown merchantReference, duplicate delivery — return true.
async function processItem(
  item: NotificationRequestItem,
  hmacKey: CryptoKey,
  supabase: SupabaseClient,
): Promise<boolean> {
  const { pspReference, eventCode, merchantReference } = item;
  const label = `${eventCode ?? "?"} ${pspReference ?? "?"}`;

  const received = item.additionalData?.hmacSignature;
  if (typeof received !== "string" || received.length === 0) {
    console.error(
      `[hmac] ${label}: no additionalData.hmacSignature; skipping item`,
    );
    return true;
  }
  const expected = await computeSignature(item, hmacKey);
  if (!constantTimeEqual(expected, received)) {
    console.error(
      `[hmac] ${label}: signature mismatch (merchantReference=${merchantReference ?? ""}); skipping item`,
    );
    return true;
  }

  if (!pspReference || !eventCode) {
    console.error(
      `[item] ${label}: missing pspReference or eventCode; skipping item`,
    );
    return true;
  }

  // merchantReference is the order's uuid. Events that don't match an order
  // are still recorded (order_id null) so nothing Adyen sent is lost.
  let orderId: string | null = null;
  if (merchantReference && UUID_PATTERN.test(merchantReference)) {
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id")
      .eq("id", merchantReference)
      .maybeSingle();
    if (orderError) {
      console.error(`[orders] ${label}: lookup failed:`, orderError.message);
      return false;
    }
    orderId = order?.id ?? null;
  }
  if (orderId === null) {
    console.error(
      `[orders] ${label}: unknown merchantReference "${merchantReference ?? ""}"; recording event without order`,
    );
  }

  // Adyen may redeliver the same event; duplicates are ignored and come back
  // as zero rows, which is how a first delivery is told apart from a replay.
  const { data: inserted, error: eventError } = await supabase
    .from("payment_events")
    .upsert(
      {
        order_id: orderId,
        psp_reference: pspReference,
        event_type: eventCode,
        amount_minor: item.amount?.value ?? null,
        currency: item.amount?.currency ?? null,
        payload: item,
      },
      { onConflict: "psp_reference,event_type", ignoreDuplicates: true },
    )
    .select("id");
  if (eventError) {
    console.error(
      `[payment_events] ${label}: upsert failed:`,
      eventError.message,
    );
    return false;
  }
  if (!inserted || inserted.length === 0) {
    console.log(`[payment_events] ${label}: duplicate delivery, ignored`);
    return true;
  }
  console.log(
    `[payment_events] ${label}: recorded (order=${orderId ?? "none"})`,
  );

  if (eventCode !== "AUTHORISATION" || orderId === null) {
    return true;
  }

  // Only a pending order may change, so a late-arriving webhook never
  // overwrites a more final state.
  const status = String(item.success) === "true" ? "paid" : "cancelled";
  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update({
      status,
      psp_reference: pspReference,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("status", "pending")
    .select("id");
  if (updateError) {
    console.error(
      `[orders] ${label}: update of ${orderId} to ${status} failed:`,
      updateError.message,
    );
    return false;
  }
  if (!updated || updated.length === 0) {
    console.log(
      `[orders] ${label}: order ${orderId} is no longer pending; left unchanged`,
    );
    return true;
  }
  console.log(`[orders] ${label}: order ${orderId} marked ${status}`);
  return true;
}

// Called by Adyen directly with no Supabase session: there is no
// Authorization check, trust comes entirely from each item's HMAC signature.
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    console.error("[webhook] request body is not valid JSON");
    return new Response("Request body must be JSON", { status: 400 });
  }

  // A non-200 makes Adyen retry later, so a misconfigured deployment doesn't
  // acknowledge (and thereby lose) notifications it couldn't verify or store.
  let supabase: SupabaseClient;
  let hmacKey: CryptoKey;
  try {
    supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    hmacKey = await crypto.subtle.importKey(
      "raw",
      hexToBytes(requireEnv("ADYEN_HMAC_KEY").trim()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  } catch (err) {
    console.error("[config]", (err as Error).message);
    return new Response("Webhook is not configured", { status: 500 });
  }

  const notificationItems = (body as { notificationItems?: unknown } | null)
    ?.notificationItems;
  if (!Array.isArray(notificationItems)) {
    console.error("[webhook] payload has no notificationItems array");
    return acceptedResponse();
  }
  console.log(`[webhook] received ${notificationItems.length} item(s)`);

  let failedItems = 0;
  for (const [index, entry] of notificationItems.entries()) {
    try {
      const item = (entry as { NotificationRequestItem?: unknown } | null)
        ?.NotificationRequestItem;
      if (!item || typeof item !== "object") {
        console.error(
          `[item] #${index}: no NotificationRequestItem; skipping item`,
        );
        continue;
      }
      const ok = await processItem(
        item as NotificationRequestItem,
        hmacKey,
        supabase,
      );
      if (!ok) {
        failedItems++;
      }
    } catch (err) {
      console.error(`[item] #${index}: processing threw:`, err);
      failedItems++;
    }
  }

  // Adyen redelivers the whole batch on a non-200; items already recorded
  // are skipped as duplicates on the retry.
  if (failedItems > 0) {
    console.error(
      `[webhook] ${failedItems} item(s) failed; returning 500 so Adyen retries`,
    );
    return new Response("Processing failed", { status: 500 });
  }

  return acceptedResponse();
});
