"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Command,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  Loader2,
  LayoutDashboard,
  Menu,
  MessageCircle,
  LogOut,
  Moon,
  Package,
  PackageSearch,
  Receipt,
  Search,
  Settings,
  ShoppingBag,
  Sun,
  Truck,
  Users,
  X,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { useRetail } from "@/lib/store";
import { DashboardPage } from "@/components/pages/dashboard";
import { CategoriesPage, ProductsPage } from "@/components/pages/products";
import {
  CustomersPage,
  ExpensesPage,
  InventoryPage,
  PurchasesPage,
  SuppliersPage,
} from "@/components/pages/operations";
import { SalesPage } from "@/components/pages/sales";
import { ReportsPage, SettingsPage } from "@/components/pages/reports-settings";
import { IconButton, Modal } from "@/components/retail-ui";

const SUPPORT_WHATSAPP_NUMBER = "233592771234";

const navigation = [
  {
    label: "Workspace",
    items: [{ label: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    label: "Sell",
    items: [
      { label: "New sale", href: "/pos", icon: ShoppingBag },
      { label: "Sales history", href: "/sales", icon: Receipt },
    ],
  },
  {
    label: "Manage",
    items: [
      { label: "Products", href: "/products", icon: Package },
      { label: "Inventory", href: "/inventory", icon: PackageSearch },
      { label: "Purchases", href: "/purchases", icon: Truck },
      { label: "Expenses", href: "/expenses", icon: CreditCard },
      { label: "Customers", href: "/customers", icon: Users },
    ],
  },
  {
    label: "Insights",
    items: [{ label: "Reports", href: "/reports", icon: BarChart3 }],
  },
  {
    label: "Workspace",
    items: [{ label: "Settings", href: "/settings", icon: Settings }],
  },
];

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const pageNames: Record<string, string> = {
  "/": "Dashboard",
  "/pos": "New sale",
  "/sales": "Sales history",
  "/products": "Products",
  "/categories": "Categories",
  "/inventory": "Inventory",
  "/purchases": "Purchases",
  "/suppliers": "Suppliers",
  "/expenses": "Expenses",
  "/customers": "Customers",
  "/reports": "Reports",
  "/settings": "Settings",
};

function routeLabel(pathname: string) {
  const root = `/${pathname.split("/")[1] ?? ""}`;
  if (pathname.startsWith("/sales/")) return "Sale receipt";
  if (pathname.startsWith("/products/"))
    return pathname.endsWith("/edit") ? "Edit product" : "Product details";
  if (pathname.startsWith("/purchases/"))
    return pathname.endsWith("/new") ? "Record purchase" : "Purchase details";
  if (pathname.startsWith("/suppliers/")) return "Supplier details";
  if (pathname.startsWith("/customers/")) return "Customer details";
  if (pathname.startsWith("/inventory/"))
    return (
      pathname
        .split("/")[2]
        ?.replace(/^\w/, (letter) => letter.toUpperCase()) ?? "Inventory"
    );
  if (pathname.startsWith("/expenses/")) return "Expense categories";
  if (pathname.startsWith("/reports/"))
    return (
      pathname
        .split("/")[2]
        ?.replace(/^\w/, (letter) => letter.toUpperCase()) ?? "Reports"
    );
  if (pathname.startsWith("/settings/"))
    return (
      pathname
        .split("/")[2]
        ?.replace(/^\w/, (letter) => letter.toUpperCase()) ?? "Settings"
    );
  return pageNames[root] ?? "Dashboard";
}

export function RetailApp() {
  const pathname = usePathname();
  const router = useRouter();
  const { data, ready, authReady, authenticated, unlock, logout } = useRetail();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const installPrompt = useRef<DeferredInstallPrompt | null>(null);
  const currentUser = data.users.find((item) => item.id === data.activeUserId);
  const lowStock = data.products.filter(
    (item) => !item.archived && item.stock <= item.reorderLevel,
  );

  useEffect(() => {
    let savedTheme: string | null = null;
    try { savedTheme = window.localStorage.getItem("retail-theme"); } catch { /* Storage may be disabled by the browser. */ }
    document.documentElement.dataset.theme = savedTheme === "dark" ? "dark" : "light";
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error: unknown) => {
        console.error("Could not register the app service worker.", error);
      });
    }
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      installPrompt.current = event as DeferredInstallPrompt;
    };
    const onAppInstalled = () => { installPrompt.current = null; };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        setNotificationsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const cashierPage = pathname === "/pos" || pathname === "/sales" || pathname.startsWith("/sales/");
    if (authenticated && currentUser?.role === "Cashier" && !cashierPage) router.replace("/pos");
  }, [authenticated, currentUser?.role, pathname, router]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const query = search.toLowerCase();
    const products = data.products
      .filter((item) =>
        `${item.name} ${item.sku} ${item.barcode}`
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 4)
      .map((item) => ({
        label: item.name,
        meta: `Product · ${item.sku}`,
        href: `/products/${item.id}`,
      }));
    const sales = data.sales
      .filter((item) =>
        `${item.reference} ${item.customerName}`.toLowerCase().includes(query),
      )
      .slice(0, 4)
      .map((item) => ({
        label: item.reference,
        meta: `Sale · ${item.customerName}`,
        href: `/sales/${item.id}`,
      }));
    return [...products, ...sales].slice(0, 6);
  }, [data.products, data.sales, search]);

  if (!authReady || (authenticated && !ready))
    return (
      <main className="app-loading">
        {/* <div className="loading-mark">E</div> */}
        {/* <strong>Everyday Essentials</strong> */}
        <span>Connecting to your workspace…</span>
      </main>
    );
  if (!authenticated) return <UnlockScreen onUnlock={unlock} />;

  const openSearch = () => {
    setSearchOpen(true);
    setNotificationsOpen(false);
  };
  const closeMobile = () => setMobileOpen(false);
  const canManage = currentUser?.role === "Owner";
  const toggleTheme = () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    try { window.localStorage.setItem("retail-theme", nextTheme); } catch { /* The theme still applies for this session. */ }
  };
  const installApp = async () => {
    const installed = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (installed) {
      toast.message("Everyday Retail is already installed on this device.");
      return;
    }
    if (installPrompt.current) {
      const prompt = installPrompt.current;
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") installPrompt.current = null;
      return;
    }
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
      || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isIOS) {
      toast.message("Add Everyday Retail to your Home Screen", {
        description: "In Safari, tap Share, choose Add to Home Screen, then tap Add.",
        duration: 9000,
      });
    } else {
      toast.message("Install Everyday Retail from your browser menu", {
        description: "Choose Install app or Add to Home screen in the browser menu.",
        duration: 8000,
      });
    }
  };

  const cashierPage = pathname === "/pos" || pathname === "/sales" || pathname.startsWith("/sales/");
  const restricted = !canManage && !cashierPage;
  const content = restricted ? (
    <div className="page-content">
      <section className="panel access-notice">
        <span className="access-notice-icon">
          <CircleHelp size={20} />
        </span>
        <h1>{canManage ? "Page not found" : "Opening the register"}</h1>
        <p>
          {canManage ? "This workspace page could not be found." : "Cashier accounts can use the register and their own sales history."}
        </p>
        {!canManage && <button className="button button-primary" onClick={() => router.replace("/pos")}>Go to register</button>}
      </section>
    </div>
  ) : pathname === "/" ? (
    <DashboardPage key={pathname} />
  ) : pathname === "/pos" ||
    pathname === "/sales" ||
    pathname.startsWith("/sales/") ? (
    <SalesPage key={pathname} />
  ) : pathname === "/products" ||
    pathname === "/products/new" ||
    pathname.startsWith("/products/") ? (
    <ProductsPage key={pathname} />
  ) : pathname === "/categories" ? (
    <CategoriesPage key={pathname} />
  ) : pathname === "/inventory" || pathname.startsWith("/inventory/") ? (
    <InventoryPage key={pathname} />
  ) : pathname === "/purchases" ||
    pathname === "/purchases/new" ||
    pathname.startsWith("/purchases/") ? (
    <PurchasesPage key={pathname} />
  ) : pathname === "/suppliers" || pathname.startsWith("/suppliers/") ? (
    <SuppliersPage key={pathname} />
  ) : pathname === "/expenses" || pathname.startsWith("/expenses/") ? (
    <ExpensesPage key={pathname} />
  ) : pathname === "/customers" || pathname.startsWith("/customers/") ? (
    <CustomersPage key={pathname} />
  ) : pathname === "/reports" || pathname.startsWith("/reports/") ? (
    <ReportsPage key={pathname} />
  ) : pathname === "/settings" || pathname.startsWith("/settings/") ? (
    <SettingsPage key={pathname} />
  ) : (
    <DashboardPage key={pathname} />
  );

  return (
    <div className={`app-frame ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <Link className="brand" href="/" onClick={closeMobile}>
          <span className="brand-mark">E</span>
          <span className="brand-copy">
            {/* <strong>everyday</strong> */}
            <small>RETAIL WORKSPACE</small>
          </span>
          <button
            type="button"
            className="mobile-close"
            aria-label="Close navigation"
            onClick={(event) => {
              event.preventDefault();
              closeMobile();
            }}
          >
            <X size={18} />
          </button>
        </Link>
        <div className="store-switcher">
          <span className="store-avatar">DJ</span>
          <span>
            <strong>{data.settings.name}</strong>
            {/* <small>Retail store</small> */}
          </span>
          {/* <ChevronDown size={15} /> */}
        </div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navigation.filter((group) => canManage || group.items.some((item) => item.href === "/pos" || item.href === "/sales")).map((group, groupIndex) => (
            <div className="nav-group" key={`${group.label}-${groupIndex}`}>
              <span className="nav-group-label">{group.label}</span>
              {group.items.filter((item) => canManage || item.href === "/pos" || item.href === "/sales").map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href ||
                      pathname.startsWith(`${item.href}/`) ||
                      (item.href === "/products" && pathname === "/categories");
                const isAdmin = [
                  "/products",
                  "/inventory",
                  "/purchases",
                  "/expenses",
                  "/reports",
                  "/settings",
                  "/suppliers",
                  "/customers",
                ].includes(item.href);
                const disabled = !canManage && isAdmin;
                return (
                  <Link
                    key={item.href}
                    href={disabled ? "/pos" : item.href}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={`nav-link ${active ? "active" : ""}`}
                    onClick={(event) => {
                      closeMobile();
                      if (disabled) {
                        event.preventDefault();
                        toast.message(
                          "This section is available to the owner profile.",
                        );
                      }
                    }}
                  >
                    <item.icon size={17} strokeWidth={1.8} />
                    <span>{item.label}</span>
                    {item.href === "/inventory" && lowStock.length > 0 && (
                      <small className="nav-count">{lowStock.length}</small>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            type="button"
            className="sidebar-help"
            title={collapsed ? "Help & support" : undefined}
            aria-haspopup="dialog"
            aria-expanded={helpOpen}
            onClick={() => {
              setMobileOpen(false);
              setHelpOpen(true);
            }}
          >
            <span className="help-mark">
              <CircleHelp size={16} />
            </span>
            <span>
              <strong>Need a hand?</strong>
              <small>Retail workspace</small>
            </span>
            <ChevronRight size={15} />
          </button>
          <div className="sidebar-user">
            <span className="user-avatar">
              {currentUser?.name.slice(0, 1) ?? "A"}
            </span>
            <span className="user-copy">
              <strong>{currentUser?.name ?? "Operator"}</strong>
              <small>{currentUser?.role ?? "Cashier"}</small>
            </span>
          </div>
          <button type="button" className="sidebar-logout" onClick={() => void logout()}>
            <LogOut size={15} />
            <span>Log out</span>
          </button>
          <button type="button" className="sidebar-install" onClick={() => void installApp()}>
            <Download size={15} />
            <span>Install app</span>
          </button>
        </div>
        <button
          className="sidebar-collapse"
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed(!collapsed)}
        >
          <ChevronLeft size={15} />
        </button>
      </aside>
      {mobileOpen && (
        <button
          type="button"
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={closeMobile}
        />
      )}
      <div className="main-column">
        <header className="topbar">
          <div className="topbar-left">
            <IconButton
              className="mobile-menu-button"
              label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={19} />
            </IconButton>
            <span className="topbar-context">Workspace</span>
            <ChevronRight size={14} className="context-chevron" />
            <span className="topbar-current">{routeLabel(pathname)}</span>
          </div>
          <div className="topbar-actions">
            {/* <IconButton label="Install app" onClick={() => void installApp()}>
              <Download size={17} />
            </IconButton> */}
            <IconButton label="Toggle dark mode" onClick={toggleTheme}>
              <Sun className="theme-icon-light" size={17} />
              <Moon className="theme-icon-dark" size={17} />
            </IconButton>
            <button
              type="button"
              className="global-search"
              onClick={openSearch}
            >
              <Search size={16} />
              <span>Search products, sales...</span>
              <kbd>
                <Command size={11} /> K
              </kbd>
            </button>
            {canManage && <div className="topbar-popover-wrap">
              <IconButton
                label={`Notifications, ${lowStock.length} low stock items`}
                onClick={() => {
                  setNotificationsOpen(!notificationsOpen);
                  setSearchOpen(false);
                }}
              >
                <Bell size={18} />
                {lowStock.length > 0 && <i className="notification-dot" />}
              </IconButton>
              {notificationsOpen && (
                <div className="popover notification-popover">
                  <div className="popover-title">
                    <strong>Notifications</strong>
                    <span>{lowStock.length} new</span>
                  </div>
                  {lowStock.length ? (
                    lowStock.slice(0, 5).map((item) => (
                      <Link
                        href="/inventory"
                        key={item.id}
                        onClick={() => setNotificationsOpen(false)}
                      >
                        <span className="notification-indicator" />
                        <span>
                          <strong>{item.name}</strong>
                          <small>
                            {item.stock === 0
                              ? "Out of stock"
                              : `${item.stock} remaining — reorder at ${item.reorderLevel}`}
                          </small>
                        </span>
                      </Link>
                    ))
                  ) : (
                    <p className="popover-empty">
                      You&apos;re all caught up. No low-stock alerts.
                    </p>
                  )}
                </div>
              )}
            </div>}
            <div className="topbar-popover-wrap">
              <div className="profile-trigger">
                <span className="user-avatar small">
                  {currentUser?.name.slice(0, 1) ?? "O"}
                </span>
                <span className="profile-trigger-copy">
                  <strong>{currentUser?.name ?? "Operator"}</strong>
                  <small>{currentUser?.role ?? "Cashier"}</small>
                </span>
              </div>
            </div>
          </div>
        </header>
        <main className="main-content">{content}</main>
        <footer className="app-footer">
          <span>
            © {new Date().getFullYear()} {data.settings.name}
          </span>
        </footer>
      </div>
      {searchOpen && (
        <div
          className="search-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSearchOpen(false);
          }}
        >
          <div className="search-dialog">
            <label className="search-dialog-input">
              <Search size={18} />
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setSearchOpen(false);
                  if (event.key === "Enter" && searchResults[0]) {
                    router.push(searchResults[0].href);
                    setSearchOpen(false);
                  }
                }}
                placeholder="Search products, SKUs, sales..."
              />
              <kbd>ESC</kbd>
            </label>
            <div className="search-dialog-results">
              {search.trim() ? (
                searchResults.length ? (
                  searchResults.map((result) => (
                    <Link
                      key={result.href}
                      href={result.href}
                      onClick={() => setSearchOpen(false)}
                    >
                      <span className="search-result-icon">
                        <Search size={15} />
                      </span>
                      <span>
                        <strong>{result.label}</strong>
                        <small>{result.meta}</small>
                      </span>
                      <ChevronRight size={15} />
                    </Link>
                  ))
                ) : (
                  <div className="empty-state">
                    No results found. Try another name or receipt number.
                  </div>
                )
              ) : (
                <div className="search-hint">
                  Start typing to find products by name or SKU, or sales by
                  receipt number.
                </div>
              )}
            </div>
            <div className="search-dialog-footer">
              <span>
                <kbd>↵</kbd> to select
              </span>
              <span>
                <kbd>ESC</kbd> to close
              </span>
            </div>
          </div>
        </div>
      )}
      <Modal
        title="Help & support"
        description="Find a workspace task or get in touch with our team."
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      >
        <div className="help-panel-content">
          <div className="help-panel-section">
            <h3>Quick links</h3>
            <div className="help-panel-links">
              <Link href="/pos" onClick={() => setHelpOpen(false)}>
                <ShoppingBag size={17} />
                <span>Start a sale</span>
                <ChevronRight size={15} />
              </Link>
              <Link href="/sales" onClick={() => setHelpOpen(false)}>
                <Receipt size={17} />
                <span>Find a receipt</span>
                <ChevronRight size={15} />
              </Link>
              {canManage && (
                <>
                  <Link href="/products" onClick={() => setHelpOpen(false)}>
                    <Package size={17} />
                    <span>Manage products</span>
                    <ChevronRight size={15} />
                  </Link>
                  <Link href="/inventory" onClick={() => setHelpOpen(false)}>
                    <PackageSearch size={17} />
                    <span>Check inventory</span>
                    <ChevronRight size={15} />
                  </Link>
                  <Link href="/purchases" onClick={() => setHelpOpen(false)}>
                    <Truck size={17} />
                    <span>Track purchases</span>
                    <ChevronRight size={15} />
                  </Link>
                </>
              )}
            </div>
          </div>
          <a
            className="help-panel-contact"
            href={`https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi.")}`}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle size={18} />
            <span>
              <strong>Contact support on WhatsApp</strong>
              <small>+233 59 277 1234</small>
            </span>
            <ArrowRight size={16} />
          </a>
        </div>
      </Modal>
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  );
}

