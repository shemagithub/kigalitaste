import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import {
  Bike,
  ClipboardList,
  Clock,
  Handshake,
  Headphones,
  Heart,
  Home,
  LayoutDashboard,
  Loader2,
  MailCheck,
  Mail,
  Percent,
  Phone,
  Search,
  ShoppingBag,
  Store,
  Tag,
  UtensilsCrossed,
} from "lucide-react";
import { api, frw, img } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Btn, BtnLink, Logo, PillInput, UserAvatar, useBodyScrollLock } from "./ui";
import { newsletterFromSettings } from "./newsletterContent";
import { useCatalog } from "./catalog";
import {
  categoriesFromItems,
  type CartLine,
  type MenuItem,
  type Settings,
} from "./customer";
import { DishPromoBadge, useBogoAdd } from "./BogoPromo";
import { heroFromSettings } from "./heroContent";

const BAG =
  "https://images.unsplash.com/photo-1586511925558-a4c6376fe65f?auto=format&fit=crop&w=500&q=80";
const BOWL =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80";

const FEATURE_ICONS: Record<string, typeof Bike> = {
  bike: Bike,
  utensils: UtensilsCrossed,
  tag: Tag,
  headphones: Headphones,
  percent: Percent,
};

function navActive(loc: string, href: string, hash = "") {
  const path = (loc.split("?")[0] || "/").split("#")[0];
  if (href === "/restaurants") return path === "/restaurants" || path.startsWith("/r/");
  if (href === "/promos") return path === "/promos";
  if (href === "/") return path === "/" && !hash;
  return path === href || path.startsWith(`${href}/`);
}

function handleNavClick(href: string, _e?: { preventDefault?: () => void }) {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

type NavItem = {
  href: string;
  label: string;
  desktop: string;
  icon: typeof UtensilsCrossed;
};

function BottomNavLink({
  href,
  label,
  active,
  icon: Icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: typeof UtensilsCrossed;
}) {
  return (
    <Link
      href={href}
      onClick={(e) => handleNavClick(href, e)}
      className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 text-[10px] font-semibold leading-tight sm:text-[11px] ${
        active ? "text-primary" : "text-foreground/50"
      }`}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
          active ? "bg-primary text-white shadow-md shadow-primary/30" : "bg-transparent"
        }`}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 2} />
      </span>
      <span className="max-w-full truncate">{label}</span>
    </Link>
  );
}

function NavLink({
  href,
  label,
  active,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={(e) => {
        handleNavClick(href, e);
        onClick?.();
      }}
      className={`relative shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition ${
        active
          ? "bg-primary text-white shadow-md shadow-primary/25"
          : "text-foreground/70 hover:bg-secondary hover:text-primary"
      }`}
    >
      {label}
    </Link>
  );
}

