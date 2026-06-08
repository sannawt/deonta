import { useCallback, useEffect, useState } from "react";
import { AppShell, type AppRoute } from "./components/shell/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { ProductWorkflow } from "./pages/ProductWorkflow";
import { ComplianceChatPage } from "./pages/ComplianceChatPage";
import { MonitoringPage } from "./pages/MonitoringPage";
import { RuntimeInfo } from "./components/product/RuntimeInfo";
import {
  loadProducts,
  saveProducts,
  upsertProduct,
  type ProductRecord,
} from "./lib/productStore";
import { fetchLaws } from "./lib/api";
import { ensureCatalogLoaded } from "./lib/ruleCatalog";

const ROUTES: AppRoute[] = ["dashboard", "chat", "product", "law", "monitoring"];

function routeFromHash(): AppRoute {
  const h = (window.location.hash || "").replace(/^#\/?/, "");
  return ROUTES.includes(h as AppRoute) ? (h as AppRoute) : "dashboard";
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => routeFromHash());
  const [products, setProducts] = useState<ProductRecord[]>(() => loadProducts());
  const [playbookCompanyId] = useState("");

  function navigate(next: AppRoute) {
    setRoute(next);
    const hash = next === "dashboard" ? "" : `#/${next}`;
    window.history.replaceState(null, "", hash || window.location.pathname);
  }

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    ensureCatalogLoaded();
    fetchLaws().catch(() => {});
  }, []);

  const handleProductComplete = useCallback((product: ProductRecord) => {
    setProducts((prev) => {
      const next = upsertProduct(prev, product);
      saveProducts(next);
      return next;
    });
  }, []);

  const showDev = import.meta.env.DEV;

  return (
    <>
      <AppShell
        currentRoute={route}
        onNavigate={navigate}
        products={products}
      >
        {route === "dashboard" && (
          <DashboardPage
            products={products}
            onProductPath={() => navigate("product")}
            onChatPath={() => navigate("chat")}
          />
        )}

        {route === "chat" && (
          <ComplianceChatPage onNavigateHome={() => navigate("dashboard")} />
        )}

        {route === "product" && (
          <ProductWorkflow
            playbookCompanyId={playbookCompanyId || undefined}
            onComplete={handleProductComplete}
            onNavigateHome={() => navigate("dashboard")}
          />
        )}

        {route === "law" && (
          <div className="ct-page">
            <p className="ct-page-sub">Law workflow is available from a direct link only.</p>
            <button type="button" className="ct-btn-primary" onClick={() => navigate("dashboard")}>
              Go to Home
            </button>
          </div>
        )}

        {route === "monitoring" && <MonitoringPage products={products} />}
      </AppShell>
      {showDev && <RuntimeInfo />}
    </>
  );
}
