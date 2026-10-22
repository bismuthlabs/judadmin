import { NextResponse } from "next/server";
import { readSession } from "@/lib/server/session";
import { loadRetailData, saveRetailData } from "@/lib/server/retail-data";
import type { RetailData } from "@/lib/retail-types";

export async function GET() {
  try {
    const session = await readSession();
    if (!session) return NextResponse.json({ error: "Unlock the workspace first." }, { status: 401 });
    const data = await loadRetailData(session.profile.id);
    return NextResponse.json({ data: session.role === "Owner" ? data : cashierView(data, session.profile.id, session.profile.name) });
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
      const currentView = cashierView(current, session.profile.id, session.profile.name);
      if (!isCashierSaleUpdate(currentView, data, session.profile.id, session.profile.name)) {
        return NextResponse.json({ error: "Cashier access can only record sales." }, { status: 403 });
      }
      const addedCount = data.sales.length - currentView.sales.length;
      const addedSales = data.sales.slice(0, addedCount).map((sale) => ({
        ...sale,
        items: sale.items.map((item) => ({ ...item, unitCost: current.products.find((product) => product.id === item.productId)!.costPrice })),
      }));
      const movementCount = addedSales.reduce((sum, sale) => sum + sale.items.length, 0);
      const addedCustomers = data.customers.filter((customer) => !current.customers.some((item) => item.id === customer.id));
      const submittedStocks = new Map(data.products.map((product) => [product.id, product.stock]));
      const merged: RetailData = {
        ...current,
        products: current.products.map((product) => ({ ...product, stock: submittedStocks.get(product.id) ?? product.stock })),
        customers: [...addedCustomers, ...current.customers],
        sales: [...addedSales, ...current.sales],
        movements: [...data.movements.slice(0, movementCount), ...current.movements],
        activeUserId: session.profile.id,
      };
      await saveRetailData(merged);
      return NextResponse.json({ ok: true });
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
  for (const key of ["suppliers", "purchases", "expenses", "expenseCategories", "categories", "users", "settings"] as const) {
    if (!same(current[key], next[key])) return false;
  }
  const submittedCustomers = new Map(next.customers.map((customer) => [customer.id, customer]));
  if (current.customers.some((customer) => !same(submittedCustomers.get(customer.id), customer))) return false;
  if (submittedCustomers.size !== next.customers.length) return false;
  const addedCustomers = next.customers.filter((customer) => !current.customers.some((item) => item.id === customer.id));
  if (addedCustomers.some((customer) => !customer.id || !customer.name.trim())) return false;

  const addedCount = next.sales.length - current.sales.length;
  if (addedCount < 0 || !same(next.sales.slice(addedCount), current.sales)) return false;
  const addedSales = next.sales.slice(0, addedCount);
  const quantities = new Map<string, number>();
  let movementCount = 0;
  for (const sale of addedSales) {
    if (sale.status !== "Completed" || sale.cashier !== profileName || !sale.items.length || sale.total <= 0) return false;
    if (current.sales.some((existing) => existing.id === sale.id || existing.reference === sale.reference)) return false;
    const subtotal = sale.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    if (Math.abs(subtotal - sale.subtotal) > 0.01 || sale.discount < 0 || sale.discount > subtotal || Math.abs(subtotal - sale.discount - sale.total) > 0.01) return false;
    if (sale.paymentMethod === "Cash") {
      if (sale.amountReceived < sale.total || Math.abs(sale.change - (sale.amountReceived - sale.total)) > 0.01) return false;
    } else if (Math.abs(sale.amountReceived - sale.total) > 0.01 || sale.change !== 0) return false;
    const customer = sale.customerId ? submittedCustomers.get(sale.customerId) : undefined;
    if (sale.customerId && (!customer || customer.name !== sale.customerName)) return false;
    for (const item of sale.items) {
      const product = current.products.find((candidate) => candidate.id === item.productId && !candidate.archived);
      if (!product || !Number.isInteger(item.quantity) || item.quantity <= 0 || item.unitPrice !== product.sellingPrice || item.name !== product.name || item.sku !== product.sku || item.unitCost !== 0) return false;
      quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
      movementCount += 1;
    }
  }
  if (next.products.length !== current.products.length) return false;
  for (const product of current.products) {
    const updated = next.products.find((candidate) => candidate.id === product.id);
    const expectedStock = product.stock - (quantities.get(product.id) ?? 0);
    if (!updated || updated.stock !== expectedStock || updated.costPrice !== 0 || !same({ ...updated, stock: product.stock, costPrice: product.costPrice }, product)) return false;
  }
  if (next.movements.length !== current.movements.length + movementCount || !same(next.movements.slice(movementCount), current.movements)) return false;
  const pendingMovements = [...next.movements.slice(0, movementCount)];
  for (const sale of addedSales) for (const item of sale.items) {
    const index = pendingMovements.findIndex((movement) => movement.type === "Sale" && movement.productId === item.productId && movement.quantity === -item.quantity && movement.reference === sale.reference && movement.user === profileName);
    if (index < 0) return false;
    pendingMovements.splice(index, 1);
  }
  return pendingMovements.length === 0;
}

function cashierView(data: RetailData, profileId: string, profileName: string): RetailData {
  return {
    ...data,
    products: data.products.map((product) => ({ ...product, costPrice: 0 })),
    suppliers: [],
    sales: data.sales.filter((sale) => sale.cashier === profileName),
    movements: data.movements.filter((movement) => movement.type === "Sale" && movement.user === profileName),
    purchases: [],
    expenses: [],
    expenseCategories: [],
    users: data.users.filter((user) => user.id === profileId),
    activeUserId: profileId,
  };
}
