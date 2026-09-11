import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { Clock, MapPin, Search, Store, UtensilsCrossed } from "lucide-react";
import { img } from "@/lib/api";
import { useCatalog } from "./catalog";
import { type Restaurant } from "./customer";
import { BtnLink, Empty, Loading } from "./ui";

function RestaurantCard({ restaurant, dishCount }: { restaurant: Restaurant; dishCount: number }) {
  const open = restaurant.isOpen !== 0;

  return (
    <Link
      href={`/r/${restaurant.slug}`}
      className="group overflow-hidden rounded-[1.75rem] bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative">
        <img
          src={img(restaurant.coverUrl || restaurant.logoUrl)}
          alt={`${restaurant.name} restaurant cover — ${restaurant.type} food in Kigali`}
          className="h-44 w-full object-cover transition duration-300 group-hover:scale-[1.02] sm:h-48"
        />
        <span
          className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
            open ? "bg-emerald-500 text-white" : "bg-black/60 text-white"
          }`}
        >
          {open ? "Open" : "Closed"}
        </span>
      </div>
      <div className="flex gap-3 p-4 sm:p-5">
        <img
          src={img(restaurant.logoUrl)}
          alt={`${restaurant.name} logo`}
          className="h-14 w-14 shrink-0 rounded-2xl object-cover shadow-sm ring-2 ring-white"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold text-foreground group-hover:text-primary">{restaurant.name}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{restaurant.type}</p>
          {restaurant.openingHours ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              {restaurant.openingHours}
            </p>
          ) : null}
          <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-2">{restaurant.address}</span>
          </p>
          {restaurant.description ? (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{restaurant.description}</p>
          ) : null}
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
            <UtensilsCrossed className="h-4 w-4" />
            {dishCount} {dishCount === 1 ? "dish" : "dishes"} · View menu →
          </p>
        </div>
      </div>
    </Link>
  );
}

export function RestaurantsPage() {
  const catalog = useCatalog();
  const search = useSearch();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("q");
    if (q) setQuery(q);
  }, [search]);

  const restaurants = catalog?.restaurants || [];
  const items = catalog?.items || [];

  const dishCounts = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of items) {
      if (!item.restaurantId) continue;
      map.set(item.restaurantId, (map.get(item.restaurantId) || 0) + 1);
    }
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return restaurants;
    return restaurants.filter((r) =>
      `${r.name} ${r.type} ${r.address} ${r.description || ""}`.toLowerCase().includes(needle),
    );
  }, [restaurants, query]);

  if (!catalog) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6">
        <Loading label="Loading restaurants…" />
      </div>
    );
  }

  return (
    <div className="pb-12">
      <section className="overflow-hidden rounded-b-[2rem] bg-[#1f1f1f] px-4 py-10 text-white sm:px-6 sm:py-12 md:px-8">
        <div className="mx-auto max-w-[1440px]">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Order food</p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl">
            Restaurants in{" "}
            <span className="font-serif italic text-primary">Kigali</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">
            Browse local kitchens, pick your favourites, and order delivery or pickup. Tap a restaurant to see its full
            menu.
          </p>
          <div className="relative mt-6 max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => {
                const value = e.target.value;
                setQuery(value);
                const url = new URL(window.location.href);
                if (value.trim()) url.searchParams.set("q", value.trim());
                else url.searchParams.delete("q");
                window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
              }}
              placeholder="Search by name, area, or cuisine…"
              className="h-12 w-full rounded-full bg-white pl-11 pr-4 text-sm text-foreground outline-none ring-primary/20 focus:ring-2"
              aria-label="Search restaurants in Kigali"
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 sm:py-10">
        {restaurants.length === 0 ? (
          <Empty
            title="No restaurants yet"
            body="When vendors go live, their kitchens will appear here."
            action={
              <BtnLink href="/become-a-partner" variant="outline">
                Become a partner
              </BtnLink>
            }
          />
        ) : filtered.length === 0 ? (
          <Empty
            title="No matches"
            body={`Nothing found for “${query.trim()}”. Try another search.`}
            action={
              <button
                type="button"
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white"
                onClick={() => setQuery("")}
              >
                Clear search
              </button>
            }
          />
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Store className="h-4 w-4" />
                  {filtered.length} {filtered.length === 1 ? "kitchen" : "kitchens"}
                  {query.trim() ? ` matching “${query.trim()}”` : " available now"}
                </p>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((restaurant) => (
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  dishCount={dishCounts.get(restaurant.id) || 0}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
