export type Category = {
  id: string;
  name: string;
  count: number;
  image: string;
};

export type Restaurant = {
  id: string;
  name: string;
  cuisines: string[];
  categoryIds: string[];
  rating: number;
  reviews: number;
  time: string;
  deliveryFee: number;
  image: string;
  cover: string;
  featured?: boolean;
};

export type MenuItem = {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  price: number;
  image: string;
  popular?: boolean;
};

export type HeroSlide = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  deal: string;
};

export const USER = {
  name: "Aline Uwase",
  email: "aline@kigalitaste.rw",
  phone: "+250 788 123 456",
  location: "Kacyiru, Kigali",
  city: "Kigali, Rwanda",
  avatar:
    "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=200&q=80",
};

export const PROMO = {
  code: "TASTE50",
  percent: 50,
  label: "Get 50% OFF on your first order",
};

export const categories: Category[] = [
  {
    id: "pizza",
    name: "Pizza",
    count: 32,
    image:
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "burgers",
    name: "Burgers",
    count: 24,
    image:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "desserts",
    name: "Desserts",
    count: 18,
    image:
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "sushi",
    name: "Sushi",
    count: 12,
    image:
      "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "drinks",
    name: "Drinks",
    count: 41,
    image:
      "https://images.unsplash.com/photo-1544145945-f90425316c8c?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "salads",
    name: "Salads",
    count: 16,
    image:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80",
  },
];

export const restaurants: Restaurant[] = [
  {
    id: "burger-house",
    name: "Burger House",
    cuisines: ["Burgers", "Fast Food"],
    categoryIds: ["burgers", "drinks"],
    rating: 4.6,
    reviews: 328,
    time: "30-40 min",
    deliveryFee: 0,
    featured: true,
    image:
      "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=900&q=80",
    cover:
      "https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: "pizza-palace",
    name: "Pizza Palace",
    cuisines: ["Pizza", "Italian"],
    categoryIds: ["pizza", "salads"],
    rating: 4.8,
    reviews: 512,
    time: "25-35 min",
    deliveryFee: 0,
    featured: true,
    image:
      "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=900&q=80",
    cover:
      "https://images.unsplash.com/photo-1548365328-9f547fb0953a?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: "sakae",
    name: "Sakae Sushi",
    cuisines: ["Sushi", "Japanese"],
    categoryIds: ["sushi", "salads"],
    rating: 4.7,
    reviews: 214,
    time: "35-45 min",
    deliveryFee: 1000,
    featured: true,
    image:
      "https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=900&q=80",
    cover:
      "https://images.unsplash.com/photo-1617196034796-73d7d0d3f877?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: "heaven",
    name: "Heaven Restaurant",
    cuisines: ["Rwandan", "Salads"],
    categoryIds: ["salads", "desserts", "drinks"],
    rating: 4.9,
    reviews: 640,
    time: "20-30 min",
    deliveryFee: 0,
    image:
      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80",
    cover:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: "meze",
    name: "Meze Fresh",
    cuisines: ["Salads", "Wraps"],
    categoryIds: ["salads", "drinks"],
    rating: 4.5,
    reviews: 189,
    time: "15-25 min",
    deliveryFee: 0,
    image:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80",
    cover:
      "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: "sweet-lab",
    name: "Sweet Lab",
    cuisines: ["Desserts", "Coffee"],
    categoryIds: ["desserts", "drinks"],
    rating: 4.4,
    reviews: 156,
    time: "20-30 min",
    deliveryFee: 800,
    image:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80",
    cover:
      "https://images.unsplash.com/photo-1488477182946-bb92d543928b?auto=format&fit=crop&w=1400&q=80",
  },
];

