import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  Bike,
  ClipboardList,
  LayoutDashboard,
  Mail,
  MapPin,
  Menu,
  Newspaper,
  Percent,
  Settings,
  Sparkles,
  Star,
  Info,
  Store,
  UserRound,
  Users,
  UtensilsCrossed,
  Wallet,
  ArrowLeftRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useSettings } from "./catalog";
import { BrandName, Logo } from "./ui";
import { img } from "@/lib/api";

const ICONS: Record<string, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  hero: Sparkles,
  about: Info,
  shop: Store,
  menu: UtensilsCrossed,
  menus: UtensilsCrossed,
  orders: ClipboardList,
  reviews: Star,
  promos: Percent,
  wallet: Wallet,
  transactions: ArrowLeftRight,
  vendors: Users,
  restaurants: Store,
  customers: UserRound,
  markup: Percent,
  delivery: Bike,
  "delivery-zones": MapPin,
  mailbox: Mail,
  newsletter: Newspaper,
  settings: Settings,
};

export function BalanceCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] bg-[linear-gradient(145deg,#0f5a50,#0a3d36)] p-5 text-white shadow-lg sm:p-6">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
      <p className="text-sm text-white/70">{label}</p>
      <p className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl md:text-4xl">{value}</p>
      {hint && <p className="mt-4 text-xs tracking-wide text-white/50">{hint}</p>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  pct = 60,
  gold = false,
}: {
  label: string;
  value: string;
  pct?: number;
  gold?: boolean;
}) {
  const color = gold ? "#e8c547" : "#0d4f46";
  return (
    <div className="flex items-center justify-between gap-3 rounded-[1.5rem] bg-white p-4 shadow-card sm:p-5">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-xl font-extrabold sm:text-2xl">{value}</p>
      </div>
      <div
        className="h-14 w-14 shrink-0 rounded-full"
        style={{
          background: `conic-gradient(${color} ${pct * 3.6}deg, #eceae3 0deg)`,
        }}
      >
        <div className="m-[5px] flex h-[46px] w-[46px] items-center justify-center rounded-full bg-white text-[10px] font-bold">
          {pct}%
        </div>
      </div>
    </div>
  );
}

export function PanelShell({
  title,
  basePath,
  nav,
  tab,
  onLogout,
  children,
}: {
  title: string;
  basePath: string;
  nav: string[][];
  tab: string;
  onLogout: () => void;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const dateLabel = useMemo(
    () =>
      new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    [],
  );
  const current = nav.find(([id]) => id === tab)?.[1] || title;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [tab]);

  return (
    <div className="panel min-h-screen overflow-x-hidden text-foreground lg:pl-[280px]">
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-3 left-3 z-30 flex max-h-[calc(100dvh-1.5rem)] w-[min(260px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[1.75rem] bg-[#f7f4ee]/90 p-5 shadow-card backdrop-blur ${
          open ? "flex" : "hidden"
        } lg:flex`}
      >
        <div className="px-2">
          <Logo settings={settings} />
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0d4f46]/60">{title}</p>
        </div>
        <nav className="mt-8 min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain">
          {nav.map(([id, label]) => {
            const Icon = ICONS[id] || LayoutDashboard;
            const href = `${basePath}/${id}`;
            const active = tab === id;
            return (
              <Link
                key={id}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-left text-sm font-medium transition ${
                  active ? "bg-[#0d4f46] text-white shadow-md" : "text-muted-foreground hover:bg-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="rounded-[1.5rem] bg-[linear-gradient(160deg,#0f5a50,#0a3d36)] p-4 text-white">
          <p className="text-sm font-bold">{title} tools</p>
          <p className="mt-1 text-xs text-white/70">Manage kitchens, orders and wallets in FRw.</p>
          <Link
            href="/"
            className="mt-3 inline-flex rounded-full bg-white px-4 py-2 text-xs font-bold text-[#0d4f46]"
          >
            Open site →
          </Link>
        </div>
        <Link href="/profile" className="mt-3 px-2 text-left text-sm font-semibold text-[#0d4f46]" onClick={() => setOpen(false)}>
          My profile
        </Link>
        <button type="button" className="mt-2 px-2 text-left text-sm text-muted-foreground" onClick={onLogout}>
          Log out
        </button>
      </aside>

      <header className="flex min-w-0 items-center justify-between gap-2 px-4 py-4 lg:hidden">
        <button type="button" onClick={() => setOpen(!open)} className="shrink-0 rounded-full bg-white px-3 py-2 shadow-card">
          <Menu className="h-4 w-4" />
        </button>
        <span className="min-w-0 truncate text-center font-bold">{current}</span>
        <span className="w-[42px] shrink-0" aria-hidden />
      </header>

      <div className="min-w-0 px-4 pb-8 lg:px-8 lg:pt-6">
        <div className="mb-6 hidden items-center justify-between gap-4 lg:flex">
          <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            {String(settings.logoUrl || "").trim() ? (
              <img
                src={img(settings.logoUrl)}
                alt=""
                className="h-7 w-7 rounded-full object-cover ring-1 ring-black/5"
              />
            ) : null}
            <BrandName name={settings.platformName || "Kigali Taste"} size="sm" className="inline text-base" />
            <span>· {title}</span>
          </p>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white px-4 py-2.5 text-sm font-medium shadow-card">{dateLabel}</span>
            <span className="rounded-full bg-white px-4 py-2.5 text-sm font-medium shadow-card">EN</span>
            <div className="flex items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-4 shadow-card">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0d4f46] text-xs font-bold text-white">
                {(user?.firstName || title)[0]}
              </span>
              <span className="text-sm font-semibold">
                {user ? `${user.firstName} ${user.lastName}` : title}
              </span>
            </div>
          </div>
        </div>
        <h1 className="mb-5 hidden text-2xl font-extrabold lg:block">{current}</h1>
        {children}
      </div>
    </div>
  );
}
