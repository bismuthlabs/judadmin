"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createSeed } from "@/lib/seed";
import { newId } from "@/lib/format";
import type {
  Expense, InventoryMovement, Product, Purchase, PurchaseItem, RetailData, Sale, SaleItem,
} from "@/lib/retail-types";

const STORAGE_KEY = "everyday-essentials-retail-v1";
type Update = (previous: RetailData) => RetailData;

interface RetailContextValue {
  data: RetailData;
  ready: boolean;
  update: (updater: Update) => void;
  saveProduct: (product: Omit<Product, "id"> & { id?: string }) => string;
  completeSale: (sale: Omit<Sale, "id" | "reference" | "createdAt" | "cashier" | "status">) => Sale;
  adjustStock: (productId: string, newQuantity: number, reason: string, notes?: string) => void;
  recordPurchase: (purchase: Omit<Purchase, "id">) => Purchase;
  receivePurchase: (purchaseId: string, received: Record<string, number>) => void;
  recordExpense: (expense: Omit<Expense, "id"> & { id?: string }) => void;
}

const RetailContext = createContext<RetailContextValue | null>(null);

function hasRetailShape(value: unknown): value is RetailData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<RetailData>;
  return Array.isArray(data.products) && Array.isArray(data.sales) && Array.isArray(data.movements)
    && Array.isArray(data.purchases) && Array.isArray(data.expenses) && Array.isArray(data.users)
    && Array.isArray(data.suppliers) && Array.isArray(data.customers) && Boolean(data.settings);
}

