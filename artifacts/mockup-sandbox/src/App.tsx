import { useEffect } from "react";
import { Toaster } from "sonner";
import { useLocation } from "wouter";
import { AuthProvider } from "./lib/auth";
import { PublicApp } from "./web/PublicApp";
import { VendorApp } from "./web/VendorApp";
import { AdminApp } from "./web/AdminApp";
import { SeoManager } from "./web/seo";

function scrollPageTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function ScrollToTop() {
  const [loc] = useLocation();
  useEffect(() => {
    const hash = loc.includes("#") ? loc.split("#")[1] : window.location.hash.replace("#", "");
    if (hash) return;
    scrollPageTop();
  }, [loc]);
  return null;
}

function Routed() {
  const [path] = useLocation();
  if (path.startsWith("/admin")) return <AdminApp />;
  if (path.startsWith("/vendor")) return <VendorApp />;
  return <PublicApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <SeoManager />
      <ScrollToTop />
      <Routed />
      <Toaster position="top-center" richColors />
    </AuthProvider>
  );
}