function UnlockScreen({
  onUnlock,
}: {
  onUnlock: (passcode: string) => Promise<void>;
}) {
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onUnlock(passcode);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not unlock the workspace.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="unlock-screen">
      <div className="unlock-wrap">
        <form className="unlock-card" onSubmit={submit} aria-label="Unlock workspace">
          <div className="unlock-control">
            <div className="unlock-input-wrap">
              <label className="sr-only" htmlFor="passcode">Access code</label>
              <input
                id="passcode"
                autoComplete="current-password"
                type={showPasscode ? "text" : "password"}
                value={passcode}
                onChange={(event) => setPasscode(event.target.value)}
                required
                autoFocus
                disabled={busy}
                placeholder="Enter your access code"
              />
              <button
                type="button"
                className="unlock-visibility"
                aria-label={showPasscode ? "Hide code" : "Show code"}
                aria-pressed={showPasscode}
                onClick={() => setShowPasscode((visible) => !visible)}
                disabled={busy}
              >
                {showPasscode ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <button
              className="unlock-submit"
              type="submit"
              aria-label="Unlock workspace"
              disabled={busy}
            >
              {busy ? <Loader2 className="unlock-spinner" size={20} /> : <ArrowRight size={20} />}
            </button>
          </div>
        </form>
        {error && (
          <p className="unlock-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
