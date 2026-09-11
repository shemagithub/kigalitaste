import { Toaster } from "sonner";
import { StoreProvider, useStore } from "./store";
import { AppLayout } from "./layout";
import { HomePage } from "./home";
import { CheckoutPage, RestaurantPage } from "./restaurant";
import {
  CategoriesPage,
  FavoritesPage,
  HelpPage,
  OffersPage,
  OrdersPage,
  ProfilePage,
  RestaurantsPage,
} from "./pages";

function Screen() {
  const { route } = useStore();
  switch (route.page) {
    case "restaurants":
      return <RestaurantsPage />;
    case "categories":
      return <CategoriesPage />;
    case "restaurant":
      return <RestaurantPage />;
    case "orders":
      return <OrdersPage />;
    case "favorites":
      return <FavoritesPage />;
    case "offers":
      return <OffersPage />;
    case "help":
      return <HelpPage />;
    case "profile":
      return <ProfilePage />;
    case "checkout":
      return <CheckoutPage />;
    default:
      return <HomePage />;
  }
}

export function KigaliTasteApp() {
  return (
    <StoreProvider>
      <AppLayout>
        <Screen />
      </AppLayout>
      <Toaster position="top-center" richColors />
    </StoreProvider>
  );
}
