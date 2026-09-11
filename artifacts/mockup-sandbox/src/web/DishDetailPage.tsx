import { useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { ArrowLeft, Clock, Heart, MapPin, Minus, Plus, Store } from "lucide-react";
import { frw, img } from "@/lib/api";
import { Btn, Empty, GhostBtn, Loading } from "./ui";
import { DishCard } from "./HomePage";
import { DishPromoBadge, useBogoAdd } from "./BogoPromo";
import { useCatalog, useSettings } from "./catalog";
import { bogoLabelFor, isBogoItem, type CartLine, type MenuItem } from "./customer";

export function DishDetailPage({
  id,
  cart,
  onCart,
  favs,
  onFavs,
}: {
  id: number;
  cart: CartLine[];
  onCart: (cart: CartLine[]) => void;
  favs: number[];
  onFavs: (ids: number[]) => void;
}) {
  const catalog = useCatalog();
  const settings = useSettings();
  const [, setLoc] = useLocation();
  const item = catalog?.items.find((row) => row.id === id) || null;
  const restaurant = catalog?.restaurants.find((row) => row.id === item?.restaurantId) || null;
  const paidInCart = cart.filter((line) => !line.isFree && line.menuItemId === id).reduce((s, l) => s + l.qty, 0);
  const [qty, setQty] = useState(1);
  const { addDish, bogoModal } = useBogoAdd({
    cart,
    onCart,
    catalogItems: catalog?.items || [],
    onAdded: (added) => toast.success(`${added.name} added`),
  });

  if (!catalog) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 py-16">
        <Loading label="Loading dish…" />
      </div>
    );
  }

  if (!item || !restaurant) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 py-16">
        <Empty
          title="Dish not found"
          body="This item is no longer on the menu, or the link is wrong."
          action={
            <Link href="/menu">
              <Btn>Browse menu</Btn>
            </Link>
          }
        />
      </div>
    );
  }

  const related =
    catalog.items
      .filter((row) => row.restaurantId === restaurant.id && row.id !== item.id && row.isAvailable)
      .slice(0, 4) || [];

  const deliveryFee = Number(settings.deliveryFee || 1500);

  function toggleFav() {
    onFavs(favs.includes(item!.id) ? favs.filter((x) => x !== item!.id) : [...favs, item!.id]);
  }

  function addNow() {
    addDish(item!, { id: restaurant!.id, name: restaurant!.name }, Math.max(1, qty));
  }

  return (
    <div className="pb-16">
      {bogoModal}
      <div className="relative h-56 w-full bg-muted md:h-80 lg:h-[420px]">
        <img src={img(item.imageUrl)} alt={item.name} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <DishPromoBadge item={item} />
        <div className="absolute left-0 right-0 top-0">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4">
            <button
              type="button"
              onClick={() => (window.history.length > 1 ? window.history.back() : setLoc(`/r/${restaurant.slug}`))}
              className="flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold shadow-card"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              onClick={toggleFav}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-card"
              aria-label="Favorite"
            >
              <Heart className={`h-5 w-5 ${favs.includes(item.id) ? "fill-red-500 text-red-500" : ""}`} />
            </button>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-6">
          <div className="mx-auto max-w-[1440px]">
            <p className="text-sm font-semibold text-white/80">{restaurant.name}</p>
            <h1 className="mt-1 text-3xl font-extrabold text-white md:text-4xl">{item.name}</h1>
            {isBogoItem(item) ? (
              <p className="mt-2 inline-flex rounded-full bg-[#e8c547] px-3 py-1 text-xs font-bold text-[#0d4f46]">
                {bogoLabelFor(item)} — pick your free dish when you add
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1440px] gap-8 px-6 py-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-muted-foreground">{item.description || "No description yet."}</p>
          <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Store className="h-4 w-4 text-primary" />
              {restaurant.type}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" />
              {restaurant.address}
            </span>
            {restaurant.openingHours ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary" />
                {restaurant.openingHours}
              </span>
            ) : null}
          </div>
          <div className="mt-8">
            <Link href={`/r/${restaurant.slug}`} className="text-sm font-semibold text-primary hover:underline">
              View full menu →
            </Link>
          </div>
        </div>

        <div className="rounded-[1.75rem] bg-white p-6 shadow-card">
          <p className="text-3xl font-extrabold text-primary">{frw(item.price)}</p>
          <p className="mt-1 text-sm text-muted-foreground">Delivery from {frw(deliveryFee)}</p>
          {paidInCart > 0 ? (
            <p className="mt-2 text-sm font-semibold text-primary">{paidInCart} already in cart</p>
          ) : null}
          <div className="mt-6 flex items-center gap-3">
            <GhostBtn type="button" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Less">
              <Minus className="h-4 w-4" />
            </GhostBtn>
            <span className="w-8 text-center font-bold">{qty}</span>
            <GhostBtn type="button" onClick={() => setQty(qty + 1)} aria-label="More">
              <Plus className="h-4 w-4" />
            </GhostBtn>
          </div>
          <Btn className="mt-6 w-full" disabled={!item.isAvailable} onClick={addNow}>
            {item.isAvailable ? (isBogoItem(item) ? "Add & pick free dish" : "Add to cart") : "Unavailable"}
          </Btn>
        </div>
      </div>

      {related.length > 0 ? (
        <div className="mx-auto max-w-[1440px] px-6">
          <h2 className="mb-4 text-xl font-bold">More from {restaurant.name}</h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {related.map((row) => (
              <DishCard
                key={row.id}
                item={row}
                favorited={favs.includes(row.id)}
                onFav={() =>
                  onFavs(favs.includes(row.id) ? favs.filter((x) => x !== row.id) : [...favs, row.id])
                }
                onAdd={() => addDish(row, { id: restaurant.id, name: restaurant.name })}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
