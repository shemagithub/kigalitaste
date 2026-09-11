import { useMemo, useState } from "react";
import { Clock, Heart, Plus, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatPrice,
  menuForRestaurant,
  restaurantById,
} from "./data";
import { useStore } from "./store";
import { EmptyState } from "./ui";

export function RestaurantPage() {
  const { route, go, addToCart, favorites, toggleFavorite } = useStore();
  const restaurant = restaurantById(route.restaurantId ?? "");
  const menu = restaurant ? menuForRestaurant(restaurant.id) : [];
  const [filter, setFilter] = useState<"all" | "popular">("all");
  const liked = restaurant ? favorites.includes(restaurant.id) : false;

  const items = useMemo(() => {
    if (filter === "popular") return menu.filter((item) => item.popular);
    return menu;
  }, [filter, menu]);

  if (!restaurant) {
    return (
      <EmptyState
        title="Restaurant not found"
        body="That kitchen is no longer listed."
        action={{ label: "Back to restaurants", onClick: () => go({ page: "restaurants" }) }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[1.6rem] bg-white shadow-card">
        <div className="relative h-52 md:h-72">
          <img src={restaurant.cover} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => go({ page: "restaurants" })}
            className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold shadow-sm"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => toggleFavorite(restaurant.id)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-sm"
            aria-label="Favorite"
          >
            <Heart className={cn("h-5 w-5", liked && "fill-primary text-primary")} />
          </button>
        </div>
        <div className="p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">{restaurant.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {restaurant.cuisines.join(" · ")}
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                {restaurant.rating}
                <span className="font-normal text-muted-foreground">
                  ({restaurant.reviews})
                </span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {restaurant.time}
              </span>
              <span>
                {restaurant.deliveryFee === 0
                  ? "Free delivery"
                  : `${formatPrice(restaurant.deliveryFee)} delivery`}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {(["all", "popular"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold capitalize",
              filter === value
                ? "bg-primary text-primary-foreground"
                : "bg-white text-muted-foreground shadow-card",
            )}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <MenuRow key={item.id} item={item} onAdd={() => addToCart(item.id)} />
        ))}
      </div>
    </div>
  );
}

function MenuRow({
  item,
  onAdd,
}: {
  item: ReturnType<typeof menuForRestaurant>[number];
  onAdd: () => void;
}) {
  return (
    <div className="flex gap-4 rounded-[1.35rem] bg-white p-3 shadow-card">
      <img src={item.image} alt="" className="h-24 w-24 rounded-2xl object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold">{item.name}</h3>
          {item.popular && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-primary">
              Popular
            </span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {item.description}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <p className="font-bold text-primary">{formatPrice(item.price)}</p>
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

export function CheckoutPage() {
  const { cartCount, total, placeOrder, go } = useStore();
  const [name, setName] = useState("Aline Uwase");
  const [phone, setPhone] = useState("+250 788 123 456");
  const [address, setAddress] = useState("KG 7 Ave, Kacyiru");
  const [payment, setPayment] = useState("momo");

  if (cartCount === 0) {
    return (
      <EmptyState
        title="Nothing to check out"
        body="Add items to your cart first."
        action={{ label: "Browse restaurants", onClick: () => go({ page: "restaurants" }) }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-2xl font-extrabold">Checkout</h1>
      <form
        className="space-y-4 rounded-[1.5rem] bg-white p-5 shadow-card"
        onSubmit={(event) => {
          event.preventDefault();
          placeOrder(`${payment === "momo" ? "MoMo" : payment} · ${address}`);
        }}
      >
        <Field label="Name" value={name} onChange={setName} />
        <Field label="Phone" value={phone} onChange={setPhone} />
        <Field label="Delivery address" value={address} onChange={setAddress} />
        <div>
          <p className="mb-2 text-sm font-medium">Payment</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "momo", label: "MoMo" },
              { id: "card", label: "Card" },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setPayment(option.id)}
                className={cn(
                  "rounded-xl py-2 text-sm font-semibold",
                  payment === option.id
                    ? "bg-secondary text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="submit"
          className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground"
        >
          Place order · {formatPrice(total)}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 w-full rounded-xl bg-muted px-3 text-sm outline-none ring-primary/30 focus:ring-2"
      />
    </label>
  );
}
 