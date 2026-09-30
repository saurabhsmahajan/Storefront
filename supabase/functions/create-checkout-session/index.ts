// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const ADYEN_SESSIONS_URL = "https://checkout-test.adyen.com/v71/sessions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CartItemRow = {
  quantity: number;
  products: {
    price_minor: number;
    currency: string;
    active: boolean;
  } | null;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(status: number, error: string): Response {
  return jsonResponse({ error }, status);
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed");
  }

  let supabaseUrl: string;
  let serviceRoleKey: string;
  let adyenApiKey: string;
  let adyenMerchantAccount: string;
  let adyenReturnUrl: string;
  try {
    supabaseUrl = requireEnv("SUPABASE_URL");
    serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    adyenApiKey = requireEnv("ADYEN_API_KEY");
    adyenMerchantAccount = requireEnv("ADYEN_MERCHANT_ACCOUNT");
    adyenReturnUrl = requireEnv("ADYEN_RETURN_URL");
  } catch (err) {
    console.error("[config]", (err as Error).message);
    return errorResponse(500, "Checkout is not configured");
  }

  let cartId: unknown;
  try {
    ({ cartId } = await req.json());
  } catch {
    return errorResponse(400, "Request body must be JSON");
  }
  if (typeof cartId !== "string" || cartId.length === 0) {
    return errorResponse(400, "cartId is required");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // The service_role client bypasses RLS, so ownership must be checked here:
  // the caller's JWT identifies the user, and the cart must belong to them.
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return errorResponse(401, "Missing Authorization header");
  }
  const { data: userData, error: userError } =
    await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return errorResponse(401, "Invalid or expired session");
  }

  const { data: cart, error: cartError } = await supabase
    .from("carts")
    .select("id, user_id")
    .eq("id", cartId)
    .maybeSingle();
  if (cartError) {
    // A malformed uuid surfaces as a query error (22P02); treat it as not found.
    if (cartError.code === "22P02") {
      return errorResponse(404, "Cart not found");
    }
    console.error("[carts] lookup failed:", cartError.message);
    return errorResponse(500, "Could not load cart");
  }
  // Same response for "doesn't exist" and "not yours", so cart ids can't be probed.
  if (!cart || cart.user_id !== userData.user.id) {
    return errorResponse(404, "Cart not found");
  }

  const { data: items, error: itemsError } = await supabase
    .from("cart_items")
    .select("quantity, products(price_minor, currency, active)")
    .eq("cart_id", cartId);
  if (itemsError) {
    console.error("[cart_items] query failed:", itemsError.message);
    return errorResponse(500, "Could not load cart items");
  }

  const rows = (items ?? []) as unknown as CartItemRow[];
  if (rows.length === 0) {
    return errorResponse(422, "Cart is empty");
  }

  let totalMinor = 0;
  let currency: string | null = null;
  for (const row of rows) {
    const product = row.products;
    if (!product || !product.active) {
      return errorResponse(
        409,
        "Cart contains a product that is no longer available",
      );
    }
    // Single currency assumed for now; reject rather than silently mis-charge.
    if (currency === null) {
      currency = product.currency;
    } else if (product.currency !== currency) {
      return errorResponse(
        422,
        "Cart contains items in more than one currency",
      );
    }
    totalMinor += product.price_minor * row.quantity;
  }
  if (!Number.isSafeInteger(totalMinor) || totalMinor <= 0) {
    return errorResponse(422, "Cart total is invalid");
  }

  // No discounts, tax or shipping yet, so total equals subtotal.
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: userData.user.id,
      status: "pending",
      currency,
      subtotal_minor: totalMinor,
      total_minor: totalMinor,
    })
    .select("id")
    .single();
  if (orderError || !order) {
    console.error("[orders] insert failed:", orderError?.message);
    return errorResponse(500, "Could not create order");
  }
  const orderId = order.id as string;

  // If Adyen fails, the order can never be paid; mark it cancelled so it
  // doesn't linger as pending. Failure here is logged but not surfaced.
  const cancelOrder = async () => {
    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", orderId);
    if (error) {
      console.error(`[orders] cancel of ${orderId} failed:`, error.message);
    }
  };

  let adyenResponse: Response;
  try {
    adyenResponse = await fetch(ADYEN_SESSIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": adyenApiKey,
      },
      body: JSON.stringify({
        amount: { value: totalMinor, currency },
        merchantAccount: adyenMerchantAccount,
        reference: orderId,
        returnUrl: adyenReturnUrl,
      }),
    });
  } catch (err) {
    console.error("[adyen] request failed:", (err as Error).message);
    await cancelOrder();
    return errorResponse(502, "Payment provider unavailable");
  }

  if (!adyenResponse.ok) {
    // Log Adyen's details server-side only; the client gets a generic message.
    const detail = await adyenResponse.text();
    console.error(`[adyen] ${adyenResponse.status}:`, detail);
    await cancelOrder();
    return errorResponse(502, "Payment provider rejected the checkout request");
  }

  const session = await adyenResponse.json();
  return jsonResponse({ orderId, session });
});
