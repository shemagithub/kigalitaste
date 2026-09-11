import { categories, formatPrice, helpTopics, offers, restaurants, USER } from "./data";
import { useStore } from "./store";
import { CategoryCard, EmptyState, RestaurantCard, SectionHeader } from "./ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function RestaurantsPage() {
  const { route, go, search } = useStore();
  const categoryId = route.categoryId;
  const query = (route.query ?? search).trim().toLowerCase();
  const category = categories.find((item) => item.id === categoryId);

  const list = restaurants.filter((restaurant) => {
    const matchesCategory = categoryId
      ? restaurant.categoryIds.includes(categoryId)
      : true;
    const matchesQuery = query
      ? restaurant.name.toLowerCase().includes(query) ||
        restaurant.cuisines.some((c) => c.toLowerCase().includes(query))
      : true;
    return matchesCategory && matchesQuery;
  });

  return (
    <div>
      <SectionHeader
        title={category ? category.name : "Restaurants"}
        onViewAll={categoryId ? () => go({ page: "restaurants" }) : undefined}
      />
      {category && (
        <p className="mb-5 text-sm text-muted-foreground">
          {list.length} kitchens serving {category.name.toLowerCase()} in Kigali
        </p>
      )}
      {list.length === 0 ? (
        <EmptyState
          title="No restaurants found"
          body="Clear filters or try a different search."
          action={{ label: "Show all", onClick: () => go({ page: "restaurants" }) }}
        />
      ) : (
        <>
          <div className="hidden grid-cols-3 gap-5 lg:grid">
            {list.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>
          <div className="space-y-3 lg:hidden">
            {list.map((restaurant) => (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                variant="list"
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function CategoriesPage() {
  const { go } = useStore();
  return (
    <div>
      <SectionHeader title="Categories" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {categories.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            onClick={() => go({ page: "restaurants", categoryId: category.id })}
          />
        ))}
      </div>
    </div>
  );
}

export function FavoritesPage() {
  const { favorites, go } = useStore();
  const list = restaurants.filter((restaurant) => favorites.includes(restaurant.id));
  if (list.length === 0) {
    return (
      <EmptyState
        title="No favorites yet"
        body="Tap the heart on a restaurant to save it here."
        action={{ label: "Explore restaurants", onClick: () => go({ page: "restaurants" }) }}
      />
    );
  }
  return (
    <div>
      <SectionHeader title="Favorites" />
      <div className="hidden grid-cols-3 gap-5 lg:grid">
        {list.map((restaurant) => (
          <RestaurantCard key={restaurant.id} restaurant={restaurant} />
        ))}
      </div>
      <div className="space-y-3 lg:hidden">
        {list.map((restaurant) => (
          <RestaurantCard key={restaurant.id} restaurant={restaurant} variant="list" />
        ))}
      </div>
    </div>
  );
}

export function OrdersPage() {
  const { orders, cancelOrder, go } = useStore();
  if (orders.length === 0) {
    return (
      <EmptyState
        title="No orders yet"
        body="When you place an order, you’ll track it here."
        action={{ label: "Order now", onClick: () => go({ page: "home" }) }}
      />
    );
  }
  return (
    <div className="space-y-4">
      <SectionHeader title="Orders" />
      {orders.map((order) => (
        <div
          key={order.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-[1.35rem] bg-white p-5 shadow-card"
        >
          <div>
            <p className="font-semibold">{order.restaurantName}</p>
            <p className="text-sm text-muted-foreground">
              {order.id} · {order.itemCount} items ·{" "}
              {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-primary">
              {order.status}
            </span>
            <span className="font-bold">{formatPrice(order.total)}</span>
            {order.status === "Preparing" && (
              <button
                type="button"
                onClick={() => cancelOrder(order.id)}
                className="text-sm font-semibold text-destructive"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function OffersPage() {
  const { applyPromo, go } = useStore();
  return (
    <div>
      <SectionHeader title="Offers" />
      <div className="grid gap-4 md:grid-cols-3">
        {offers.map((offer) => (
          <div key={offer.id} className="rounded-[1.4rem] bg-white p-5 shadow-card">
            <p className="text-lg font-bold">{offer.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{offer.detail}</p>
            <p className="mt-3 text-sm font-semibold text-primary">{offer.code}</p>
            <button
              type="button"
              onClick={() => {
                applyPromo(offer.code);
                go({ page: "restaurants" });
              }}
              className="mt-4 w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Use offer
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HelpPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <SectionHeader title="Help Center" />
      <div className="space-y-3">
        {helpTopics.map((topic) => (
          <details
            key={topic.q}
            className="rounded-[1.3rem] bg-white p-5 shadow-card"
          >
            <summary className="cursor-pointer font-semibold">{topic.q}</summary>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {topic.a}
            </p>
          </details>
        ))}
      </div>
    </div>
  );
}

export function ProfilePage() {
  const { orders, favorites, go } = useStore();
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center gap-4 rounded-[1.5rem] bg-white p-6 shadow-card">
        <Avatar className="h-16 w-16">
          <AvatarImage src={USER.avatar} alt="" />
          <AvatarFallback>AU</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-xl font-extrabold">{USER.name}</h1>
          <p className="text-sm text-muted-foreground">{USER.email}</p>
          <p className="text-sm text-muted-foreground">{USER.phone}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => go({ page: "orders" })}
          className="rounded-[1.3rem] bg-white p-4 text-left shadow-card"
        >
          <p className="text-2xl font-extrabold">{orders.length}</p>
          <p className="text-sm text-muted-foreground">Orders</p>
        </button>
        <button
          type="button"
          onClick={() => go({ page: "favorites" })}
          className="rounded-[1.3rem] bg-white p-4 text-left shadow-card"
        >
          <p className="text-2xl font-extrabold">{favorites.length}</p>
          <p className="text-sm text-muted-foreground">Favorites</p>
        </button>
      </div>
      <div className="rounded-[1.5rem] bg-white p-5 shadow-card">
        <p className="font-semibold">Default address</p>
        <p className="mt-1 text-sm text-muted-foreground">{USER.location}</p>
      </div>
    </div>
  );
}
