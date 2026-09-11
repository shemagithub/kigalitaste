import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Copy, Gift, Tag } from "lucide-react";
import { toast } from "sonner";
import { api, frw, img } from "@/lib/api";
import { Btn, Card, Empty, Loading } from "./ui";
import { useCatalog } from "./catalog";
import { bogoLabelFor, isBogoItem, type MenuItem } from "./customer";
import { DishPromoBadge } from "./BogoPromo";

export type PublicPromo = {
  id: number;
  code: string;
  description: string;
  discountType: string;
  discountValue: number;
  minSubtotal: number;
  firstOrderOnly: boolean;
  headline: string;
  condition: string;
  restaurantId: number | null;
  restaurantName: string | null;
  restaurantSlug: string | null;
  scope: "ALL" | "RESTAURANT";
};

export function copyPromoCode(code: string) {
  void navigator.clipboard?.writeText(code).then(
    () => toast.success(`${code} copied`),
    () => toast.message(`Use code ${code} at checkout`),
  );
}

export function PromoOfferCard({
  promo,
  restaurantHref,
}: {
  promo: PublicPromo;
  restaurantHref?: string | null;
}) {
  const href =
    restaurantHref ||
    (promo.restaurantSlug ? `/r/${promo.restaurantSlug}?tab=promo` : "/restaurants");

  return (
    <Card className="flex h-full flex-col overflow-hidden border-0 bg-[#1a1a1a] p-0 text-white shadow-card">
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/70">
            <Tag className="h-3.5 w-3.5 text-primary" />
            {promo.scope === "RESTAURANT" ? "Kitchen offer" : "Site-wide"}
          </span>
          {promo.firstOrderOnly ? (
            <span className="text-[11px] font-semibold text-primary">First order</span>
          ) : null}
        </div>
        <h2 className="mt-4 text-2xl font-extrabold leading-tight sm:text-[1.7rem]">{promo.headline}</h2>
        {promo.description ? (
          <p className="mt-2 text-sm leading-relaxed text-white/65">{promo.description}</p>
        ) : null}
        <p className="mt-2 text-xs text-white/50">{promo.condition}</p>
        {promo.restaurantName ? (
          <p className="mt-3 text-sm font-semibold text-primary">{promo.restaurantName}</p>
        ) : (
          <p className="mt-3 text-sm text-white/55">Valid at all live restaurants</p>
        )}
        <div className="mt-5 rounded-2xl bg-white/10 px-4 py-3 text-center">
          <p className="text-[11px] uppercase tracking-wide text-white/55">Use code</p>
          <p className="mt-1 text-xl font-black tracking-[0.2em] text-primary sm:text-2xl">{promo.code}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn
            type="button"
            variant="outline"
            className="border-white/20 bg-transparent text-white hover:bg-white/10"
            onClick={() => copyPromoCode(promo.code)}
          >
            <Copy className="h-4 w-4" />
            Copy code
          </Btn>
          <Link href={href}>
            <Btn type="button">{promo.restaurantSlug ? "View menu" : "Browse kitchens"}</Btn>
          </Link>
        </div>
      </div>
    </Card>
  );
}

