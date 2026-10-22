"use client";

import Link from "next/link";
import { useState } from "react";
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Banknote, Boxes, CircleAlert, Package, Plus, ReceiptText, ShoppingBag, TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { money, shortDate } from "@/lib/format";
import { useRetail } from "@/lib/store";
import { MetricCard, PageHeading, Panel, Status } from "@/components/retail-ui";

type Period = "Today" | "Last 7 days" | "Last 30 days" | "This month";

function rangeFor(period: Period, current: Date) {
  const now = new Date(current);
  const start = new Date(now);
  if (period === "Today") start.setHours(0, 0, 0, 0);
  if (period === "Last 7 days") start.setDate(now.getDate() - 6);
  if (period === "Last 30 days") start.setDate(now.getDate() - 29);
  if (period === "This month") start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return { start, end: now };
}

export function DashboardPage() {
  const { data } = useRetail();
  const [currentDate] = useState(() => new Date());
  const [period, setPeriod] = useState<Period>("Last 7 days");
  const { start, end } = rangeFor(period, currentDate);
  const activeSales = data.sales.filter((sale) => sale.status === "Completed" && new Date(sale.createdAt) >= start && new Date(sale.createdAt) <= end);
  const revenue = activeSales.reduce((sum, sale) => sum + sale.total, 0);
  const cogs = activeSales.reduce((sum, sale) => sum + sale.items.reduce((itemsSum, item) => itemsSum + item.unitCost * item.quantity, 0), 0);
  const expenses = data.expenses.filter((expense) => expense.status === "Paid" && new Date(expense.date) >= start && new Date(expense.date) <= end).reduce((sum, expense) => sum + expense.amount, 0);
  const lowStock = data.products.filter((product) => !product.archived && product.stock <= product.reorderLevel);
  const inventoryValue = data.products.reduce((sum, product) => sum + (product.archived ? 0 : product.stock * product.costPrice), 0);
  const totalUnits = data.products.reduce((sum, product) => sum + (product.archived ? 0 : product.stock), 0);

  const chartData = (() => {
    const points: Array<{ key: string; label: string; sales: number }> = [];
    const count = period === "Today" ? 12 : period === "Last 7 days" ? 7 : period === "Last 30 days" ? 14 : currentDate.getDate();
    for (let i = count - 1; i >= 0; i -= 1) {
      const date = new Date(currentDate);
      if (period === "Today") date.setHours(date.getHours() - i);
      else date.setDate(date.getDate() - i);
      const key = period === "Today" ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}` : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const matches = activeSales.filter((sale) => {
        const saleDate = new Date(sale.createdAt);
        return period === "Today"
          ? saleDate.getFullYear() === date.getFullYear() && saleDate.getMonth() === date.getMonth() && saleDate.getDate() === date.getDate() && saleDate.getHours() === date.getHours()
          : saleDate.getFullYear() === date.getFullYear() && saleDate.getMonth() === date.getMonth() && saleDate.getDate() === date.getDate();
      });
      points.push({
        key,
        label: period === "Today" ? `${date.getHours()}:00` : period === "Last 30 days" ? `${date.getDate()}` : shortDate(date, data.settings.timezone).split(" ").slice(0, 2).join(" "),
        sales: matches.reduce((sum, sale) => sum + sale.total, 0),
      });
    }
    return points;
  })();

  return <div className="page-content">
    <PageHeading title="Dashboard" description="Here's what's happening with your business." action={
      <div className="heading-actions"><label className="select-compact"><span className="sr-only">Dashboard date range</span><select value={period} onChange={(event) => setPeriod(event.target.value as Period)}>{(["Today", "Last 7 days", "Last 30 days", "This month"] as Period[]).map((item) => <option key={item}>{item}</option>)}</select></label><Link className="button button-primary" href="/pos"><Plus size={16} /> New sale</Link></div>
    } />

    <div className="section-label"><span>Sales performance</span><small>{shortDate(start, data.settings.timezone)} — {shortDate(end, data.settings.timezone)}</small></div>
    <div className="metric-grid">
      <MetricCard label="Net sales" value={money(revenue, data.settings.currency)} note={`${activeSales.length} transactions in period`} icon={<Banknote size={19} />} accent="blue" />
      <MetricCard label="Gross profit" value={money(revenue - cogs, data.settings.currency)} note={revenue ? `${Math.round(((revenue - cogs) / revenue) * 100)}% gross margin` : "No sales in this period"} icon={<TrendingUp size={19} />} accent="green" />
      <MetricCard label="Operating expenses" value={money(expenses, data.settings.currency)} note="Paid expenses in period" icon={<ReceiptText size={19} />} accent="amber" />
      <MetricCard label="Estimated net profit" value={money(revenue - cogs - expenses, data.settings.currency)} note="Gross profit less paid expenses" icon={<Activity size={19} />} accent="purple" />
    </div>

    <div className="dashboard-layout">
      <Panel className="chart-panel">
        <div className="panel-heading"><div><h2>Sales over time</h2><p>Completed sales in the selected period</p></div><span className="chart-key"><i /> Sales</span></div>
        <div className="chart-area">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="#edf0f4" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#8792a2", fontSize: 11 }} minTickGap={26} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#8792a2", fontSize: 11 }} tickFormatter={(value: number) => value === 0 ? "0" : `${value}`} width={44} />
              <Tooltip formatter={(value) => [money(Number(value), data.settings.currency), "Sales"]} contentStyle={{ border: "1px solid #e7eaf0", borderRadius: 10, fontSize: 12 }} />
              <Line type="monotone" dataKey="sales" stroke="#3c6e59" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "#3c6e59", strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel className="stock-card">
        <div className="panel-heading"><div><h2>Inventory snapshot</h2><p>Current stock at a glance</p></div><Link href="/inventory" aria-label="View inventory"><ArrowRight size={17} /></Link></div>
        <div className="inventory-stats">
          <div><span className="inventory-stat-icon"><Package size={17} /></span><span>Units in stock</span><strong>{totalUnits.toLocaleString()}</strong></div>
          <div><span className="inventory-stat-icon warning"><CircleAlert size={17} /></span><span>Low stock</span><strong>{lowStock.length}</strong></div>
          <div><span className="inventory-stat-icon"><Boxes size={17} /></span><span>Stock value</span><strong>{money(inventoryValue, data.settings.currency)}</strong></div>
          <div><span className="inventory-stat-icon danger"><Package size={17} /></span><span>Out of stock</span><strong>{data.products.filter((item) => !item.archived && item.stock === 0).length}</strong></div>
        </div>
        <Link href="/inventory" className="text-link">Go to inventory <ArrowRight size={14} /></Link>
      </Panel>
    </div>

    <div className="dashboard-lower">
      <Panel>
        <div className="panel-heading"><div><h2>Needs attention</h2><p>Products at or below their reorder level</p></div><Link href="/inventory" className="panel-link">View all</Link></div>
        <div className="attention-list">
          {lowStock.slice(0, 5).map((product) => <Link href={`/products/${product.id}`} className="attention-row" key={product.id}>
            <span className="product-avatar">{product.name.slice(0, 1)}</span><span className="attention-product"><strong>{product.name}</strong><small>{product.sku}</small></span><span className="attention-stock"><strong>{product.stock}</strong><small>of {product.reorderLevel} min.</small></span><Status tone={product.stock === 0 ? "red" : "amber"}>{product.stock === 0 ? "Out" : "Low"}</Status>
          </Link>)}
          {lowStock.length === 0 && <div className="empty-state">All products are above their reorder levels.</div>}
        </div>
      </Panel>
      <Panel>
        <div className="panel-heading"><div><h2>Recent transactions</h2><p>Your latest completed sales</p></div><Link href="/sales" className="panel-link">View all</Link></div>
        <div className="transaction-list">
          {data.sales.slice(0, 5).map((sale) => <Link href={`/sales/${sale.id}`} className="transaction-row" key={sale.id}>
            <span className="transaction-icon"><ShoppingBag size={16} /></span><span className="transaction-main"><strong>{sale.customerName}</strong><small>{sale.reference} · {shortDate(sale.createdAt, data.settings.timezone)}</small></span><span className="transaction-total"><strong>{money(sale.total, data.settings.currency)}</strong><small>{sale.paymentMethod}</small></span>
          </Link>)}
          {data.sales.length === 0 && <div className="empty-state">No transactions yet. Your sales will appear here.</div>}
        </div>
      </Panel>
    </div>

    <div className="quick-actions">
      <div><h2>Quick actions</h2><p>Get things done without breaking your flow.</p></div>
      <div className="quick-action-links">
        <Link href="/pos"><span className="quick-icon green"><ShoppingBag size={17} /></span><span><strong>New sale</strong><small>Start a checkout</small></span><ArrowUpRight size={15} /></Link>
        <Link href="/products/new"><span className="quick-icon blue"><Plus size={18} /></span><span><strong>Add product</strong><small>Grow your catalogue</small></span><ArrowUpRight size={15} /></Link>
        <Link href="/purchases/new"><span className="quick-icon amber"><Package size={17} /></span><span><strong>Receive stock</strong><small>Record a purchase</small></span><ArrowUpRight size={15} /></Link>
        <Link href="/expenses"><span className="quick-icon purple"><ArrowDownRight size={17} /></span><span><strong>Record expense</strong><small>Track shop spending</small></span><ArrowUpRight size={15} /></Link>
      </div>
    </div>
  </div>;
}
