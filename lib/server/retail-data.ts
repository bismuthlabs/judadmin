import "server-only";
import type { RetailData, SaleItem, PurchaseItem } from "@/lib/retail-types";
import { businessQuery } from "@/lib/server/supabase";

type ProductRow = { id: string; name: string; sku: string; category: string; description: string; barcode: string; cost_price: number; selling_price: number; stock: number; reorder_level: number; archived: boolean };
type CustomerRow = { id: string; name: string; phone: string; email: string; notes: string };
type SupplierRow = { id: string; name: string; phone: string; email: string; address: string; notes: string; archived: boolean };
type SaleRow = { id: string; reference: string; created_at: string; customer_id: string | null; customer_name: string; cashier: string; subtotal: number; discount: number; total: number; payment_method: RetailData["sales"][number]["paymentMethod"]; amount_received: number; change_amount: number; status: RetailData["sales"][number]["status"] };
type SaleItemRow = { id: number; sale_id: string; product_id: string; name: string; sku: string; quantity: number; unit_price: number; unit_cost: number };
type MovementRow = { id: string; product_id: string; product_name: string; type: string; quantity: number; balance: number; reference: string; reason: string; user_name: string; created_at: string };
type PurchaseRow = { id: string; reference: string; supplier_id: string; supplier_name: string; created_at: string; total: number; amount_paid: number; status: RetailData["purchases"][number]["status"] };
type PurchaseItemRow = { id: number; purchase_id: string; product_id: string; name: string; quantity: number; received: number; unit_cost: number };
type ExpenseRow = { id: string; title: string; category: string; amount: number; date: string; payment_method: RetailData["expenses"][number]["paymentMethod"]; status: RetailData["expenses"][number]["status"]; notes: string; reference: string };
type ProfileRow = RetailData["users"][number];
type SettingsRow = { name: string; phone: string; email: string; address: string; receipt_footer: string; currency: string; timezone: string; low_stock_threshold: number };

export async function loadRetailData(activeUserId: string): Promise<RetailData> {
  const [products, customers, suppliers, sales, saleLines, movements, purchases, purchaseLines, expenses, expenseCategories, categories, users, settings] = await Promise.all([
    businessQuery<ProductRow[]>("products?select=id,name,sku,category,description,barcode,cost_price,selling_price,stock,reorder_level,archived&order=name.asc"),
    businessQuery<CustomerRow[]>("customers?select=id,name,phone,email,notes&order=name.asc"),
    businessQuery<SupplierRow[]>("suppliers?select=id,name,phone,email,address,notes,archived&order=name.asc"),
    businessQuery<SaleRow[]>("sales?select=id,reference,created_at,customer_id,customer_name,cashier,subtotal,discount,total,payment_method,amount_received,change_amount,status&order=created_at.desc"),
    businessQuery<SaleItemRow[]>("sale_items?select=id,sale_id,product_id,name,sku,quantity,unit_price,unit_cost&order=id.asc"),
    businessQuery<MovementRow[]>("inventory_movements?select=id,product_id,product_name,type,quantity,balance,reference,reason,user_name,created_at&order=created_at.desc,id.asc"),
    businessQuery<PurchaseRow[]>("purchases?select=id,reference,supplier_id,supplier_name,created_at,total,amount_paid,status&order=created_at.desc"),
    businessQuery<PurchaseItemRow[]>("purchase_items?select=id,purchase_id,product_id,name,quantity,received,unit_cost&order=id.asc"),
    businessQuery<ExpenseRow[]>("expenses?select=id,title,category,amount,date,payment_method,status,notes,reference&order=date.desc"),
    businessQuery<Array<{ name: string }>>("expense_categories?select=name&order=sort_order.asc"),
    businessQuery<Array<{ name: string }>>("categories?select=name&order=sort_order.asc"),
    businessQuery<ProfileRow[]>("profiles?select=id,name,role,active&order=name.asc"),
    businessQuery<SettingsRow[]>("business_settings?id=eq.1&select=name,phone,email,address,receipt_footer,currency,timezone,low_stock_threshold"),
  ]);
  const saleItemsById = new Map<string, SaleItem[]>();
  for (const row of saleLines) {
    const items = saleItemsById.get(row.sale_id) ?? [];
    items.push({ productId: row.product_id, name: row.name, sku: row.sku, quantity: row.quantity, unitPrice: Number(row.unit_price), unitCost: Number(row.unit_cost) });
    saleItemsById.set(row.sale_id, items);
  }
  const purchaseItemsById = new Map<string, PurchaseItem[]>();
  for (const row of purchaseLines) {
    const items = purchaseItemsById.get(row.purchase_id) ?? [];
    items.push({ productId: row.product_id, name: row.name, quantity: row.quantity, received: row.received, unitCost: Number(row.unit_cost) });
    purchaseItemsById.set(row.purchase_id, items);
  }
  const setting = settings[0];
  if (!setting) throw new Error("Business settings are missing. Run the Supabase seed SQL.");
  return {
    products: products.map((row) => ({ id: row.id, name: row.name, sku: row.sku, category: row.category, description: row.description, barcode: row.barcode, costPrice: Number(row.cost_price), sellingPrice: Number(row.selling_price), stock: row.stock, reorderLevel: row.reorder_level, archived: row.archived })),
    customers,
    suppliers,
    sales: sales.map((row) => ({ id: row.id, reference: row.reference, createdAt: row.created_at, customerId: row.customer_id, customerName: row.customer_name, cashier: row.cashier, items: saleItemsById.get(row.id) ?? [], subtotal: Number(row.subtotal), discount: Number(row.discount), total: Number(row.total), paymentMethod: row.payment_method, amountReceived: Number(row.amount_received), change: Number(row.change_amount), status: row.status })),
    movements: movements.map((row) => ({ id: row.id, productId: row.product_id, productName: row.product_name, type: row.type, quantity: row.quantity, balance: row.balance, reference: row.reference, reason: row.reason, user: row.user_name, createdAt: row.created_at })),
    purchases: purchases.map((row) => ({ id: row.id, reference: row.reference, supplierId: row.supplier_id, supplierName: row.supplier_name, createdAt: row.created_at, items: purchaseItemsById.get(row.id) ?? [], total: Number(row.total), amountPaid: Number(row.amount_paid), status: row.status })),
    expenses: expenses.map((row) => ({ id: row.id, title: row.title, category: row.category, amount: Number(row.amount), date: row.date, paymentMethod: row.payment_method, status: row.status, notes: row.notes, reference: row.reference })),
    expenseCategories: expenseCategories.map((row) => row.name),
    categories: categories.map((row) => row.name),
    users,
    settings: { name: setting.name, phone: setting.phone, email: setting.email, address: setting.address, receiptFooter: setting.receipt_footer, currency: setting.currency, timezone: setting.timezone, lowStockThreshold: setting.low_stock_threshold },
    activeUserId,
  };
}

export async function saveRetailData(data: RetailData) {
  await businessQuery("rpc/replace_retail_data", { method: "POST", body: JSON.stringify({ p_data: data }) });
}