function DishPromoGrid({ items }: { items: MenuItem[] }) {
  if (items.length === 0) {
    return <Empty title="No dish promos yet" body="When a kitchen marks a dish Buy 1 Get 1, it appears here." />;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <Link key={item.id} href={`/dish/${item.id}`} className="block overflow-hidden rounded-3xl bg-white shadow-card">
          <div className="relative">
            <img src={img(item.imageUrl)} alt="" className="h-36 w-full object-cover" />
            <DishPromoBadge item={item} />
          </div>
          <div className="p-4">
            <p className="font-semibold">{item.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.restaurantName}</p>
            <p className="mt-2 text-sm font-bold text-primary">{bogoLabelFor(item)}</p>
            <p className="mt-1 text-sm font-semibold">{frw(item.price)}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function PromosPage() {
  const [promos, setPromos] = useState<PublicPromo[] | null>(null);
  const catalog = useCatalog();
  const dishPromos = useMemo(
    () => (catalog?.items || []).filter((i) => isBogoItem(i) && i.isAvailable !== false),
    [catalog],
  );

  useEffect(() => {
    api<{ promos: PublicPromo[] }>("/api/promos")
      .then((data) => setPromos(data.promos || []))
      .catch(() => setPromos([]));
  }, []);

  const { siteWide, kitchen } = useMemo(() => {
    const rows = promos || [];
    return {
      siteWide: rows.filter((p) => p.scope === "ALL"),
      kitchen: rows.filter((p) => p.scope === "RESTAURANT"),
    };
  }, [promos]);

  if (!promos) {
    return (
      <div className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6">
        <Loading label="Loading promos…" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 sm:py-10">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Offers</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Promos</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Dish deals like Buy 1 Get 1 show on the menu — tap the dish and pick your free item. Coupon codes still apply at
          checkout when available.
        </p>
      </div>

      <div className="mt-8 space-y-10">
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <Gift className="h-5 w-5 text-primary" />
            Dish promos (Buy 1 Get 1)
          </h2>
          <DishPromoGrid items={dishPromos} />
        </section>

        {siteWide.length > 0 ? (
          <section>
            <h2 className="mb-4 text-lg font-bold">Coupon codes · site-wide</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {siteWide.map((promo) => (
                <PromoOfferCard key={promo.id} promo={promo} />
              ))}
            </div>
          </section>
        ) : null}
        {kitchen.length > 0 ? (
          <section>
            <h2 className="mb-4 text-lg font-bold">Coupon codes · restaurants</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {kitchen.map((promo) => (
                <PromoOfferCard key={promo.id} promo={promo} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

export function RestaurantPromoTab({
  slug,
  restaurantName,
}: {
  slug: string;
  restaurantName: string;
}) {
  const catalog = useCatalog();
  const [promos, setPromos] = useState<PublicPromo[] | null>(null);
  const dishPromos = useMemo(() => {
    return (catalog?.items || []).filter(
      (i) => i.restaurantSlug === slug && isBogoItem(i) && i.isAvailable !== false,
    );
  }, [catalog, slug]);

  useEffect(() => {
    api<{ promos: PublicPromo[] }>(`/api/restaurants/${slug}/promos`)
      .then((data) => setPromos(data.promos || []))
      .catch(() => setPromos([]));
  }, [slug]);

  if (!promos) {
    return <Loading label="Loading offers…" />;
  }

  const kitchenOnly = promos.filter((p) => p.scope === "RESTAURANT");
  const shared = promos.filter((p) => p.scope === "ALL");
  const empty = dishPromos.length === 0 && promos.length === 0;

  if (empty) {
    return (
      <Empty
        title={`No promos for ${restaurantName}`}
        body="This kitchen has no Buy 1 Get 1 dishes or coupon codes right now."
        action={
          <Link href="/promos">
            <Btn variant="outline">See all promos</Btn>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold">Promos for {restaurantName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Promo dishes show a badge on the Menu tab. Add the dish, then choose your free item — no code needed.
        </p>
      </div>

      {dishPromos.length > 0 ? (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Buy 1 Get 1 dishes
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {dishPromos.map((item) => (
              <Link key={item.id} href={`/dish/${item.id}`} className="overflow-hidden rounded-3xl bg-white shadow-card">
                <div className="relative">
                  <img src={img(item.imageUrl)} alt="" className="h-36 w-full object-cover" />
                  <DishPromoBadge item={item} />
                </div>
                <div className="p-4">
                  <p className="font-semibold">{item.name}</p>
                  <p className="mt-1 text-sm font-bold text-primary">{bogoLabelFor(item)}</p>
                  <p className="mt-1 text-sm">{frw(item.price)} · tap to order & pick free</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {kitchenOnly.length > 0 ? (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Coupon codes · this kitchen
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {kitchenOnly.map((promo) => (
              <PromoOfferCard key={promo.id} promo={promo} restaurantHref={`/r/${slug}?tab=menu`} />
            ))}
          </div>
        </section>
      ) : null}
      {shared.length > 0 ? (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Coupon codes · also valid here
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {shared.map((promo) => (
              <PromoOfferCard key={promo.id} promo={promo} restaurantHref={`/r/${slug}?tab=menu`} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
