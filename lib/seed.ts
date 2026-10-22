import type { InventoryMovement, RetailData, Sale, Supplier } from "./retail-types";

const now = new Date();
const daysAgo = (days: number, hour = 12) => {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  date.setHours(hour, 15, 0, 0);
  return date.toISOString();
};

const products = [
  ["Bottled Water 500ml", "WAT-001", "Beverages", 3, 5, 120, 30],
  ["Soft Drink 500ml", "DRK-001", "Beverages", 5, 8, 65, 20],
  ["Biscuits", "SNK-001", "Snacks", 2.5, 4, 8, 25],
  ["Washing Powder", "HOU-001", "Household Products", 12, 16, 0, 10],
  ["Bathing Soap", "PER-001", "Personal Care", 4, 6, 48, 15],
  ["Exercise Book", "STA-001", "Stationery", 6, 9, 32, 10],
  ["Long Grain Rice 1kg", "GRO-001", "Groceries", 18, 24, 42, 12],
  ["Palm Oil 1L", "GRO-002", "Groceries", 22, 29, 18, 8],
  ["Toothpaste 100ml", "PER-002", "Personal Care", 8, 12, 24, 10],
  ["Corn Flakes 500g", "GRO-003", "Groceries", 25, 34, 15, 8],
  ["Laundry Bar", "HOU-002", "Household Products", 7, 10, 21, 10],
  ["Chocolate Wafer", "SNK-002", "Snacks", 3, 5, 36, 12],
].map(([name, sku, category, costPrice, sellingPrice, stock, reorderLevel], index) => ({
  id: `prd-${index + 1}`,
  name: String(name),
  sku: String(sku),
  category: String(category),
  description: "",
  barcode: "",
  costPrice: Number(costPrice),
  sellingPrice: Number(sellingPrice),
  stock: Number(stock),
  reorderLevel: Number(reorderLevel),
  archived: false,
}));

const customers = [
  { id: "cus-1", name: "Ama Mensah", phone: "024 555 0192", email: "ama.m@example.com", notes: "" },
  { id: "cus-2", name: "Kojo Asante", phone: "020 441 7730", email: "", notes: "" },
  { id: "cus-3", name: "Abena Owusu", phone: "055 218 9031", email: "", notes: "" },
];

const suppliers: Supplier[] = [
  { id: "sup-1", name: "Accra Wholesale Mart", phone: "030 222 4581", email: "orders@accrawholesale.gh", address: "Makola Market, Accra", notes: "", archived: false },
  { id: "sup-2", name: "Golden Harvest Distributors", phone: "024 817 6004", email: "", address: "Tema Industrial Area", notes: "", archived: false },
  { id: "sup-3", name: "Coastal Consumer Goods", phone: "050 300 1762", email: "", address: "Kaneshie, Accra", notes: "", archived: false },
];

const saleSpecs = [
  [0, 2, 2, 5], [0, 0, 3, 8], [1, 1, 1, 4], [1, 4, 2, 7], [2, 6, 1, 3],
  [2, 0, 4, 9], [3, 2, 3, 6], [3, 8, 1, 2], [4, 5, 2, 4], [4, 1, 3, 7],
  [5, 0, 2, 3], [5, 11, 2, 5], [6, 6, 1, 2], [7, 4, 3, 6], [8, 7, 1, 3],
  [9, 0, 5, 8], [10, 9, 1, 2], [11, 10, 2, 4], [12, 1, 3, 5], [13, 5, 1, 3],
];

const sales: Sale[] = saleSpecs.map(([days, productIndex, quantity, hour], index) => {
  const product = products[productIndex];
  const total = product.sellingPrice * quantity;
  return {
    id: `sale-${index + 1}`,
    reference: `EE-${String(2601 + index).padStart(6, "0")}`,
    createdAt: daysAgo(days, hour),
    customerId: index % 3 === 0 ? customers[index % customers.length].id : null,
    customerName: index % 3 === 0 ? customers[index % customers.length].name : "Walk-in Customer",
    cashier: index % 4 === 0 ? "Kofi Asare" : "Efua Boateng",
    items: [{ productId: product.id, name: product.name, sku: product.sku, quantity, unitPrice: product.sellingPrice, unitCost: product.costPrice }],
    subtotal: total,
    discount: 0,
    total,
    paymentMethod: ["Cash", "Mobile Money", "Card"][index % 3] as Sale["paymentMethod"],
    amountReceived: total,
    change: 0,
    status: "Completed",
  };
});