export function PublicChrome({
  settings,
  cartCount,
  children,
}: {
  settings: Settings;
  cartCount: number;
  children: ReactNode;
}) {
  const [loc] = useLocation();
  const { user, logout } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [hash, setHash] = useState(() => (typeof window !== "undefined" ? window.location.hash : ""));
  const hero = heroFromSettings(settings);

  useEffect(() => {
    setAccountOpen(false);
    setSearchOpen(false);
    setHash(window.location.hash);
  }, [loc]);

  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const links: NavItem[] = [
    { href: "/", label: "Home", desktop: "Home", icon: Home },
    { href: "/restaurants", label: "Restaurants", desktop: "Restaurants", icon: Store },
    { href: "/promos", label: "Promo", desktop: "Promo", icon: Tag },
    { href: "/become-a-partner", label: "Partner", desktop: "Become a partner", icon: Handshake },
    { href: "/about", label: "About", desktop: "About", icon: UtensilsCrossed },
    { href: "/contact", label: "Contact", desktop: "Contact", icon: Phone },
    ...(user?.role === "customer"
      ? [{ href: "/orders", label: "Orders", desktop: "My orders", icon: ClipboardList }]
      : []),
    ...(user?.role === "vendor"
      ? [{ href: "/vendor", label: "Vendor", desktop: "Vendor", icon: Store }]
      : []),
    ...(user?.role === "admin"
      ? [{ href: "/admin", label: "Admin", desktop: "Admin", icon: LayoutDashboard }]
      : []),
  ];

  const bottomNavLinks: NavItem[] = [
    { href: "/", label: "Home", desktop: "Home", icon: Home },
    { href: "/restaurants", label: "Restaurants", desktop: "Restaurants", icon: Store },
    { href: "/promos", label: "Promo", desktop: "Promo", icon: Tag },
    { href: "/about", label: "About", desktop: "About", icon: UtensilsCrossed },
    { href: "/contact", label: "Contact", desktop: "Contact", icon: Phone },
    ...(user?.role === "customer"
      ? [{ href: "/orders", label: "Orders", desktop: "My orders", icon: ClipboardList }]
      : []),
    ...(user?.role === "vendor"
      ? [{ href: "/vendor", label: "Vendor", desktop: "Vendor", icon: Store }]
      : []),
    ...(user?.role === "admin"
      ? [{ href: "/admin", label: "Admin", desktop: "Admin", icon: LayoutDashboard }]
      : []),
  ];

  const iconBtn =
    "flex h-10 w-10 items-center justify-center rounded-full text-foreground/80 transition hover:bg-secondary hover:text-primary";

  return (
    <div className="min-h-screen bg-background pb-[5.5rem] text-foreground lg:pb-0">
      <div className="bg-[#1f1f1f] text-[11px] font-medium text-white/80">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <p className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {hero.topBannerText}
          </p>
          <p className="hidden sm:block">{hero.topBannerTagline}</p>
          <p className="hidden sm:block">{settings.phone || "24/7 Support"}</p>
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/90 shadow-[0_8px_30px_rgba(20,16,12,0.06)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] min-w-0 items-center gap-3 px-4 py-3 sm:gap-5 sm:px-6 sm:py-3.5">
          <Logo settings={settings} />
          <nav className="mx-auto hidden min-w-0 max-w-[720px] items-center gap-1 overflow-x-auto no-scrollbar rounded-full bg-[#f7f4f0] p-1 lg:flex">
            {links.map((l) => (
              <NavLink key={l.href} href={l.href} label={l.desktop} active={navActive(loc, l.href, hash)} />
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-full bg-[#f7f4f0] p-1">
              <button type="button" className={iconBtn} aria-label="Search" onClick={() => setSearchOpen(true)}>
                <Search className="h-[18px] w-[18px]" />
              </button>
              <div className="relative">
                <button
                  type="button"
                  className={`${iconBtn} overflow-hidden p-0 ${accountOpen ? "ring-2 ring-primary/30" : ""}`}
                  aria-label="Account"
                  onClick={() => setAccountOpen((v) => !v)}
                >
                  <UserAvatar user={user} />
                </button>
                {accountOpen && (
                  <div className="absolute right-0 mt-3 w-56 overflow-hidden rounded-2xl border border-black/5 bg-white p-2 text-sm shadow-card">
                    {user ? (
                      <>
                        <p className="px-3 py-2 text-xs font-medium text-muted-foreground">
                          {user.firstName} {user.lastName}
                        </p>
                        <Link href="/profile" className="block rounded-xl px-3 py-2 hover:bg-secondary hover:text-primary" onClick={() => setAccountOpen(false)}>
                          My profile
                        </Link>
                        {user.role === "customer" && (
                          <Link href="/orders" className="block rounded-xl px-3 py-2 hover:bg-secondary hover:text-primary" onClick={() => setAccountOpen(false)}>
                            My orders
                          </Link>
                        )}
                        {user.role === "vendor" && (
                          <Link href="/vendor" className="block rounded-xl px-3 py-2 hover:bg-secondary hover:text-primary" onClick={() => setAccountOpen(false)}>
                            Vendor
                          </Link>
                        )}
                        {user.role === "admin" && (
                          <Link href="/admin" className="block rounded-xl px-3 py-2 hover:bg-secondary hover:text-primary" onClick={() => setAccountOpen(false)}>
                            Admin
                          </Link>
                        )}
                        <Link href="/become-a-partner" className="block rounded-xl px-3 py-2 hover:bg-secondary hover:text-primary" onClick={() => setAccountOpen(false)}>
                          Become a partner
                        </Link>
                        <button type="button" className="block w-full rounded-xl px-3 py-2 text-left hover:bg-secondary hover:text-primary" onClick={() => { logout(); setAccountOpen(false); }}>
                          Log out
                        </button>
                      </>
                    ) : (
                      <>
                        <Link href="/login" className="block rounded-xl px-3 py-2 hover:bg-secondary hover:text-primary" onClick={() => setAccountOpen(false)}>
                          Log in
                        </Link>
                        <Link href="/register" className="block rounded-xl px-3 py-2 hover:bg-secondary hover:text-primary" onClick={() => setAccountOpen(false)}>
                          Create account
                        </Link>
                        <Link href="/become-a-partner" className="block rounded-xl px-3 py-2 hover:bg-secondary hover:text-primary" onClick={() => setAccountOpen(false)}>
                          Become a partner
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
              <Link href="/cart" className={`relative ${iconBtn}`}>
                <ShoppingBag className="h-[18px] w-[18px]" />
                {cartCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white shadow">
                    {cartCount}
                  </span>
                )}
              </Link>
            </div>
            {!user ? (
              <Link
                href="/login"
                className="hidden rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:brightness-105 lg:inline-flex"
              >
                Log in
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}

      {children}

      <PublicFooter settings={settings} />

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/95 shadow-[0_-10px_30px_rgba(20,16,12,0.08)] backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Main"
      >
        <div className="mx-auto flex max-w-[1440px] items-stretch px-1 pt-1">
          {bottomNavLinks.map((l) => (
            <BottomNavLink
              key={l.href}
              href={l.href}
              label={l.label}
              icon={l.icon}
              active={navActive(loc, l.href, hash)}
            />
          ))}
        </div>
      </nav>
    </div>
  );
}

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const catalog = useCatalog();
  const items = catalog?.items || [];
  const restaurants = catalog?.restaurants || [];

  useBodyScrollLock(true);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const needle = q.trim().toLowerCase();
  const dishHits = needle
    ? items.filter((i) => `${i.name} ${i.description} ${i.restaurantName}`.toLowerCase().includes(needle))
    : items.slice(0, 6);
  const shopHits = needle
    ? restaurants.filter((r) => `${r.name} ${r.type} ${r.address}`.toLowerCase().includes(needle))
    : restaurants;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div
        className="mx-auto mt-8 flex max-h-[min(85dvh,calc(100dvh-2rem))] w-full max-w-xl flex-col rounded-3xl bg-white p-4 shadow-card sm:mt-16 sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search dishes or restaurants"
            className="h-12 w-full rounded-full bg-muted pl-10 pr-4 text-sm outline-none"
          />
        </div>
        <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto">
          {shopHits.map((r) => (
            <Link key={r.id} href={`/r/${r.slug}`} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-muted" onClick={onClose}>
              <img src={img(r.logoUrl)} alt="" className="h-10 w-10 rounded-xl object-cover" />
              <div>
                <p className="text-sm font-semibold">{r.name}</p>
                <p className="text-xs text-muted-foreground">{r.type}</p>
              </div>
            </Link>
          ))}
          {dishHits.map((item) => (
            <Link
              key={item.id}
              href={`/dish/${item.id}`}
              className="flex items-center gap-3 rounded-2xl p-2 hover:bg-muted"
              onClick={onClose}
            >
              <img src={img(item.imageUrl)} alt="" className="h-10 w-10 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.restaurantName}</p>
              </div>
              <span className="text-sm font-bold text-primary">{frw(item.price)}</span>
            </Link>
          ))}
          {needle && shopHits.length === 0 && dishHits.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No matches</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PublicFooter({ settings }: { settings: Settings }) {
  const newsletter = newsletterFromSettings(settings);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [message, setMessage] = useState("");

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    try {
      const res = await api<{ ok: boolean; message: string; alreadySubscribed?: boolean }>("/api/subscribe", {
        method: "POST",
        json: { email: trimmed },
      });
      setSubscribed(true);
      setMessage(res.message);
      toast.success(res.message);
      if (!res.alreadySubscribed) setEmail("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <footer className="mt-8">
      <div className="border-y border-border bg-white">
        <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6">
          {subscribed ? (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
              <MailCheck className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
              <div>
                <p className="font-bold text-emerald-900">You are subscribed</p>
                <p className="mt-1 text-sm text-emerald-800">{message}</p>
                <button
                  type="button"
                  className="mt-3 text-sm font-semibold text-emerald-700 underline"
                  onClick={() => {
                    setSubscribed(false);
                    setMessage("");
                  }}
                >
                  Subscribe another email
                </button>
              </div>
            </div>
          ) : (
            <form
              className="flex flex-col gap-4 rounded-[1.75rem] border border-primary/10 bg-gradient-to-br from-secondary/30 to-white p-5 sm:flex-row sm:items-center"
              onSubmit={(e) => void subscribe(e)}
            >
              <div className="min-w-0 sm:max-w-[14rem]">
                <p className="text-lg font-bold">{newsletter.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{newsletter.subtitle}</p>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                <PillInput
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={newsletter.placeholder}
                  variant="soft"
                  inputSize="md"
                  icon={<Mail className="h-4 w-4" />}
                  disabled={loading}
                  wrapperClassName="min-w-0 flex-1"
                  autoComplete="email"
                />
                <Btn type="submit" disabled={loading || !email.trim()} size="md" className="shrink-0 sm:min-w-[8.5rem]">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {loading ? "Subscribing…" : newsletter.button}
                </Btn>
              </div>
            </form>
          )}
        </div>
      </div>
      <div className="bg-[#1f1f1f] text-white">
        <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-12 sm:px-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo settings={settings} light />
            <p className="mt-3 max-w-xs text-sm text-white/70">
              Multivendor food delivery across Kigali. Pay in FRw. We bring it to your door.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:gap-x-10 lg:col-span-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/50">Company</p>
              <div className="mt-3 space-y-2 text-sm text-white/80">
                <Link href="/about" className="block hover:text-primary">About Us</Link>
                <Link href="/become-a-partner" className="block hover:text-primary">Careers / Partners</Link>
                <Link href="/contact" className="block hover:text-primary">Press</Link>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/50">Help</p>
              <div className="mt-3 space-y-2 text-sm text-white/80">
                <Link href="/orders" className="block hover:text-primary">Track Order</Link>
                <Link href="/faq" className="block hover:text-primary">FAQ</Link>
                <Link href="/shipping" className="block hover:text-primary">Shipping & Delivery</Link>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/50">Contact Us</p>
            <div className="mt-3 space-y-2 text-sm text-white/80">
              <p>{settings.phone || "+250 780 000 000"}</p>
              <p>{settings.email || "hello@kigalitaste.rw"}</p>
              <p>{settings.address || "Kacyiru, Kigali, Rwanda"}</p>
            </div>
          </div>
        </div>
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-end justify-between gap-4 px-4 pb-8 sm:px-6">
          <p className="text-xs text-white/40">Prices in FRw · Delivery in Kigali</p>
          <p className="font-serif text-2xl italic text-primary">Good Food Good Mood</p>
        </div>
      </div>
    </footer>
  );
}

export function DishCard({
  item,
  favorited,
  onFav,
  onAdd,
}: {
  item: MenuItem;
  favorited: boolean;
  onFav: () => void;
  onAdd: () => void;
}) {
  const [, setLoc] = useLocation();

  return (
    <article
      className="cursor-pointer overflow-hidden rounded-2xl bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lg sm:rounded-3xl"
      onClick={() => setLoc(`/dish/${item.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setLoc(`/dish/${item.id}`);
        }
      }}
      role="link"
      tabIndex={0}
    >
      <div className="relative">
        <img
          src={img(item.imageUrl)}
          alt={`${item.name}${item.restaurantName ? ` from ${item.restaurantName}` : ""} — food delivery in Kigali`}
          className="h-32 w-full object-cover sm:h-40"
        />
        <DishPromoBadge item={item} />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onFav();
          }}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow"
          aria-label="Favorite"
        >
          <Heart className={`h-4 w-4 ${favorited ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
        </button>
      </div>
      <div className="p-3 sm:p-4">
        <h3 className="text-sm font-semibold leading-snug sm:text-base">{item.name}</h3>
        <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground sm:text-xs">
          {item.description || item.restaurantName}
        </p>
        <div className="mt-2.5 flex items-end justify-between sm:mt-3">
          <span className="text-sm font-bold sm:text-base">{frw(item.price)}</span>
          <button
            type="button"
            disabled={!item.isAvailable}
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-lg font-bold text-white disabled:opacity-40 sm:h-9 sm:w-9"
            aria-label={`Add ${item.name}`}
          >
            +
          </button>
        </div>
      </div>
    </article>
  );
}

export function HomePage({
  settings,
  cart,
  onCart,
  favs,
  onFavs,
}: {
  settings: Settings;
  cart: CartLine[];
  onCart: (cart: CartLine[]) => void;
  favs: number[];
  onFavs: (ids: number[]) => void;
}) {
  const [, setLoc] = useLocation();
  const catalog = useCatalog();
  const items = catalog?.items || [];
  const restaurants = catalog?.restaurants || [];
  const [activeCat, setActiveCat] = useState("");
  const [featuredPromo, setFeaturedPromo] = useState<{
    code: string;
    headline: string;
    condition: string;
    firstOrderOnly: boolean;
  } | null>(null);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    const timer = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [items.length, featuredPromo?.code]);

  useEffect(() => {
    const onHash = () => {
      const id = window.location.hash.replace("#", "");
      if (id) document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    api<{ promo: { code: string; headline: string; condition: string; firstOrderOnly: boolean } | null }>(
      "/api/promos/featured",
    )
      .then((data) => setFeaturedPromo(data.promo))
      .catch(() => setFeaturedPromo(null));
  }, []);

  const categories = useMemo(() => categoriesFromItems(items), [items]);
  const dishes = activeCat
    ? items.filter((i) => {
        const look = categories.find((c) => c.key === activeCat);
        return look ? look.match.test(`${i.name} ${i.categoryName || ""}`) : true;
      })
    : items;

  const firstShop = restaurants[0];
  const hero = heroFromSettings(settings);
  const primaryHref = hero.primaryHref || (firstShop ? `/r/${firstShop.slug}` : "/restaurants");
  const { addDish, bogoModal } = useBogoAdd({
    cart,
    onCart,
    catalogItems: items,
    onAdded: (item) => toast.success(`${item.name} added`),
  });

  function add(item: MenuItem) {
    if (!item.restaurantId || !item.restaurantName) return;
    addDish(item, { id: item.restaurantId, name: item.restaurantName });
  }

  function toggleFav(id: number) {
    onFavs(favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id]);
  }

  return (
    <div>
      {bogoModal}
      <section className="mx-auto grid max-w-[1440px] items-center gap-8 px-4 py-8 sm:gap-10 sm:px-6 sm:py-10 lg:grid-cols-2 lg:py-16">
        <div className="min-w-0 text-center sm:text-left">
          <h1 className="text-[2rem] font-extrabold leading-[1.12] tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
            <span className="block sm:inline">{hero.titleLine1}</span>{" "}
            <span className="font-serif italic text-primary">
              {hero.titleHighlight}
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:mx-0 sm:mt-4 sm:text-base">
            {hero.subtitle}
          </p>
          <div className="mt-5 flex flex-col gap-2.5 sm:mt-6 sm:flex-row sm:flex-wrap sm:gap-3">
            <Btn type="button" onClick={() => setLoc(primaryHref)} className="w-full sm:w-auto">
              {hero.primaryButton}
            </Btn>
            <BtnLink href={hero.secondaryHref} variant="outline" className="w-full sm:w-auto">
              {hero.secondaryButton}
            </BtnLink>
          </div>
          <div className="mt-6 flex items-center justify-center gap-3 sm:mt-8 sm:justify-start">
            <div className="flex -space-x-2">
              {hero.avatars.map((src) => (
                <img key={src} src={src} alt="" className="h-8 w-8 rounded-full border-2 border-white object-cover sm:h-9 sm:w-9" />
              ))}
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold sm:text-sm">{hero.customersText}</p>
              <p className="text-[11px] text-amber-500 sm:text-xs">
                ★★★★★ <span className="text-muted-foreground">{hero.ratingText}</span>
              </p>
            </div>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-xl lg:mx-0 lg:max-w-none">
          <img
            src={hero.mainImage}
            alt=""
            className="h-[220px] w-full rounded-[1.5rem] object-cover shadow-2xl sm:h-[300px] sm:rounded-[2rem] md:h-[420px]"
          />
          <img
            src={hero.badgeImage}
            alt=""
            className="absolute -bottom-4 left-4 hidden h-20 w-20 rounded-full border-4 border-white object-cover shadow-xl sm:-bottom-6 sm:left-6 sm:block sm:h-28 sm:w-28"
          />
          <div className="absolute right-2 top-3 flex max-w-[min(100%,11rem)] items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold shadow-card backdrop-blur sm:right-4 sm:top-6 sm:max-w-none sm:gap-2 sm:px-3 sm:py-2 sm:text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white sm:h-8 sm:w-8">
              <Bike className="h-3 w-3 sm:h-4 sm:w-4" />
            </span>
            <span className="truncate">{hero.badgeTitle}</span>
            <span className="truncate text-muted-foreground">{hero.badgeSubtitle}</span>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-white">
        <div className="mx-auto grid max-w-[1440px] gap-5 px-4 py-6 sm:grid-cols-2 sm:gap-6 sm:px-6 sm:py-8 lg:grid-cols-5">
          {hero.features.map(({ icon, title, body }) => {
            const Icon = FEATURE_ICONS[icon] || Bike;
            return (
              <div key={`${title}-${body}`} className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary sm:h-11 sm:w-11">
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold">{title}</p>
                  <p className="text-xs leading-snug text-muted-foreground">{body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="categories" className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-5 flex items-end justify-between gap-3 sm:mb-6">
          <h2 className="text-xl font-extrabold sm:text-2xl md:text-3xl">Explore Categories</h2>
          <Link href="/menu" className="shrink-0 text-xs font-semibold text-primary sm:text-sm">
            View all →
          </Link>
        </div>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">Live kitchens will appear here once a vendor goes live.</p>
        ) : (
          <div
            className="-mx-4 touch-scroll-x no-scrollbar flex gap-3 overflow-x-auto overscroll-x-contain px-4 pb-3 [-webkit-overflow-scrolling:touch] snap-x snap-proximity md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 md:pb-0 md:snap-none lg:grid-cols-6"
            role="list"
            aria-label="Food categories"
          >
            {categories.map((cat) => (
              <button
                key={cat.key}
                type="button"
                role="listitem"
                onClick={() => {
                  setActiveCat(cat.key === activeCat ? "" : cat.key);
                  document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`w-[9.5rem] shrink-0 snap-start overflow-hidden rounded-2xl bg-white text-left shadow-card ring-2 touch-manipulation select-none sm:w-[10.5rem] md:w-auto md:max-w-none md:rounded-3xl ${
                  activeCat === cat.key ? "ring-primary" : "ring-transparent"
                }`}
              >
                <img
                  src={img(cat.photo)}
                  alt=""
                  draggable={false}
                  className="pointer-events-none h-24 w-full object-cover sm:h-28"
                />
                <div className="p-2.5 sm:p-3">
                  <p className="truncate text-sm font-bold sm:text-base">{cat.label}</p>
                  <p className="text-[11px] text-muted-foreground sm:text-xs">{cat.count}+ Items</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-[1440px] px-4 pb-4 sm:px-6">
        <div className="mb-5 flex items-end justify-between gap-3 sm:mb-6">
          <h2 className="text-xl font-extrabold sm:text-2xl md:text-3xl">Kigali kitchens</h2>
          <Link href="/restaurants" className="shrink-0 text-xs font-semibold text-primary sm:text-sm">
            View all →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {restaurants.map((r) => (
            <Link key={r.id} href={`/r/${r.slug}`} className="overflow-hidden rounded-2xl bg-white shadow-card sm:rounded-3xl">
              <img src={img(r.coverUrl || r.logoUrl)} alt="" className="h-36 w-full object-cover sm:h-40" />
              <div className="p-3.5 sm:p-4">
                <p className="font-bold">{r.name}</p>
                <p className="text-sm text-muted-foreground">{r.type} · {r.openingHours}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-[1440px] px-4 pb-10 sm:px-6 sm:pb-12">
        <div className="mb-5 flex items-end justify-between gap-3 sm:mb-6">
          <h2 className="text-xl font-extrabold sm:text-2xl md:text-3xl">Popular Dishes</h2>
          <Link href="/restaurants" className="shrink-0 text-xs font-semibold text-primary sm:text-sm">
            View all →
          </Link>
        </div>
        {dishes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No dishes in this category yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {dishes.map((item) => (
              <DishCard
                key={item.id}
                item={item}
                favorited={favs.includes(item.id)}
                onFav={() => toggleFav(item.id)}
                onAdd={() => add(item)}
              />
            ))}
          </div>
        )}
      </section>

      <section id="offers" className="mx-auto max-w-[1440px] px-4 pb-10 sm:px-6 sm:pb-12">
        <div className="relative overflow-hidden rounded-[1.5rem] bg-[#1a1a1a] px-5 py-8 text-white sm:rounded-[2rem] sm:px-6 sm:py-10 md:px-12">
          <div className="grid items-center gap-6 md:grid-cols-[1fr_1.4fr_1fr]">
            <img src={BAG} alt="" className="mx-auto h-28 w-28 object-contain sm:h-36 sm:w-36 md:h-44 md:w-44" />
            <div className="text-center md:text-left">
              <p className="text-sm font-semibold tracking-wide text-white/70">HUNGRY? WE'VE GOT YOU!</p>
              <p className="mt-2 text-3xl font-extrabold md:text-4xl">
                {featuredPromo ? (
                  <>
                    {featuredPromo.headline}{" "}
                    <span className="text-primary">
                      {featuredPromo.firstOrderOnly ? "On Your First Order" : "On Your Order"}
                    </span>
                  </>
                ) : (
                  <>
                    Special offers <span className="text-primary">coming soon</span>
                  </>
                )}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 text-center">
              {featuredPromo ? (
                <>
                  <p className="text-xs uppercase tracking-wide text-white/60">Use Code</p>
                  <p className="mt-1 text-2xl font-black tracking-widest text-primary">{featuredPromo.code}</p>
                  <p className="mt-2 text-xs text-white/60">
                    {featuredPromo.condition ? `Valid on ${featuredPromo.condition}` : "Apply at checkout"}
                  </p>
                  <Link href="/promos" className="mt-3 inline-block rounded-full bg-primary px-4 py-2 text-sm font-semibold">
                    See all promos
                  </Link>
                </>
              ) : (
                <p className="text-sm text-white/70">Check back soon for promo codes at checkout.</p>
              )}
            </div>
          </div>
          <img src={BOWL} alt="" className="absolute -bottom-8 right-8 hidden h-28 w-28 rounded-full object-cover opacity-80 lg:block" />
        </div>
      </section>

      <section id="about" className="mx-auto max-w-[1440px] px-6 pb-16">
        <h2 className="mb-10 text-center text-2xl font-extrabold md:text-3xl">How It Works</h2>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: UtensilsCrossed, title: "Choose Your Food", body: "Explore menus and pick your favorite dishes." },
            { icon: ShoppingBag, title: "Place Your Order", body: "Add to cart and check out in FRw." },
            { icon: Bike, title: "Fast Delivery", body: "Kigali Taste delivers hot and fresh to your door." },
            { icon: Clock, title: "Enjoy Your Meal", body: "Sit back, relax, and enjoy your food." },
          ].map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="relative text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-primary">
                <Icon className="h-7 w-7" />
              </span>
              {i < 3 && <span className="absolute left-[60%] top-8 hidden w-[80%] border-t border-dashed border-primary/40 lg:block" />}
              <p className="mt-4 font-bold">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
