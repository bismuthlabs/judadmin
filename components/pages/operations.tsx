"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Edit2,
  Plus,
  Truck,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { usePathname, useRouter } from "next/navigation";
import { csvDownload, dateTime, money, newId, shortDate } from "@/lib/format";
import { useRetail } from "@/lib/store";
import type {
  Customer,
  Expense,
  PaymentMethod,
  Product,
  PurchaseItem,
  Supplier,
} from "@/lib/retail-types";
import {
  Button,
  DataTable,
  Field,
  Modal,
  PageHeading,
  Panel,
  SearchInput,
  SelectField,
  Status,
  TextAreaField,
  Toolbar,
} from "@/components/retail-ui";

function stockStatus(product: Product) {
  if (product.stock === 0) return <Status tone="red">Out of stock</Status>;
  if (product.stock <= product.reorderLevel)
    return <Status tone="amber">Low stock</Status>;
  return <Status tone="green">Healthy</Status>;
}

export function InventoryPage() {
  const pathname = usePathname();
  const { data, adjustStock } = useRetail();
  const [query, setQuery] = useState("");
  const [productId, setProductId] = useState("");
  const [count, setCount] = useState(0);
  const [reason, setReason] = useState("Physical count");
  const [notes, setNotes] = useState("");
  const [moveType, setMoveType] = useState("All movement types");
  const products = data.products.filter((item) => !item.archived);
  const selectedProduct = products.find((item) => item.id === productId);
  const movements = data.movements
    .filter((move) =>
      `${move.productName} ${move.reference} ${move.reason}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .filter(
      (move) => moveType === "All movement types" || move.type === moveType,
    );
  const pageTitle = pathname.endsWith("/movements")
    ? "Stock movements"
    : pathname.endsWith("/adjustments")
      ? "Stock adjustments"
      : pathname.endsWith("/stocktake")
        ? "Stocktake"
        : "Inventory";

  if (pathname.endsWith("/adjustments"))
    return (
      <div className="page-content">
        <PageHeading
          title="Stock adjustments"
          description="Correct inventory counts with a clear reason and a complete audit trail."
          action={
            <Link className="button button-secondary" href="/inventory">
              <ArrowLeft size={16} /> Inventory
            </Link>
          }
        />
        <div className="inventory-workflow-grid">
          <Panel>
            <div className="form-section-heading">
              <h2>Record an adjustment</h2>
              <p>
                Physical counts are recorded as movements, never overwritten.
              </p>
            </div>
            <form
              className="modal-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!selectedProduct)
                  return toast.error("Select a product to adjust.");
                if (!Number.isInteger(count) || count < 0)
                  return toast.error("Counted quantity must be a non-negative whole number.");
                try {
                  adjustStock(productId, count, reason, notes);
                  toast.success(`Stock adjusted for ${selectedProduct.name}`);
                  setNotes("");
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Could not adjust stock.",
                  );
                }
              }}
            >
              <SelectField
                label="Product"
                required
                value={productId}
                onChange={(event) => {
                  const item = products.find(
                    (product) => product.id === event.target.value,
                  );
                  setProductId(event.target.value);
                  setCount(item?.stock ?? 0);
                }}
              >
                <option value="">Select a product</option>
                {products.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.sku})
                  </option>
                ))}
              </SelectField>
              {selectedProduct && (
                <div className="current-stock-note">
                  <span>Current system quantity</span>
                  <strong>{selectedProduct.stock} units</strong>
                </div>
              )}
              <Field
                label="Counted quantity"
                type="number"
                min="0"
                step="1"
                value={Number.isFinite(count) ? count : ""}
                onChange={(event) =>
                  setCount(event.target.value === "" ? Number.NaN : Number(event.target.value))
                }
                required
              />
              {selectedProduct && (
                <div
                  className={`adjustment-difference ${!Number.isFinite(count) ? "muted" : count - selectedProduct.stock < 0 ? "negative" : "positive"}`}
                >
                  <span>Adjustment</span>
                  <strong>
                    {Number.isFinite(count)
                      ? `${count - selectedProduct.stock > 0 ? "+" : ""}${count - selectedProduct.stock} units`
                      : "Enter counted quantity"}
                  </strong>
                </div>
              )}
              <SelectField
                label="Reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              >
                <option>Physical count</option>
                <option>Damaged goods</option>
                <option>Expired goods</option>
                <option>Lost or missing</option>
                <option>Data correction</option>
                <option>Other</option>
              </SelectField>
              <TextAreaField
                label="Notes (optional)"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add details to help explain the adjustment"
              />
              <Button
                type="submit"
                disabled={!selectedProduct || count === selectedProduct.stock}
              >
                Confirm adjustment
              </Button>
            </form>
          </Panel>
          <Panel>
            <div className="panel-heading">
              <div>
                <h2>Recent adjustments</h2>
                <p>Latest inventory corrections</p>
              </div>
              <Link href="/inventory/movements" className="panel-link">
                All movements
              </Link>
            </div>
            <div className="activity-list">
              {data.movements
                .filter((move) => move.type === "Stock Adjustment")
                .slice(0, 8)
                .map((move) => (
                  <div className="activity-row" key={move.id}>
                    <span className="activity-icon amber">
                      <Warehouse size={16} />
                    </span>
                    <div>
                      <strong>{move.productName}</strong>
                      <small>
                        {move.reason} · {dateTime(move.createdAt)}
                      </small>
                    </div>
                    <strong
                      className={move.quantity < 0 ? "negative" : "positive"}
                    >
                      {move.quantity > 0 ? "+" : ""}
                      {move.quantity}
                    </strong>
                  </div>
                ))}
              {!data.movements.some(
                (move) => move.type === "Stock Adjustment",
              ) && (
                <div className="empty-state">No adjustments recorded yet.</div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    );

  if (pathname.endsWith("/stocktake"))
    return <StocktakePage products={products} onAdjust={adjustStock} />;

  if (pathname.endsWith("/movements"))
    return (
      <div className="page-content">
        <PageHeading
          title={pageTitle}
          description="A complete timeline of stock coming in and going out."
          action={
            <Link
              className="button button-primary"
              href="/inventory/adjustments"
            >
              <Plus size={16} /> Adjust stock
            </Link>
          }
        />
        <Panel className="table-panel">
          <Toolbar>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search product, reference or reason..."
            />
            <SelectField
              label="Movement type"
              aria-label="Filter by movement type"
              value={moveType}
              onChange={(event) => setMoveType(event.target.value)}
            >
              <option>All movement types</option>
              {Array.from(new Set(data.movements.map((move) => move.type))).map(
                (type) => (
                  <option key={type}>{type}</option>
                ),
              )}
            </SelectField>
            <div className="toolbar-spacer" />
            <Button
              variant="secondary"
              onClick={() =>
                csvDownload("stock-movements.csv", [
                  [
                    "Date",
                    "Product",
                    "Type",
                    "Quantity",
                    "Balance",
                    "Reference",
                    "Reason",
                  ],
                  ...movements.map((move) => [
                    dateTime(move.createdAt),
                    move.productName,
                    move.type,
                    move.quantity,
                    move.balance,
                    move.reference,
                    move.reason,
                  ]),
                ])
              }
            >
              <Download size={15} /> Export
            </Button>
          </Toolbar>
          <DataTable
            empty={movements.length ? undefined : "No movements found."}
          >
            <thead>
              <tr>
                <th>Date and time</th>
                <th>Product</th>
                <th>Movement</th>
                <th>Change</th>
                <th>Balance</th>
                <th>Reference</th>
                <th>Reason</th>
                <th>User</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((move) => (
                <tr key={move.id}>
                  <td>{dateTime(move.createdAt)}</td>
                  <td>
                    <Link
                      className="table-primary-link"
                      href={`/products/${move.productId}`}
                    >
                      {move.productName}
                    </Link>
                  </td>
                  <td>{move.type}</td>
                  <td className={move.quantity < 0 ? "negative" : "positive"}>
                    {move.quantity > 0 ? "+" : ""}
                    {move.quantity}
                  </td>
                  <td>{move.balance}</td>
                  <td className="mono">{move.reference}</td>
                  <td>{move.reason}</td>
                  <td>{move.user}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <div className="table-footer">
            <span>{movements.length} movements</span>
            <Link href="/inventory/stocktake" className="panel-link">
              Start stocktake
            </Link>
          </div>
        </Panel>
      </div>
    );

  return (
    <div className="page-content">
      <PageHeading
        title="Inventory"
        description="Stock levels, value and product availability across your shop."
        action={
          <>
            <Link
              className="button button-secondary"
              href="/inventory/stocktake"
            >
              <Warehouse size={16} /> Start stocktake
            </Link>
            <Link className="button button-primary" href="/purchases/new">
              <Plus size={16} /> Receive stock
            </Link>
          </>
        }
      />
      <div className="stats-row inventory-summary">
        <div>
          <span>Total units</span>
          <strong>
            {products
              .reduce((sum, product) => sum + product.stock, 0)
              .toLocaleString()}
          </strong>
        </div>
        <div>
          <span>Low-stock products</span>
          <strong>
            {
              products.filter(
                (item) => item.stock > 0 && item.stock <= item.reorderLevel,
              ).length
            }
          </strong>
        </div>
        <div>
          <span>Out of stock</span>
          <strong>{products.filter((item) => item.stock === 0).length}</strong>
        </div>
        <div>
          <span>Estimated stock value</span>
          <strong>
            {money(
              products.reduce(
                (sum, item) => sum + item.stock * item.costPrice,
                0,
              ),
              data.settings.currency,
            )}
          </strong>
        </div>
      </div>
      <Panel className="table-panel">
        <Toolbar>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search products..."
          />
          <div className="toolbar-spacer" />
          <Link className="button button-secondary" href="/inventory/movements">
            Movement history
          </Link>
        </Toolbar>
        <DataTable
          empty={products.length ? undefined : "No products in your inventory."}
        >
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Current stock</th>
              <th>Reorder level</th>
              <th>Status</th>
              <th>Cost value</th>
              <th>Last movement</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products
              .filter((item) =>
                `${item.name} ${item.sku}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((product) => {
                const latest = data.movements.find(
                  (item) => item.productId === product.id,
                );
                return (
                  <tr key={product.id}>
                    <td>
                      <Link
                        href={`/products/${product.id}`}
                        className="table-primary-link"
                      >
                        {product.name}
                      </Link>
                    </td>
                    <td className="mono">{product.sku}</td>
                    <td>
                      <strong>{product.stock}</strong>{" "}
                      <span className="muted">units</span>
                    </td>
                    <td>{product.reorderLevel}</td>
                    <td>{stockStatus(product)}</td>
                    <td>
                      {money(
                        product.stock * product.costPrice,
                        data.settings.currency,
                      )}
                    </td>
                    <td>{latest ? shortDate(latest.createdAt) : "—"}</td>
                    <td>
                      <Link
                        className="text-button"
                        href="/inventory/adjustments"
                      >
                        Adjust
                      </Link>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </DataTable>
      </Panel>
      <div className="route-shortcuts">
        <Link href="/products">
          Product catalogue <ArrowRight size={14} />
        </Link>
        <Link href="/purchases">
          Purchase history <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

function StocktakePage({
  products,
  onAdjust,
}: {
  products: Product[];
  onAdjust: (
    productId: string,
    count: number,
    reason: string,
    notes?: string,
  ) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const filtered = products.filter((item) =>
    `${item.name} ${item.sku}`.toLowerCase().includes(query.toLowerCase()),
  );
  const discrepancies = selected.filter(
    (id) =>
      counts[id] !== undefined &&
      products.find((item) => item.id === id)?.stock !== counts[id],
  );
  const confirm = () => {
    const invalid = discrepancies.find(
      (id) => !Number.isInteger(counts[id]) || counts[id] < 0,
    );
    if (invalid)
      return toast.error(
        "Counted quantities must be non-negative whole numbers.",
      );
    if (!discrepancies.length)
      return toast.message("No stock differences to adjust.");
    if (
      !window.confirm(
        `Confirm ${discrepancies.length} stock adjustment${discrepancies.length === 1 ? "" : "s"}? Each adjustment will be recorded in stock movements.`,
      )
    )
      return;
    try {
      discrepancies.forEach((id) =>
        onAdjust(
          id,
          counts[id],
          "Stocktake",
          "Confirmed from physical stocktake",
        ),
      );
      toast.success(
        `${discrepancies.length} stocktake adjustment${discrepancies.length === 1 ? "" : "s"} confirmed`,
      );
      setSelected([]);
      setCounts({});
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not apply stocktake adjustments.",
      );
    }
  };
  return (
    <div className="page-content">
      <PageHeading
        title="Stocktake"
        description="Count physical stock, review variances and confirm all corrections."
        action={
          <Link href="/inventory" className="button button-secondary">
            <ArrowLeft size={16} /> Inventory
          </Link>
        }
      />
      <Panel className="table-panel">
        <div className="stocktake-top">
          <div>
            <h2>Physical stock count</h2>
            <p>
              Select products, enter the counted quantities, then review
              differences.
            </p>
          </div>
          <div className="stocktake-actions">
            <span>
              {selected.length} selected · {discrepancies.length} differences
            </span>
            <Button disabled={!discrepancies.length} onClick={confirm}>
              Review & confirm
            </Button>
          </div>
        </div>
        <Toolbar>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Find products..."
          />
          <Button
            variant="secondary"
            onClick={() => {
              setSelected(filtered.map((item) => item.id));
              setCounts(
                Object.fromEntries(
                  filtered.map((item) => [item.id, item.stock]),
                ),
              );
            }}
          >
            Select visible
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setSelected([]);
              setCounts({});
            }}
          >
            Clear selection
          </Button>
        </Toolbar>
        <DataTable>
          <thead>
            <tr>
              <th>Select</th>
              <th>Product</th>
              <th>System quantity</th>
              <th>Counted quantity</th>
              <th>Difference</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const isSelected = selected.includes(item.id);
              const count = counts[item.id] ?? item.stock;
              return (
                <tr key={item.id}>
                  <td>
                    <input
                      aria-label={`Select ${item.name}`}
                      type="checkbox"
                      checked={isSelected}
                      onChange={(event) => {
                        setSelected((previous) =>
                          event.target.checked
                            ? [...previous, item.id]
                            : previous.filter((id) => id !== item.id),
                        );
                        setCounts((previous) => ({
                          ...previous,
                          [item.id]: previous[item.id] ?? item.stock,
                        }));
                      }}
                    />
                  </td>
                  <td>
                    <strong>{item.name}</strong>
                    <small className="table-subtext">{item.sku}</small>
                  </td>
                  <td>{item.stock}</td>
                  <td>
                    <input
                      aria-label={`Counted quantity for ${item.name}`}
                      className="table-input"
                      type="number"
                      min="0"
                      step="1"
                      disabled={!isSelected}
                      value={isSelected ? count : ""}
                      placeholder="—"
                      onChange={(event) =>
                        setCounts((previous) => ({
                          ...previous,
                          [item.id]: Number(event.target.value),
                        }))
                      }
                    />
                  </td>
                  <td
                    className={
                      count - item.stock < 0
                        ? "negative"
                        : count === item.stock
                          ? "muted"
                          : "positive"
                    }
                  >
                    {isSelected
                      ? `${count - item.stock > 0 ? "+" : ""}${count - item.stock}`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      </Panel>
    </div>
  );
}

export function PurchasesPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { data, recordPurchase, receivePurchase, update } = useRetail();
  const purchaseId =
    pathname.startsWith("/purchases/") && pathname !== "/purchases/new"
      ? pathname.split("/")[2]
      : "";
  const purchase = data.purchases.find((item) => item.id === purchaseId);
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<
    Array<{
      productId: string;
      quantity: number | "";
      received: number | "";
      unitCost: number | "";
    }>
  >([{ productId: "", quantity: 1, received: 1, unitCost: 0 }]);
  const [amountPaid, setAmountPaid] = useState(0);
  const [receivedMore, setReceivedMore] = useState<Record<string, number>>({});
  const [paymentMore, setPaymentMore] = useState(0);
  const purchaseLock = useRef(false);
  const [search, setSearch] = useState("");
  const newPurchase = pathname === "/purchases/new";
  const total = lines.reduce(
    (sum, item) =>
      sum +
      (typeof item.quantity === "number" ? item.quantity : 0) *
        (typeof item.unitCost === "number" ? item.unitCost : 0),
    0,
  );
  const paidNow = Number.isFinite(amountPaid) ? amountPaid : 0;
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [currentMonth] = useState(() => new Date().getMonth());

  if (newPurchase)
    return (
      <div className="page-content">
        <PageHeading
          title="Record a purchase"
          description="Capture supplier costs, deliveries received and payments made."
          action={
            <Link className="button button-secondary" href="/purchases">
              <ArrowLeft size={16} /> Purchase history
            </Link>
          }
        />
        <form
          className="form-layout"
          onSubmit={(event) => {
            event.preventDefault();
            if (purchaseLock.current) return;
            const supplier = data.suppliers.find(
              (item) => item.id === supplierId && !item.archived,
            );
            if (!supplier) return toast.error("Choose a supplier.");
            if (!Number.isFinite(amountPaid) || amountPaid < 0 || amountPaid > total)
              return toast.error("Amount paid must be between zero and the purchase total.");
            if (
              lines.some(
                (line) =>
                  !line.productId ||
                  line.quantity === "" ||
                  line.quantity <= 0 ||
                  !Number.isInteger(line.quantity) ||
                  line.received === "" ||
                  line.received < 0 ||
                  line.received > line.quantity ||
                  !Number.isInteger(line.received) ||
                  line.unitCost === "" ||
                  line.unitCost < 0,
              )
            )
              return toast.error("Review product, quantities and unit costs.");
            const items: PurchaseItem[] = lines.map((line) => ({
              productId: line.productId,
              name:
                data.products.find((product) => product.id === line.productId)
                  ?.name ?? "",
              quantity: Number(line.quantity),
              received: Number(line.received),
              unitCost: Number(line.unitCost),
            }));
            purchaseLock.current = true;
            try {
              const status = items.every(
                (item) => item.received === item.quantity,
              )
                ? "Received"
                : items.some((item) => item.received > 0)
                  ? "Partially received"
                  : "Pending";
              const reference = newId("PO").toUpperCase();
              const created = recordPurchase({
                reference,
                supplierId,
                supplierName: supplier.name,
                createdAt: new Date(`${date}T12:00:00`).toISOString(),
                items,
                total,
                amountPaid,
                status,
              });
              toast.success("Purchase recorded");
              router.push(`/purchases/${created.id}`);
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not save purchase.",
              );
            } finally {
              purchaseLock.current = false;
            }
          }}
        >
          <Panel>
            <div className="form-section-heading">
              <h2>Supplier details</h2>
              <p>Choose who supplied the goods and record the purchase date.</p>
            </div>
            <div className="form-grid">
              <SelectField
                label="Supplier"
                required
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
              >
                <option value="">Select supplier</option>
                {data.suppliers
                  .filter((item) => !item.archived)
                  .map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
              </SelectField>
              <Field
                label="Purchase date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </div>
          </Panel>
          <Panel>
            <div className="form-section-heading">
              <h2>Products ordered</h2>
              <p>
                Only quantities marked as received will increase your inventory.
              </p>
            </div>
            <div className="purchase-line-list">
              {lines.map((line, index) => (
                <div className="purchase-line" key={index}>
                  <SelectField
                    label="Product"
                    value={line.productId}
                    onChange={(event) => {
                      const product = data.products.find(
                        (item) => item.id === event.target.value,
                      );
                      setLines((previous) =>
                        previous.map((row, rowIndex) =>
                          rowIndex === index
                            ? {
                                ...row,
                                productId: event.target.value,
                                unitCost: product?.costPrice ?? 0,
                              }
                            : row,
                        ),
                      );
                    }}
                  >
                    <option value="">Choose product</option>
                    {data.products
                      .filter((item) => !item.archived)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.sku})
                        </option>
                      ))}
                  </SelectField>
                  <Field
                    label="Quantity ordered"
                    type="number"
                    min="1"
                    step="1"
                    value={line.quantity}
                    onChange={(event) =>
                      setLines((previous) =>
                        previous.map((row, rowIndex) =>
                          rowIndex === index
                            ? {
                                ...row,
                                quantity:
                                  event.target.value === ""
                                    ? ""
                                    : Number(event.target.value),
                                received: Math.min(
                                  typeof row.received === "number"
                                    ? row.received
                                    : 0,
                                  event.target.value === ""
                                    ? 0
                                    : Number(event.target.value),
                                ),
                              }
                            : row,
                        ),
                      )
                    }
                  />
                  <Field
                    label="Received now"
                    type="number"
                    min="0"
                    step="1"
                    value={line.received}
                    onChange={(event) =>
                      setLines((previous) =>
                        previous.map((row, rowIndex) =>
                          rowIndex === index
                            ? {
                                ...row,
                                received:
                                  event.target.value === ""
                                    ? ""
                                    : Number(event.target.value),
                              }
                            : row,
                        ),
                      )
                    }
                  />
                  <Field
                    label={`Unit cost (${data.settings.currency})`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitCost}
                    onChange={(event) =>
                      setLines((previous) =>
                        previous.map((row, rowIndex) =>
                          rowIndex === index
                            ? {
                                ...row,
                                unitCost:
                                  event.target.value === ""
                                    ? ""
                                    : Number(event.target.value),
                              }
                            : row,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="icon-link danger-link"
                    aria-label={`Remove purchase line ${index + 1}`}
                    disabled={lines.length === 1}
                    onClick={() =>
                      setLines((previous) =>
                        previous.filter((_, rowIndex) => rowIndex !== index),
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setLines((previous) => [
                  ...previous,
                  { productId: "", quantity: 1, received: 1, unitCost: 0 },
                ])
              }
            >
              <Plus size={15} /> Add product
            </Button>
          </Panel>
          <Panel>
            <div className="purchase-summary">
              <div>
                <span>Purchase total</span>
                <strong>{money(total, data.settings.currency)}</strong>
              </div>
              <div>
                <span>Amount paid now</span>
                <Field
                  label={`Amount paid (${data.settings.currency})`}
                  type="number"
                  min="0"
                  max={total}
                  step="0.01"
                  required
                  value={Number.isFinite(amountPaid) ? amountPaid : ""}
                  onChange={(event) =>
                    setAmountPaid(event.target.value === "" ? Number.NaN : Number(event.target.value))
                  }
                />
              </div>
              <div className="purchase-outstanding">
                <span>Outstanding balance</span>
                <strong>
                  {money(
                    Math.max(0, total - paidNow),
                    data.settings.currency,
                  )}
                </strong>
              </div>
            </div>
            <p className="form-footnote">
              Inventory value is recorded separately from operating expenses.
            </p>
          </Panel>
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/purchases")}
            >
              Cancel
            </Button>
            <Button type="submit">Save purchase</Button>
          </div>
        </form>
      </div>
    );

  if (purchaseId)
    return purchase ? (
      <div className="page-content">
        <PageHeading
          title={purchase.reference}
          description={`Purchase from ${purchase.supplierName} · ${shortDate(purchase.createdAt)}`}
          action={
            <Link href="/purchases" className="button button-secondary">
              <ArrowLeft size={16} /> Purchase history
            </Link>
          }
        />
        <div className="detail-summary-cards">
          <div>
            <span>Purchase total</span>
            <strong>{money(purchase.total, data.settings.currency)}</strong>
          </div>
          <div>
            <span>Paid</span>
            <strong>
              {money(purchase.amountPaid, data.settings.currency)}
            </strong>
          </div>
          <div>
            <span>Outstanding</span>
            <strong>
              {money(
                purchase.total - purchase.amountPaid,
                data.settings.currency,
              )}
            </strong>
          </div>
          <div>
            <span>Delivery</span>
            <Status
              tone={
                purchase.status === "Received"
                  ? "green"
                  : purchase.status === "Pending"
                    ? "amber"
                    : "blue"
              }
            >
              {purchase.status}
            </Status>
          </div>
        </div>
        <Panel className="table-panel">
          <div className="panel-heading">
            <div>
              <h2>Purchase items</h2>
              <p>Item costs are retained for this purchase.</p>
            </div>
          </div>
          <DataTable>
            <thead>
              <tr>
                <th>Product</th>
                <th>Ordered</th>
                <th>Received</th>
                <th>Unit cost</th>
                <th>Line total</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items.map((item) => (
                <tr key={item.productId}>
                  <td>
                    <Link
                      href={`/products/${item.productId}`}
                      className="table-primary-link"
                    >
                      {item.name}
                    </Link>
                  </td>
                  <td>{item.quantity}</td>
                  <td>{item.received}</td>
                  <td>{money(item.unitCost, data.settings.currency)}</td>
                  <td>
                    {money(
                      item.quantity * item.unitCost,
                      data.settings.currency,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Panel>
        {purchase.items.some((item) => item.received < item.quantity) && (
          <Panel className="receive-panel">
            <div className="form-section-heading">
              <h2>Receive remaining goods</h2>
              <p>
                Receiving updates stock exactly once and records each movement.
              </p>
            </div>
            <div className="receive-lines">
              {purchase.items
                .filter((item) => item.received < item.quantity)
                .map((item) => (
                  <div key={item.productId}>
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.received} of {item.quantity} received
                      </small>
                    </span>
                    <Field
                      label={`Receive ${item.name}`}
                      type="number"
                      min="0"
                      max={item.quantity - item.received}
                      step="1"
                      value={Number.isFinite(receivedMore[item.productId])
                        ? receivedMore[item.productId]
                        : ""}
                      onChange={(event) =>
                        setReceivedMore((previous) => ({
                          ...previous,
                          [item.productId]: event.target.value === ""
                            ? Number.NaN
                            : Number(event.target.value),
                        }))
                      }
                    />
                  </div>
                ))}
            </div>
            <Button
              onClick={() => {
                try {
                  receivePurchase(
                    purchase.id,
                    Object.fromEntries(
                      Object.entries(receivedMore).map(([productId, quantity]) => [
                        productId,
                        Number.isFinite(quantity) ? quantity : 0,
                      ]),
                    ),
                  );
                  toast.success("Delivery quantities recorded");
                  setReceivedMore({});
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Could not receive these goods.",
                  );
                }
              }}
            >
              Record delivery
            </Button>
          </Panel>
        )}
        {purchase.amountPaid < purchase.total && (
          <Panel className="receive-panel">
            <div className="form-section-heading">
              <h2>Record supplier payment</h2>
              <p>
                Payments change the balance only; the purchase total stays
                unchanged.
              </p>
            </div>
            <div className="payment-record-row">
              <Field
                label={`Additional payment (${data.settings.currency})`}
                type="number"
                min="0.01"
                max={purchase.total - purchase.amountPaid}
                step="0.01"
                value={Number.isFinite(paymentMore) ? paymentMore : ""}
                onChange={(event) =>
                  setPaymentMore(event.target.value === "" ? Number.NaN : Number(event.target.value))
                }
              />
              <Button
                disabled={!Number.isFinite(paymentMore) || paymentMore <= 0}
                onClick={() => {
                  if (!Number.isFinite(paymentMore) || paymentMore <= 0)
                    return toast.error("Enter a payment amount greater than zero.");
                  if (paymentMore > purchase.total - purchase.amountPaid)
                    return toast.error(
                      "Payment exceeds the outstanding balance.",
                    );
                  update((previous) => ({
                    ...previous,
                    purchases: previous.purchases.map((item) =>
                      item.id === purchase.id
                        ? { ...item, amountPaid: item.amountPaid + paymentMore }
                        : item,
                    ),
                  }));
                  setPaymentMore(0);
                  toast.success("Supplier payment recorded");
                }}
              >
                Add payment
              </Button>
            </div>
          </Panel>
        )}
      </div>
    ) : (
      <div className="page-content">
        <PageHeading
          title="Purchase not found"
          description="The requested purchase could not be found."
        />
      </div>
    );

  const rows = data.purchases.filter((item) =>
    `${item.reference} ${item.supplierName}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="page-content">
      <PageHeading
        title="Purchases"
        description="Track supplier orders, deliveries and outstanding balances."
        action={
          <Link href="/purchases/new" className="button button-primary">
            <Plus size={16} /> Record purchase
          </Link>
        }
      />
      <div className="stats-row compact-stats">
        <div>
          <span>Purchases this month</span>
          <strong>
            {money(
              data.purchases
                .filter(
                  (item) =>
                    new Date(item.createdAt).getMonth() === currentMonth,
                )
                .reduce((sum, item) => sum + item.total, 0),
              data.settings.currency,
            )}
          </strong>
        </div>
        <div>
          <span>Amount outstanding</span>
          <strong>
            {money(
              data.purchases.reduce(
                (sum, item) => sum + item.total - item.amountPaid,
                0,
              ),
              data.settings.currency,
            )}
          </strong>
        </div>
        <div>
          <span>Suppliers</span>
          <strong>
            {data.suppliers.filter((item) => !item.archived).length}
          </strong>
        </div>
      </div>
      <Panel className="table-panel">
        <Toolbar>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search reference or supplier..."
          />
          <div className="toolbar-spacer" />
          <Link className="button button-secondary" href="/suppliers">
            <Truck size={15} /> Suppliers
          </Link>
        </Toolbar>
        <DataTable empty={rows.length ? undefined : "No purchases found."}>
          <thead>
            <tr>
              <th>Purchase ref.</th>
              <th>Supplier</th>
              <th>Date</th>
              <th>Total</th>
              <th>Amount paid</th>
              <th>Outstanding</th>
              <th>Payment status</th>
              <th>Delivery status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const paymentStatus =
                item.amountPaid === 0
                  ? "Unpaid"
                  : item.amountPaid >= item.total
                    ? "Paid"
                    : "Partial";
              return (
                <tr key={item.id}>
                  <td>
                    <Link
                      href={`/purchases/${item.id}`}
                      className="table-primary-link mono"
                    >
                      {item.reference}
                    </Link>
                  </td>
                  <td>{item.supplierName}</td>
                  <td>{shortDate(item.createdAt)}</td>
                  <td>
                    <strong>{money(item.total, data.settings.currency)}</strong>
                  </td>
                  <td>{money(item.amountPaid, data.settings.currency)}</td>
                  <td>
                    {money(
                      item.total - item.amountPaid,
                      data.settings.currency,
                    )}
                  </td>
                  <td>
                    <Status
                      tone={
                        paymentStatus === "Paid"
                          ? "green"
                          : paymentStatus === "Unpaid"
                            ? "amber"
                            : "blue"
                      }
                    >
                      {paymentStatus}
                    </Status>
                  </td>
                  <td>
                    <Status
                      tone={
                        item.status === "Received"
                          ? "green"
                          : item.status === "Pending"
                            ? "amber"
                            : "blue"
                      }
                    >
                      {item.status}
                    </Status>
                  </td>
                  <td>
                    <Link
                      className="text-button"
                      href={`/purchases/${item.id}`}
                    >
                      Details
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      </Panel>
    </div>
  );
}

export function SuppliersPage() {
  const pathname = usePathname();
  const { data, update } = useRetail();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });
  const supplierId = pathname.startsWith("/suppliers/")
    ? pathname.split("/")[2]
    : "";
  const selected = data.suppliers.find((item) => item.id === supplierId);
  const reset = () => {
    setForm({ name: "", phone: "", email: "", address: "", notes: "" });
    setEditing(null);
    setOpen(false);
  };
  const startEdit = (supplier: Supplier) => {
    setEditing(supplier);
    setForm({
      name: supplier.name,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      notes: supplier.notes,
    });
    setOpen(true);
  };
  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim())
      return toast.error("Supplier name and phone are required.");
    if (editing) {
      update((previous) => ({
        ...previous,
        suppliers: previous.suppliers.map((item) =>
          item.id === editing.id
            ? { ...item, ...form, name: form.name.trim() }
            : item,
        ),
      }));
    } else {
      const supplier: Supplier = {
        id: newId("sup"),
        ...form,
        name: form.name.trim(),
        archived: false,
      };
      update((previous) => ({
        ...previous,
        suppliers: [supplier, ...previous.suppliers],
      }));
    }
    toast.success(editing ? "Supplier updated" : "Supplier added");
    reset();
  };

  if (supplierId)
    return selected ? (
      <div className="page-content">
        <PageHeading
          title={selected.name}
          description={
            selected.address || "Supplier details and purchase history"
          }
          action={
            <>
              <Link href="/suppliers" className="button button-secondary">
                <ArrowLeft size={16} /> Suppliers
              </Link>
              <Button onClick={() => startEdit(selected)}>
                <Edit2 size={15} /> Edit supplier
              </Button>
            </>
          }
        />
        <div className="detail-summary-cards">
          <div>
            <span>Phone</span>
            <strong>{selected.phone}</strong>
          </div>
          <div>
            <span>Email</span>
            <strong>{selected.email || "Not provided"}</strong>
          </div>
          <div>
            <span>Purchases</span>
            <strong>
              {
                data.purchases.filter((item) => item.supplierId === selected.id)
                  .length
              }
            </strong>
          </div>
          <div>
            <span>Outstanding balance</span>
            <strong>
              {money(
                data.purchases
                  .filter((item) => item.supplierId === selected.id)
                  .reduce((sum, item) => sum + item.total - item.amountPaid, 0),
                data.settings.currency,
              )}
            </strong>
          </div>
        </div>
        <Panel className="table-panel">
          <div className="panel-heading">
            <div>
              <h2>Purchase history</h2>
              <p>Orders and supplier balances for {selected.name}.</p>
            </div>
            <Link href="/purchases/new" className="panel-link">
              Record purchase
            </Link>
          </div>
          <DataTable
            empty={
              data.purchases.some((item) => item.supplierId === selected.id)
                ? undefined
                : "No purchases from this supplier yet."
            }
          >
            <thead>
              <tr>
                <th>Reference</th>
                <th>Date</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Outstanding</th>
                <th>Delivery</th>
              </tr>
            </thead>
            <tbody>
              {data.purchases
                .filter((item) => item.supplierId === selected.id)
                .map((purchase) => (
                  <tr key={purchase.id}>
                    <td>
                      <Link
                        className="table-primary-link mono"
                        href={`/purchases/${purchase.id}`}
                      >
                        {purchase.reference}
                      </Link>
                    </td>
                    <td>{shortDate(purchase.createdAt)}</td>
                    <td>{money(purchase.total, data.settings.currency)}</td>
                    <td>
                      {money(purchase.amountPaid, data.settings.currency)}
                    </td>
                    <td>
                      {money(
                        purchase.total - purchase.amountPaid,
                        data.settings.currency,
                      )}
                    </td>
                    <td>{purchase.status}</td>
                  </tr>
                ))}
            </tbody>
          </DataTable>
        </Panel>
        <Modal title="Edit supplier" open={open} onClose={reset}>
          <SupplierForm form={form} setForm={setForm} onSubmit={save} editing />
        </Modal>
      </div>
    ) : (
      <div className="page-content">
        <PageHeading
          title="Supplier not found"
          action={
            <Link href="/suppliers" className="button button-secondary">
              Suppliers
            </Link>
          }
        />
      </div>
    );

  const rows = data.suppliers.filter((item) =>
    `${item.name} ${item.phone} ${item.email}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="page-content">
      <PageHeading
        title="Suppliers"
        description="Keep your supplier contacts and purchasing history in one place."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} /> Add supplier
          </Button>
        }
      />
      <Panel className="table-panel">
        <Toolbar>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search supplier name or contact..."
          />
          <div className="toolbar-spacer" />
          <Link className="button button-secondary" href="/purchases">
            Purchase history
          </Link>
        </Toolbar>
        <DataTable
          empty={rows.length ? undefined : "No suppliers match this search."}
        >
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Purchases</th>
              <th>Outstanding</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((supplier) => {
              const purchases = data.purchases.filter(
                (item) => item.supplierId === supplier.id,
              );
              const balance = purchases.reduce(
                (sum, item) => sum + item.total - item.amountPaid,
                0,
              );
              return (
                <tr key={supplier.id}>
                  <td>
                    <Link
                      className="table-primary-link"
                      href={`/suppliers/${supplier.id}`}
                    >
                      {supplier.name}
                    </Link>
                    <small className="table-subtext">{supplier.address}</small>
                  </td>
                  <td>{supplier.phone}</td>
                  <td>{supplier.email || "—"}</td>
                  <td>{purchases.length}</td>
                  <td>{money(balance, data.settings.currency)}</td>
                  <td>
                    <Status tone={supplier.archived ? "neutral" : "green"}>
                      {supplier.archived ? "Archived" : "Active"}
                    </Status>
                  </td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => startEdit(supplier)}
                    >
                      Edit
                    </button>
                    <button
                      className="text-button danger-text"
                      onClick={() => {
                        update((previous) => ({
                          ...previous,
                          suppliers: previous.suppliers.map((item) =>
                            item.id === supplier.id
                              ? { ...item, archived: !item.archived }
                              : item,
                          ),
                        }));
                        toast.success(
                          supplier.archived
                            ? "Supplier restored"
                            : "Supplier archived",
                        );
                      }}
                    >
                      {supplier.archived ? "Restore" : "Archive"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      </Panel>
      <Modal
        title={editing ? "Edit supplier" : "Add a supplier"}
        description="Supplier records help you track orders and outstanding balances."
        open={open}
        onClose={reset}
      >
        <SupplierForm
          form={form}
          setForm={setForm}
          onSubmit={save}
          editing={Boolean(editing)}
        />
      </Modal>
    </div>
  );
}

function SupplierForm({
  form,
  setForm,
  onSubmit,
  editing,
}: {
  form: {
    name: string;
    phone: string;
    email: string;
    address: string;
    notes: string;
  };
  setForm: (form: {
    name: string;
    phone: string;
    email: string;
    address: string;
    notes: string;
  }) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  editing: boolean;
}) {
  return (
    <form className="modal-form" onSubmit={onSubmit}>
      <Field
        label="Supplier name"
        required
        autoFocus
        value={form.name}
        onChange={(event) => setForm({ ...form, name: event.target.value })}
      />
      <Field
        label="Phone"
        required
        value={form.phone}
        onChange={(event) => setForm({ ...form, phone: event.target.value })}
      />
      <Field
        label="Email (optional)"
        type="email"
        value={form.email}
        onChange={(event) => setForm({ ...form, email: event.target.value })}
      />
      <Field
        label="Address (optional)"
        value={form.address}
        onChange={(event) => setForm({ ...form, address: event.target.value })}
      />
      <TextAreaField
        label="Notes (optional)"
        rows={2}
        value={form.notes}
        onChange={(event) => setForm({ ...form, notes: event.target.value })}
      />
      <div className="modal-actions">
        <Button type="submit">
          {editing ? "Save changes" : "Add supplier"}
        </Button>
      </div>
    </form>
  );
}

const paymentMethods: PaymentMethod[] = [
  "Cash",
  "Mobile Money",
  "Card",
  "Bank Transfer",
  "Other",
];

export function ExpensesPage() {
  const pathname = usePathname();
  const { data, recordExpense, update } = useRetail();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState("");
  const [categoryEditValue, setCategoryEditValue] = useState("");
  const [queryCategory, setQueryCategory] = useState("All categories");
  const expenseLock = useRef(false);
  const [form, setForm] = useState(() => ({
    title: "",
    category: "Rent",
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    paymentMethod: "Cash" as PaymentMethod,
    status: "Paid" as Expense["status"],
    notes: "",
    reference: "",
  }));
  const reset = () => {
    setForm({
      title: "",
      category: data.expenseCategories[0] ?? "Other",
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      paymentMethod: "Cash",
      status: "Paid",
      notes: "",
      reference: "",
    });
    setEditing(null);
    setOpen(false);
  };
  const startEdit = (expense: Expense) => {
    setEditing(expense);
    setForm({
      title: expense.title,
      category: expense.category,
      amount: expense.amount,
      date: expense.date.slice(0, 10),
      paymentMethod: expense.paymentMethod,
      status: expense.status,
      notes: expense.notes,
      reference: expense.reference,
    });
    setOpen(true);
  };
  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!Number.isFinite(form.amount) || form.amount <= 0)
      return toast.error("Enter an expense amount greater than zero.");
    if (expenseLock.current) return;
    expenseLock.current = true;
    try {
      recordExpense({
        ...form,
        date: new Date(`${form.date}T12:00:00`).toISOString(),
        id: editing?.id,
      });
      toast.success(editing ? "Expense updated" : "Expense recorded");
      reset();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save expense.",
      );
    } finally {
      expenseLock.current = false;
    }
  };

  if (pathname.endsWith("/categories"))
    return (
      <div className="page-content">
        <PageHeading
          title="Expense categories"
          description="Organize operating costs for clearer business reports."
          action={
            <Link href="/expenses" className="button button-secondary">
              <ArrowLeft size={16} /> Expenses
            </Link>
          }
        />
        <div className="settings-grid">
          <Panel>
            <div className="form-section-heading">
              <h2>Add category</h2>
              <p>Categories can be reused on any expense record.</p>
            </div>
            <div className="inline-form">
              <Field
                label="Category name"
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder="e.g. Security"
              />
              <Button
                onClick={() => {
                  const value = categoryName.trim();
                  if (!value) return toast.error("Enter a category name.");
                  if (
                    data.expenseCategories.some(
                      (item) => item.toLowerCase() === value.toLowerCase(),
                    )
                  )
                    return toast.error("This expense category already exists.");
                  update((previous) => ({
                    ...previous,
                    expenseCategories: [...previous.expenseCategories, value],
                  }));
                  setCategoryName("");
                  toast.success("Expense category added");
                }}
              >
                Add category
              </Button>
            </div>
          </Panel>
          <Panel>
            <div className="panel-heading">
              <div>
                <h2>Categories</h2>
                <p>Expense amounts by category</p>
              </div>
            </div>
            <div className="category-list">
              {data.expenseCategories.map((category) => (
                <div className="category-row" key={category}>
                  {editingCategory === category ? (
                    <>
                      <Field
                        label="Category name"
                        value={categoryEditValue}
                        onChange={(event) =>
                          setCategoryEditValue(event.target.value)
                        }
                      />
                      <button
                        className="text-button"
                        onClick={() => {
                          const value = categoryEditValue.trim();
                          if (!value)
                            return toast.error("Enter a category name.");
                          if (
                            data.expenseCategories.some(
                              (item) =>
                                item !== category &&
                                item.toLowerCase() === value.toLowerCase(),
                            )
                          )
                            return toast.error("That category already exists.");
                          update((previous) => ({
                            ...previous,
                            expenseCategories: previous.expenseCategories.map(
                              (item) => (item === category ? value : item),
                            ),
                            expenses: previous.expenses.map((expense) =>
                              expense.category === category
                                ? { ...expense, category: value }
                                : expense,
                            ),
                          }));
                          setEditingCategory("");
                          toast.success("Expense category renamed");
                        }}
                      >
                        Save
                      </button>
                      <button
                        className="text-button"
                        onClick={() => setEditingCategory("")}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span>{category}</span>
                      <small>
                        {money(
                          data.expenses
                            .filter((expense) => expense.category === category)
                            .reduce((sum, expense) => sum + expense.amount, 0),
                          data.settings.currency,
                        )}
                      </small>
                      <button
                        className="text-button"
                        onClick={() => {
                          setEditingCategory(category);
                          setCategoryEditValue(category);
                        }}
                      >
                        Rename
                      </button>
                      <button
                        className="text-button danger-text"
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Archive ${category}? Existing expenses will keep this category.`,
                            )
                          )
                            return;
                          update((previous) => ({
                            ...previous,
                            expenseCategories:
                              previous.expenseCategories.filter(
                                (item) => item !== category,
                              ),
                          }));
                          toast.success("Expense category archived");
                        }}
                      >
                        Archive
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    );

  const rows = data.expenses
    .filter((item) =>
      `${item.title} ${item.category} ${item.reference}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .filter(
      (item) =>
        queryCategory === "All categories" || item.category === queryCategory,
    );
  const paidTotal = data.expenses
    .filter((item) => item.status === "Paid")
    .reduce((sum, item) => sum + item.amount, 0);
  const unpaidTotal = data.expenses
    .filter((item) => item.status === "Unpaid")
    .reduce((sum, item) => sum + item.amount, 0);
  return (
    <div className="page-content">
      <PageHeading
        title="Expenses"
        description="Track day-to-day operating costs separately from inventory purchases."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} /> Record expense
          </Button>
        }
      />
      <div className="stats-row compact-stats">
        <div>
          <span>Paid expenses</span>
          <strong>{money(paidTotal, data.settings.currency)}</strong>
        </div>
        <div>
          <span>Unpaid expenses</span>
          <strong>{money(unpaidTotal, data.settings.currency)}</strong>
        </div>
        <div>
          <span>Recorded expenses</span>
          <strong>{data.expenses.length}</strong>
        </div>
      </div>
      <Panel className="table-panel">
        <Toolbar>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search description or reference..."
          />
          <SelectField
            label="Category"
            aria-label="Filter expenses by category"
            value={queryCategory}
            onChange={(event) => setQueryCategory(event.target.value)}
          >
            <option>All categories</option>
            {data.expenseCategories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </SelectField>
          <div className="toolbar-spacer" />
          <Link href="/expenses/categories" className="button button-secondary">
            Manage categories
          </Link>
        </Toolbar>
        <DataTable
          empty={rows.length ? undefined : "No expenses match this search."}
        >
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Payment method</th>
              <th>Status</th>
              <th>Reference</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((expense) => (
              <tr key={expense.id}>
                <td>{shortDate(expense.date)}</td>
                <td>
                  <strong>{expense.title}</strong>
                </td>
                <td>{expense.category}</td>
                <td>
                  <strong>
                    {money(expense.amount, data.settings.currency)}
                  </strong>
                </td>
                <td>{expense.paymentMethod}</td>
                <td>
                  <Status tone={expense.status === "Paid" ? "green" : "amber"}>
                    {expense.status}
                  </Status>
                </td>
                <td className="mono">{expense.reference || "—"}</td>
                <td>
                  <button
                    className="text-button"
                    onClick={() => startEdit(expense)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        <div className="table-footer">
          <span>{rows.length} expenses</span>
          <span className="muted">
            Only paid expenses are included in estimated operating profit.
          </span>
        </div>
      </Panel>
      <Modal
        title={editing ? "Edit expense" : "Record an expense"}
        description="Inventory purchases belong in Purchases, not operating expenses."
        open={open}
        onClose={reset}
      >
        <form className="modal-form" onSubmit={save}>
          <Field
            label="Expense title"
            required
            autoFocus
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
            placeholder="e.g. Electricity top-up"
          />
          <div className="form-grid">
            <SelectField
              label="Category"
              value={form.category}
              onChange={(event) =>
                setForm({ ...form, category: event.target.value })
              }
            >
              {data.expenseCategories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </SelectField>
            <Field
              label={`Amount (${data.settings.currency})`}
              type="number"
              min="0.01"
              step="0.01"
              required
              value={Number.isFinite(form.amount) ? form.amount : ""}
              onChange={(event) =>
                setForm({
                  ...form,
                  amount: event.target.value === "" ? Number.NaN : Number(event.target.value),
                })
              }
            />
            <Field
              label="Date"
              type="date"
              required
              value={form.date}
              onChange={(event) =>
                setForm({ ...form, date: event.target.value })
              }
            />
            <SelectField
              label="Payment method"
              value={form.paymentMethod}
              onChange={(event) =>
                setForm({
                  ...form,
                  paymentMethod: event.target.value as PaymentMethod,
                })
              }
            >
              {paymentMethods.map((method) => (
                <option key={method}>{method}</option>
              ))}
            </SelectField>
            <SelectField
              label="Payment status"
              value={form.status}
              onChange={(event) =>
                setForm({
                  ...form,
                  status: event.target.value as Expense["status"],
                })
              }
            >
              <option>Paid</option>
              <option>Unpaid</option>
            </SelectField>
            <Field
              label="Reference (optional)"
              value={form.reference}
              onChange={(event) =>
                setForm({ ...form, reference: event.target.value })
              }
            />
          </div>
          <TextAreaField
            label="Notes (optional)"
            rows={2}
            value={form.notes}
            onChange={(event) =>
              setForm({ ...form, notes: event.target.value })
            }
          />
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={reset}>
              Cancel
            </Button>
            <Button type="submit">
              {editing ? "Save changes" : "Save expense"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function CustomersPage() {
  const pathname = usePathname();
  const { data, update } = useRetail();
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const customerId = pathname.startsWith("/customers/")
    ? pathname.split("/")[2]
    : "";
  const customer = data.customers.find((item) => item.id === customerId);
  if (customerId)
    return customer ? (
      <div className="page-content">
        <PageHeading
          title={customer.name}
          description={`Customer record · ${customer.phone}`}
          action={
            <Link className="button button-secondary" href="/customers">
              <ArrowLeft size={16} /> Customers
            </Link>
          }
        />
        <div className="detail-summary-cards">
          <div>
            <span>Phone</span>
            <strong>{customer.phone}</strong>
          </div>
          <div>
            <span>Email</span>
            <strong>{customer.email || "Not provided"}</strong>
          </div>
          <div>
            <span>Transactions</span>
            <strong>
              {
                data.sales.filter((sale) => sale.customerId === customer.id)
                  .length
              }
            </strong>
          </div>
          <div>
            <span>Lifetime spend</span>
            <strong>
              {money(
                data.sales
                  .filter((sale) => sale.customerId === customer.id)
                  .reduce((sum, sale) => sum + sale.total, 0),
                data.settings.currency,
              )}
            </strong>
          </div>
        </div>
        <Panel className="table-panel">
          <div className="panel-heading">
            <div>
              <h2>Purchase history</h2>
              <p>Completed transactions for {customer.name}.</p>
            </div>
          </div>
          <DataTable
            empty={
              data.sales.some((sale) => sale.customerId === customer.id)
                ? undefined
                : "No sales associated with this customer."
            }
          >
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Date</th>
                <th>Items</th>
                <th>Total</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              {data.sales
                .filter((sale) => sale.customerId === customer.id)
                .map((sale) => (
                  <tr key={sale.id}>
                    <td>
                      <Link
                        href={`/sales/${sale.id}`}
                        className="table-primary-link mono"
                      >
                        {sale.reference}
                      </Link>
                    </td>
                    <td>{dateTime(sale.createdAt)}</td>
                    <td>
                      {sale.items.reduce((sum, item) => sum + item.quantity, 0)}
                    </td>
                    <td>{money(sale.total, data.settings.currency)}</td>
                    <td>{sale.paymentMethod}</td>
                  </tr>
                ))}
            </tbody>
          </DataTable>
        </Panel>
      </div>
    ) : (
      <div className="page-content">
        <PageHeading
          title="Customer not found"
          action={
            <Link href="/customers" className="button button-secondary">
              Customers
            </Link>
          }
        />
      </div>
    );
  const customers = data.customers.filter((item) =>
    `${item.name} ${item.phone} ${item.email}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="page-content">
      <PageHeading
        title="Customers"
        description="Optional customer records for repeat shoppers. Walk-in sales never require registration."
      />
      <Panel className="table-panel">
        <div className="customer-add-form">
          <div>
            <h2>Add a customer</h2>
            <p>Capture only the details that are useful for your business.</p>
          </div>
          <div className="customer-add-fields">
            <Field
              label="Full name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Customer name"
            />
            <Field
              label="Phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="024 000 0000"
            />
            <Field
              label="Email (optional)"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
            />
            <Button
              onClick={() => {
                if (!name.trim() || !phone.trim())
                  return toast.error("Name and phone are required.");
                const customer = {
                  id: newId("cus"),
                  name: name.trim(),
                  phone: phone.trim(),
                  email: email.trim(),
                  notes: "",
                };
                update((previous) => ({
                  ...previous,
                  customers: [customer, ...previous.customers],
                }));
                setName("");
                setPhone("");
                setEmail("");
                toast.success("Customer added");
              }}
            >
              Add customer
            </Button>
          </div>
        </div>
        <Toolbar>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search customers..."
          />
        </Toolbar>
        <DataTable
          empty={customers.length ? undefined : "No customer records found."}
        >
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Transactions</th>
              <th>Lifetime spend</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((item) => {
              const sales = data.sales.filter(
                (sale) => sale.customerId === item.id,
              );
              return (
                <tr key={item.id}>
                  <td>
                    <Link
                      className="table-primary-link"
                      href={`/customers/${item.id}`}
                    >
                      {item.name}
                    </Link>
                  </td>
                  <td>{item.phone}</td>
                  <td>{item.email || "—"}</td>
                  <td>{sales.length}</td>
                  <td>
                    {money(
                      sales.reduce((sum, sale) => sum + sale.total, 0),
                      data.settings.currency,
                    )}
                  </td>
                  <td>
                    <Link
                      className="text-button"
                      href={`/customers/${item.id}`}
                    >
                      Details
                    </Link>
                    <button
                      className="text-button"
                      onClick={() => {
                        setEditingCustomer(item);
                        setEditName(item.name);
                        setEditPhone(item.phone);
                        setEditEmail(item.email);
                        setEditNotes(item.notes);
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      </Panel>
      <Modal
        title="Edit customer"
        open={Boolean(editingCustomer)}
        onClose={() => setEditingCustomer(null)}
      >
        <form
          className="modal-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!editName.trim() || !editPhone.trim() || !editingCustomer)
              return toast.error("Customer name and phone are required.");
            update((previous) => ({
              ...previous,
              customers: previous.customers.map((item) =>
                item.id === editingCustomer.id
                  ? {
                      ...item,
                      name: editName.trim(),
                      phone: editPhone.trim(),
                      email: editEmail.trim(),
                      notes: editNotes.trim(),
                    }
                  : item,
              ),
            }));
            setEditingCustomer(null);
            toast.success("Customer details updated");
          }}
        >
          <Field
            label="Full name"
            required
            value={editName}
            onChange={(event) => setEditName(event.target.value)}
          />
          <Field
            label="Phone"
            required
            value={editPhone}
            onChange={(event) => setEditPhone(event.target.value)}
          />
          <Field
            label="Email (optional)"
            type="email"
            value={editEmail}
            onChange={(event) => setEditEmail(event.target.value)}
          />
          <TextAreaField
            label="Notes (optional)"
            rows={2}
            value={editNotes}
            onChange={(event) => setEditNotes(event.target.value)}
          />
          <div className="modal-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditingCustomer(null)}
            >
              Cancel
            </Button>
            <Button type="submit">Save customer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
