import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  menuItems,
  offers,
  PROMO,
  restaurantById,
  type MenuItem,
} from "./data";

export type PageName =
  | "home"
  | "restaurants"
  | "categories"
  | "restaurant"
  | "orders"
  | "favorites"
  | "offers"
  | "help"
  | "profile"
  | "checkout";

export type Route = {
  page: PageName;
  restaurantId?: string;
  categoryId?: string;
  query?: string;
};

export type CartLine = {
  itemId: string;
  qty: number;
};

export type Order = {
  id: string;
  createdAt: string;
  status: "Preparing" | "On the way" | "Delivered" | "Cancelled";
  total: number;
  itemCount: number;
  restaurantName: string;
};

type Store = {
  route: Route;
  go: (route: Route) => void;
  search: string;
  setSearch: (value: string) => void;
  cart: CartLine[];
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  addToCart: (itemId: string) => void;
  setQty: (itemId: string, qty: number) => void;
  cartCount: number;
  cartSubtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  promoCode: string;
  setPromoCode: (code: string) => void;
  applyPromo: (code?: string) => void;
  promoApplied: boolean;
  favorites: string[];
  toggleFavorite: (restaurantId: string) => void;
  orders: Order[];
  placeOrder: (note?: string) => boolean;
  cancelOrder: (id: string) => void;
};

const StoreContext = createContext<Store | null>(null);
const STORAGE_KEY = "kigali-taste-state";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as {
      cart?: CartLine[];
      favorites?: string[];
      orders?: Order[];
      promoApplied?: boolean;
    };
  } catch {
    return null;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const saved = typeof window !== "undefined" ? loadState() : null;
  const [route, setRoute] = useState<Route>({ page: "home" });
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>(saved?.cart ?? []);
  const [cartOpen, setCartOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(saved?.favorites ?? []);
  const [orders, setOrders] = useState<Order[]>(saved?.orders ?? []);
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(saved?.promoApplied ?? false);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ cart, favorites, orders, promoApplied }),
    );
  }, [cart, favorites, orders, promoApplied]);

  const go = useCallback((next: Route) => {
    setRoute(next);
    if (next.page !== "restaurants") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const addToCart = useCallback((itemId: string) => {
    setCart((prev) => {
      const existing = prev.find((line) => line.itemId === itemId);
      if (existing) {
        return prev.map((line) =>
          line.itemId === itemId ? { ...line, qty: line.qty + 1 } : line,
        );
      }
      return [...prev, { itemId, qty: 1 }];
    });
    const item = menuItems.find((m) => m.id === itemId);
    toast.success(`${item?.name ?? "Item"} added to cart`);
    setCartOpen(true);
  }, []);

  const setQty = useCallback((itemId: string, qty: number) => {
    setCart((prev) => {
      if (qty <= 0) return prev.filter((line) => line.itemId !== itemId);
      return prev.map((line) =>
        line.itemId === itemId ? { ...line, qty } : line,
      );
    });
  }, []);

  const toggleFavorite = useCallback((restaurantId: string) => {
    setFavorites((prev) => {
      if (prev.includes(restaurantId)) {
        toast("Removed from favorites");
        return prev.filter((id) => id !== restaurantId);
      }
      toast.success("Saved to favorites");
      return [...prev, restaurantId];
    });
  }, []);

  const lines = useMemo(
    () =>
      cart
        .map((line) => {
          const item = menuItems.find((m) => m.id === line.itemId);
          return item ? { ...line, item } : null;
        })
        .filter((line): line is CartLine & { item: MenuItem } => Boolean(line)),
    [cart],
  );

  const cartCount = lines.reduce((sum, line) => sum + line.qty, 0);
  const cartSubtotal = lines.reduce(
    (sum, line) => sum + line.item.price * line.qty,
    0,
  );
  const restaurantIds = new Set(lines.map((line) => line.item.restaurantId));
  const deliveryFee =
    restaurantIds.size === 0
      ? 0
      : Array.from(restaurantIds).reduce((sum, id) => {
          const restaurant = restaurantById(id);
          return sum + (restaurant?.deliveryFee ?? 0);
        }, 0);
  const discount = promoApplied ? Math.round(cartSubtotal * (PROMO.percent / 100)) : 0;
  const total = Math.max(0, cartSubtotal + deliveryFee - discount);

  const applyPromo = useCallback(
    (code?: string) => {
      const value = (code ?? promoCode).trim().toUpperCase();
      const known = offers.find((offer) => offer.code === value);
      if (value === PROMO.code) {
        setPromoApplied(true);
        setPromoCode(PROMO.code);
        toast.success("Promo applied — 50% off");
        return;
      }
      if (known) {
        setPromoCode(known.code);
        toast.success(`${known.title} is ready at checkout`);
        return;
      }
      toast.error("That code is not valid");
    },
    [promoCode],
  );

  const placeOrder = useCallback(
    (note?: string) => {
      if (lines.length === 0) {
        toast.error("Your cart is empty");
        return false;
      }
      const first = restaurantById(lines[0].item.restaurantId);
      const order: Order = {
        id: `KT-${Date.now().toString().slice(-6)}`,
        createdAt: new Date().toISOString(),
        status: "Preparing",
        total,
        itemCount: cartCount,
        restaurantName: first?.name ?? "Kigali Taste",
      };
      setOrders((prev) => [order, ...prev]);
      setCart([]);
      setCartOpen(false);
      setPromoApplied(false);
      setPromoCode("");
      toast.success(note ? `Order placed · ${note}` : "Order placed");
      setRoute({ page: "orders" });
      return true;
    },
    [cartCount, lines, total],
  );

  const cancelOrder = useCallback((id: string) => {
    setOrders((prev) =>
      prev.map((order) =>
        order.id === id && order.status === "Preparing"
          ? { ...order, status: "Cancelled" }
          : order,
      ),
    );
    toast("Order cancelled");
  }, []);

  const value: Store = {
    route,
    go,
    search,
    setSearch,
    cart,
    cartOpen,
    setCartOpen,
    addToCart,
    setQty,
    cartCount,
    cartSubtotal,
    deliveryFee,
    discount,
    total,
    promoCode,
    setPromoCode,
    applyPromo,
    promoApplied,
    favorites,
    toggleFavorite,
    orders,
    placeOrder,
    cancelOrder,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export function useCartItems() {
  const { cart } = useStore();
  return cart
    .map((line) => {
      const item = menuItems.find((m) => m.id === line.itemId);
      const restaurant = item ? restaurantById(item.restaurantId) : undefined;
      return item ? { ...line, item, restaurant } : null;
    })
    .filter(
      (
        line,
      ): line is CartLine & {
        item: MenuItem;
        restaurant: ReturnType<typeof restaurantById>;
      } => Boolean(line),
    );
}
