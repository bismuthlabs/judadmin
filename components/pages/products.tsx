"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Download,
  Edit2,
  PackagePlus,
  Plus,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { usePathname, useRouter } from "next/navigation";
import { csvDownload, money, newId, shortDate } from "@/lib/format";
import { useRetail } from "@/lib/store";
import type { Product } from "@/lib/retail-types";
import {
  Button,
  DataTable,
  Field,
  PageHeading,
  Pagination,
  Panel,
  SearchInput,
  SelectField,
  Status,
  TextAreaField,
  Toolbar,
} from "@/components/retail-ui";

const blankProduct = (category: string): Omit<Product, "id"> => ({
  name: "",
  sku: "",
  category,
  description: "",
  barcode: "",
  costPrice: 0,
  sellingPrice: 0,
  stock: 0,
  reorderLevel: 5,
  archived: false,
});

function parseCSV(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("CSV has an unclosed quoted value.");
  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
  }
  return rows;
}

export function ProductsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { data, saveProduct, update } = useRetail();
  const id =
    pathname.startsWith("/products/") && pathname !== "/products/new"
      ? pathname.split("/")[2]
      : undefined;
  const creating = pathname === "/products/new";
  const editing = pathname.endsWith("/edit");
  const detail = Boolean(id && !editing);
  const productId = editing ? pathname.split("/")[2] : id;
  const product = data.products.find((item) => item.id === productId);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [status, setStatus] = useState("All stock");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<Omit<Product, "id">>(() =>
    product ? { ...product } : blankProduct(data.categories[0] ?? "General"),
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () =>
      data.products
        .filter((item) => includeArchived || !item.archived)
        .filter(
          (item) =>
            !query ||
            `${item.name} ${item.sku} ${item.barcode}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .filter(
          (item) => category === "All categories" || item.category === category,
        )
        .filter(
          (item) =>
            status === "All stock" ||
            (status === "Low stock" &&
              item.stock > 0 &&
              item.stock <= item.reorderLevel) ||
            (status === "Out of stock" && item.stock === 0) ||
            (status === "Healthy" && item.stock > item.reorderLevel),
        )
        .sort((a, b) =>
          sort === "stock"
            ? a.stock - b.stock
            : sort === "price"
              ? a.sellingPrice - b.sellingPrice
              : a.name.localeCompare(b.name),
        ),
    [category, data.products, includeArchived, query, sort, status],
  );
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  if (detail && product) return <ProductDetail product={product} />;
  if ((creating || editing) && (!editing || product)) {
    const editMode = Boolean(editing && product);
    const save = (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const sku = form.sku.trim() || newId("SKU").toUpperCase();
      if (
        !form.name.trim() ||
        !form.category ||
        !Number.isFinite(form.costPrice) ||
        form.costPrice < 0 ||
        !Number.isFinite(form.sellingPrice) ||
        form.sellingPrice < 0 ||
        !Number.isInteger(form.stock) ||
        form.stock < 0 ||
        !Number.isInteger(form.reorderLevel) ||
        form.reorderLevel < 0
      ) {
        toast.error("Check required fields, prices and stock quantities.");
        return;
      }
      try {
        saveProduct({ ...form, sku, id: editMode ? product!.id : undefined });
        toast.success(
          editMode ? "Product updated" : "Product added to your catalogue",
        );
        router.push(editMode ? `/products/${product!.id}` : "/products");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not save product.",
        );
      }
    };
    return (
      <div className="page-content">
        <PageHeading
          title={editMode ? "Edit product" : "Add a product"}
          description={
            editMode
              ? "Update product details. Stock is adjusted separately in Inventory."
              : "Create a product and record its opening stock."
          }
          action={
            <Link
              className="button button-secondary"
              href={editMode ? `/products/${product!.id}` : "/products"}
            >
              <ArrowLeft size={16} /> Back to products
            </Link>
          }
        />
        <form className="form-layout" onSubmit={save}>
          <Panel>
            <div className="form-section-heading">
              <h2>Product information</h2>
              <p>Give this product a clear name and an easy-to-find SKU.</p>
            </div>
            <div className="form-grid">
              <Field
                label="Product name"
                required
                autoFocus
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                placeholder="e.g. Bottled Water 500ml"
              />
              <Field
                label="SKU"
                value={form.sku}
                onChange={(event) =>
                  setForm({ ...form, sku: event.target.value })
                }
                placeholder="Auto-generated if left blank"
              />
              <SelectField
                label="Category"
                value={form.category}
                onChange={(event) =>
                  setForm({ ...form, category: event.target.value })
                }
              >
                {data.categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </SelectField>
              <Field
                label="Barcode (optional)"
                value={form.barcode}
                onChange={(event) =>
                  setForm({ ...form, barcode: event.target.value })
                }
                placeholder="Scan or enter barcode"
              />
              <TextAreaField
                className="span-2"
                label="Description (optional)"
                rows={3}
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                placeholder="A short description for your team"
              />
            </div>
          </Panel>
          <Panel>
            <div className="form-section-heading">
              <h2>Pricing & stock</h2>
              <p>
                Prices are in Ghana cedis. Cost is used for profitability
                estimates.
              </p>
            </div>
            <div className="form-grid">
              <Field
                label={`Cost price (${data.settings.currency})`}
                type="number"
                min="0"
                step="0.01"
                required
                value={form.costPrice}
                onChange={(event) =>
                  setForm({
                    ...form,
                    costPrice:
                      event.target.value === ""
                        ? Number.NaN
                        : Number(event.target.value),
                  })
                }
              />
              <Field
                label={`Selling price (${data.settings.currency})`}
                type="number"
                min="0"
                step="0.01"
                required
                value={form.sellingPrice}
                onChange={(event) =>
                  setForm({ ...form, sellingPrice: event.target.value === "" ? Number.NaN : Number(event.target.value) })
                }
              />
              {!editMode && (
                <Field
                  label="Opening quantity"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={form.stock}
                  onChange={(event) =>
                    setForm({ ...form, stock: event.target.value === "" ? Number.NaN : Number(event.target.value) })
                  }
                />
              )}
              {editMode && (
                <div className="form-note span-2">
                  <PackagePlus size={17} /> Current stock is {product!.stock}.
                  Use the inventory adjustment workflow to change stock and
                  record a reason.
                </div>
              )}
              <Field
                label="Reorder threshold"
                type="number"
                min="0"
                step="1"
                required
                value={form.reorderLevel}
                onChange={(event) =>
                  setForm({ ...form, reorderLevel: event.target.value === "" ? Number.NaN : Number(event.target.value) })
                }
              />
            </div>
            {form.sellingPrice > 0 && form.sellingPrice < form.costPrice && (
              <div className="inline-alert amber">
                Selling price is below cost. Review your margin before saving.
              </div>
            )}
            {!editMode && (
              <p className="form-footnote">
                Opening stock will be recorded as an inventory movement.
              </p>
            )}
          </Panel>
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/products")}
            >
              Cancel
            </Button>
            <Button type="submit">
              {editMode ? "Save changes" : "Create product"}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  const archive = (item: Product) => {
    const action = item.archived ? "restore" : "archive";
    if (
      !window.confirm(
        `${action === "archive" ? "Archive" : "Restore"} ${item.name}?`,
      )
    )
      return;
    update((previous) => ({
      ...previous,
      products: previous.products.map((row) =>
        row.id === item.id ? { ...row, archived: !row.archived } : row,
      ),
    }));
    toast.success(item.archived ? "Product restored" : "Product archived");
  };

  const importCSV = async (file?: File) => {
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      const headers =
        rows.shift()?.map((header) =>
          header
            .trim()
            .toLowerCase()
            .replace(/[\s_-]/g, ""),
        ) ?? [];
      const indexOf = (name: string) => headers.indexOf(name);
      if (indexOf("name") < 0) throw new Error("CSV needs a Name column.");
      const imported: Product[] = rows
        .filter((row) => row.length >= headers.length && row[indexOf("name")])
        .map((row) => ({
          id: newId("prd"),
          name: row[indexOf("name")],
          sku: row[indexOf("sku")] || newId("SKU").toUpperCase(),
          category: row[indexOf("category")] || data.categories[0] || "General",
          description: "",
          barcode: "",
          costPrice: Number(row[indexOf("costprice")] || 0),
          sellingPrice: Number(row[indexOf("sellingprice")] || 0),
          stock: Number(row[indexOf("stock")] || 0),
          reorderLevel: Number(row[indexOf("reorderlevel")] || 0),
          archived: false,
        }));
      if (
        !imported.length ||
        imported.some(
          (item) =>
            !Number.isFinite(item.costPrice) ||
            !Number.isFinite(item.sellingPrice) ||
            !Number.isInteger(item.stock) ||
            !Number.isInteger(item.reorderLevel) ||
            item.stock < 0 ||
            item.reorderLevel < 0 ||
            item.costPrice < 0 ||
            item.sellingPrice < 0,
        )
      )
        throw new Error(
          "No valid rows found. Use columns name, sku, category, costprice, sellingprice, stock, reorderlevel.",
        );
      const skus = new Set(data.products.map((item) => item.sku.toLowerCase()));
      if (
        imported.some((item) => {
          const duplicate =
            skus.has(item.sku.toLowerCase()) || !item.name.trim();
          skus.add(item.sku.toLowerCase());
          return duplicate;
        })
      )
        throw new Error(
          "Import contains an empty name or SKU already in your catalogue.",
        );
      update((previous) => ({
        ...previous,
        products: [...imported, ...previous.products],
        movements: [
          ...imported
            .filter((item) => item.stock > 0)
            .map((item) => ({
              id: newId("mov"),
              productId: item.id,
              productName: item.name,
              type: "Opening Stock",
              quantity: item.stock,
              balance: item.stock,
              reference: "CSV-IMPORT",
              reason: "Opening stock from product import",
              user:
                previous.users.find((user) => user.id === previous.activeUserId)
                  ?.name ?? "Owner",
              createdAt: new Date().toISOString(),
            })),
          ...previous.movements,
        ],
      }));
      toast.success(`${imported.length} products imported`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not import this CSV.",
      );
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const exportCSV = () =>
    csvDownload("products.csv", [
      [
        "Name",
        "SKU",
        "Category",
        "Cost Price",
        "Selling Price",
        "Stock",
        "Reorder Level",
      ],
      ...filtered.map((item) => [
        item.name,
        item.sku,
        item.category,
        item.costPrice,
        item.sellingPrice,
        item.stock,
        item.reorderLevel,
      ]),
    ]);

  return (
    <div className="page-content">
      <PageHeading
        title="Products"
        description="Manage the items you sell and keep your catalogue up to date."
        action={
          <Link className="button button-primary" href="/products/new">
            <Plus size={16} /> Add product
          </Link>
        }
      />
      <div className="stats-row compact-stats">
        <div>
          <span>Active products</span>
          <strong>
            {data.products.filter((item) => !item.archived).length}
          </strong>
        </div>
        <div>
          <span>Categories</span>
          <strong>{data.categories.length}</strong>
        </div>
        <div>
          <span>Low stock</span>
          <strong>
            {
              data.products.filter(
                (item) =>
                  !item.archived &&
                  item.stock > 0 &&
                  item.stock <= item.reorderLevel,
              ).length
            }
          </strong>
        </div>
      </div>
      <Panel className="table-panel">
        <Toolbar>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search name, SKU or barcode..."
          />
          <SelectField
            label="Category"
            aria-label="Filter by category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option>All categories</option>
            {data.categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </SelectField>
          <SelectField
            label="Stock status"
            aria-label="Filter by stock status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option>All stock</option>
            <option>Healthy</option>
            <option>Low stock</option>
            <option>Out of stock</option>
          </SelectField>
          <SelectField
            label="Sort by"
            aria-label="Sort products"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="name">Name</option>
            <option value="stock">Stock: lowest</option>
            <option value="price">Price: lowest</option>
          </SelectField>
          <div className="toolbar-spacer" />
          <label className="check-compact">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) => setIncludeArchived(event.target.checked)}
            />{" "}
            Show archived
          </label>
          <Button variant="secondary" onClick={exportCSV}>
            <Download size={15} /> Export
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> Import
          </Button>
          <input
            ref={fileRef}
            hidden
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => void importCSV(event.target.files?.[0])}
          />
        </Toolbar>
        <DataTable
          empty={
            filtered.length === 0
              ? "No products match your filters. Try a different search or add a product."
              : undefined
          }
        >
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Cost price</th>
              <th>Selling price</th>
              <th>Available</th>
              <th>Stock status</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link className="table-product" href={`/products/${item.id}`}>
                    <span className="product-avatar">
                      {item.name.slice(0, 1)}
                    </span>
                    <span>
                      <strong>{item.name}</strong>
                      <small>Reorder at {item.reorderLevel}</small>
                    </span>
                  </Link>
                </td>
                <td className="mono">{item.sku}</td>
                <td>{item.category}</td>
                <td>{money(item.costPrice, data.settings.currency)}</td>
                <td>
                  <strong>
                    {money(item.sellingPrice, data.settings.currency)}
                  </strong>
                </td>
                <td>
                  <strong>{item.stock}</strong>{" "}
                  <span className="muted">units</span>
                </td>
                <td>
                  <StockPill product={item} />
                </td>
                <td>
                  <div className="table-actions">
                    <Link
                      className="icon-link"
                      aria-label={`Edit ${item.name}`}
                      title="Edit product"
                      href={`/products/${item.id}/edit`}
                    >
                      <Edit2 size={15} />
                    </Link>
                    <button
                      className="icon-link"
                      aria-label={`${item.archived ? "Restore" : "Archive"} ${item.name}`}
                      title={item.archived ? "Restore" : "Archive"}
                      onClick={() => archive(item)}
                    >
                      <Archive size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        <Pagination
          page={currentPage}
          pageCount={pageCount}
          pageSize={pageSize}
          total={filtered.length}
          onChange={setPage}
        />
      </Panel>
      <div className="route-shortcuts">
        <Link href="/categories">
          Manage categories <ArrowRight size={14} />
        </Link>
        <Link href="/inventory">
          View stock overview <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

function StockPill({ product }: { product: Product }) {
  if (product.archived) return <Status>Archived</Status>;
  if (product.stock === 0) return <Status tone="red">Out of stock</Status>;
  if (product.stock <= product.reorderLevel)
    return <Status tone="amber">Low stock</Status>;
  return <Status tone="green">Healthy</Status>;
}

function ProductDetail({ product }: { product: Product }) {
  const { data } = useRetail();
  const recentSales = data.sales
    .filter((sale) => sale.items.some((item) => item.productId === product.id))
    .slice(0, 5);
  const recentPurchases = data.purchases
    .filter((purchase) =>
      purchase.items.some((item) => item.productId === product.id),
    )
    .slice(0, 5);
  const sold = data.sales
    .flatMap((sale) => sale.items)
    .filter((item) => item.productId === product.id)
    .reduce((sum, item) => sum + item.quantity, 0);
  const movements = data.movements
    .filter((item) => item.productId === product.id)
    .slice(0, 6);
  return (
    <div className="page-content">
      <PageHeading
        title={product.name}
        description={`${product.category} · ${product.sku}`}
        action={
          <>
            <Link className="button button-secondary" href="/products">
              <ArrowLeft size={16} /> Products
            </Link>
            <Link
              className="button button-primary"
              href={`/products/${product.id}/edit`}
            >
              <Edit2 size={16} /> Edit product
            </Link>
          </>
        }
      />
      <div className="metric-grid product-detail-metrics">
        <div className="product-kpi">
          <span>In stock</span>
          <strong>{product.stock} units</strong>
          <small>
            <StockPill product={product} />
          </small>
        </div>
        <div className="product-kpi">
          <span>Selling price</span>
          <strong>{money(product.sellingPrice, data.settings.currency)}</strong>
          <small>per unit</small>
        </div>
        <div className="product-kpi">
          <span>Cost price</span>
          <strong>{money(product.costPrice, data.settings.currency)}</strong>
          <small>weighted average</small>
        </div>
        <div className="product-kpi">
          <span>Stock value</span>
          <strong>
            {money(product.costPrice * product.stock, data.settings.currency)}
          </strong>
          <small>{sold} units sold to date</small>
        </div>
      </div>
      <Panel className="table-panel">
        <div className="panel-heading">
          <div>
            <h2>Recent stock movements</h2>
            <p>Every stock change is recorded in your movement history.</p>
          </div>
          <Link href="/inventory/movements" className="panel-link">
            View all
          </Link>
        </div>
        <DataTable
          empty={
            movements.length
              ? undefined
              : "No stock movements for this product."
          }
        >
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Quantity change</th>
              <th>Balance</th>
              <th>Reference</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((move) => (
              <tr key={move.id}>
                <td>{shortDate(move.createdAt, data.settings.timezone)}</td>
                <td>{move.type}</td>
                <td className={move.quantity < 0 ? "negative" : "positive"}>
                  {move.quantity > 0 ? "+" : ""}
                  {move.quantity}
                </td>
                <td>{move.balance}</td>
                <td className="mono">{move.reference}</td>
                <td>{move.reason}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Panel>
      <div className="dashboard-lower">
        <Panel>
          <div className="panel-heading">
            <div>
              <h2>Recent sales</h2>
              <p>Sale-time prices are kept unchanged for receipt accuracy.</p>
            </div>
          </div>
          <div className="activity-list">
            {recentSales.map((sale) => {
              const line = sale.items.find(
                (item) => item.productId === product.id,
              )!;
              return (
                <Link
                  className="activity-row"
                  href={`/sales/${sale.id}`}
                  key={sale.id}
                >
                  <span className="activity-icon green">
                    <ArrowRight size={15} />
                  </span>
                  <div>
                    <strong>
                      {sale.reference} · {line.quantity} units
                    </strong>
                    <small>
                      {shortDate(sale.createdAt, data.settings.timezone)} ·{" "}
                      {sale.customerName}
                    </small>
                  </div>
                  <strong>
                    {money(line.unitPrice, data.settings.currency)}
                  </strong>
                </Link>
              );
            })}
            {!recentSales.length && (
              <div className="empty-state">
                No sales recorded for this product.
              </div>
            )}
          </div>
        </Panel>
        <Panel>
          <div className="panel-heading">
            <div>
              <h2>Recent purchases</h2>
              <p>Supplier costs captured when stock was ordered.</p>
            </div>
          </div>
          <div className="activity-list">
            {recentPurchases.map((purchase) => {
              const line = purchase.items.find(
                (item) => item.productId === product.id,
              )!;
              return (
                <Link
                  className="activity-row"
                  href={`/purchases/${purchase.id}`}
                  key={purchase.id}
                >
                  <span className="activity-icon blue">
                    <PackagePlus size={15} />
                  </span>
                  <div>
                    <strong>
                      {purchase.reference} · {line.received} received
                    </strong>
                    <small>
                      {shortDate(purchase.createdAt, data.settings.timezone)} ·{" "}
                      {purchase.supplierName}
                    </small>
                  </div>
                  <strong>
                    {money(line.unitCost, data.settings.currency)}
                  </strong>
                </Link>
              );
            })}
            {!recentPurchases.length && (
              <div className="empty-state">
                No purchases recorded for this product.
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function CategoriesPage() {
  const { data, update } = useRetail();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState("");
  const [editValue, setEditValue] = useState("");
  const save = () => {
    const value = (editing ? editValue : name).trim();
    if (!value) return toast.error("Enter a category name.");
    if (
      !editing &&
      data.categories.some((item) => item.toLowerCase() === value.toLowerCase())
    )
      return toast.error("That category already exists.");
    update((previous) => ({
      ...previous,
      categories: editing
        ? previous.categories.map((item) => (item === editing ? value : item))
        : [...previous.categories, value],
      products: editing
        ? previous.products.map((product) =>
            product.category === editing
              ? { ...product, category: value }
              : product,
          )
        : previous.products,
    }));
    if (!editing) setName("");
    setEditing("");
    toast.success(editing ? "Category updated" : "Category added");
  };
  return (
    <div className="page-content">
      <PageHeading
        title="Product categories"
        description="Keep products organized with simple categories."
        action={
          <Link className="button button-secondary" href="/products">
            <ArrowLeft size={16} /> Products
          </Link>
        }
      />
      <div className="settings-grid">
        <Panel>
          <div className="form-section-heading">
            <h2>{editing ? "Rename category" : "Add a category"}</h2>
          </div>
          <div className="inline-form">
            <Field
              label="Category name"
              value={editing ? editValue : name}
              onChange={(event) =>
                editing
                  ? setEditValue(event.target.value)
                  : setName(event.target.value)
              }
              placeholder="e.g. Chilled drinks"
            />
            <Button onClick={save}>{editing ? "Save" : "Add category"}</Button>
          </div>
        </Panel>
        <Panel>
          <div className="panel-heading">
            <div>
              <h2>Categories</h2>
              <p>{data.categories.length} product categories</p>
            </div>
          </div>
          <div className="category-list">
            {data.categories.map((item) => (
              <div className="category-row" key={item}>
                <span>{item}</span>
                <small>
                  {
                    data.products.filter(
                      (product) =>
                        product.category === item && !product.archived,
                    ).length
                  }{" "}
                  products
                </small>
                <button
                  className="text-button"
                  onClick={() => {
                    setEditing(item);
                    setEditValue(item);
                  }}
                >
                  Rename
                </button>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
