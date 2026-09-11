import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { toast } from "sonner";
import { Bike, Clock, CreditCard, MapPin, Phone, Star, Store } from "lucide-react";
import { api, frw, img, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Btn, BtnLink, Card, Empty, FormShell, FormStepper, GhostBtn, LineField, LineFile, LineInput, LineSelect, LineTextarea, Loading, Textarea, btnStyles } from "./ui";
import { HomePage, PublicChrome, DishCard } from "./HomePage";
import { DishDetailPage } from "./DishDetailPage";
import { AboutPage } from "./AboutPage";
import { FaqPage } from "./FaqPage";
import { ShippingPage } from "./ShippingPage";
import { RestaurantsPage } from "./RestaurantsPage";
import { PromosPage, RestaurantPromoTab } from "./PromosPage";
import { ProfilePage } from "./ProfilePage";
import { freePriceLabel, useBogoAdd } from "./BogoPromo";
import {
  CART_KEY,
  cartCheckoutItems,
  cartNeedsSync,
  clearCheckout,
  emptyCart,
  loadCart,
  loadCheckout,
  loadFavs,
  saveCart,
  saveCheckout,
  saveFavs,
  setCartLineQty,
  syncCartWithCatalog,
  type CartLine,
  type CheckoutDraft,
  type MenuItem,
  type Settings,
} from "./customer";
import { useCatalog, useSettings } from "./catalog";
import { DeliveryCheckoutFields, type DeliveryCheckoutValue } from "./DeliveryCheckoutFields";
import { buildDeliveryAddress } from "./deliveryCheckoutUtils";
import { OrderTrackingPanel } from "./OrderTrackingPanel";

function safeNext(fallback: string) {
  const next = new URLSearchParams(window.location.search).get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return fallback;
}

function homeForRole(role: string) {
  return role === "admin" ? "/admin/dashboard" : role === "vendor" ? "/vendor/dashboard" : "/";
}

export function PublicApp() {
  const [loc, setLoc] = useLocation();
  const settings = useSettings();
  const catalog = useCatalog();
  const [cart, setCart] = useState<CartLine[]>(loadCart);
  const [favs, setFavs] = useState<number[]>(loadFavs);

  function updateCart(next: CartLine[]) {
    const clean = next.filter((line) => line.qty > 0);
    setCart(clean);
    saveCart(clean);
  }

  useEffect(() => {
    if (!catalog) return;
    const latest = loadCart();
    if (!latest.length) return;
    const next = syncCartWithCatalog(latest, catalog.items);
    if (cartNeedsSync(latest, next)) updateCart(next);
  }, [catalog]);

  useEffect(() => {
    function sync() {
      setCart(loadCart());
    }
    function onStorage(e: StorageEvent) {
      if (e.key === CART_KEY || e.key === null) sync();
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("kt-cart", sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("kt-cart", sync);
    };
  }, []);

  function updateFavs(ids: number[]) {
    setFavs(ids);
    saveFavs(ids);
  }

  const path = (loc.split("#")[0] || "/").split("?")[0];

  useEffect(() => {
    if (path === "/checkout") setLoc("/cart");
  }, [path, setLoc]);
  const count = cart.reduce((s, l) => s + l.qty, 0);
  const slug = path.startsWith("/r/") ? path.slice(3) : "";
  const dishMatch = path.match(/^\/dish\/(\d+)$/);
  const dishId = dishMatch ? Number(dishMatch[1]) : 0;

  const known =
    path === "/" ||
    path === "/restaurants" ||
    path === "/promos" ||
    path === "/menu" ||
    path === "/cart" ||
    path === "/checkout" ||
    path === "/login" ||
    path === "/register" ||
    path === "/verify-email" ||
    path === "/forgot-password" ||
    path === "/reset-password" ||
    path === "/become-a-partner" ||
    path === "/waiting-approval" ||
    path === "/orders" ||
    path === "/profile" ||
    path === "/contact" ||
    path === "/about" ||
    path === "/faq" ||
    path === "/shipping" ||
    path === "/pay" ||
    path.startsWith("/pay/") ||
    dishId > 0 ||
    Boolean(slug);

  return (
    <PublicChrome settings={settings} cartCount={count}>
      <main>
        {path === "/" && (
          <HomePage settings={settings} cart={cart} onCart={updateCart} favs={favs} onFavs={updateFavs} />
        )}
        {path === "/menu" && (
          <MenuPage cart={cart} onCart={updateCart} favs={favs} onFavs={updateFavs} />
        )}
        {path === "/restaurants" && <RestaurantsPage />}
        {path === "/promos" && <PromosPage />}
        {slug && <RestaurantPage slug={slug} cart={cart} onCart={updateCart} favs={favs} onFavs={updateFavs} />}
        {dishId > 0 && (
          <DishDetailPage id={dishId} cart={cart} onCart={updateCart} favs={favs} onFavs={updateFavs} />
        )}
        {(path === "/cart" || path === "/checkout") && (
          <CartPage cart={cart} onCart={updateCart} settings={settings} />
        )}
        {path === "/login" && <AuthPage mode="login" />}
        {path === "/register" && <AuthPage mode="register" />}
        {path === "/verify-email" && <VerifyPage />}
        {path === "/forgot-password" && <ForgotPasswordPage />}
        {path === "/reset-password" && <ResetPasswordPage />}
        {path === "/become-a-partner" && <PartnerPage />}
        {path === "/waiting-approval" && <WaitingPage />}
        {path === "/orders" && <OrdersPage />}
        {path === "/profile" && <ProfilePage />}
        {(path === "/pay" || path.startsWith("/pay/")) && (
          <PayPage cart={cart} onCart={updateCart} settings={settings} />
        )}
        {path === "/contact" && <ContactPage />}
        {path === "/about" && (
          <PageWrap>
            <AboutPage settings={settings} />
          </PageWrap>
        )}
        {path === "/faq" && (
          <PageWrap>
            <FaqPage settings={settings} />
          </PageWrap>
        )}
        {path === "/shipping" && (
          <PageWrap>
            <ShippingPage settings={settings} />
          </PageWrap>
        )}
        {!known && (
          <PageWrap>
            <Empty
              title="Page not found"
              body="That link is not in Kigali Taste."
              action={
                <Link href="/">
                  <Btn>Back to restaurants</Btn>
                </Link>
              }
            />
          </PageWrap>
        )}
      </main>
    </PublicChrome>
  );
}

function PageWrap({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8">{children}</div>;
}

function MenuPage({
  cart,
  onCart,
  favs,
  onFavs,
}: {
  cart: CartLine[];
  onCart: (c: CartLine[]) => void;
  favs: number[];
  onFavs: (ids: number[]) => void;
}) {
  const catalog = useCatalog();
  const items = catalog?.items || [];
  const { addDish, bogoModal } = useBogoAdd({
    cart,
    onCart,
    catalogItems: items,
    onAdded: (item) => toast.success(`${item.name} added`),
  });

  if (!catalog) {
    return (
      <PageWrap>
        <Loading label="Loading menu…" />
      </PageWrap>
    );
  }

  return (
    <PageWrap>
      {bogoModal}
      <h1 className="text-3xl font-extrabold">Menu</h1>
      <p className="mt-1 text-sm text-muted-foreground">Every live dish in Kigali Taste, priced in FRw.</p>
      {items.length === 0 ? (
        <div className="mt-6">
          <Empty title="No dishes yet" body="Live kitchens will list food here." />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <DishCard
              key={item.id}
              item={item}
              favorited={favs.includes(item.id)}
              onFav={() => onFavs(favs.includes(item.id) ? favs.filter((x) => x !== item.id) : [...favs, item.id])}
              onAdd={() => {
                if (!item.restaurantId || !item.restaurantName) return;
                addDish(item, { id: item.restaurantId, name: item.restaurantName });
              }}
            />
          ))}
        </div>
      )}
    </PageWrap>
  );
}

