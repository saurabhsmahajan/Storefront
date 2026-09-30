import { AdyenCheckout, Dropin } from "@adyen/adyen-web";
import "@adyen/adyen-web/styles/adyen.css";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient.ts";

type Product = {
  id: string;
  sku: string;
  name: string;
  price_minor: number;
  currency: string;
};

type CartItem = {
  id: string;
  quantity: number;
  // null when the product is no longer visible (e.g. deactivated, so RLS hides it).
  products: Pick<Product, "name" | "price_minor" | "currency"> | null;
};

const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;
const listEl = document.querySelector<HTMLUListElement>("#products")!;
const cartStatusEl =
  document.querySelector<HTMLParagraphElement>("#cart-status")!;
const cartListEl = document.querySelector<HTMLUListElement>("#cart")!;
const checkoutButton =
  document.querySelector<HTMLButtonElement>("#checkout-button")!;
const checkoutStatusEl =
  document.querySelector<HTMLParagraphElement>("#checkout-status")!;
const dropinEl = document.querySelector<HTMLDivElement>("#dropin")!;

let userId: string | null = null;
let cartId: string | null = null;

// Converts integer minor units to a display string, using the currency's own
// number of decimal places (e.g. 2 for USD, 0 for JPY).
function formatPrice(minor: number, currency: string): string {
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(minor / 10 ** digits);
}

async function ensureSession(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`[auth] getSession failed: ${error.message}`);
  }
  if (data.session) {
    return data.session.user.id;
  }

  const { data: signInData, error: signInError } =
    await supabase.auth.signInAnonymously();
  if (signInError || !signInData.user) {
    throw new Error(
      `[auth] signInAnonymously failed: ${signInError?.message ?? "no user returned"}`,
    );
  }
  return signInData.user.id;
}

async function loadProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id, sku, name, price_minor, currency");
  if (error) {
    throw new Error(`[products] query failed: ${error.message}`);
  }
  return data ?? [];
}

// Returns the current user's existing cart id, or null if they have none yet.
async function findCart(): Promise<string | null> {
  if (cartId) {
    return cartId;
  }
  if (!userId) {
    throw new Error("[cart] no session");
  }

  const { data: existing, error: selectError } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (selectError) {
    throw new Error(`[cart] lookup failed: ${selectError.message}`);
  }
  if (existing) {
    cartId = existing.id as string;
  }
  return cartId;
}

// Returns the current user's cart id, creating a cart on first use.
async function ensureCart(): Promise<string> {
  const existing = await findCart();
  if (existing) {
    return existing;
  }

  const { data: created, error: insertError } = await supabase
    .from("carts")
    .insert({ user_id: userId })
    .select("id")
    .single();
  if (insertError) {
    throw new Error(`[cart] create failed: ${insertError.message}`);
  }
  cartId = created.id as string;
  return cartId;
}

async function addToCart(productId: string): Promise<void> {
  const cart = await ensureCart();

  const { data: existing, error: selectError } = await supabase
    .from("cart_items")
    .select("quantity")
    .eq("cart_id", cart)
    .eq("product_id", productId)
    .maybeSingle();
  if (selectError) {
    throw new Error(`[cart_items] lookup failed: ${selectError.message}`);
  }

  const quantity = ((existing?.quantity as number | undefined) ?? 0) + 1;
  const { error: upsertError } = await supabase.from("cart_items").upsert(
    {
      cart_id: cart,
      product_id: productId,
      quantity,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "cart_id,product_id" },
  );
  if (upsertError) {
    throw new Error(`[cart_items] upsert failed: ${upsertError.message}`);
  }
}

async function loadCartItems(): Promise<CartItem[]> {
  const cart = await findCart();
  if (!cart) {
    return [];
  }
  const { data, error } = await supabase
    .from("cart_items")
    .select("id, quantity, products(name, price_minor, currency)")
    .eq("cart_id", cart)
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(`[cart_items] query failed: ${error.message}`);
  }
  return (data ?? []) as unknown as CartItem[];
}

