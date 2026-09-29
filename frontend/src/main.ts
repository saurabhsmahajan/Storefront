import { supabase } from "./supabaseClient.ts";

type Product = {
  id: string;
  sku: string;
  name: string;
  price_minor: number;
  currency: string;
};

const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;
const listEl = document.querySelector<HTMLUListElement>("#products")!;

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

async function ensureSession(): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`[auth] getSession failed: ${error.message}`);
  }
  if (data.session) {
    return;
  }

  const { error: signInError } = await supabase.auth.signInAnonymously();
  if (signInError) {
    throw new Error(`[auth] signInAnonymously failed: ${signInError.message}`);
  }
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

function renderProducts(products: Product[]): void {
  listEl.replaceChildren();
  if (products.length === 0) {
    statusEl.textContent = "No products available.";
    return;
  }

  for (const product of products) {
    const item = document.createElement("li");
    item.textContent = `${product.name} — ${formatPrice(product.price_minor, product.currency)}`;
    listEl.append(item);
  }
  statusEl.textContent = "";
}

async function main(): Promise<void> {
  try {
    await ensureSession();
    renderProducts(await loadProducts());
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Could not load products. See console for details.";
  }
}

main();
