import { Heart, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice, type Category, type Restaurant } from "./data";
import { useStore } from "./store";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
          <path
            d="M4 19h16"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M6 19c0-5.5 2.6-9 6-9s6 3.5 6 9"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M12 10V7.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="12" cy="6.2" r="1.15" fill="currentColor" />
        </svg>
      </div>
      {!compact && (
        <span className="text-[1.35rem] font-extrabold tracking-tight text-foreground">
          Kigali Taste
        </span>
      )}
    </div>
  );
}

export function SectionHeader({
  title,
  onViewAll,
}: {
  title: string;
  onViewAll?: () => void;
}) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <h2 className="text-xl font-bold tracking-tight text-foreground md:text-[1.4rem]">
        {title}
      </h2>
      {onViewAll && (
        <button
          type="button"
          onClick={onViewAll}
          className="text-sm font-semibold text-primary hover:underline"
        >
          View All
        </button>
      )}
    </div>
  );
}

export function CategoryCard({
  category,
  onClick,
}: {
  category: Category;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-[140px] flex-1 flex-col items-center rounded-[1.35rem] bg-white px-3 pb-4 pt-3 shadow-card transition hover:-translate-y-0.5"
    >
      <div className="mb-3 h-24 w-24 overflow-hidden rounded-full bg-muted ring-4 ring-white">
        <img
          src={category.image}
          alt=""
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
      </div>
      <p className="font-semibold text-foreground">{category.name}</p>
      <p className="text-xs text-muted-foreground">{category.count} Restaurants</p>
    </button>
  );
}

export function MobileCategory({
  category,
  onClick,
}: {
  category: Category;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-[72px] shrink-0 flex-col items-center gap-2"
    >
      <div className="h-16 w-16 overflow-hidden rounded-full bg-white shadow-card">
        <img src={category.image} alt="" className="h-full w-full object-cover" />
      </div>
      <span className="text-xs font-medium text-foreground">{category.name}</span>
    </button>
  );
}

export function RestaurantCard({
  restaurant,
  variant = "grid",
}: {
  restaurant: Restaurant;
  variant?: "grid" | "list";
}) {
  const { go, favorites, toggleFavorite } = useStore();
  const liked = favorites.includes(restaurant.id);

  if (variant === "list") {
    return (
      <button
        type="button"
        onClick={() => go({ page: "restaurant", restaurantId: restaurant.id })}
        className="flex w-full gap-3 rounded-2xl bg-white p-2.5 text-left shadow-card"
      >
        <img
          src={restaurant.image}
          alt=""
          className="h-24 w-24 shrink-0 rounded-xl object-cover"
        />
        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-semibold">{restaurant.name}</p>
            <span className="inline-flex items-center gap-1 text-sm font-medium">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {restaurant.rating}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {restaurant.cuisines.join(", ")}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {restaurant.time} · {formatPrice(restaurant.deliveryFee)} Delivery
          </p>
        </div>
      </button>
    );
  }

  return (
    <article className="group relative min-w-[260px] overflow-hidden rounded-[1.35rem] bg-white shadow-card transition hover:-translate-y-0.5">
      <button
        type="button"
        className="block w-full text-left"
        onClick={() => go({ page: "restaurant", restaurantId: restaurant.id })}
      >
        <div className="relative h-40 overflow-hidden">
          <img
            src={restaurant.image}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        </div>
        <div className="p-4">
          <h3 className="text-lg font-bold">{restaurant.name}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {restaurant.cuisines.join(", ")}
          </p>
          <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              {restaurant.rating}
            </span>
            <span>{restaurant.time}</span>
            <span>
              {restaurant.deliveryFee === 0
                ? "Free Delivery"
                : `${formatPrice(restaurant.deliveryFee)} Delivery`}
            </span>
          </div>
        </div>
      </button>
      <button
        type="button"
        aria-label={liked ? "Remove favorite" : "Save favorite"}
        onClick={() => toggleFavorite(restaurant.id)}
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur"
      >
        <Heart
          className={cn(
            "h-4 w-4",
            liked ? "fill-primary text-primary" : "text-foreground",
          )}
        />
      </button>
    </article>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-[1.5rem] bg-white px-6 py-16 text-center shadow-card">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
