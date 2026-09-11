import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import {
  categories,
  heroSlides,
  restaurants,
  searchCatalog,
} from "./data";
import { useStore } from "./store";
import {
  CategoryCard,
  EmptyState,
  MobileCategory,
  RestaurantCard,
  SectionHeader,
} from "./ui";

export function HomePage() {
  const { go, search, applyPromo } = useStore();
  const [slide, setSlide] = useState(0);
  const current = heroSlides[slide];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSlide((value) => (value + 1) % heroSlides.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, []);

  const filtered = search.trim()
    ? searchCatalog(search).restaurants
    : restaurants.filter((r) => r.featured);
  const popular = restaurants;

  return (
    <div className="space-y-8 lg:space-y-10">
      <section className="relative overflow-hidden rounded-[1.75rem] bg-[#F3E6D6]">
        <div className="grid items-center gap-4 px-6 py-8 md:grid-cols-[1.1fr_0.9fr] md:px-10 md:py-10 lg:min-h-[280px]">
          <div className="relative z-10 max-w-md">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-foreground md:text-5xl">
              {current.title}
            </h1>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground md:text-base">
              {current.subtitle}
            </p>
            <button
              type="button"
              onClick={() => go({ page: "restaurants" })}
              className="mt-6 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-sm"
            >
              Order Now
            </button>
          </div>
          <div className="relative hidden h-full min-h-[220px] md:block">
            <img
              src={current.image}
              alt=""
              className="absolute bottom-[-24px] right-8 h-[240px] w-[240px] rounded-full object-cover shadow-xl lg:h-[280px] lg:w-[280px]"
            />
            <div className="absolute right-0 top-4 w-[210px] rounded-2xl bg-white p-4 shadow-card">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-primary">
                  <Flame className="h-4 w-4" />
                </span>
                Hot Deal
              </div>
              <p className="text-sm font-bold leading-snug">{current.deal}</p>
              <button
                type="button"
                onClick={() => {
                  applyPromo("TASTE50");
                  go({ page: "restaurants" });
                }}
                className="mt-2 text-sm font-semibold text-primary"
              >
                Order Now
              </button>
            </div>
          </div>
        </div>
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
          {heroSlides.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Go to slide ${index + 1}`}
              onClick={() => setSlide(index)}
              className={`h-2 rounded-full transition ${
                index === slide ? "w-6 bg-primary" : "w-2 bg-black/20"
              }`}
            />
          ))}
        </div>
      </section>

      <section className="md:hidden">
        <button
          type="button"
          onClick={() => go({ page: "offers" })}
          className="flex w-full items-center justify-between overflow-hidden rounded-[1.4rem] bg-[#F3E6D6] p-4 text-left"
        >
          <div>
            <p className="text-xs font-semibold text-primary">Hot Deal</p>
            <p className="mt-1 text-lg font-extrabold leading-tight">
              {current.deal}
            </p>
          </div>
          <img
            src={current.image}
            alt=""
            className="h-20 w-20 rounded-full object-cover"
          />
        </button>
      </section>

      <section>
        <div className="hidden lg:block">
          <SectionHeader
            title="Categories"
            onViewAll={() => go({ page: "categories" })}
          />
          <div className="grid grid-cols-6 gap-4">
            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                onClick={() =>
                  go({ page: "restaurants", categoryId: category.id })
                }
              />
            ))}
          </div>
        </div>
        <div className="lg:hidden">
          <SectionHeader
            title="Categories"
            onViewAll={() => go({ page: "categories" })}
          />
          <div className="no-scrollbar flex gap-4 overflow-x-auto pb-1">
            {categories.map((category) => (
              <MobileCategory
                key={category.id}
                category={category}
                onClick={() =>
                  go({ page: "restaurants", categoryId: category.id })
                }
              />
            ))}
          </div>
        </div>
      </section>

      <section>
        <SectionHeader
          title="Popular Restaurants"
          onViewAll={() => go({ page: "restaurants" })}
        />
        {filtered.length === 0 ? (
          <EmptyState
            title="No matches"
            body="Try another search or browse all restaurants."
            action={{
              label: "See all restaurants",
              onClick: () => go({ page: "restaurants" }),
            }}
          />
        ) : (
          <>
            <div className="hidden grid-cols-3 gap-5 lg:grid">
              {(search.trim() ? filtered : popular).map((restaurant) => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} />
              ))}
            </div>
            <div className="space-y-3 lg:hidden">
              {(search.trim() ? filtered : popular).map((restaurant) => (
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  variant="list"
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