export const menuItems: MenuItem[] = [
  {
    id: "bh-classic",
    restaurantId: "burger-house",
    name: "Classic House Burger",
    description: "Beef patty, cheddar, pickles, house sauce, brioche bun",
    price: 6500,
    popular: true,
    image:
      "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "bh-double",
    restaurantId: "burger-house",
    name: "Double Smash",
    description: "Two smash patties, American cheese, caramelized onion",
    price: 8900,
    popular: true,
    image:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "bh-fries",
    restaurantId: "burger-house",
    name: "Crispy Fries",
    description: "Hand-cut fries with paprika salt",
    price: 2500,
    image:
      "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "bh-shake",
    restaurantId: "burger-house",
    name: "Vanilla Shake",
    description: "Thick vanilla milkshake",
    price: 3000,
    image:
      "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "pp-margherita",
    restaurantId: "pizza-palace",
    name: "Margherita",
    description: "San Marzano tomato, mozzarella, basil",
    price: 8000,
    popular: true,
    image:
      "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "pp-pepperoni",
    restaurantId: "pizza-palace",
    name: "Pepperoni",
    description: "Spicy pepperoni, mozzarella, oregano",
    price: 9500,
    popular: true,
    image:
      "https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "pp-salad",
    restaurantId: "pizza-palace",
    name: "Garden Salad",
    description: "Mixed greens, tomato, cucumber, lemon dressing",
    price: 4200,
    image:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "sk-salmon",
    restaurantId: "sakae",
    name: "Salmon Nigiri Set",
    description: "8 pieces of fresh salmon nigiri",
    price: 14000,
    popular: true,
    image:
      "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "sk-roll",
    restaurantId: "sakae",
    name: "California Roll",
    description: "Crab, avocado, cucumber, sesame",
    price: 7800,
    image:
      "https://images.unsplash.com/photo-1617196034796-73d7d0d3f877?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "hv-brochette",
    restaurantId: "heaven",
    name: "Goat Brochettes",
    description: "Grilled goat, ibirayi, pili pili",
    price: 9500,
    popular: true,
    image:
      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "hv-isombe",
    restaurantId: "heaven",
    name: "Isombe Plate",
    description: "Cassava leaves, plantain, rice",
    price: 7000,
    image:
      "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "mz-bowl",
    restaurantId: "meze",
    name: "Harvest Bowl",
    description: "Quinoa, roasted veg, feta, tahini",
    price: 6800,
    popular: true,
    image:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "mz-wrap",
    restaurantId: "meze",
    name: "Chicken Wrap",
    description: "Grilled chicken, greens, yogurt sauce",
    price: 5500,
    image:
      "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "sl-cake",
    restaurantId: "sweet-lab",
    name: "Chocolate Layer Cake",
    description: "Dark chocolate ganache slice",
    price: 4500,
    popular: true,
    image:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "sl-affogato",
    restaurantId: "sweet-lab",
    name: "Affogato",
    description: "Vanilla gelato, espresso shot",
    price: 3800,
    image:
      "https://images.unsplash.com/photo-1488477182946-bb92d543928b?auto=format&fit=crop&w=400&q=80",
  },
];

export const heroSlides: HeroSlide[] = [
  {
    id: "fast",
    title: "Delicious food, delivered fast",
    subtitle: "Order from Kigali's favourite kitchens - hot, fresh, on time.",
    deal: "30% OFF on all orders",
    image:
      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "weekend",
    title: "Weekend feasts, half the wait",
    subtitle: "Pizza, burgers and sushi from kitchens near you.",
    deal: "Free delivery this weekend",
    image:
      "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "taste",
    title: "Taste of Kigali at your door",
    subtitle: "Brochettes, bowls and desserts from local favourites.",
    deal: "First order 50% OFF",
    image:
      "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=900&q=80",
  },
];

export const offers = [
  {
    id: "first",
    title: "50% off your first order",
    code: "TASTE50",
    detail: "Up to 8,000 FRw · new customers",
  },
  {
    id: "free-del",
    title: "Free delivery over 10,000 FRw",
    code: "FREEDEL",
    detail: "Valid citywide in Kigali",
  },
  {
    id: "lunch",
    title: "30% off weekday lunch",
    code: "LUNCH30",
    detail: "11:00–15:00 · selected restaurants",
  },
];

export const helpTopics = [
  {
    q: "How long does delivery take?",
    a: "Most Kigali orders arrive in 20–45 minutes. The estimate is shown on each restaurant card.",
  },
  {
    q: "What payment methods do you accept?",
    a: "MoMo, Airtel Money, and card. You choose at checkout.",
  },
  {
    q: "Can I cancel an order?",
    a: "Yes, until the restaurant starts preparing. Open Orders and tap Cancel.",
  },
  {
    q: "How do promo codes work?",
    a: "Add TASTE50 on your first order for 50% off. Codes apply at checkout.",
  },
];

export function formatPrice(amount: number) {
  if (amount <= 0) return "Free";
  return `${amount.toLocaleString("en-RW")} FRw`;
}

export function restaurantById(id: string) {
  return restaurants.find((r) => r.id === id);
}

export function menuForRestaurant(id: string) {
  return menuItems.filter((item) => item.restaurantId === id);
}

export function searchCatalog(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) {
    return { restaurants, items: [] as MenuItem[] };
  }
  const matchedRestaurants = restaurants.filter(
    (r) =>
      r.name.toLowerCase().includes(q) ||
      r.cuisines.some((c) => c.toLowerCase().includes(q)),
  );
  const items = menuItems.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q),
  );
  return { restaurants: matchedRestaurants, items };
}