function RestaurantReviews({ slug, asTab = false }: { slug: string; asTab?: boolean }) {
  const [reviews, setReviews] = useState<
    { rating: number; reviewComment: string | null; reviewedAt: string | null; customerName: string }[]
  >([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    api<typeof reviews>(`/api/restaurants/${slug}/reviews`)
      .then(setReviews)
      .catch(() => setReviews([]))
      .finally(() => setLoaded(true));
  }, [slug]);

  if (!loaded) {
    return asTab ? <Loading label="Loading reviews…" /> : null;
  }

  if (reviews.length === 0) {
    return asTab ? (
      <Empty title="No reviews yet" body="Be the first to rate an order from this kitchen after delivery." />
    ) : null;
  }

  const average = (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);

  return (
    <section className={asTab ? "" : "mt-10 border-t border-border pt-8"}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">Customer reviews</h2>
          <p className="text-sm text-muted-foreground">
            {average} ★ average · {reviews.length} review{reviews.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <div className="space-y-3">
        {reviews.map((review, idx) => (
          <Card key={`${review.customerName}-${review.reviewedAt}-${idx}`} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{review.customerName}</p>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={`h-4 w-4 ${n <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/25"}`}
                  />
                ))}
              </div>
            </div>
            {review.reviewComment ? (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{review.reviewComment}</p>
            ) : null}
          </Card>
        ))}
      </div>
    </section>
  );
}

function OrderReviewForm({ orderId, onDone }: { orderId: number; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (rating < 1) {
      toast.error("Pick a star rating first");
      return;
    }
    setSaving(true);
    try {
      await api(`/api/orders/${orderId}/review`, {
        method: "POST",
        json: { rating, comment: comment.trim() || undefined },
      });
      toast.success("Thanks for your review");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit review");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-2xl bg-muted/30 p-3">
      <p className="text-sm font-semibold">Rate this order</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} stars`}>
            <Star className={`h-6 w-6 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
          </button>
        ))}
      </div>
      <Textarea
        className="min-h-20 rounded-xl text-sm"
        placeholder="Optional comment about the food or delivery…"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <Btn size="sm" onClick={() => void submit()} disabled={saving || rating < 1}>
        {saving ? "Submitting…" : "Submit review"}
      </Btn>
    </div>
  );
}

function RestaurantPage({
  slug,
  cart,
  onCart,
  favs,
  onFavs,
}: {
  slug: string;
  cart: CartLine[];
  onCart: (cart: CartLine[]) => void;
  favs: number[];
  onFavs: (ids: number[]) => void;
}) {
  const [, setLoc] = useLocation();
  const search = useSearch();
  const catalog = useCatalog();
  const restaurant = catalog?.restaurants.find((r) => r.slug === slug) || null;
  const items = catalog?.items.filter((item) => item.restaurantSlug === slug) || [];
  const [tab, setTab] = useState<"menu" | "promo" | "reviews">("menu");
  const { addDish, bogoModal } = useBogoAdd({
    cart,
    onCart,
    catalogItems: catalog?.items || [],
    onAdded: (item) => toast.success(`${item.name} added`),
  });

  useEffect(() => {
    const next = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("tab");
    if (next === "promo" || next === "promos") setTab("promo");
    else if (next === "reviews") setTab("reviews");
    else setTab("menu");
  }, [search, slug]);

  if (!catalog) {
    return (
      <PageWrap>
        <Loading label="Loading restaurant…" />
      </PageWrap>
    );
  }

  if (!restaurant) {
    return (
      <PageWrap>
        <Empty
          title="Restaurant not found"
          body="This kitchen is not live, or the link is wrong."
          action={
            <Link href="/restaurants">
              <Btn>Browse restaurants</Btn>
            </Link>
          }
        />
      </PageWrap>
    );
  }

  const data = restaurant;

  function add(item: MenuItem) {
    addDish(item, { id: data.id, name: data.name });
  }

  function selectTab(next: "menu" | "promo" | "reviews") {
    setTab(next);
    setLoc(next === "menu" ? `/r/${slug}` : `/r/${slug}?tab=${next}`);
  }

  const grouped = items.reduce<{ id: number; name: string; items: MenuItem[] }[]>((groups, item) => {
    const existing = groups.find((g) => g.id === item.categoryId);
    if (existing) existing.items.push(item);
    else groups.push({ id: item.categoryId, name: item.categoryName || "Menu", items: [item] });
    return groups;
  }, []);

  const tabs: { id: "menu" | "promo" | "reviews"; label: string }[] = [
    { id: "menu", label: "Menu" },
    { id: "promo", label: "Promo" },
    { id: "reviews", label: "Reviews" },
  ];

  return (
    <div>
      {bogoModal}
      <img
        src={img(data.coverUrl)}
        alt={`${data.name} restaurant cover photo`}
        className="h-56 w-full object-cover md:h-72"
      />
      <PageWrap>
        <Link href="/restaurants" className="mb-4 inline-flex text-sm font-semibold text-primary hover:underline">
          ← All restaurants
        </Link>
        <div className="flex items-center gap-4">
          <img
            src={img(data.logoUrl)}
            alt={`${data.name} logo`}
            className="h-16 w-16 rounded-2xl object-cover shadow-card"
          />
          <div>
            <h1 className="text-3xl font-extrabold">{data.name}</h1>
            <p className="text-sm text-muted-foreground">
              {data.type} · {data.openingHours}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {data.address}
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-1 overflow-x-auto no-scrollbar rounded-full bg-[#f7f4f0] p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTab(t.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                tab === t.id
                  ? "bg-primary text-white shadow-md shadow-primary/25"
                  : "text-foreground/70 hover:bg-white hover:text-primary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "menu" ? (
            grouped.length === 0 ? (
              <p className="text-sm text-muted-foreground">This restaurant has no menu items yet.</p>
            ) : (
              grouped.map((group) => (
                <section key={group.id} className="mt-8 first:mt-0">
                  <h2 className="mb-4 text-xl font-bold">{group.name}</h2>
                  <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {group.items.map((item) => (
                      <DishCard
                        key={item.id}
                        item={item}
                        favorited={favs.includes(item.id)}
                        onFav={() =>
                          onFavs(favs.includes(item.id) ? favs.filter((x) => x !== item.id) : [...favs, item.id])
                        }
                        onAdd={() => add(item)}
                      />
                    ))}
                  </div>
                </section>
              ))
            )
          ) : null}

          {tab === "promo" ? <RestaurantPromoTab slug={slug} restaurantName={data.name} /> : null}

          {tab === "reviews" ? <RestaurantReviews slug={slug} asTab /> : null}
        </div>
      </PageWrap>
    </div>
  );
}

