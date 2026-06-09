import { useCallback, useEffect, useState } from "react";
import { AppShell, type AppRoute } from "./components/shell/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { ProductWorkflow } from "./pages/ProductWorkflow";
import { ProductWorkflowLab } from "./pages/ProductWorkflowLab";
import { ComplianceChatPage } from "./pages/ComplianceChatPage";
import { MonitoringPage } from "./pages/MonitoringPage";
import { RuntimeInfo } from "./components/product/RuntimeInfo";
import {
  loadProducts,
  saveProducts,
  upsertProduct,
  type ProductRecord,
  type ProductWorkflowId,
} from "./lib/productStore";
import { fetchLaws } from "./lib/api";
import { ensureCatalogLoaded } from "./lib/ruleCatalog";

const ROUTES: AppRoute[] = [
  "dashboard",
  "chat",
  "product",
  "product-lab",
  "law",
  "monitoring",
];

function routeFromHash(): AppRoute {
  const h = (window.location.hash || "").replace(/^#\/?/, "");
  return ROUTES.includes(h as AppRoute) ? (h as AppRoute) : "dashboard";
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => routeFromHash());
  const [products, setProducts] = useState<ProductRecord[]>(() => loadProducts("default"));
  const [labProducts, setLabProducts] = useState<ProductRecord[]>(() => loadProducts("lab"));
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

  const handleProductComplete = useCallback(
    (workflow: ProductWorkflowId, product: ProductRecord) => {
      if (workflow === "lab") {
        setLabProducts((prev) => {
          const next = upsertProduct(prev, product);
          saveProducts(next, "lab");
          return next;
        });
        return;
      }
      setProducts((prev) => {
        const next = upsertProduct(prev, product);
        saveProducts(next, "default");
        return next;
      });
    },
    [],
  );

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
            labProducts={labProducts}
            onProductPath={() => navigate("product")}
            onProductLabPath={() => navigate("product-lab")}
            onChatPath={() => navigate("chat")}
          />
        )}

        {route === "chat" && (
          <ComplianceChatPage onNavigateHome={() => navigate("dashboard")} />
        )}

        {route === "product" && (
          <ProductWorkflow
            playbookCompanyId={playbookCompanyId || undefined}
            onComplete={(product) => handleProductComplete("default", product)}
            onNavigateHome={() => navigate("dashboard")}
          />
        )}

        {route === "product-lab" && (
          <ProductWorkflowLab
            playbookCompanyId={playbookCompanyId || undefined}
            onComplete={(product) => handleProductComplete("lab", product)}
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
