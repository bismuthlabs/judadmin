"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Download, Save } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { usePathname } from "next/navigation";
import { csvDownload, money, shortDate } from "@/lib/format";
import { useRetail } from "@/lib/store";
import { MemberManagement } from "@/components/member-management";
import {
  Button,
  DataTable,
  Field,
  PageHeading,
  Panel,
  SelectField,
  Status,
  TextAreaField,
} from "@/components/retail-ui";

const reportLinks = [
  ["Sales report", "/reports/sales"],
  ["Profitability", "/reports/profitability"],
  ["Product performance", "/reports/products"],
  ["Inventory report", "/reports/inventory"],
  ["Purchase report", "/reports/purchases"],
  ["Expense report", "/reports/expenses"],
];

export function ReportsPage() {
  const pathname = usePathname();
  const { data } = useRetail();
  const [startDate, setStartDate] = useState(() =>
    new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59`);
  const sales = data.sales.filter(
    (sale) =>
      sale.status === "Completed" &&
      new Date(sale.createdAt) >= start &&
      new Date(sale.createdAt) <= end,
  );
  const expenses = data.expenses.filter(
    (expense) =>
      new Date(expense.date) >= start && new Date(expense.date) <= end,
  );
  const paidExpenses = expenses.filter((expense) => expense.status === "Paid");
  const revenue = sales.reduce((sum, sale) => sum + sale.total, 0);
  const discounts = sales.reduce((sum, sale) => sum + sale.discount, 0);
  const cogs = sales.reduce(
    (sum, sale) =>
      sum +
      sale.items.reduce(
        (subtotal, item) => subtotal + item.unitCost * item.quantity,
        0,
      ),
    0,
  );
  const grossProfit = revenue - cogs;
  const opExpenses = paidExpenses.reduce(
    (sum, expense) => sum + expense.amount,
    0,
  );
  const netProfit = grossProfit - opExpenses;
  const productRows = (() => {
    const map = new Map<
      string,
      {
        productId: string;
        name: string;
        units: number;
        revenue: number;
        cost: number;
      }
    >();
    sales.forEach((sale) =>
      sale.items.forEach((item) => {
        const row = map.get(item.productId) ?? {
          productId: item.productId,
          name: item.name,
          units: 0,
          revenue: 0,
          cost: 0,
        };
        row.units += item.quantity;
        row.revenue += item.quantity * item.unitPrice;
        row.cost += item.quantity * item.unitCost;
        map.set(item.productId, row);
      }),
    );
    return [...map.values()].sort((a, b) => b.units - a.units);
  })();
  const paymentRows = Object.entries(
    sales.reduce<Record<string, number>>((acc, sale) => {
      acc[sale.paymentMethod] = (acc[sale.paymentMethod] ?? 0) + sale.total;
      return acc;
    }, {}),
  );
  const expenseRows = data.expenseCategories
    .map((category) => ({
      category,
      amount: expenses
        .filter((item) => item.category === category)
        .reduce((sum, item) => sum + item.amount, 0),
    }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const purchaseRows = data.purchases.filter(
    (item) =>
      new Date(item.createdAt) >= start && new Date(item.createdAt) <= end,
  );
  const reportType = pathname === "/reports" ? "/reports/sales" : pathname;
  const titles: Record<string, string> = {
    "/reports/sales": "Sales report",
    "/reports/profitability": "Profitability report",
    "/reports/products": "Product performance",
    "/reports/inventory": "Inventory report",
    "/reports/purchases": "Purchase report",
    "/reports/expenses": "Expense report",
  };

  const exportRows = () => {
    if (reportType === "/reports/inventory")
      return csvDownload("inventory-report.csv", [
        [
          "Product",
          "SKU",
          "Category",
          "Quantity",
          "Cost price",
          "Stock value",
          "Status",
        ],
        ...data.products
          .filter((item) => !item.archived)
          .map((item) => [
            item.name,
            item.sku,
            item.category,
            item.stock,
            item.costPrice,
            item.stock * item.costPrice,
            item.stock === 0
              ? "Out of stock"
              : item.stock <= item.reorderLevel
                ? "Low stock"
                : "Healthy",
          ]),
      ]);
    if (reportType === "/reports/products")
      return csvDownload("product-performance.csv", [
        [
          "Product",
          "Units sold",
          "Sales revenue",
          "Cost of goods",
          "Gross profit",
        ],
        ...productRows.map((row) => [
          row.name,
          row.units,
          row.revenue,
          row.cost,
          row.revenue - row.cost,
        ]),
      ]);
    if (reportType === "/reports/purchases")
      return csvDownload("purchase-report.csv", [
        ["Reference", "Supplier", "Date", "Total", "Paid", "Outstanding"],
        ...purchaseRows.map((item) => [
          item.reference,
          item.supplierName,
          shortDate(item.createdAt),
          item.total,
          item.amountPaid,
          item.total - item.amountPaid,
        ]),
      ]);
    if (reportType === "/reports/expenses")
      return csvDownload("expense-report.csv", [
        ["Category", "Amount"],
        ...expenseRows.map((item) => [item.category, item.amount]),
      ]);
    return csvDownload("sales-report.csv", [
      ["Receipt", "Date", "Customer", "Cashier", "Net sales", "Payment method"],
      ...sales.map((sale) => [
        sale.reference,
        shortDate(sale.createdAt),
        sale.customerName,
        sale.cashier,
        sale.total,
        sale.paymentMethod,
      ]),
    ]);
  };

  return (
    <div className="page-content">
      <PageHeading
        title={titles[reportType] ?? "Reports"}
        description="Business performance, calculated from your sales, stock, expenses and purchases."
        action={
          <Button variant="secondary" onClick={exportRows}>
            <Download size={15} /> Export CSV
          </Button>
        }
      />
      <div className="report-toolbar">
        <div className="report-tabs">
          {reportLinks.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className={reportType === href ? "active" : ""}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="date-fields">
          <Field
            label="From"
            type="date"
            value={startDate}
            max={endDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
          <Field
            label="To"
            type="date"
            min={startDate}
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>
      </div>
      {reportType === "/reports/inventory" ? (
        <InventoryReport />
      ) : reportType === "/reports/purchases" ? (
        <PurchaseReport rows={purchaseRows} />
      ) : reportType === "/reports/expenses" ? (
        <ExpenseReport
          expenses={expenses}
          rows={expenseRows}
          paid={paidExpenses}
        />
      ) : reportType === "/reports/products" ? (
        <ProductReport rows={productRows} />
      ) : reportType === "/reports/profitability" ? (
        <ProfitReport
          revenue={revenue}
          discounts={discounts}
          cogs={cogs}
          grossProfit={grossProfit}
          expenses={opExpenses}
          netProfit={netProfit}
          currency={data.settings.currency}
        />
      ) : (
        <SalesReport
          sales={sales}
          paymentRows={paymentRows}
          currency={data.settings.currency}
        />
      )}
    </div>
  );
}

function ReportStat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="report-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

function SalesReport({
  sales,
  paymentRows,
  currency,
}: {
  sales: ReturnType<typeof useRetail>["data"]["sales"];
  paymentRows: [string, number][];
  currency: string;
}) {
  const byCashier = Object.entries(
    sales.reduce<Record<string, number>>((acc, sale) => {
      acc[sale.cashier] = (acc[sale.cashier] ?? 0) + sale.total;
      return acc;
    }, {}),
  );
  const dateMap = new Map<string, number>();
  sales.forEach((sale) => {
    const key = shortDate(sale.createdAt);
    dateMap.set(key, (dateMap.get(key) ?? 0) + sale.total);
  });
  const chart = [...dateMap].map(([date, total]) => ({
    date: date.split(" ").slice(0, 2).join(" "),
    total,
  }));
  return (
    <>
      <div className="report-stat-grid">
        <ReportStat
          label="Net sales revenue"
          value={money(
            sales.reduce((sum, sale) => sum + sale.total, 0),
            currency,
          )}
          note="Completed sales in selected period"
        />
        <ReportStat label="Transactions" value={String(sales.length)} />
        <ReportStat
          label="Average transaction"
          value={money(
            sales.length
              ? sales.reduce((sum, sale) => sum + sale.total, 0) / sales.length
              : 0,
            currency,
          )}
        />
        <ReportStat
          label="Items sold"
          value={String(
            sales
              .flatMap((sale) => sale.items)
              .reduce((sum, item) => sum + item.quantity, 0),
          )}
        />
      </div>
      <div className="report-grid">
        <Panel>
          <div className="panel-heading">
            <div>
              <h2>Sales by day</h2>
              <p>Transaction value during the selected period</p>
            </div>
          </div>
          <div className="report-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid stroke="#edf0f4" vertical={false} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#8792a2", fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#8792a2", fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value) => money(Number(value), currency)}
                />
                <Bar
                  dataKey="total"
                  name="Sales"
                  fill="#3c6e59"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel>
          <div className="panel-heading">
            <div>
              <h2>By payment method</h2>
              <p>Sales distribution</p>
            </div>
          </div>
          <div className="report-breakdown">
            {paymentRows.map(([method, total]) => (
              <div key={method}>
                <span>{method}</span>
                <strong>{money(total, currency)}</strong>
              </div>
            ))}
            {!paymentRows.length && (
              <div className="empty-state">No sales in this period.</div>
            )}
          </div>
        </Panel>
      </div>
      <Panel className="table-panel">
        <div className="panel-heading">
          <div>
            <h2>Sales by cashier</h2>
            <p>Completed sale value by cashier</p>
          </div>
        </div>
        <DataTable
          empty={byCashier.length ? undefined : "No sales in this period."}
        >
          <thead>
            <tr>
              <th>Cashier</th>
              <th>Transactions</th>
              <th>Net sales</th>
              <th>Average transaction</th>
            </tr>
          </thead>
          <tbody>
            {byCashier.map(([cashier, total]) => {
              const count = sales.filter(
                (sale) => sale.cashier === cashier,
              ).length;
              return (
                <tr key={cashier}>
                  <td>{cashier}</td>
                  <td>{count}</td>
                  <td>{money(total, currency)}</td>
                  <td>{money(total / count, currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      </Panel>
      {/* <p className="report-note">
        Sales and payment records are stored in Supabase. Payment methods show
        cashier-recorded confirmations, not gateway settlement.
      </p> */}
    </>
  );
}

function ProfitReport({
  revenue,
  discounts,
  cogs,
  grossProfit,
  expenses,
  netProfit,
  currency,
}: {
  revenue: number;
  discounts: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  currency: string;
}) {
  const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  return (
    <>
      <div className="report-stat-grid">
        <ReportStat
          label="Gross sales"
          value={money(revenue + discounts, currency)}
        />
        <ReportStat label="Discounts" value={money(discounts, currency)} />
        <ReportStat
          label="Net sales revenue"
          value={money(revenue, currency)}
        />
        <ReportStat label="Cost of goods sold" value={money(cogs, currency)} />
        <ReportStat
          label="Gross profit"
          value={money(grossProfit, currency)}
          note={`${margin.toFixed(1)}% gross margin`}
        />
        <ReportStat
          label="Paid operating expenses"
          value={money(expenses, currency)}
        />
        <ReportStat
          label="Estimated net operating profit"
          value={money(netProfit, currency)}
          note="Gross profit less paid expenses"
        />
        <ReportStat
          label="Operating profit margin"
          value={`${revenue ? ((netProfit / revenue) * 100).toFixed(1) : "0.0"}%`}
        />
      </div>
      <Panel>
        <div className="profit-formula">
          <h2>How we calculate this estimate</h2>
          <div>
            <span>Net sales revenue</span>
            <strong>{money(revenue, currency)}</strong>
          </div>
          <div>
            <span>Less: cost of goods sold</span>
            <strong>−{money(cogs, currency)}</strong>
          </div>
          <div>
            <span>Gross profit</span>
            <strong>{money(grossProfit, currency)}</strong>
          </div>
          <div>
            <span>Less: paid operating expenses</span>
            <strong>−{money(expenses, currency)}</strong>
          </div>
          <div className="formula-total">
            <span>Estimated net operating profit</span>
            <strong>{money(netProfit, currency)}</strong>
          </div>
        </div>
      </Panel>
      <p className="report-note">
        Estimates use sale-time product costs and paid operating expenses dated
        in the selected period. Unpaid expenses and accrual accounting are
        excluded. New inventory purchases are not treated as expenses; cost is
        recognized when items sell.
      </p>
    </>
  );
}

function ProductReport({
  rows,
}: {
  rows: Array<{
    productId: string;
    name: string;
    units: number;
    revenue: number;
    cost: number;
  }>;
}) {
  const { data } = useRetail();
  return (
    <Panel className="table-panel">
      <div className="panel-heading">
        <div>
          <h2>Product performance</h2>
          <p>
            Best-selling items in the selected period, ranked by units sold.
          </p>
        </div>
      </div>
      <DataTable
        empty={rows.length ? undefined : "No product sales in this period."}
      >
        <thead>
          <tr>
            <th>Product</th>
            <th>Units sold</th>
            <th>Sales revenue</th>
            <th>Cost of goods</th>
            <th>Gross profit</th>
            <th>Margin</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.productId}>
              <td>
                <Link
                  className="table-primary-link"
                  href={`/products/${row.productId}`}
                >
                  {row.name}
                </Link>
              </td>
              <td>{row.units}</td>
              <td>{money(row.revenue, data.settings.currency)}</td>
              <td>{money(row.cost, data.settings.currency)}</td>
              <td>
                <strong>
                  {money(row.revenue - row.cost, data.settings.currency)}
                </strong>
              </td>
              <td>
                {row.revenue
                  ? `${(((row.revenue - row.cost) / row.revenue) * 100).toFixed(1)}%`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      <div className="report-subsection">
        <h3>Slow moving products</h3>
        <p>Active products with no units sold in this period.</p>
        <div className="slow-product-chips">
          {data.products
            .filter(
              (product) =>
                !product.archived &&
                !rows.some((row) => row.productId === product.id),
            )
            .slice(0, 8)
            .map((product) => (
              <Link key={product.id} href={`/products/${product.id}`}>
                <span>{product.name}</span>
                <small>{product.stock} in stock</small>
              </Link>
            ))}
        </div>
      </div>
    </Panel>
  );
}

function InventoryReport() {
  const { data } = useRetail();
  const products = data.products.filter((item) => !item.archived);
  const value = products.reduce(
    (sum, product) => sum + product.stock * product.costPrice,
    0,
  );
  return (
    <>
      <div className="report-stat-grid">
        <ReportStat
          label="Total units"
          value={products
            .reduce((sum, item) => sum + item.stock, 0)
            .toLocaleString()}
        />
        <ReportStat
          label="Cost value of stock"
          value={money(value, data.settings.currency)}
        />
        <ReportStat
          label="Low stock"
          value={String(
            products.filter(
              (item) => item.stock > 0 && item.stock <= item.reorderLevel,
            ).length,
          )}
        />
        <ReportStat
          label="Out of stock"
          value={String(products.filter((item) => item.stock === 0).length)}
        />
      </div>
      <Panel className="table-panel">
        <div className="panel-heading">
          <div>
            <h2>Stock on hand</h2>
            <p>
              Current quantities and estimated value at weighted-average cost.
            </p>
          </div>
        </div>
        <DataTable>
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Quantity</th>
              <th>Reorder level</th>
              <th>Cost price</th>
              <th>Cost value</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {products.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link
                    className="table-primary-link"
                    href={`/products/${item.id}`}
                  >
                    {item.name}
                  </Link>
                </td>
                <td className="mono">{item.sku}</td>
                <td>{item.category}</td>
                <td>{item.stock}</td>
                <td>{item.reorderLevel}</td>
                <td>{money(item.costPrice, data.settings.currency)}</td>
                <td>
                  {money(item.stock * item.costPrice, data.settings.currency)}
                </td>
                <td>
                  <Status
                    tone={
                      item.stock === 0
                        ? "red"
                        : item.stock <= item.reorderLevel
                          ? "amber"
                          : "green"
                    }
                  >
                    {item.stock === 0
                      ? "Out"
                      : item.stock <= item.reorderLevel
                        ? "Low"
                        : "Healthy"}
                  </Status>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Panel>
      <Panel className="table-panel">
        <div className="panel-heading">
          <div>
            <h2>Recent stock adjustments</h2>
            <p>Physical count corrections and write-offs.</p>
          </div>
          <Link className="panel-link" href="/inventory/movements">
            All movements
          </Link>
        </div>
        <DataTable
          empty={
            data.movements.some((move) => move.type === "Stock Adjustment")
              ? undefined
              : "No adjustments recorded."
          }
        >
          <thead>
            <tr>
              <th>Date</th>
              <th>Product</th>
              <th>Change</th>
              <th>Reason</th>
              <th>User</th>
            </tr>
          </thead>
          <tbody>
            {data.movements
              .filter((move) => move.type === "Stock Adjustment")
              .slice(0, 10)
              .map((move) => (
                <tr key={move.id}>
                  <td>{shortDate(move.createdAt)}</td>
                  <td>{move.productName}</td>
                  <td>
                    {move.quantity > 0 ? "+" : ""}
                    {move.quantity}
                  </td>
                  <td>{move.reason}</td>
                  <td>{move.user}</td>
                </tr>
              ))}
          </tbody>
        </DataTable>
      </Panel>
    </>
  );
}

function PurchaseReport({
  rows,
}: {
  rows: ReturnType<typeof useRetail>["data"]["purchases"];
}) {
  const { data } = useRetail();
  const supplierRows = Object.entries(
    rows.reduce<Record<string, number>>((acc, purchase) => {
      acc[purchase.supplierName] =
        (acc[purchase.supplierName] ?? 0) + purchase.total;
      return acc;
    }, {}),
  );
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const balance = rows.reduce(
    (sum, row) => sum + row.total - row.amountPaid,
    0,
  );
  return (
    <>
      <div className="report-stat-grid">
        <ReportStat
          label="Purchase totals"
          value={money(total, data.settings.currency)}
        />
        <ReportStat
          label="Amount paid"
          value={money(total - balance, data.settings.currency)}
        />
        <ReportStat
          label="Outstanding supplier balances"
          value={money(balance, data.settings.currency)}
        />
        <ReportStat label="Purchase orders" value={String(rows.length)} />
      </div>
      <div className="report-grid">
        <Panel>
          <div className="panel-heading">
            <div>
              <h2>Supplier breakdown</h2>
            </div>
          </div>
          <div className="report-breakdown">
            {supplierRows.map(([supplier, amount]) => (
              <div key={supplier}>
                <span>{supplier}</span>
                <strong>{money(amount, data.settings.currency)}</strong>
              </div>
            ))}
            {!supplierRows.length && (
              <div className="empty-state">No purchases in this period.</div>
            )}
          </div>
        </Panel>
        <Panel>
          <div className="panel-heading">
            <div>
              <h2>Supplier balances</h2>
              <p>Outstanding amount across all purchase records</p>
            </div>
          </div>
          <div className="report-breakdown">
            {data.suppliers.map((supplier) => (
              <div key={supplier.id}>
                <span>{supplier.name}</span>
                <strong>
                  {money(
                    data.purchases
                      .filter((item) => item.supplierId === supplier.id)
                      .reduce(
                        (sum, item) => sum + item.total - item.amountPaid,
                        0,
                      ),
                    data.settings.currency,
                  )}
                </strong>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel className="table-panel">
        <div className="panel-heading">
          <div>
            <h2>Purchase history</h2>
          </div>
        </div>
        <DataTable
          empty={rows.length ? undefined : "No purchases in this period."}
        >
          <thead>
            <tr>
              <th>Reference</th>
              <th>Supplier</th>
              <th>Date</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link
                    className="table-primary-link mono"
                    href={`/purchases/${item.id}`}
                  >
                    {item.reference}
                  </Link>
                </td>
                <td>{item.supplierName}</td>
                <td>{shortDate(item.createdAt)}</td>
                <td>{money(item.total, data.settings.currency)}</td>
                <td>{money(item.amountPaid, data.settings.currency)}</td>
                <td>
                  {money(item.total - item.amountPaid, data.settings.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Panel>
      <p className="report-note">
        Purchase totals represent supplier orders; stock movements include only
        quantities explicitly received.
      </p>
    </>
  );
}

function ExpenseReport({
  expenses,
  rows,
  paid,
}: {
  expenses: ReturnType<typeof useRetail>["data"]["expenses"];
  rows: Array<{ category: string; amount: number }>;
  paid: ReturnType<typeof useRetail>["data"]["expenses"];
}) {
  const { data } = useRetail();
  const total = expenses.reduce((sum, item) => sum + item.amount, 0);
  const paidTotal = paid.reduce((sum, item) => sum + item.amount, 0);
  return (
    <>
      <div className="report-stat-grid">
        <ReportStat
          label="Total expenses"
          value={money(total, data.settings.currency)}
        />
        <ReportStat
          label="Paid"
          value={money(paidTotal, data.settings.currency)}
        />
        <ReportStat
          label="Unpaid"
          value={money(total - paidTotal, data.settings.currency)}
        />
        <ReportStat label="Expense records" value={String(expenses.length)} />
      </div>
      <div className="report-grid">
        <Panel>
          <div className="panel-heading">
            <div>
              <h2>Spending by category</h2>
            </div>
          </div>
          <div className="report-breakdown">
            {rows.map((item) => (
              <div key={item.category}>
                <span>{item.category}</span>
                <strong>{money(item.amount, data.settings.currency)}</strong>
              </div>
            ))}
            {!rows.length && (
              <div className="empty-state">No expenses in this period.</div>
            )}
          </div>
        </Panel>
        <Panel>
          <div className="panel-heading">
            <div>
              <h2>Expenses over time</h2>
              <p>Based on expense date</p>
            </div>
          </div>
          <div className="report-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={expenses.map((item) => ({
                  date: shortDate(item.date).split(" ").slice(0, 2).join(" "),
                  amount: item.amount,
                }))}
              >
                <CartesianGrid stroke="#edf0f4" vertical={false} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#8792a2", fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#8792a2", fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value) =>
                    money(Number(value), data.settings.currency)
                  }
                />
                <Bar
                  dataKey="amount"
                  name="Expenses"
                  fill="#bd9352"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
      <Panel className="table-panel">
        <div className="panel-heading">
          <div>
            <h2>Expense details</h2>
          </div>
          <Link href="/expenses" className="panel-link">
            Manage expenses
          </Link>
        </div>
        <DataTable
          empty={expenses.length ? undefined : "No expenses in this period."}
        >
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Payment status</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((item) => (
              <tr key={item.id}>
                <td>{shortDate(item.date)}</td>
                <td>{item.title}</td>
                <td>{item.category}</td>
                <td>{money(item.amount, data.settings.currency)}</td>
                <td>{item.status}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Panel>
      <p className="report-note">
        Profitability recognizes only paid expenses in the selected period.
        Unpaid expenses remain visible here but are not subtracted from
        estimated profit.
      </p>
    </>
  );
}

const settingsTabs = [
  ["Business profile", "/settings/business"],
  ["Users & permissions", "/settings/users"],
  ["Financial settings", "/settings/financial"],
  ["Receipt settings", "/settings/receipts"],
];

export function SettingsPage() {
  const pathname = usePathname();
  const { data, update } = useRetail();
  const section = pathname === "/settings" ? "/settings/business" : pathname;
  const [settings, setSettings] = useState(data.settings);
  const user = data.users.find((item) => item.id === data.activeUserId);
  const owner = user?.role === "Owner";

  const saveSettings = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !Number.isInteger(settings.lowStockThreshold) ||
      settings.lowStockThreshold < 0
    ) {
      toast.error("Low-stock threshold must be a non-negative whole number.");
      return;
    }
    update((previous) => ({ ...previous, settings }));
    toast.success("Settings saved");
  };

  return (
    <div className="page-content">
      <PageHeading
        title="Settings"
        description="Configure your business workspace and team access."
      />
      <div className="settings-tabs">
        {settingsTabs.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className={section === href ? "active" : ""}
          >
            {label}
          </Link>
        ))}
      </div>
      {!owner && (
        <div className="inline-alert amber">
          Owner access is required to configure team members and workspace
          settings.
        </div>
      )}
      {section === "/settings/users" ? (
        <MemberManagement activeUserId={data.activeUserId} />
      ) : section === "/settings/financial" ? (
        <form className="settings-form" onSubmit={saveSettings}>
          <Panel>
            <div className="form-section-heading">
              <h2>Financial preferences</h2>
              <p>
                These preferences are used for displayed values and business
                time.
              </p>
            </div>
            <div className="form-grid">
              <SelectField
                label="Currency"
                value={settings.currency}
                onChange={(event) =>
                  setSettings({ ...settings, currency: event.target.value })
                }
              >
                <option value="GHS">Ghana cedi (GHS)</option>
                <option value="USD">US dollar (USD)</option>
                <option value="GBP">Pound sterling (GBP)</option>
              </SelectField>
              <SelectField
                label="Time zone"
                value={settings.timezone}
                onChange={(event) =>
                  setSettings({ ...settings, timezone: event.target.value })
                }
              >
                <option>Africa/Accra</option>
                <option>UTC</option>
                <option>Africa/Lagos</option>
              </SelectField>
              <Field
                label="Default low-stock threshold"
                type="number"
                min="0"
                step="1"
                required
                value={
                  Number.isFinite(settings.lowStockThreshold)
                    ? settings.lowStockThreshold
                    : ""
                }
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    lowStockThreshold:
                      event.target.value === ""
                        ? Number.NaN
                        : Number(event.target.value),
                  })
                }
              />
            </div>
            <p className="form-footnote">
              Product-specific reorder levels remain the source of low-stock
              badges. Switching currencies changes formatting, not conversion.
            </p>
            <div className="form-actions">
              <Button disabled={!owner} type="submit">
                <Save size={15} /> Save preferences
              </Button>
            </div>
          </Panel>
          <Panel>
            <div className="form-section-heading">
              <h2>Expense categories</h2>
              <p>Manage the list of available operating expense categories.</p>
            </div>
            <Link
              href="/expenses/categories"
              className="button button-secondary"
            >
              Manage expense categories <ArrowRight size={15} />
            </Link>
          </Panel>
        </form>
      ) : (
        <form className="settings-form" onSubmit={saveSettings}>
          <Panel>
            <div className="form-section-heading">
              <h2>
                {section === "/settings/receipts"
                  ? "Receipt settings"
                  : "Business profile"}
              </h2>
              <p>
                {section === "/settings/receipts"
                  ? "These details appear on digital and printed receipts."
                  : "Business details personalize your workspace and receipt header."}
              </p>
            </div>
            <div className="form-grid">
              <Field
                label="Business name"
                required
                value={settings.name}
                onChange={(event) =>
                  setSettings({ ...settings, name: event.target.value })
                }
              />
              <Field
                label="Contact number"
                value={settings.phone}
                onChange={(event) =>
                  setSettings({ ...settings, phone: event.target.value })
                }
              />
              <Field
                label="Email"
                type="email"
                value={settings.email}
                onChange={(event) =>
                  setSettings({ ...settings, email: event.target.value })
                }
              />
              <Field
                label="Address"
                value={settings.address}
                onChange={(event) =>
                  setSettings({ ...settings, address: event.target.value })
                }
              />
              {section === "/settings/receipts" && (
                <TextAreaField
                  className="span-2"
                  label="Receipt footer message"
                  rows={3}
                  value={settings.receiptFooter}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      receiptFooter: event.target.value,
                    })
                  }
                />
              )}
            </div>
            {/* <p className="form-footnote">
              Your changes are stored in Supabase and appear in new receipts.
            </p> */}
            <div className="form-actions">
              <Button disabled={!owner} type="submit">
                <Save size={15} /> Save changes
              </Button>
            </div>
          </Panel>
          {section === "/settings/receipts" && (
            <Panel>
              <div className="form-section-heading">
                <h2>Receipt numbering</h2>
                <p>
                  New transaction references are generated automatically using a
                  unique timestamp reference.
                </p>
              </div>
              <div className="receipt-number-preview">
                <span>Reference format</span>
                <strong>EE-00000000</strong>
              </div>
            </Panel>
          )}
        </form>
      )}
    </div>
  );
}
