"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Download,
  Printer,
  Search,
  Share2,
  ShoppingBag,
  Trash2,
  UserRoundPlus,
} from "lucide-react";
import { toast } from "sonner";
import { usePathname, useRouter } from "next/navigation";
import { dateTime, money, newId } from "@/lib/format";
import { useRetail } from "@/lib/store";
import type { PaymentMethod, Sale, SaleItem } from "@/lib/retail-types";
import {
  Button,
  DataTable,
  Field,
  Modal,
  PageHeading,
  Pagination,
  Panel,
  SearchInput,
  SelectField,
  Status,
  Toolbar,
} from "@/components/retail-ui";

const paymentMethods: PaymentMethod[] = [
  "Cash",
  "Mobile Money",
  "Card",
  "Bank Transfer",
  "Other",
];

export function SalesPage() {
  const pathname = usePathname();
  const { data, completeSale, update } = useRetail();
  const saleRoute = pathname.startsWith("/sales/")
    ? pathname.split("/")[2]
    : undefined;
  const selectedSale = saleRoute
    ? data.sales.find(
        (sale) => sale.id === saleRoute || sale.reference === saleRoute,
      )
    : undefined;
  const isPos = pathname === "/pos";
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("All methods");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [dateFilter, setDateFilter] = useState("All time");
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("Cash");
  const [received, setReceived] = useState(0);
  const [busy, setBusy] = useState(false);
  const checkoutLock = useRef(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [category, setCategory] = useState("All categories");
  const [productSearch, setProductSearch] = useState("");
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);
  const [page, setPage] = useState(1);

  const subtotal = cart.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const appliedDiscount = Number.isFinite(discount) ? discount : 0;
  const cashReceived = Number.isFinite(received) ? received : 0;
  const total = Math.max(0, subtotal - appliedDiscount);
  const filteredProducts = data.products.filter(
    (item) =>
      !item.archived &&
      item.stock > 0 &&
      (category === "All categories" || item.category === category) &&
      `${item.name} ${item.sku} ${item.barcode}`
        .toLowerCase()
        .includes(productSearch.toLowerCase()),
  );

  const addToCart = (productId: string) => {
    const product = data.products.find((item) => item.id === productId);
    if (!product) return;
    const existingQty =
      cart.find((item) => item.productId === productId)?.quantity ?? 0;
    if (existingQty >= product.stock)
      return toast.error(`Only ${product.stock} ${product.name} available.`);
    setCart((previous) => {
      const existing = previous.find((item) => item.productId === productId);
      if (existing)
        return previous.map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      return [
        ...previous,
        {
          productId,
          name: product.name,
          sku: product.sku,
          quantity: 1,
          unitPrice: product.sellingPrice,
          unitCost: product.costPrice,
        },
      ];
    });
  };

  const changeQuantity = (productId: string, quantity: number) => {
    const product = data.products.find((item) => item.id === productId);
    if (!product) return;
    if (quantity > product.stock) {
      toast.error(`Only ${product.stock} ${product.name} available.`);
      return;
    }
    if (quantity < 1)
      setCart((previous) =>
        previous.filter((item) => item.productId !== productId),
      );
    else
      setCart((previous) =>
        previous.map((item) =>
          item.productId === productId ? { ...item, quantity } : item,
        ),
      );
  };

  const addCustomer = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customerName.trim() || !customerPhone.trim())
      return toast.error("Enter the customer's name and phone.");
    const customer = {
      id: newId("cus"),
      name: customerName.trim(),
      phone: customerPhone.trim(),
      email: "",
      notes: "",
    };
    update((previous) => ({
      ...previous,
      customers: [customer, ...previous.customers],
    }));
    setCustomerId(customer.id);
    setCustomerName("");
    setCustomerPhone("");
    setNewCustomerOpen(false);
    toast.success("Customer added to this sale");
  };

  const checkout = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (checkoutLock.current) return;
    if (!cart.length) return toast.error("Add products to the cart first.");
    if (total <= 0) return toast.error("Sale total must be greater than zero.");
    if (
      payMethod === "Cash" &&
      (!Number.isFinite(received) || received < total)
    )
      return toast.error("Amount received must cover the amount due.");
    checkoutLock.current = true;
    setBusy(true);
    try {
      const customer = data.customers.find((item) => item.id === customerId);
      const sale = completeSale({
        customerId: customer?.id ?? null,
        customerName: customer?.name ?? "Walk-in Customer",
        items: cart.map((item) => ({ ...item })),
        subtotal,
        discount: appliedDiscount,
        total,
        paymentMethod: payMethod,
        amountReceived: payMethod === "Cash" ? cashReceived : total,
        change: payMethod === "Cash" ? cashReceived - total : 0,
      });
      setPaymentOpen(false);
      setReceiptSale(sale);
      setCart([]);
      setDiscount(0);
      setCustomerId("");
      toast.success(`Sale ${sale.reference} completed`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not complete sale. Your cart is unchanged.",
      );
    } finally {
      checkoutLock.current = false;
      setBusy(false);
    }
  };

  const visibleSales = useMemo(() => {
    let rows = data.sales.filter((sale) =>
      `${sale.reference} ${sale.customerName} ${sale.cashier}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
    if (paymentFilter !== "All methods")
      rows = rows.filter((sale) => sale.paymentMethod === paymentFilter);
    if (statusFilter !== "All statuses")
      rows = rows.filter((sale) => sale.status === statusFilter);
    if (dateFilter !== "All time") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const days =
        dateFilter === "Today" ? 1 : dateFilter === "Last 7 days" ? 7 : 30;
      const start = new Date(today);
      start.setDate(start.getDate() - days + 1);
      rows = rows.filter((sale) => new Date(sale.createdAt) >= start);
    }
    return rows;
  }, [data.sales, dateFilter, paymentFilter, search, statusFilter]);
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(visibleSales.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = visibleSales.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  if (isPos && receiptSale)
    return (
      <ReceiptConfirmation
        sale={receiptSale}
        onNewSale={() => setReceiptSale(null)}
      />
    );
  if (isPos)
    return (
      <div className="page-content pos-page">
        <PageHeading
          title="New sale"
          description="Scan or search for a product, then check out in a few steps."
          action={
            <Link className="button button-secondary" href="/sales">
              <ShoppingBag size={16} /> Sales history
            </Link>
          }
        />
        <div className="pos-layout">
          <div className="pos-products">
            <Panel className="pos-picker">
              <div className="pos-search-row">
                <label className="search-input">
                  <Search size={17} />
                  <input
                    autoFocus
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Search name, SKU or barcode..."
                  />
                </label>
                <label className="select-compact">
                  <span className="sr-only">Filter products by category</span>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                  >
                    <option>All categories</option>
                    {data.categories.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="pos-product-grid">
                {filteredProducts.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="pos-product-card"
                    onClick={() => addToCart(item.id)}
                  >
                    <span className="product-avatar large">
                      {item.name.slice(0, 1)}
                    </span>
                    <span className="pos-product-name">{item.name}</span>
                    <strong>
                      {money(item.sellingPrice, data.settings.currency)}
                    </strong>
                    <small>
                      {item.stock} in stock · {item.sku}
                    </small>
                  </button>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="empty-state">
                    No in-stock products found. Try another search or check
                    inventory.
                  </div>
                )}
              </div>
            </Panel>
          </div>
          <Panel className="cart-panel">
            <div className="cart-heading">
              <div>
                <h2>Current sale</h2>
                <p>
                  {cart.reduce((sum, item) => sum + item.quantity, 0)} items
                </p>
              </div>
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  if (
                    cart.length &&
                    window.confirm("Clear all items from this sale?")
                  )
                    setCart([]);
                }}
              >
                Clear cart
              </button>
            </div>
            <div className="customer-picker">
              <SelectField
                label="Customer"
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
              >
                <option value="">Walk-in Customer</option>
                {data.customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} · {customer.phone}
                  </option>
                ))}
              </SelectField>
              <button
                className="icon-button"
                type="button"
                aria-label="Add a customer"
                title="Add customer"
                onClick={() => setNewCustomerOpen(true)}
              >
                <UserRoundPlus size={17} />
              </button>
            </div>
            <div className="cart-items">
              {cart.map((item) => (
                <div className="cart-item" key={item.productId}>
                  <div className="cart-item-top">
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {money(item.unitPrice, data.settings.currency)} each
                      </small>
                    </span>
                    <button
                      className="icon-link danger-link"
                      type="button"
                      aria-label={`Remove ${item.name}`}
                      onClick={() =>
                        setCart((previous) =>
                          previous.filter(
                            (entry) => entry.productId !== item.productId,
                          ),
                        )
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="cart-item-bottom">
                    <div className="quantity-stepper">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() =>
                          changeQuantity(item.productId, item.quantity - 1)
                        }
                      >
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={() =>
                          changeQuantity(item.productId, item.quantity + 1)
                        }
                      >
                        +
                      </button>
                    </div>
                    <strong>
                      {money(
                        item.unitPrice * item.quantity,
                        data.settings.currency,
                      )}
                    </strong>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="cart-empty">
                  <span>
                    <ShoppingBag size={21} />
                  </span>
                  <strong>Your cart is empty</strong>
                  <p>Select products to start a sale.</p>
                </div>
              )}
            </div>
            <div className="cart-summary">
              <div>
                <span>Subtotal</span>
                <strong>{money(subtotal, data.settings.currency)}</strong>
              </div>
              <label>
                <span>Discount</span>
                <span className="discount-input">
                  <span>{data.settings.currency}</span>
                  <input
                    aria-label="Discount amount"
                    type="number"
                    min="0"
                    max={subtotal}
                    step="0.01"
                    value={
                      Number.isFinite(discount) && discount !== 0
                        ? discount
                        : ""
                    }
                    onChange={(event) =>
                      setDiscount(
                        event.target.value === ""
                          ? Number.NaN
                          : Math.min(
                              subtotal,
                              Math.max(0, Number(event.target.value)),
                            ),
                      )
                    }
                    placeholder="0.00"
                  />
                </span>
              </label>
              <div className="cart-total">
                <span>Total due</span>
                <strong>{money(total, data.settings.currency)}</strong>
              </div>
              <Button
                className="checkout-button"
                disabled={!cart.length}
                onClick={() => {
                  setReceived(total);
                  setPaymentOpen(true);
                }}
              >
                Continue to payment{" "}
                <ArrowLeft className="checkout-arrow" size={16} />
              </Button>
            </div>
          </Panel>
        </div>
        <Modal
          title="Add a customer"
          description="Customer details are optional. You can continue with a walk-in sale."
          open={newCustomerOpen}
          onClose={() => setNewCustomerOpen(false)}
        >
          <form className="modal-form" onSubmit={addCustomer}>
            <Field
              label="Full name"
              required
              autoFocus
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
            />
            <Field
              label="Phone number"
              required
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
            />
            <div className="modal-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setNewCustomerOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Add customer</Button>
            </div>
          </form>
        </Modal>
        <Modal
          title="Take payment"
          description="Payments are recorded locally for this prototype; no real payment is processed."
          open={paymentOpen}
          onClose={() => setPaymentOpen(false)}
        >
          <form onSubmit={checkout} className="modal-form">
            <div className="payment-due">
              <span>Amount due</span>
              <strong>{money(total, data.settings.currency)}</strong>
            </div>
            <SelectField
              label="Payment method"
              value={payMethod}
              onChange={(event) =>
                setPayMethod(event.target.value as PaymentMethod)
              }
            >
              {paymentMethods.map((method) => (
                <option key={method}>{method}</option>
              ))}
            </SelectField>
            {payMethod === "Cash" ? (
              <>
                <Field
                  label={`Cash received (${data.settings.currency})`}
                  type="number"
                  min={total}
                  step="0.01"
                  required
                  value={Number.isFinite(received) ? received : ""}
                  onChange={(event) =>
                    setReceived(
                      event.target.value === ""
                        ? Number.NaN
                        : Number(event.target.value),
                    )
                  }
                />
                <div className="change-due">
                  <span>Change due</span>
                  <strong>
                    {money(
                      Math.max(0, cashReceived - total),
                      data.settings.currency,
                    )}
                  </strong>
                </div>
              </>
            ) : (
              <div className="inline-alert blue">
                Record this {payMethod} payment as confirmed only after you have
                verified it outside this prototype.
              </div>
            )}
            <div className="modal-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPaymentOpen(false)}
              >
                Back to sale
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Completing..." : "Complete sale"}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    );

  if (pathname.startsWith("/sales/")) {
    return selectedSale ? (
      <SaleDetail sale={selectedSale} />
    ) : (
      <div className="page-content">
        <PageHeading
          title="Transaction not found"
          description="This receipt may have been removed or the link is incorrect."
          action={
            <Link href="/sales" className="button button-secondary">
              <ArrowLeft size={16} /> Sales history
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="page-content">
      <PageHeading
        title="Sales history"
        description="Every checkout, in one place. Select a receipt to view its details."
        action={
          <Link className="button button-primary" href="/pos">
            <ShoppingBag size={16} /> New sale
          </Link>
        }
      />
      <div className="stats-row compact-stats">
        <div>
          <span>Total transactions</span>
          <strong>{data.sales.length}</strong>
        </div>
        <div>
          <span>Sales today</span>
          <strong>
            {money(
              data.sales
                .filter(
                  (sale) =>
                    new Date(sale.createdAt).toDateString() ===
                    new Date().toDateString(),
                )
                .reduce((sum, sale) => sum + sale.total, 0),
              data.settings.currency,
            )}
          </strong>
        </div>
        <div>
          <span>Average transaction</span>
          <strong>
            {money(
              data.sales.length
                ? data.sales.reduce((sum, sale) => sum + sale.total, 0) /
                    data.sales.length
                : 0,
              data.settings.currency,
            )}
          </strong>
        </div>
      </div>
      <Panel className="table-panel">
        <Toolbar>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search receipt, customer or cashier..."
          />
          <SelectField
            label="Date"
            aria-label="Filter sales by date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
          >
            <option>All time</option>
            <option>Today</option>
            <option>Last 7 days</option>
            <option>Last 30 days</option>
          </SelectField>
          <SelectField
            label="Payment"
            aria-label="Filter by payment method"
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value)}
          >
            <option>All methods</option>
            {paymentMethods.map((method) => (
              <option key={method}>{method}</option>
            ))}
          </SelectField>
          <SelectField
            label="Status"
            aria-label="Filter by transaction status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option>All statuses</option>
            <option>Completed</option>
            <option>Refunded</option>
          </SelectField>
        </Toolbar>
        <DataTable
          empty={
            visibleSales.length
              ? undefined
              : "No transactions match your search."
          }
        >
          <thead>
            <tr>
              <th>Receipt</th>
              <th>Date and time</th>
              <th>Customer</th>
              <th>Cashier</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((sale) => (
              <tr key={sale.id}>
                <td>
                  <Link
                    href={`/sales/${sale.id}`}
                    className="table-primary-link mono"
                  >
                    {sale.reference}
                  </Link>
                </td>
                <td>{dateTime(sale.createdAt, data.settings.timezone)}</td>
                <td>{sale.customerName}</td>
                <td>{sale.cashier}</td>
                <td>
                  <strong>{money(sale.total, data.settings.currency)}</strong>
                </td>
                <td>{sale.paymentMethod}</td>
                <td>
                  <Status tone={sale.status === "Completed" ? "green" : "red"}>
                    {sale.status}
                  </Status>
                </td>
                <td>
                  <Link className="text-button" href={`/sales/${sale.id}`}>
                    Receipt
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        <Pagination
          page={currentPage}
          pageCount={pageCount}
          pageSize={pageSize}
          total={visibleSales.length}
          onChange={setPage}
        />
      </Panel>
    </div>
  );
}

function Receipt({ sale }: { sale: Sale }) {
  const { data } = useRetail();
  return (
    <article className="receipt-paper" id="print-receipt">
      <div className="receipt-brand">
        <span className="brand-mark">E</span>
        <h2>{data.settings.name}</h2>
        <p>{data.settings.address}</p>
        <p>
          {data.settings.phone} · {data.settings.email}
        </p>
      </div>
      <div className="receipt-rule" />
      <div className="receipt-meta">
        <div>
          <span>Receipt</span>
          <strong>{sale.reference}</strong>
        </div>
        <div>
          <span>Date</span>
          <strong>{dateTime(sale.createdAt, data.settings.timezone)}</strong>
        </div>
        <div>
          <span>Cashier</span>
          <strong>{sale.cashier}</strong>
        </div>
        <div>
          <span>Customer</span>
          <strong>{sale.customerName}</strong>
        </div>
      </div>
      <div className="receipt-rule" />
      <div className="receipt-items">
        {sale.items.map((item, index) => (
          <div className="receipt-item" key={`${item.productId}-${index}`}>
            <div>
              <strong>{item.name}</strong>
              <small>
                {item.quantity} ×{" "}
                {money(item.unitPrice, data.settings.currency)}
              </small>
            </div>
            <strong>
              {money(item.quantity * item.unitPrice, data.settings.currency)}
            </strong>
          </div>
        ))}
      </div>
      <div className="receipt-rule" />
      <div className="receipt-totals">
        <div>
          <span>Subtotal</span>
          <span>{money(sale.subtotal, data.settings.currency)}</span>
        </div>
        {sale.discount > 0 && (
          <div>
            <span>Discount</span>
            <span>−{money(sale.discount, data.settings.currency)}</span>
          </div>
        )}
        <div className="receipt-grand-total">
          <strong>Total</strong>
          <strong>{money(sale.total, data.settings.currency)}</strong>
        </div>
        <div>
          <span>Payment</span>
          <span>{sale.paymentMethod}</span>
        </div>
        {sale.paymentMethod === "Cash" && (
          <>
            <div>
              <span>Amount received</span>
              <span>{money(sale.amountReceived, data.settings.currency)}</span>
            </div>
            <div>
              <span>Change</span>
              <span>{money(sale.change, data.settings.currency)}</span>
            </div>
          </>
        )}
      </div>
      <div className="receipt-rule" />
      <p className="receipt-footer">{data.settings.receiptFooter}</p>
    </article>
  );
}

function ReceiptActions({ sale }: { sale: Sale }) {
  const { data } = useRetail();
  const share = async () => {
    const text = `${sale.reference} · ${money(sale.total, data.settings.currency)} · ${dateTime(sale.createdAt, data.settings.timezone)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Receipt ${sale.reference}`, text });
        toast.success("Receipt shared");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        toast.error(
          "Could not share this receipt. You can print or save it as a PDF.",
        );
      }
      return;
    }
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(
          `${text}\n${sale.items.map((item) => `${item.quantity} × ${item.name}: ${money(item.quantity * item.unitPrice, data.settings.currency)}`).join("\n")}`,
        );
        toast.success("Receipt summary copied to clipboard");
        return;
      } catch {
        toast.message(
          "Clipboard access is unavailable. Use the print dialog to save or print this receipt.",
        );
      }
    } else {
      toast.message(
        "Native sharing is unavailable. Use the print dialog to save or print this receipt.",
      );
    }
    window.print();
  };
  return (
    <div className="receipt-actions">
      <Button variant="secondary" onClick={() => window.print()}>
        <Download size={15} /> Save as PDF
      </Button>
      <Button variant="secondary" onClick={() => window.print()}>
        <Printer size={15} /> Print
      </Button>
      <Button onClick={() => void share()}>
        <Share2 size={15} /> Share receipt
      </Button>
    </div>
  );
}

function SaleDetail({ sale }: { sale: Sale }) {
  const { data } = useRetail();
  return (
    <div className="page-content">
      <PageHeading
        title="Sale receipt"
        description={`Transaction ${sale.reference}`}
        action={
          <Link href="/sales" className="button button-secondary">
            <ArrowLeft size={16} /> Sales history
          </Link>
        }
      />
      <div className="receipt-layout">
        <div className="receipt-paper-wrap">
          <Receipt sale={sale} />
        </div>
        <aside className="receipt-aside">
          <Panel>
            <div className="receipt-success">
              <span>
                <Check size={20} />
              </span>
              <div>
                <strong>Sale completed</strong>
                <small>
                  {dateTime(sale.createdAt, data.settings.timezone)}
                </small>
              </div>
            </div>
            <div className="receipt-aside-total">
              <span>Total paid</span>
              <strong>{money(sale.total, data.settings.currency)}</strong>
            </div>
            <ReceiptActions sale={sale} />
            <div className="receipt-aside-links">
              <Link href="/pos" className="button button-primary">
                <ShoppingBag size={15} /> New sale
              </Link>
            </div>
          </Panel>
          <Panel>
            <div className="panel-heading">
              <div>
                <h2>Transaction info</h2>
              </div>
            </div>
            <div className="detail-list">
              <div>
                <span>Receipt number</span>
                <strong>{sale.reference}</strong>
              </div>
              <div>
                <span>Cashier</span>
                <strong>{sale.cashier}</strong>
              </div>
              <div>
                <span>Customer</span>
                <strong>{sale.customerName}</strong>
              </div>
              <div>
                <span>Payment method</span>
                <strong>{sale.paymentMethod}</strong>
              </div>
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function ReceiptConfirmation({
  sale,
  onNewSale,
}: {
  sale: Sale;
  onNewSale: () => void;
}) {
  const router = useRouter();
  const { data } = useRetail();
  return (
    <div className="page-content">
      <div className="success-banner">
        <span>
          <Check size={19} />
        </span>
        <div>
          <h1>Sale completed</h1>
          <p>{sale.reference} has been saved and stock has been updated.</p>
        </div>
        <strong>{money(sale.total, data.settings.currency)}</strong>
      </div>
      <div className="receipt-layout confirmation-layout">
        <div className="receipt-paper-wrap">
          <Receipt sale={sale} />
        </div>
        <aside className="receipt-aside">
          <Panel>
            <div className="panel-heading">
              <div>
                <h2>Next steps</h2>
                <p>Your receipt is ready.</p>
              </div>
            </div>
            <ReceiptActions sale={sale} />
            <div className="receipt-aside-links vertical">
              <Link
                href={`/sales/${sale.id}`}
                className="button button-secondary"
              >
                View full receipt
              </Link>
              <Button onClick={onNewSale}>
                <ShoppingBag size={15} /> New sale
              </Button>
              <Button variant="ghost" onClick={() => router.push("/sales")}>
                View sales history
              </Button>
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