function streetFromSaved(saved: CheckoutDraft) {
  if (!saved.address) return "";
  if (saved.deliveryZoneName && saved.address.toLowerCase().includes(saved.deliveryZoneName.toLowerCase())) {
    return saved.address.split(",")[0]?.trim() || saved.address;
  }
  return saved.address.split(",")[0]?.trim() || saved.address;
}

function resolvedCheckoutAddress(draft: CheckoutDraft) {
  return buildDeliveryAddress(streetFromSaved(draft), draft.deliveryZoneName, draft.address);
}

type CheckoutPreview = {
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  promoCode: string | null;
  promoError: string | null;
  loading: boolean;
};

function useCheckoutPreview({
  enabled,
  cart,
  fulfillment,
  delivery,
  promo,
}: {
  enabled: boolean;
  cart: CartLine[];
  fulfillment: CheckoutDraft["fulfillment"];
  delivery: DeliveryCheckoutValue;
  promo: string;
}): CheckoutPreview {
  const subtotal = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const fallbackDelivery = fulfillment === "PICKUP" ? 0 : delivery.fee;
  const [preview, setPreview] = useState<CheckoutPreview>({
    subtotal,
    deliveryFee: fallbackDelivery,
    discount: 0,
    total: subtotal + fallbackDelivery,
    promoCode: null,
    promoError: null,
    loading: false,
  });

  useEffect(() => {
    if (!enabled || cart.length === 0) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setPreview((prev) => ({ ...prev, loading: true }));
      try {
        const address =
          fulfillment === "PICKUP"
            ? ""
            : buildDeliveryAddress(delivery.street, delivery.zoneName, delivery.address);
        const data = await api<{
          subtotal: number;
          deliveryFee: number;
          discount: number;
          total: number;
          promoCode: string | null;
          promoError: string | null;
        }>("/api/checkout/preview", {
          method: "POST",
          json: {
            restaurantId: cart[0].restaurantId,
            items: cartCheckoutItems(cart),
            fulfillment,
            deliveryAddress: address,
            deliveryLat: delivery.lat,
            deliveryLng: delivery.lng,
            deliveryZoneId: delivery.zoneId,
            promoCode: promo.trim() || undefined,
          },
        });
        if (!cancelled) {
          setPreview({
            subtotal: data.subtotal,
            deliveryFee: data.deliveryFee,
            discount: data.discount,
            total: data.total,
            promoCode: data.promoCode,
            promoError: data.promoError,
            loading: false,
          });
        }
      } catch {
        if (!cancelled) {
          setPreview({
            subtotal,
            deliveryFee: fallbackDelivery,
            discount: 0,
            total: subtotal + fallbackDelivery,
            promoCode: null,
            promoError: null,
            loading: false,
          });
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    enabled,
    cart,
    fulfillment,
    delivery.street,
    delivery.zoneName,
    delivery.address,
    delivery.lat,
    delivery.lng,
    delivery.zoneId,
    delivery.fee,
    promo,
    subtotal,
    fallbackDelivery,
  ]);

  return preview;
}

function CartPage({
  cart,
  onCart,
  settings,
}: {
  cart: CartLine[];
  onCart: (cart: CartLine[]) => void;
  settings: Settings;
}) {
  const { user } = useAuth();
  const [, setLoc] = useLocation();
  const saved = loadCheckout();
  const [fulfillment, setFulfillment] = useState<CheckoutDraft["fulfillment"]>(saved.fulfillment);
  const [delivery, setDelivery] = useState<DeliveryCheckoutValue>({
    address: saved.address,
    street: streetFromSaved(saved),
    zoneId: saved.deliveryZoneId ?? null,
    zoneName: saved.deliveryZoneName ?? null,
    lat: saved.deliveryLat ?? null,
    lng: saved.deliveryLng ?? null,
    fee: saved.deliveryFee || Number(settings.deliveryFee || 1500),
    fallback: !saved.deliveryZoneId,
  });
  const [phone, setPhone] = useState(saved.phone || user?.phone || "");
  const [notes, setNotes] = useState(saved.notes);
  const [promo, setPromo] = useState(saved.promo);
  const [deliveryQuoting, setDeliveryQuoting] = useState(false);
  const catalog = useCatalog();
  const kitchen = catalog?.restaurants.find((r) => r.id === cart[0]?.restaurantId) || null;
  const preview = useCheckoutPreview({
    enabled: Boolean(user && cart.length > 0),
    cart,
    fulfillment,
    delivery,
    promo,
  });
  const sub = preview.subtotal;
  const activeDeliveryFee = preview.deliveryFee;
  const previewDiscount = preview.discount;
  const total = preview.total;

  const qty = cart.reduce((s, l) => s + l.qty, 0);

  function checkoutDraft(): CheckoutDraft {
    return {
      fulfillment,
      address: buildDeliveryAddress(delivery.street, delivery.zoneName, delivery.address),
      deliveryLat: delivery.lat,
      deliveryLng: delivery.lng,
      deliveryFee: activeDeliveryFee,
      deliveryZoneId: delivery.zoneId,
      deliveryZoneName: delivery.zoneName,
      phone: phone.trim(),
      notes: notes.trim(),
      promo: promo.trim(),
    };
  }

  function setQty(lineKey: string, qty: number) {
    const next = setCartLineQty(cart, lineKey, qty);
    onCart(next);
    if (next.length === 0) {
      clearCheckout();
      toast.success("Cart is empty");
    }
  }

  function clearAll() {
    onCart([]);
    clearCheckout();
    toast.success("Cart cleared");
  }

  function goToPay() {
    if (!user) {
      saveCheckout(checkoutDraft());
      setLoc("/login?next=/cart");
      return;
    }
    if (!phone.trim()) {
      toast.error("Add a phone number");
      return;
    }
    if (fulfillment === "DELIVERY" && deliveryQuoting) {
      toast.error("Wait a moment while we calculate your delivery fee");
      return;
    }
    if (fulfillment === "DELIVERY" && !delivery.zoneId) {
      toast.error("Select your sector in Kigali");
      return;
    }
    if (fulfillment === "DELIVERY" && !delivery.street.trim()) {
      toast.error("Add your street, building or landmark");
      return;
    }
    saveCheckout(checkoutDraft());
    setLoc("/pay");
  }

  if (cart.length === 0) {
    return (
      <PageWrap>
        <Empty
          title="Your cart is empty"
          body="Add food from the menu or a restaurant to check out."
          action={
            <Link href="/restaurants">
              <Btn>Browse restaurants</Btn>
            </Link>
          }
        />
      </PageWrap>
    );
  }

  return (
    <PageWrap>
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-extrabold">Cart · {cart[0].restaurantName}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-primary" />
                {kitchen?.address || "Kigali"}
              </span>
              {kitchen?.openingHours && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary" />
                  {kitchen.openingHours}
                </span>
              )}
              <span>
                {qty} {qty === 1 ? "item" : "items"}
              </span>
              <button type="button" className="font-semibold text-destructive" onClick={clearAll}>
                Clear cart
              </button>
            </p>
          </div>

          {cart.map((line) => (
            <Card key={line.lineKey} className="flex gap-3">
              <img
                src={img(line.imageUrl)}
                alt=""
                className="h-24 w-24 shrink-0 rounded-2xl object-cover sm:h-28 sm:w-28"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {line.name}
                      {line.isFree ? (
                        <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                          Free promo
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{cart[0].restaurantName}</p>
                  </div>
                  <p className={`shrink-0 font-bold ${line.isFree ? "text-primary" : "text-primary"}`}>
                    {freePriceLabel(line)}
                  </p>
                </div>
                {line.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{line.description}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {line.isFree ? "Included with buy 1 get 1" : `${frw(line.price)} each`}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="h-8 w-8 rounded-full bg-muted"
                      onClick={() => setQty(line.lineKey, line.qty - 1)}
                      aria-label={`Remove one ${line.name}`}
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-sm font-semibold">{line.qty}</span>
                    <button
                      type="button"
                      className="h-8 w-8 rounded-full bg-primary text-white disabled:opacity-40"
                      disabled={Boolean(line.isFree)}
                      onClick={() => setQty(line.lineKey, line.qty + 1)}
                      aria-label={`Add one ${line.name}`}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-semibold text-destructive"
                    onClick={() => setQty(line.lineKey, 0)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </Card>
          ))}

          <Card className="space-y-5">
            <h2 className="text-lg font-bold">Delivery or pickup</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setFulfillment("DELIVERY")}
                className={`rounded-2xl border p-4 text-left ${
                  fulfillment === "DELIVERY" ? "border-primary bg-secondary" : "border-border bg-card"
                }`}
              >
                <Bike className="mb-2 h-5 w-5 text-primary" />
                <p className="font-bold">Delivery</p>
                <p className="mt-1 text-sm text-muted-foreground">Brought to your address in Kigali.</p>
              </button>
              <button
                type="button"
                onClick={() => setFulfillment("PICKUP")}
                className={`rounded-2xl border p-4 text-left ${
                  fulfillment === "PICKUP" ? "border-primary bg-secondary" : "border-border bg-card"
                }`}
              >
                <Store className="mb-2 h-5 w-5 text-primary" />
                <p className="font-bold">Pickup</p>
                <p className="mt-1 text-sm text-muted-foreground">Collect at the kitchen. No delivery fee.</p>
              </button>
            </div>
            {fulfillment === "DELIVERY" ? (
              <DeliveryCheckoutFields
                settings={settings}
                value={delivery}
                onChange={setDelivery}
                onQuotingChange={setDeliveryQuoting}
              />
            ) : (
              <div className="rounded-xl bg-muted px-4 py-3 text-sm">
                <p className="flex items-center gap-2 font-semibold">
                  <MapPin className="h-4 w-4 text-primary" />
                  Pickup at {kitchen?.name || cart[0].restaurantName}
                </p>
                <p className="mt-1 text-muted-foreground">{kitchen?.address || "Address is on the restaurant page."}</p>
                {kitchen?.openingHours && (
                  <p className="mt-1 text-muted-foreground">{kitchen.openingHours}</p>
                )}
              </div>
            )}
            <LineField label="Phone" required>
              <LineInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07…" />
            </LineField>
            <LineField label="Notes">
              <LineInput
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  fulfillment === "PICKUP" ? "Name on the order, extra instructions" : "Gate, floor, extra instructions"
                }
              />
            </LineField>
            <LineField label="Promo code">
              <LineInput value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="WELCOME20" />
            </LineField>
            {preview.promoError ? (
              <p className="text-sm font-semibold text-destructive">{preview.promoError}</p>
            ) : null}
          </Card>
        </div>

        <Card className="h-fit space-y-4 lg:sticky lg:top-24">
          <h2 className="text-lg font-bold">Order summary</h2>
          <p className="text-sm text-muted-foreground">
            {fulfillment === "PICKUP" ? "Pickup" : "Delivery"} · {cart[0].restaurantName}
          </p>
          {cart.map((line) => (
            <p key={line.lineKey} className="flex justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                {line.qty}× {line.name}
                {line.isFree ? " (free)" : ""}
              </span>
              <span className="shrink-0">{freePriceLabel(line)}</span>
            </p>
          ))}
          <p className="flex justify-between text-sm">
            <span>Food</span>
            <span>{frw(sub)}</span>
          </p>
          {previewDiscount > 0 && (
            <p className="flex justify-between text-sm text-primary">
              <span>{preview.promoCode || promo.trim().toUpperCase() || "Promo"}</span>
              <span>− {frw(previewDiscount)}</span>
            </p>
          )}
          <p className="flex justify-between text-sm">
            <span>{fulfillment === "PICKUP" ? "Pickup" : delivery.zoneName ? `Delivery · ${delivery.zoneName}` : "Delivery"}</span>
            <span>{fulfillment === "PICKUP" ? "Free" : frw(activeDeliveryFee)}</span>
          </p>
          <p className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>{frw(total)}</span>
          </p>
          <Btn className="w-full" onClick={goToPay} disabled={deliveryQuoting || preview.loading}>
            {deliveryQuoting || preview.loading ? "Calculating total…" : "Continue to payment"}
          </Btn>
          <Link href="/" className="block text-center text-sm font-semibold text-primary">
            Add more food
          </Link>
        </Card>
      </div>
    </PageWrap>
  );
}

function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { login, setSession } = useAuth();
  const [, setLoc] = useLocation();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (mode === "login") {
        const user = await login(form.email, form.password);
        toast.success("Welcome back");
        setLoc(safeNext(homeForRole(user.role)));
      } else {
        const data = await api<{ token?: string; user?: import("@/lib/auth").User; email: string; emailed?: boolean }>(
          "/api/auth/register",
          { method: "POST", json: form },
        );
        if (data.token && data.user) setSession(data.token, data.user);
        toast.success(data.emailed === false ? "Account created. Tap Resend if you have no email." : "We sent a 6-digit code to your email");
        setLoc(`/verify-email?email=${encodeURIComponent(data.email)}`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.payload.needsVerification) {
        const email = String(err.payload.email || form.email);
        toast.message("Verify your email to continue");
        setLoc(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }
      toast.error((err as Error).message);
    }
  }

  return (
    <PageWrap>
      <FormShell title={mode === "login" ? "Log in" : "Create account"}>
        <form className="mt-8 space-y-6" onSubmit={(e) => void submit(e)}>
          <div>
            <h2 className="text-lg font-bold">{mode === "login" ? "Welcome back" : "Join Kigali Taste"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "login" ? "Use your email and password." : "Tell us a little about you."}
            </p>
          </div>
          {mode === "register" && (
            <>
              <LineField label="First name" required>
                <LineInput value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </LineField>
              <LineField label="Last name" required>
                <LineInput value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </LineField>
              <LineField label="Phone" required>
                <LineInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </LineField>
            </>
          )}
          <LineField label="Email" required>
            <LineInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </LineField>
          <LineField label="Password" required>
            <LineInput type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </LineField>
          {mode === "register" && (
            <LineField label="Confirm password" required>
              <LineInput
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              />
            </LineField>
          )}
          <Btn className="min-w-36 px-8" type="submit">
            {mode === "login" ? "Log in" : "Create account"}
          </Btn>
        </form>
        {mode === "login" ? (
          <p className="mt-4 text-sm">
            <Link href="/forgot-password" className="font-semibold text-primary">
              Forgot password?
            </Link>
          </p>
        ) : null}
        <p className="mt-6 text-sm">
          {mode === "login" ? (
            <Link href="/register" className="font-semibold text-primary">Need an account?</Link>
          ) : (
            <Link href="/login" className="font-semibold text-primary">Already registered?</Link>
          )}
        </p>
      </FormShell>
    </PageWrap>
  );
}

function VerifyPage() {
  const email =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("email") || ""
      : "";
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const { setSession } = useAuth();
  const [, setLoc] = useLocation();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const data = await api<{ vendorStatus?: string; token?: string; user?: import("@/lib/auth").User }>(
        "/api/auth/verify-email",
        { method: "POST", json: { email, code } },
      );
      if (data.token && data.user) setSession(data.token, data.user);
      toast.success("Email verified");
      setLoc(data.vendorStatus === "PENDING_APPROVAL" ? "/waiting-approval" : "/");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function resend() {
    if (!email || sending) return;
    setSending(true);
    try {
      await api("/api/auth/resend-code", { method: "POST", json: { email } });
      toast.success("A new code was sent to your email");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <PageWrap>
      <FormShell title="Enter your 6-digit code">
        <form className="mt-8 space-y-6" onSubmit={(e) => void submit(e)}>
          <p className="text-sm text-muted-foreground">
            We emailed a code to <span className="font-semibold text-foreground">{email}</span>. Check your inbox and spam folder.
          </p>
          <LineField label="Verification code" required>
            <LineInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
          </LineField>
          <Btn className="min-w-36 px-8" type="submit">
            Verify
          </Btn>
        </form>
        <GhostBtn className="mt-4" type="button" disabled={sending} onClick={() => void resend()}>
          {sending ? "Sending…" : "Resend code again"}
        </GhostBtn>
      </FormShell>
    </PageWrap>
  );
}

function ForgotPasswordPage() {
  const [, setLoc] = useLocation();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || sending) return;
    setSending(true);
    try {
      await api("/api/auth/forgot-password", { method: "POST", json: { email: email.trim() } });
      toast.success("Check your email for a reset code");
      setLoc(`/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <PageWrap>
      <FormShell title="Reset your password">
        <form className="mt-8 space-y-6" onSubmit={(e) => void submit(e)}>
          <p className="text-sm text-muted-foreground">
            Enter the email on your account. We will send a 6-digit code to reset your password.
          </p>
          <LineField label="Email" required>
            <LineInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </LineField>
          <Btn className="min-w-36 px-8" type="submit" disabled={sending}>
            {sending ? "Sending…" : "Send reset code"}
          </Btn>
        </form>
        <p className="mt-6 text-sm">
          <Link href="/login" className="font-semibold text-primary">
            Back to login
          </Link>
        </p>
      </FormShell>
    </PageWrap>
  );
}

function ResetPasswordPage() {
  const email =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("email") || ""
      : "";
  const [, setLoc] = useLocation();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || saving) return;
    setSaving(true);
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        json: { email, code, password, confirmPassword },
      });
      toast.success("Password updated — log in with your new password");
      setLoc("/login");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function resend() {
    if (!email || sending) return;
    setSending(true);
    try {
      await api("/api/auth/forgot-password", { method: "POST", json: { email } });
      toast.success("A new reset code was sent");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <PageWrap>
      <FormShell title="Choose a new password">
        <form className="mt-8 space-y-6" onSubmit={(e) => void submit(e)}>
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code sent to <span className="font-semibold text-foreground">{email || "your email"}</span>.
          </p>
          {!email ? (
            <p className="text-sm text-destructive">
              Missing email. Start from{" "}
              <Link href="/forgot-password" className="font-semibold underline">
                forgot password
              </Link>
              .
            </p>
          ) : null}
          <LineField label="Reset code" required>
            <LineInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
          </LineField>
          <LineField label="New password" required>
            <LineInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </LineField>
          <LineField label="Confirm new password" required>
            <LineInput type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </LineField>
          <Btn className="min-w-36 px-8" type="submit" disabled={saving || !email}>
            {saving ? "Saving…" : "Update password"}
          </Btn>
        </form>
        <GhostBtn className="mt-4" type="button" disabled={sending || !email} onClick={() => void resend()}>
          {sending ? "Sending…" : "Resend reset code"}
        </GhostBtn>
        <p className="mt-6 text-sm">
          <Link href="/login" className="font-semibold text-primary">
            Back to login
          </Link>
        </p>
      </FormShell>
    </PageWrap>
  );
}

function PartnerPage() {
  const [, setLoc] = useLocation();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
    businessName: "",
    businessAddress: "",
    businessType: "Restaurant",
  });
  const [idFile, setIdFile] = useState<File | null>(null);
  const [rdbFile, setRdbFile] = useState<File | null>(null);
  const [accept, setAccept] = useState(false);

  function set(key: keyof typeof form, value: string) {
    setForm({ ...form, [key]: value });
  }

  function next() {
    if (step === 1) {
      if (!form.firstName || !form.lastName || !form.password || !form.confirmPassword) {
        toast.error("Fill in all general fields");
        return;
      }
      if (form.password !== form.confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
    }
    if (step === 2) {
      if (!form.businessName || !idFile || !rdbFile) {
        toast.error("Add your kitchen name and both documents");
        return;
      }
    }
    setStep((s) => Math.min(3, s + 1));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step < 3) {
      next();
      return;
    }
    if (!form.email) {
      toast.error("Add your email");
      return;
    }
    if (!accept) {
      toast.error("Please accept the terms");
      return;
    }
    const data = new FormData();
    Object.entries(form).forEach(([k, v]) => data.append(k, v));
    data.append("acceptTerms", String(accept));
    if (idFile) data.append("nationalId", idFile);
    if (rdbFile) data.append("rdbCertificate", rdbFile);
    try {
      const res = await api<{ email: string; emailed?: boolean }>("/api/partners/apply", {
        method: "POST",
        form: data,
      });
      toast.success(
        res.emailed === false
          ? "Application saved. Tap Resend if you have no email."
          : "We sent a 6-digit code to your email",
      );
      setLoc(`/verify-email?email=${encodeURIComponent(res.email)}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <PageWrap>
      <FormShell title="Partner application">
        <FormStepper steps={["General", "Details", "Contacts"]} current={step} />
        <form className="mt-8 space-y-7" onSubmit={(e) => void submit(e)}>
          <div>
            <h2 className="text-lg font-bold">Become a partner</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {step === 1 && "Tell us who will run the kitchen."}
              {step === 2 && "Tell us more about your business."}
              {step === 3 && "How we can reach you in Kigali."}
            </p>
          </div>

          {step === 1 && (
            <div className="space-y-6">
              <LineField label="First name" required>
                <LineInput value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
              </LineField>
              <LineField label="Last name" required>
                <LineInput value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
              </LineField>
              <LineField label="Password" required>
                <LineInput type="password" value={form.password} onChange={(e) => set("password", e.target.value)} />
              </LineField>
              <LineField label="Confirm password" required>
                <LineInput
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => set("confirmPassword", e.target.value)}
                />
              </LineField>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <LineField label="Business name" required>
                <LineInput value={form.businessName} onChange={(e) => set("businessName", e.target.value)} />
              </LineField>
              <LineField label="Business type" required>
                <LineSelect value={form.businessType} onChange={(e) => set("businessType", e.target.value)}>
                  <option>Restaurant</option>
                  <option>Fast food</option>
                  <option>Bakery</option>
                </LineSelect>
              </LineField>
              <LineFile
                label="National ID (image or PDF)"
                required
                file={idFile}
                accept="image/*,.pdf"
                onChange={setIdFile}
              />
              <LineFile
                label="RDB certificate (image or PDF)"
                required
                file={rdbFile}
                accept="image/*,.pdf"
                onChange={setRdbFile}
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <LineField label="Email" required>
                <LineInput type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </LineField>
              <p className="text-sm text-muted-foreground">
                After approval, add your kitchen phone and address in the vendor Shop panel.
              </p>
              <label className="flex items-center gap-2 pt-2 text-sm">
                <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
                I accept the terms
              </label>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {step > 1 && (
              <GhostBtn type="button" onClick={() => setStep((s) => s - 1)}>
                Back
              </GhostBtn>
            )}
            <Btn className="min-w-36 px-8" type="submit">
              {step < 3 ? "Next step" : "Submit application"}
            </Btn>
          </div>
        </form>
      </FormShell>
    </PageWrap>
  );
}

function WaitingPage() {
  return (
    <PageWrap>
      <Empty
        title="Wait for admin approval"
        body="We will review your National ID and RDB certificate. You cannot open the vendor panel until you are approved."
      />
    </PageWrap>
  );
}

function PayPage({
  cart,
  onCart,
  settings,
}: {
  cart: CartLine[];
  onCart: (cart: CartLine[]) => void;
  settings: Settings;
}) {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const orderId = params.get("order") || params.get("orderId");
  if (orderId) return <PayWait orderId={orderId} onCart={onCart} />;
  return <PayMethod cart={cart} onCart={onCart} settings={settings} />;
}

function PayMethod({
  cart,
  onCart,
  settings,
}: {
  cart: CartLine[];
  onCart: (cart: CartLine[]) => void;
  settings: Settings;
}) {
  const { user } = useAuth();
  const [, setLoc] = useLocation();
  const draft = loadCheckout();
  const [method, setMethod] = useState<"CARD" | "AIRTEL" | "MOMO">("MOMO");
  const [payPhone, setPayPhone] = useState(draft.phone || user?.phone || "");
  const [paying, setPaying] = useState(false);
  const [payConfig, setPayConfig] = useState<{ cardReady?: boolean; paymentReturnUrl?: string } | null>(null);
  const deliveryFee = draft.fulfillment === "PICKUP" ? 0 : draft.deliveryFee || Number(settings.deliveryFee || 1500);
  const sub = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const [previewTotal, setPreviewTotal] = useState(sub + deliveryFee);
  const [previewDiscount, setPreviewDiscount] = useState(0);
  const [appliedPromo, setAppliedPromo] = useState<string | null>(draft.promo.trim() ? draft.promo.trim().toUpperCase() : null);
  const walletPay = method === "MOMO" || method === "AIRTEL";
  const draftAddress = resolvedCheckoutAddress(draft);

  useEffect(() => {
    if (!user || cart.length === 0) return;
    let cancelled = false;
    void api<{ total: number; discount: number; promoCode: string | null }>("/api/checkout/preview", {
      method: "POST",
      json: {
        restaurantId: cart[0].restaurantId,
        items: cartCheckoutItems(cart),
        fulfillment: draft.fulfillment,
        deliveryAddress: draft.fulfillment === "DELIVERY" ? draftAddress : "",
        deliveryLat: draft.deliveryLat,
        deliveryLng: draft.deliveryLng,
        deliveryZoneId: draft.deliveryZoneId,
        promoCode: draft.promo.trim() || undefined,
      },
    })
      .then((data) => {
        if (!cancelled) {
          setPreviewTotal(data.total);
          setPreviewDiscount(data.discount);
          setAppliedPromo(data.promoCode || (draft.promo.trim() ? draft.promo.trim().toUpperCase() : null));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewTotal(sub + deliveryFee);
          setPreviewDiscount(0);
          setAppliedPromo(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, cart, draft, draftAddress, sub, deliveryFee]);

  const total = previewTotal;

  useEffect(() => {
    api<{ cardReady?: boolean; paymentReturnUrl?: string }>("/api/payments/config")
      .then(setPayConfig)
      .catch(() => setPayConfig(null));
  }, []);

  useEffect(() => {
    if (!user) {
      setLoc("/login?next=/pay");
      return;
    }
    if (paying) return;
    if (cart.length === 0) {
      setLoc("/cart");
      return;
    }
    if (!draft.phone || (draft.fulfillment === "DELIVERY" && (!draftAddress || !draft.deliveryZoneId))) {
      setLoc("/cart");
    }
  }, [user, cart.length, paying, draft.phone, draft.fulfillment, draftAddress, draft.deliveryZoneId, setLoc]);

  async function placeOrder() {
    if (!user || paying || cart.length === 0) return;
    if (method === "CARD" && payConfig && payConfig.cardReady === false) {
      toast.error(
        "Live card payments need a public HTTPS return URL. Set PAYMENT_PUBLIC_URL=https://yourdomain.com in backend/.env, then restart the API.",
      );
      return;
    }
    if (walletPay && !payPhone.trim()) {
      toast.error("Enter the number you will pay with");
      return;
    }
    setPaying(true);
    try {
      const res = await api<{
        discount?: number;
        order?: { id: number };
        payment?: { status?: string; gatewayUrl?: string; checkoutUrl?: string; message?: string };
      }>("/api/orders", {
        method: "POST",
        json: {
          restaurantId: cart[0].restaurantId,
          items: cartCheckoutItems(cart),
          fulfillment: draft.fulfillment,
          deliveryAddress: draftAddress,
          deliveryLat: draft.deliveryLat,
          deliveryLng: draft.deliveryLng,
          deliveryZoneId: draft.deliveryZoneId,
          customerPhone: draft.phone || payPhone,
          paymentPhone: payPhone.trim() || draft.phone,
          notes: draft.notes,
          paymentMethod: method,
          promoCode: draft.promo || undefined,
        },
      });
      onCart([]);
      emptyCart();
      clearCheckout();
      const payUrl = res.payment?.gatewayUrl || res.payment?.checkoutUrl;
      if (method === "CARD" && payUrl) {
        toast.success("Opening the secure card page…");
        window.location.href = payUrl;
        return;
      }
      if (res.order?.id) {
        if (res.payment?.status === "FAILED") {
          toast.error(res.payment.message || "Payment could not be started. You can try again.");
        } else if (walletPay) {
          toast.success(res.payment?.message || "Approve the prompt on your phone");
        }
        setLoc(`/pay?order=${res.order.id}`);
        return;
      }
      setLoc("/orders");
    } catch (e) {
      const err = e as ApiError;
      toast.error(err.message || "Payment could not be started");
    } finally {
      setPaying(false);
    }
  }

  if (!user) return null;
  if (cart.length === 0 && !paying) return null;

  const methods = [
    { id: "CARD" as const, badge: "Card", badgeClass: "bg-foreground text-white", title: "Card", hint: "Visa · Mastercard · debit" },
    { id: "AIRTEL" as const, badge: "Airtel", badgeClass: "bg-red-600 text-white", title: "Airtel Money", hint: "Pay with your Airtel number" },
    { id: "MOMO" as const, badge: "MoMo", badgeClass: "bg-yellow-400 text-black", title: "MoMo", hint: "MTN Mobile Money" },
  ];

  return (
    <PageWrap>
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-extrabold">
          {draft.fulfillment === "PICKUP" ? "Pickup & payment" : "Delivery & payment"}
        </h1>
        <FormStepper steps={["Contact", "Pay", "Done"]} current={2} />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <Card className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Choose how to pay</h2>
                  <p className="text-sm text-muted-foreground">Card, Airtel Money, or MoMo — charged securely with XentriPay.</p>
                </div>
                <Link href="/cart" className="shrink-0 text-sm font-semibold text-primary">
                  ← Location
                </Link>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {methods.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`rounded-2xl border p-4 text-left ${
                      method === m.id ? "border-primary bg-secondary" : "border-border bg-white"
                    }`}
                  >
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${m.badgeClass}`}>{m.badge}</span>
                    <p className="mt-2 font-bold">{m.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{m.hint}</p>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="space-y-4">
              {method === "CARD" && (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold">Card payment</h2>
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-xl font-extrabold">Pay {frw(total)}</p>
                  <p className="text-sm text-muted-foreground">
                    You will be redirected to the secure Urubuto card page (Visa / Mastercard). We never collect your card number on this site.
                  </p>
                  {payConfig?.cardReady === false ? (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      Live card payments require <strong>PAYMENT_PUBLIC_URL</strong> set to your public HTTPS site in{" "}
                      <code className="text-xs">backend/.env</code> (not localhost). MoMo and Airtel still work locally.
                    </p>
                  ) : null}
                </>
              )}
              {method === "MOMO" && (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold">MTN MoMo</h2>
                    <span className="rounded-full bg-foreground px-2 py-0.5 text-[11px] font-bold text-white">*182#</span>
                  </div>
                  <p className="text-xl font-extrabold">Pay {frw(total)}</p>
                  <p className="text-sm text-muted-foreground">
                    Approve the MoMo push on your MTN line, or dial *182*7*1# if needed. Do not enter your PIN on this website.
                  </p>
                  <LineField label="MoMo number" required>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <LineInput
                        className="pl-6"
                        value={payPhone}
                        onChange={(e) => setPayPhone(e.target.value)}
                        placeholder="+250 78…"
                      />
                    </div>
                  </LineField>
                </>
              )}
              {method === "AIRTEL" && (
                <>
                  <h2 className="font-bold">Airtel Money</h2>
                  <p className="text-xl font-extrabold">Pay {frw(total)}</p>
                  <p className="text-sm text-muted-foreground">
                    Approve the Airtel Money prompt on the number you enter. Do not enter your PIN on this website.
                  </p>
                  <LineField label="Airtel number" required>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <LineInput
                        className="pl-6"
                        value={payPhone}
                        onChange={(e) => setPayPhone(e.target.value)}
                        placeholder="+250 73…"
                      />
                    </div>
                  </LineField>
                </>
              )}
              <Btn className="w-full" disabled={paying} onClick={() => void placeOrder()}>
                {paying ? "Starting payment…" : `Pay ${frw(total)} now`}
              </Btn>
            </Card>
          </div>

          <Card className="h-fit space-y-3 lg:sticky lg:top-24">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Order summary</h2>
              <Link href="/cart" className="text-sm font-semibold text-primary">
                Edit cart
              </Link>
            </div>
            {cart.map((line) => (
              <p key={line.lineKey} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0">
                  {line.name} ×{line.qty}
                  {line.isFree ? (
                    <span className="mt-0.5 block text-xs font-semibold text-primary">Free promo</span>
                  ) : (
                    <span className="mt-0.5 block text-xs text-muted-foreground">{frw(line.price)} each</span>
                  )}
                </span>
                <span className="shrink-0">{freePriceLabel(line)}</span>
              </p>
            ))}
            <p className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{frw(sub)}</span>
            </p>
            {previewDiscount > 0 && (
              <p className="flex justify-between text-sm text-primary">
                <span>{appliedPromo || "Promo"}</span>
                <span>− {frw(previewDiscount)}</span>
              </p>
            )}
            <p className="flex justify-between text-sm">
              <span>{draft.fulfillment === "PICKUP" ? "Pickup" : "Delivery"}</span>
              <span>{draft.fulfillment === "PICKUP" ? "Free" : frw(deliveryFee)}</span>
            </p>
            <p className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>{frw(total)}</span>
            </p>
            <div className="rounded-xl bg-muted px-3 py-2 text-sm">
              {draft.fulfillment === "PICKUP"
                ? `Pickup: ${cart[0].restaurantName} — collect in store`
                : draft.deliveryZoneName
                  ? `Delivery to ${draft.address} · ${draft.deliveryZoneName} (${frw(deliveryFee)})`
                  : `Delivery to ${draft.address}`}
            </div>
          </Card>
        </div>
      </div>
    </PageWrap>
  );
}

function PayWait({ orderId, onCart }: { orderId: string; onCart: (cart: CartLine[]) => void }) {
  const { user } = useAuth();
  const [, setLoc] = useLocation();
  const [retryPhone, setRetryPhone] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [info, setInfo] = useState<{
    orderNumber: string;
    paymentStatus: string;
    paymentMethod: string;
    paymentUrl: string | null;
    total: number;
    message: string;
  } | null>(null);

  useEffect(() => {
    emptyCart();
    onCart([]);
    clearCheckout();
    if (new URLSearchParams(window.location.search).get("card") === "return") {
      toast.message("Card payment submitted — confirming with XentriPay…");
    }
  }, [orderId]);

  useEffect(() => {
    if (!user) {
      setLoc(`/login?next=${encodeURIComponent(`/pay?order=${orderId}`)}`);
      return;
    }
    let stop = false;
    async function tick() {
      try {
        const data = await api<NonNullable<typeof info>>(`/api/orders/${orderId}/payment`);
        if (stop) return;
        setInfo(data);
        if (data.paymentStatus === "PAID") {
          emptyCart();
          onCart([]);
          clearCheckout();
          toast.success("Payment received");
          setLoc("/orders");
        }
      } catch (err) {
        if (!stop) toast.error((err as Error).message);
      }
    }
    void tick();
    const id = window.setInterval(() => void tick(), 3000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [user, orderId, setLoc]);

  const wallet = info?.paymentMethod === "MOMO" || info?.paymentMethod === "AIRTEL";
  const paid = info?.paymentStatus === "PAID";
  const failed = info?.paymentStatus === "FAILED";
  const methodLabel =
    info?.paymentMethod === "AIRTEL"
      ? "Airtel Money"
      : info?.paymentMethod === "CARD"
        ? "Card"
        : info?.paymentMethod === "COD"
          ? "Cash"
          : "MTN MoMo";

  async function retry() {
    if (retrying) return;
    setRetrying(true);
    try {
      const res = await api<{ payment?: { gatewayUrl?: string; checkoutUrl?: string; message?: string } }>(
        `/api/orders/${orderId}/pay`,
        { method: "POST", json: retryPhone.trim() ? { phone: retryPhone.trim() } : {} },
      );
      const url = res.payment?.gatewayUrl || res.payment?.checkoutUrl;
      if (url) {
        window.location.href = url;
        return;
      }
      toast.success(res.payment?.message || "Approve the prompt on your phone");
    } catch (err) {
      const error = err as ApiError;
      toast.error(error.message || "Payment could not be started");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <PageWrap>
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-extrabold md:text-4xl">Complete payment</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Keep this page open. We check your payment every few seconds.
        </p>
        <FormStepper steps={["Contact", "Pay", "Done"]} current={paid ? 3 : 2} />

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Card className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">{methodLabel}</p>
                <p className="mt-1 text-2xl font-extrabold md:text-3xl">
                  {info ? `${info.orderNumber} · ${frw(info.total)}` : "Checking…"}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  paid
                    ? "bg-emerald-100 text-emerald-800"
                    : failed
                      ? "bg-red-100 text-red-700"
                      : "bg-secondary text-primary"
                }`}
              >
                {paid ? "Paid" : failed ? "Payment failed" : "Waiting for confirmation"}
              </span>
            </div>

            <p className="text-sm leading-relaxed text-muted-foreground">
              {info?.message || "Checking payment status…"}
            </p>

            {wallet && !paid && (
              <div className="rounded-2xl bg-muted/70 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-bold">{info?.paymentMethod === "AIRTEL" ? "Airtel number" : "MoMo number"}</p>
                  {info?.paymentMethod === "MOMO" && (
                    <span className="rounded-full bg-foreground px-2 py-0.5 text-[11px] font-bold text-white">*182#</span>
                  )}
                </div>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={retryPhone}
                    onChange={(e) => setRetryPhone(e.target.value)}
                    placeholder="+250 78…"
                    className="h-12 w-full rounded-2xl border border-border bg-white pl-10 pr-4 text-sm outline-none ring-primary/20 focus:ring-2"
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {info?.paymentMethod === "MOMO"
                    ? "Approve the prompt on your MTN line, or dial *182*7*1# if you do not see it. Do not enter your PIN here."
                    : "Approve the Airtel Money prompt on this number. Do not enter your PIN here."}
                </p>
              </div>
            )}

            {info?.paymentUrl && !paid && (
              <a href={info.paymentUrl} className={btnStyles("primary", "w-full")}>
                Continue to card payment
              </a>
            )}

            {!paid && (
              <Btn className="w-full py-3" disabled={retrying} onClick={() => void retry()}>
                {retrying ? "Sending again…" : "Try again"}
              </Btn>
            )}

            <Link href="/orders" className="block text-center text-sm font-semibold text-primary">
              Back to my orders
            </Link>
          </Card>

          <Card className="h-fit space-y-4 lg:sticky lg:top-24">
            <h2 className="font-bold">How to finish</h2>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-primary">1</span>
                {info?.paymentMethod === "CARD"
                  ? "Open the secure card page and complete Visa or Mastercard payment."
                  : "Approve the push on your phone. Your PIN stays on the phone, not on this site."}
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-primary">2</span>
                This page updates on its own when XentriPay confirms the payment.
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-primary">3</span>
                You will get an email receipt, and the kitchen will see the order.
              </li>
            </ol>
            <div className="rounded-xl bg-muted px-3 py-2 text-sm">
              {methodLabel} · {info ? frw(info.total) : "—"}
            </div>
          </Card>
        </div>
      </div>
    </PageWrap>
  );
}

function OrdersPage() {
  const { user } = useAuth();
  const [, setLoc] = useLocation();
  const [orders, setOrders] = useState<
    {
      id: number;
      orderNumber: string;
      restaurantName: string;
      status: string;
      paymentStatus: string;
      paymentMethod: string;
      total: number;
      deliveryAddress?: string;
      deliveryZoneName?: string | null;
      items: { name: string; qty: number; price: number }[];
      rating: number | null;
    }[]
  >([]);

  useEffect(() => {
    if (!user) {
      setLoc("/login?next=/orders");
      return;
    }
    api<typeof orders>("/api/orders").then(setOrders).catch((e) => toast.error(e.message));
  }, [user, setLoc]);

  const steps = ["PENDING", "ACCEPTED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"];

  return (
    <PageWrap>
      <div className="space-y-4">
        <h1 className="text-3xl font-extrabold">My orders</h1>
        {orders.length === 0 && <Empty title="No orders yet" body="When you check out, tracking shows here." />}
        {orders.map((order) => (
          <Card key={order.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold">
                {order.orderNumber} · {order.restaurantName}
              </p>
              <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-primary">
                {order.status.replaceAll("_", " ")}
              </span>
            </div>
            <p className="mt-2 break-words text-sm text-muted-foreground">
              {order.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
            </p>
            {order.deliveryAddress ? (
              <p className="mt-1 break-words text-sm text-muted-foreground">
                Deliver to {order.deliveryAddress}
                {order.deliveryZoneName ? ` · ${order.deliveryZoneName}` : ""}
              </p>
            ) : null}
            <p className="mt-1 font-bold">{frw(order.total)}</p>
            {order.paymentMethod !== "COD" && (
              <p className="mt-1 text-sm text-muted-foreground">
                Payment: {order.paymentStatus === "PAID" ? "Paid" : order.paymentStatus === "FAILED" ? "Failed" : "Waiting"}
              </p>
            )}
            {order.paymentMethod !== "COD" && order.paymentStatus !== "PAID" && order.status !== "CANCELLED" && (
              <BtnLink href={`/pay?order=${order.id}`} className="mt-3" size="sm">
                Complete payment
              </BtnLink>
            )}
            <div className="mt-3 flex flex-wrap gap-1 text-[11px]">
              {steps.map((s) => (
                <span
                  key={s}
                  className={`rounded-full px-2 py-0.5 ${order.status === s || steps.indexOf(order.status) > steps.indexOf(s) ? "bg-primary text-white" : "bg-muted"}`}
                >
                  {s.replaceAll("_", " ")}
                </span>
              ))}
            </div>
            <OrderTrackingPanel orderId={order.id} status={order.status} />
            {order.status === "PENDING" && (
              <Btn
                variant="destructive"
                className="mt-3"
                onClick={async () => {
                  await api(`/api/orders/${order.id}/cancel`, { method: "POST" });
                  toast.success("Cancelled");
                  setOrders(await api("/api/orders"));
                }}
              >
                Cancel order
              </Btn>
            )}
            {order.status === "DELIVERED" && !order.rating && (
              <OrderReviewForm
                orderId={order.id}
                onDone={() => {
                  void api<typeof orders>("/api/orders").then(setOrders);
                }}
              />
            )}
            {order.rating ? (
              <p className="mt-3 text-sm text-muted-foreground">Your rating: {"★".repeat(order.rating)}</p>
            ) : null}
          </Card>
        ))}
      </div>
    </PageWrap>
  );
}

function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", body: "" });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/contact", { method: "POST", json: form });
      toast.success("Sent to Kigali Taste");
      setForm({ name: "", email: "", subject: "", body: "" });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }
  return (
    <PageWrap>
      <FormShell title="Contact">
        <form className="mt-8 space-y-6" onSubmit={(e) => void submit(e)}>
          <div>
            <h2 className="text-lg font-bold">Write to Kigali Taste</h2>
            <p className="mt-1 text-sm text-muted-foreground">We read every message in English.</p>
          </div>
          <LineField label="Name" required>
            <LineInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </LineField>
          <LineField label="Email" required>
            <LineInput value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </LineField>
          <LineField label="Subject">
            <LineInput value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </LineField>
          <LineField label="Message" required>
            <LineTextarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </LineField>
          <Btn className="min-w-36 px-8" type="submit">
            Send
          </Btn>
        </form>
      </FormShell>
    </PageWrap>
  );
}
