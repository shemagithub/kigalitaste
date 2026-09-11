import { useState } from "react";
import {
  Bell,
  ChevronDown,
  Heart,
  HelpCircle,
  Home,
  LayoutGrid,
  MapPin,
  Percent,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Store,
  UserRound,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatPrice, PROMO, USER } from "./data";
import { useCartItems, useStore, type PageName } from "./store";
import { Logo } from "./ui";

const NAV: { page: PageName; label: string; icon: typeof Home }[] = [
  { page: "home", label: "Home", icon: Home },
  { page: "restaurants", label: "Restaurants", icon: Store },
  { page: "categories", label: "Categories", icon: LayoutGrid },
  { page: "orders", label: "Orders", icon: UtensilsCrossed },
  { page: "favorites", label: "Favorites", icon: Heart },
  { page: "offers", label: "Offers", icon: Percent },
  { page: "help", label: "Help Center", icon: HelpCircle },
];

const MOBILE_NAV: { page: PageName; label: string; icon: typeof Home }[] = [
  { page: "home", label: "Home", icon: Home },
  { page: "orders", label: "Orders", icon: UtensilsCrossed },
  { page: "favorites", label: "Favorites", icon: Heart },
  { page: "profile", label: "Profile", icon: UserRound },
];

function isActive(current: PageName, page: PageName) {
  if (page === "home") return current === "home";
  if (page === "restaurants") return current === "restaurants" || current === "restaurant";
  return current === page;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { route, go, search, setSearch, cartCount, setCartOpen, applyPromo } =
    useStore();
  const [locationsOpen, setLocationsOpen] = useState(false);
  const [location, setLocation] = useState(USER.city);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    go({ page: "restaurants", query: search });
  }

  return (
    <div className="min-h-screen bg-[hsl(220_16%_97%)] text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col border-r border-border/70 bg-white px-5 py-6 lg:flex">
        <button type="button" onClick={() => go({ page: "home" })}>
          <Logo />
        </button>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(route.page, item.page);
            return (
              <button
                key={item.page}
                type="button"
                onClick={() => go({ page: item.page })}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                  active
                    ? "bg-secondary text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="rounded-[1.4rem] bg-secondary p-4">
          <p className="text-sm font-semibold leading-snug text-foreground">
            {PROMO.label}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Use code{" "}
            <span className="font-bold text-primary">{PROMO.code}</span>
          </p>
          <button
            type="button"
            onClick={() => {
              applyPromo(PROMO.code);
              go({ page: "restaurants" });
            }}
            className="mt-3 w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Order Now
          </button>
        </div>
      </aside>

      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-20 border-b border-border/60 bg-[hsl(220_16%_97%)]/90 backdrop-blur-md">
          <div className="flex items-center gap-3 px-4 py-3 md:px-6 lg:gap-6 lg:px-8 lg:py-4">
            <div className="relative">
              <button
                type="button"
                onClick={() => setLocationsOpen((open) => !open)}
                className="flex items-center gap-2 text-sm font-medium"
              >
                <MapPin className="h-4 w-4 text-primary" />
                <span className="max-w-[160px] truncate sm:max-w-none">{location}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
              {locationsOpen && (
                <div className="absolute left-0 top-10 z-30 w-52 rounded-2xl bg-white p-2 shadow-card">
                  {["Kigali, Rwanda", "Kacyiru, Kigali", "Kimihurura, Kigali"].map(
                    (place) => (
                      <button
                        key={place}
                        type="button"
                        onClick={() => {
                          setLocation(place);
                          setLocationsOpen(false);
                        }}
                        className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        {place}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>

            <form onSubmit={submitSearch} className="relative hidden flex-1 md:block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search for food, restaurants, cuisines..."
                className="h-12 w-full rounded-full border-0 bg-white pl-11 pr-4 text-sm shadow-card outline-none ring-primary/30 placeholder:text-muted-foreground focus:ring-2"
              />
            </form>

            <div className="ml-auto flex items-center gap-2 lg:gap-3">
              <button
                type="button"
                className="hidden h-11 w-11 items-center justify-center rounded-full bg-white text-muted-foreground shadow-card lg:flex"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-card"
                aria-label="Open cart"
              >
                <ShoppingBag className="h-5 w-5" />
                {cartCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                    {cartCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => go({ page: "profile" })}
                className="hidden items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-3 shadow-card lg:flex"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={USER.avatar} alt="" />
                  <AvatarFallback>AU</AvatarFallback>
                </Avatar>
                <span className="text-sm font-semibold">{USER.name}</span>
              </button>
            </div>
          </div>

          <div className="px-4 pb-3 md:hidden">
            <form onSubmit={submitSearch} className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search food, restaurants..."
                className="h-12 w-full rounded-full border-0 bg-white pl-11 pr-12 text-sm shadow-card outline-none"
              />
              <SlidersHorizontal className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </form>
          </div>
        </header>

        <main className="px-4 pb-28 pt-4 md:px-6 lg:px-8 lg:pb-10 lg:pt-6">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-white px-4 py-2 lg:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between">
          {MOBILE_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(route.page, item.page);
            return (
              <button
                key={item.page}
                type="button"
                onClick={() => go({ page: item.page })}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-1 text-[11px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full",
                    active && "bg-secondary",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <CartSheet />
    </div>
  );
}

function CartSheet() {
  const {
    cartOpen,
    setCartOpen,
    setQty,
    cartSubtotal,
    deliveryFee,
    discount,
    total,
    promoCode,
    setPromoCode,
    applyPromo,
    promoApplied,
    go,
    cartCount,
  } = useStore();
  const lines = useCartItems();

  return (
    <Sheet open={cartOpen} onOpenChange={setCartOpen}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-6 py-5 text-left">
          <SheetTitle className="text-xl">Your cart ({cartCount})</SheetTitle>
        </SheetHeader>
        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <ShoppingBag className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-semibold">Your cart is empty</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add dishes from a restaurant to get started.
            </p>
            <button
              type="button"
              onClick={() => {
                setCartOpen(false);
                go({ page: "restaurants" });
              }}
              className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Browse restaurants
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 px-6 py-5">
              {lines.map((line) => (
                <div key={line.itemId} className="flex gap-3">
                  <img
                    src={line.item.image}
                    alt=""
                    className="h-16 w-16 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{line.item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {line.restaurant?.name}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-primary">
                      {formatPrice(line.item.price)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-muted px-2 py-1">
                    <button
                      type="button"
                      className="h-6 w-6 rounded-full bg-white text-sm font-bold"
                      onClick={() => setQty(line.itemId, line.qty - 1)}
                    >
                      −
                    </button>
                    <span className="w-4 text-center text-sm font-semibold">
                      {line.qty}
                    </span>
                    <button
                      type="button"
                      className="h-6 w-6 rounded-full bg-primary text-sm font-bold text-white"
                      onClick={() => setQty(line.itemId, line.qty + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 rounded-2xl bg-muted p-2">
                <input
                  value={promoCode}
                  onChange={(event) => setPromoCode(event.target.value)}
                  placeholder="Promo code"
                  className="h-10 flex-1 rounded-xl bg-transparent px-3 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => applyPromo()}
                  className="rounded-xl bg-primary px-3 text-sm font-semibold text-white"
                >
                  Apply
                </button>
              </div>
              {promoApplied && (
                <p className="text-sm font-medium text-primary">TASTE50 applied</p>
              )}
            </div>
            <div className="space-y-2 border-t border-border px-6 py-5">
              <Row label="Subtotal" value={formatPrice(cartSubtotal)} />
              <Row
                label="Delivery"
                value={deliveryFee === 0 ? "Free" : formatPrice(deliveryFee)}
              />
              {discount > 0 && (
                <Row label="Discount" value={`− ${formatPrice(discount)}`} />
              )}
              <Row label="Total" value={formatPrice(total)} bold />
              <button
                type="button"
                onClick={() => {
                  setCartOpen(false);
                  go({ page: "checkout" });
                }}
                className="mt-2 w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground"
              >
                Checkout
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between text-sm",
        bold && "text-base font-bold",
      )}
    >
      <span className={cn(!bold && "text-muted-foreground")}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
