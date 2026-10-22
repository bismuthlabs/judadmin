export type PaymentMethod = "Cash" | "Mobile Money" | "Card" | "Bank Transfer" | "Other";
export type UserRole = "Owner" | "Cashier";

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  description: string;
  barcode: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  reorderLevel: number;
  archived: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  archived: boolean;
}

export interface SaleItem {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
}

export interface Sale {
  id: string;
  reference: string;
  createdAt: string;
  customerId: string | null;
  customerName: string;
  cashier: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  amountReceived: number;
  change: number;
  status: "Completed" | "Refunded";
}

export interface InventoryMovement {
  id: string;
  productId: string;
  productName: string;
  type: string;
  quantity: number;
  balance: number;
  reference: string;
  reason: string;
  user: string;
  createdAt: string;
}

export interface PurchaseItem {
  productId: string;
  name: string;
  quantity: number;
  received: number;
  unitCost: number;
}

export interface Purchase {
  id: string;
  reference: string;
  supplierId: string;
  supplierName: string;
  createdAt: string;
  items: PurchaseItem[];
  total: number;
  amountPaid: number;
  status: "Received" | "Partially received" | "Pending";
}

export interface Expense {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  paymentMethod: PaymentMethod;
  status: "Paid" | "Unpaid";
  notes: string;
  reference: string;
}

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  active: boolean;
}

export interface BusinessSettings {
  name: string;
  phone: string;
  email: string;
  address: string;
  receiptFooter: string;
  currency: string;
  timezone: string;
  lowStockThreshold: number;
}

export interface RetailData {
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  sales: Sale[];
  movements: InventoryMovement[];
  purchases: Purchase[];
  expenses: Expense[];
  expenseCategories: string[];
  categories: string[];
  users: UserProfile[];
  settings: BusinessSettings;
  activeUserId: string;
}