const purchases = [
  { id: "pur-1", reference: "PO-0048", supplierId: "sup-1", supplierName: "Accra Wholesale Mart", createdAt: daysAgo(3), items: [{ productId: "prd-1", name: "Bottled Water 500ml", quantity: 60, received: 60, unitCost: 3 }], total: 180, amountPaid: 180, status: "Received" as const },
  { id: "pur-2", reference: "PO-0047", supplierId: "sup-2", supplierName: "Golden Harvest Distributors", createdAt: daysAgo(8), items: [{ productId: "prd-7", name: "Long Grain Rice 1kg", quantity: 40, received: 24, unitCost: 18 }, { productId: "prd-8", name: "Palm Oil 1L", quantity: 20, received: 20, unitCost: 22 }], total: 1160, amountPaid: 800, status: "Partially received" as const },
  { id: "pur-3", reference: "PO-0046", supplierId: "sup-3", supplierName: "Coastal Consumer Goods", createdAt: daysAgo(14), items: [{ productId: "prd-5", name: "Bathing Soap", quantity: 50, received: 50, unitCost: 4 }], total: 200, amountPaid: 150, status: "Received" as const },
];

const movements: InventoryMovement[] = [];
products.forEach((product) => {
  const sold = sales.flatMap((sale) => sale.items)
    .filter((item) => item.productId === product.id)
    .reduce((sum, item) => sum + item.quantity, 0);
  const received = purchases.flatMap((purchase) => purchase.items)
    .filter((item) => item.productId === product.id)
    .reduce((sum, item) => sum + item.received, 0);
  let balance = product.stock - received + sold;
  movements.push({
    id: `mov-opening-${product.id}`,
    productId: product.id,
    productName: product.name,
    type: "Opening Stock",
    quantity: balance,
    balance,
    reference: "OPENING",
    reason: "Opening count before recorded activity",
    user: "Akosua (Owner)",
    createdAt: daysAgo(35),
  });
  const events = [
    ...purchases.flatMap((purchase) => purchase.items.filter((item) => item.productId === product.id && item.received > 0)
      .map((item) => ({ createdAt: purchase.createdAt, quantity: item.received, reference: purchase.reference, reason: `Received from ${purchase.supplierName}`, type: "Stock Received" }))),
    ...sales.flatMap((sale) => sale.items.filter((item) => item.productId === product.id)
      .map((item) => ({ createdAt: sale.createdAt, quantity: -item.quantity, reference: sale.reference, reason: `Sale to ${sale.customerName}`, type: "Sale" }))),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  events.forEach((event, index) => {
    balance += event.quantity;
    movements.push({
      id: `mov-${product.id}-${index}`,
      productId: product.id,
      productName: product.name,
      type: event.type,
      quantity: event.quantity,
      balance,
      reference: event.reference,
      reason: event.reason,
      user: event.type === "Sale" ? sales.find((sale) => sale.reference === event.reference)?.cashier ?? "Cashier" : "Akosua (Owner)",
      createdAt: event.createdAt,
    });
  });
});

export function createSeed(): RetailData {
  return {
    products,
    customers,
    suppliers,
    sales,
    movements: movements.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    purchases,
    expenses: [
      { id: "exp-1", title: "Shop rent — October", category: "Rent", amount: 1800, date: daysAgo(5), paymentMethod: "Bank Transfer", status: "Paid", notes: "", reference: "RENT-OCT" },
      { id: "exp-2", title: "Electricity top-up", category: "Electricity", amount: 350, date: daysAgo(2), paymentMethod: "Mobile Money", status: "Paid", notes: "", reference: "ECG-1022" },
      { id: "exp-3", title: "Delivery fuel", category: "Transport", amount: 120, date: daysAgo(1), paymentMethod: "Cash", status: "Paid", notes: "", reference: "" },
      { id: "exp-4", title: "Shop internet", category: "Internet and Telephone", amount: 180, date: daysAgo(10), paymentMethod: "Mobile Money", status: "Unpaid", notes: "", reference: "" },
    ],
    expenseCategories: ["Rent", "Electricity", "Water", "Transport", "Salaries", "Internet and Telephone", "Repairs and Maintenance", "Marketing", "Bank Charges", "Other"],
    categories: ["Beverages", "Snacks", "Groceries", "Household Products", "Personal Care", "Stationery"],
    users: [
      { id: "usr-owner", name: "Akosua Mensah", role: "Owner", active: true },
      { id: "usr-cashier-1", name: "Kofi Asare", role: "Cashier", active: true },
      { id: "usr-cashier-2", name: "Efua Boateng", role: "Cashier", active: true },
    ],
    settings: {
      name: "Everyday Essentials Shop",
      phone: "030 278 4402",
      email: "hello@everydayessentials.gh",
      address: "12 Oxford Street, Osu, Accra",
      receiptFooter: "Thank you for shopping with us!",
      currency: "GHS",
      timezone: "Africa/Accra",
      lowStockThreshold: 10,
    },
    activeUserId: "usr-owner",
  };
}