export function RetailProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<RetailData>(() => createSeed());
  const [ready, setReady] = useState(false);
  const dataRef = useRef(data);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (!hasRetailShape(parsed)) throw new Error("Saved retail data has an invalid format.");
          dataRef.current = parsed;
          setData(parsed);
        }
      } catch (error) {
        console.error("Could not restore saved retail data.", error);
        toast.error("Saved data could not be loaded. The sample workspace has been restored.");
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch (removeError) {
          console.error("Could not remove invalid saved retail data.", removeError);
        }
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Could not save retail data to this browser.", error);
      toast.error("Your browser could not save this update. Check available storage.");
    }
  }, [data, ready]);

  const update = useCallback((updater: Update) => {
    const next = updater(dataRef.current);
    dataRef.current = next;
    setData(next);
  }, []);

  const saveProduct = useCallback((input: Omit<Product, "id"> & { id?: string }) => {
    const savedId = input.id ?? newId("prd");
    update((previous) => {
      const duplicate = previous.products.some((item) => item.sku.toLowerCase() === input.sku.trim().toLowerCase() && item.id !== savedId);
      if (duplicate) throw new Error("A product with this SKU already exists.");
      const exists = previous.products.some((item) => item.id === savedId);
      const nextProduct: Product = { ...input, id: savedId, name: input.name.trim(), sku: input.sku.trim() };
      if (exists) return { ...previous, products: previous.products.map((item) => item.id === savedId ? { ...item, ...nextProduct, stock: item.stock } : item) };
      const opening = input.stock;
      const product = { ...nextProduct, stock: 0 };
      const movement: InventoryMovement = {
        id: newId("mov"), productId: savedId, productName: product.name, type: "Opening Stock",
        quantity: opening, balance: opening, reference: "OPENING", reason: "Opening stock",
        user: currentUser(previous), createdAt: new Date().toISOString(),
      };
      return { ...previous, products: [...previous.products, { ...product, stock: opening }], movements: [movement, ...previous.movements] };
    });
    return savedId;
  }, [update]);

  const completeSale = useCallback((input: Omit<Sale, "id" | "reference" | "createdAt" | "cashier" | "status">) => {
    if (input.items.length === 0) throw new Error("Add at least one product before checkout.");
    if (input.total <= 0 || input.discount < 0 || input.discount > input.subtotal) throw new Error("Check the sale total and discount.");
    if (input.paymentMethod === "Cash" && input.amountReceived < input.total) throw new Error("Cash received must cover the amount due.");
    const quantities = new Map<string, number>();
    input.items.forEach((item) => quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity));
    for (const [productId, quantity] of quantities) {
      const product = data.products.find((candidate) => candidate.id === productId);
      if (!product || product.archived) throw new Error(`${input.items.find((item) => item.productId === productId)?.name ?? "Product"} is no longer available.`);
      if (product.stock < quantity) throw new Error(`Only ${product.stock} ${product.name} available. Your cart is unchanged.`);
    }
    const id = newId("sale");
    const reference = `EE-${Date.now().toString().slice(-8)}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    const createdAt = new Date().toISOString();
    const sale: Sale = {
      ...input, id, reference, createdAt, cashier: currentUser(data), status: "Completed",
      customerName: input.customerName || "Walk-in Customer",
    };
    update((previous) => {
      if (input.items.length === 0) throw new Error("Add at least one product before checkout.");
      if (input.total <= 0 || input.discount < 0 || input.discount > input.subtotal) throw new Error("Check the sale total and discount.");
      if (input.paymentMethod === "Cash" && input.amountReceived < input.total) throw new Error("Cash received must cover the amount due.");
      for (const [productId, quantity] of quantities) {
        const product = previous.products.find((candidate) => candidate.id === productId);
        if (!product || product.archived) throw new Error(`${input.items.find((item) => item.productId === productId)?.name ?? "Product"} is no longer available.`);
        if (product.stock < quantity) throw new Error(`Only ${product.stock} ${product.name} available. Your cart is unchanged.`);
      }
      const products = previous.products.map((product) => {
        const qty = quantities.get(product.id) ?? 0;
        return qty > 0 ? { ...product, stock: product.stock - qty } : product;
      });
      const movements = input.items.map((item) => {
        const product = products.find((candidate) => candidate.id === item.productId)!;
        return {
          id: newId("mov"), productId: item.productId, productName: item.name, type: "Sale",
          quantity: -item.quantity, balance: product.stock, reference, reason: `Sale to ${sale.customerName}`,
          user: sale.cashier, createdAt,
        };
      });
      return { ...previous, products, sales: [sale, ...previous.sales], movements: [...movements, ...previous.movements] };
    });
    return sale;
  }, [data, update]);

  const adjustStock = useCallback((productId: string, newQuantity: number, reason: string, notes = "") => {
    const product = data.products.find((item) => item.id === productId);
    if (!product) throw new Error("Product not found.");
    if (!Number.isInteger(newQuantity) || newQuantity < 0) throw new Error("Counted stock must be a non-negative whole number.");
    const difference = newQuantity - product.stock;
    if (difference === 0) throw new Error("The count matches the current stock; no adjustment is needed.");
    const createdAt = new Date().toISOString();
    update((previous) => {
      const currentProduct = previous.products.find((item) => item.id === productId);
      if (!currentProduct) throw new Error("Product not found.");
      if (!Number.isInteger(newQuantity) || newQuantity < 0) throw new Error("Counted stock must be a non-negative whole number.");
      if (newQuantity === currentProduct.stock) throw new Error("The count matches the current stock; no adjustment is needed.");
      const currentDifference = newQuantity - currentProduct.stock;
      return {
        ...previous,
        products: previous.products.map((item) => item.id === productId ? { ...item, stock: newQuantity } : item),
        movements: [{
          id: newId("mov"), productId, productName: currentProduct.name, type: "Stock Adjustment",
          quantity: currentDifference, balance: newQuantity, reference: `ADJ-${Date.now().toString().slice(-6)}`,
          reason: `${reason}${notes ? ` — ${notes}` : ""}`, user: currentUser(previous), createdAt,
        }, ...previous.movements],
      };
    });
  }, [data.products, update]);

  const recordPurchase = useCallback((input: Omit<Purchase, "id">) => {
    const supplier = data.suppliers.find((item) => item.id === input.supplierId);
    if (!supplier) throw new Error("Choose an existing supplier.");
    if (!input.items.length || input.total <= 0) throw new Error("Add at least one purchase item.");
    if (input.amountPaid < 0 || input.amountPaid > input.total) throw new Error("Amount paid must be between zero and the purchase total.");
    for (const line of input.items) {
      if (!data.products.some((item) => item.id === line.productId)) throw new Error(`${line.name} is no longer available.`);
      if (!Number.isInteger(line.quantity) || line.quantity <= 0 || !Number.isInteger(line.received) || line.received < 0 || line.received > line.quantity || line.unitCost < 0) {
        throw new Error("Check ordered quantity, received quantity and unit cost.");
      }
    }
    const purchase: Purchase = { ...input, id: newId("pur") };
    update((previous) => {
      const currentSupplier = previous.suppliers.find((item) => item.id === purchase.supplierId);
      if (!currentSupplier) throw new Error("Choose an existing supplier.");
      if (!purchase.items.length || purchase.total <= 0) throw new Error("Add at least one purchase item.");
      if (purchase.amountPaid < 0 || purchase.amountPaid > purchase.total) throw new Error("Amount paid must be between zero and the purchase total.");
      const products = [...previous.products];
      const movements = [...previous.movements];
      for (const line of purchase.items) {
        const productIndex = products.findIndex((item) => item.id === line.productId);
        if (productIndex < 0) throw new Error(`${line.name} is no longer available.`);
        if (!Number.isInteger(line.quantity) || line.quantity <= 0 || !Number.isInteger(line.received) || line.received < 0 || line.received > line.quantity || line.unitCost < 0) {
          throw new Error("Check ordered quantity, received quantity and unit cost.");
        }
        if (line.received < 0 || line.received > line.quantity) throw new Error("Received quantity must be between zero and ordered quantity.");
        const product = products[productIndex];
        if (line.received > 0) {
          const oldStock = product.stock;
          const newStock = oldStock + line.received;
          const averageCost = (oldStock * product.costPrice + line.received * line.unitCost) / newStock;
          products[productIndex] = { ...product, stock: newStock, costPrice: Number(averageCost.toFixed(2)) };
          movements.unshift({
            id: newId("mov"), productId: product.id, productName: product.name, type: "Stock Received",
            quantity: line.received, balance: newStock, reference: purchase.reference,
            reason: `Received from ${currentSupplier.name}`, user: currentUser(previous), createdAt: purchase.createdAt,
          });
        }
      }
      return { ...previous, products, movements, purchases: [purchase, ...previous.purchases] };
    });
    return purchase;
  }, [data.products, data.suppliers, update]);

  const receivePurchase = useCallback((purchaseId: string, received: Record<string, number>) => {
    const currentPurchase = data.purchases.find((item) => item.id === purchaseId);
    if (!currentPurchase) throw new Error("Purchase not found.");
    currentPurchase.items.forEach((line) => {
      const add = received[line.productId] ?? 0;
      if (!Number.isInteger(add) || add < 0 || line.received + add > line.quantity) throw new Error(`Check received quantity for ${line.name}.`);
      if (add > 0 && !data.products.some((product) => product.id === line.productId)) throw new Error(`Product ${line.name} was not found.`);
    });
    update((previous) => {
      const purchase = previous.purchases.find((item) => item.id === purchaseId);
      if (!purchase) throw new Error("Purchase not found.");
      const products = [...previous.products];
      const movements: InventoryMovement[] = [];
      const items = purchase.items.map((line) => {
        const add = received[line.productId] ?? 0;
        if (!Number.isInteger(add) || add < 0 || line.received + add > line.quantity) throw new Error(`Check received quantity for ${line.name}.`);
        if (add > 0) {
          const productIndex = products.findIndex((product) => product.id === line.productId);
          if (productIndex < 0) throw new Error(`Product ${line.name} was not found.`);
          const product = products[productIndex];
          const stock = product.stock + add;
          products[productIndex] = { ...product, stock, costPrice: Number(((product.stock * product.costPrice + add * line.unitCost) / stock).toFixed(2)) };
          movements.push({
            id: newId("mov"), productId: product.id, productName: product.name, type: "Stock Received",
            quantity: add, balance: stock, reference: purchase.reference,
            reason: `Delivery received from ${purchase.supplierName}`, user: currentUser(previous), createdAt: new Date().toISOString(),
          });
        }
        return { ...line, received: line.received + add };
      });
      const status = items.every((item) => item.received === item.quantity) ? "Received" : items.some((item) => item.received > 0) ? "Partially received" : "Pending";
      return {
        ...previous,
        products,
        movements: [...movements, ...previous.movements],
        purchases: previous.purchases.map((item) => item.id === purchaseId ? { ...item, items, status } : item),
      };
    });
  }, [data.products, data.purchases, update]);

  const recordExpense = useCallback((input: Omit<Expense, "id"> & { id?: string }) => {
    if (!input.title.trim() || !Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Enter an expense description and a positive amount.");
    const expense: Expense = { ...input, id: input.id ?? newId("exp"), title: input.title.trim() };
    update((previous) => {
      if (!input.title.trim() || !Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Enter an expense description and a positive amount.");
      const exists = previous.expenses.some((item) => item.id === expense.id);
      return { ...previous, expenses: exists ? previous.expenses.map((item) => item.id === expense.id ? expense : item) : [expense, ...previous.expenses] };
    });
  }, [update]);

  const value = useMemo(() => ({ data, ready, update, saveProduct, completeSale, adjustStock, recordPurchase, receivePurchase, recordExpense }), [
    data, ready, update, saveProduct, completeSale, adjustStock, recordPurchase, receivePurchase, recordExpense,
  ]);

  return <RetailContext.Provider value={value}>{children}</RetailContext.Provider>;
}

function currentUser(data: RetailData) {
  return data.users.find((user) => user.id === data.activeUserId)?.name ?? "Owner";
}

export function useRetail() {
  const context = useContext(RetailContext);
  if (!context) throw new Error("useRetail must be used within RetailProvider.");
  return context;
}

export type { PurchaseItem, SaleItem };