function renderProducts(products: Product[]): void {
  listEl.replaceChildren();
  if (products.length === 0) {
    statusEl.textContent = "No products available.";
    return;
  }

  for (const product of products) {
    const item = document.createElement("li");
    item.textContent = `${product.name} — ${formatPrice(product.price_minor, product.currency)} `;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Add to cart";
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await addToCart(product.id);
        await refreshCart();
      } catch (err) {
        console.error(err);
        cartStatusEl.textContent =
          "Could not add to cart. See console for details.";
      } finally {
        button.disabled = false;
      }
    });

    item.append(button);
    listEl.append(item);
  }
  statusEl.textContent = "";
}

function renderCart(items: CartItem[]): void {
  cartListEl.replaceChildren();
  if (items.length === 0) {
    cartStatusEl.textContent = "Your cart is empty.";
    return;
  }

  for (const cartItem of items) {
    const item = document.createElement("li");
    const product = cartItem.products;
    if (product) {
      const lineTotal = formatPrice(
        product.price_minor * cartItem.quantity,
        product.currency,
      );
      item.textContent = `${product.name} × ${cartItem.quantity} — ${lineTotal}`;
    } else {
      item.textContent = `Unavailable product × ${cartItem.quantity}`;
    }
    cartListEl.append(item);
  }
  cartStatusEl.textContent = "";
}

async function refreshCart(): Promise<void> {
  renderCart(await loadCartItems());
}

type CheckoutSessionResponse = {
  orderId: string;
  session: { id: string; sessionData: string };
};

async function createCheckoutSession(
  cart: string,
): Promise<CheckoutSessionResponse> {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    throw new Error(
      `[checkout] no active session: ${sessionError?.message ?? "not signed in"}`,
    );
  }

  const { data, error } =
    await supabase.functions.invoke<CheckoutSessionResponse>(
      "create-checkout-session",
      {
        body: { cartId: cart },
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      },
    );
  if (error) {
    // The function returns { error: "..." } with a non-2xx status; surface that message.
    let message = error.message;
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      message = `${error.context.status} ${body?.error ?? message}`;
    }
    throw new Error(`[checkout] create-checkout-session failed: ${message}`);
  }
  if (!data?.orderId || !data.session?.id || !data.session.sessionData) {
    throw new Error(
      "[checkout] unexpected response from create-checkout-session",
    );
  }
  return data;
}

async function startCheckout(): Promise<void> {
  const clientKey = import.meta.env.VITE_ADYEN_CLIENT_KEY as string | undefined;
  if (!clientKey) {
    throw new Error(
      "[checkout] Missing VITE_ADYEN_CLIENT_KEY. Check frontend/.env.",
    );
  }

  const cart = await findCart();
  if (!cart) {
    checkoutStatusEl.textContent = "Your cart is empty.";
    return;
  }

  checkoutStatusEl.textContent = "Starting checkout…";
  const { orderId, session } = await createCheckoutSession(cart);

  const checkout = await AdyenCheckout({
    environment: "test",
    clientKey,
    session,
    // Only log and show status here; order state is updated by the webhook later.
    onPaymentCompleted: (result) => {
      console.log("[checkout] payment completed", { orderId, result });
      checkoutStatusEl.textContent = `Payment result: ${result.resultCode}`;
    },
    onPaymentFailed: (result) => {
      console.error("[checkout] payment failed", { orderId, result });
      checkoutStatusEl.textContent = `Payment failed: ${result?.resultCode ?? "unknown"}`;
    },
    onError: (error) => {
      console.error("[checkout] Adyen error", { orderId, error });
      checkoutStatusEl.textContent = "Payment error. See console for details.";
    },
  });

  dropinEl.replaceChildren();
  dropinEl.hidden = false;
  new Dropin(checkout).mount(dropinEl);
  checkoutStatusEl.textContent = "";
}

async function main(): Promise<void> {
  try {
    userId = await ensureSession();
    renderProducts(await loadProducts());
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Could not load products. See console for details.";
    return;
  }

  try {
    await refreshCart();
  } catch (err) {
    console.error(err);
    cartStatusEl.textContent = "Could not load cart. See console for details.";
  }

  checkoutButton.addEventListener("click", async () => {
    checkoutButton.disabled = true;
    try {
      await startCheckout();
    } catch (err) {
      console.error(err);
      checkoutStatusEl.textContent =
        "Could not start checkout. See console for details.";
    } finally {
      checkoutButton.disabled = false;
    }
  });
}

main();
