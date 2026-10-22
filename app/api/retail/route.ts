import { NextResponse } from "next/server";
import { readSession } from "@/lib/server/session";
import { loadRetailData, saveRetailData } from "@/lib/server/retail-data";
import type { RetailData } from "@/lib/retail-types";

export async function GET() {
  try {
    const session = await readSession();
    if (!session) return NextResponse.json({ error: "Unlock the workspace first." }, { status: 401 });
    return NextResponse.json({ data: await loadRetailData(session.profile.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load retail data." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await readSession();
    if (!session) return NextResponse.json({ error: "Unlock the workspace first." }, { status: 401 });
    const { data } = await request.json() as { data?: RetailData };
    if (!data || !Array.isArray(data.products) || !Array.isArray(data.sales)) return NextResponse.json({ error: "Invalid retail data." }, { status: 400 });
    if (session.role === "Cashier") {
      const current = await loadRetailData(session.profile.id);
      if (!isCashierSaleUpdate(current, data, session.profile.id, session.profile.name)) {
        return NextResponse.json({ error: "Cashier access can only record sales." }, { status: 403 });
      }
    }
    await saveRetailData(data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save retail data." }, { status: 503 });
  }
}

function same(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isCashierSaleUpdate(current: RetailData, next: RetailData, profileId: string, profileName: string) {
  if (next.activeUserId !== profileId) return false;
  for (const key of ["customers", "suppliers", "purchases", "expenses", "expenseCategories", "categories", "users", "settings"] as const) {
    if (!same(current[key], next[key])) return false;
  }

  const addedCount = next.sales.length - current.sales.length;
  if (addedCount < 1 || !same(next.sales.slice(addedCount), current.sales)) return false;
  const addedSales = next.sales.slice(0, addedCount);
  const quantities = new Map<string, number>();
  let movementCount = 0;
  for (const sale of addedSales) {
    if (sale.status !== "Completed" || sale.cashier !== profileName || !sale.items.length || sale.total <= 0) return false;
    const subtotal = sale.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    if (Math.abs(subtotal - sale.subtotal) > 0.01 || sale.discount < 0 || sale.discount > subtotal || Math.abs(subtotal - sale.discount - sale.total) > 0.01) return false;
    for (const item of sale.items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.unitPrice < 0 || !current.products.some((product) => product.id === item.productId && !product.archived)) return false;
      quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
      movementCount += 1;
    }
  }

  if (next.products.length !== current.products.length) return false;
  for (const product of current.products) {
    const updated = next.products.find((candidate) => candidate.id === product.id);
    const expectedStock = product.stock - (quantities.get(product.id) ?? 0);
    if (!updated || updated.stock !== expectedStock || !same({ ...updated, stock: product.stock }, product)) return false;
  }
  return next.movements.length === current.movements.length + movementCount
    && same(next.movements.slice(movementCount), current.movements);
}
