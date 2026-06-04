import { useCallback, useEffect, useState } from "react";
import { AppShell, type AppRoute } from "./components/shell/AppShell";
import { StartPage } from "./pages/StartPage";
import { ProductWorkflow } from "./pages/ProductWorkflow";
import { LawWorkflow } from "./pages/LawWorkflow";
import { MonitoringPage } from "./pages/MonitoringPage";
import { RuntimeInfo } from "./components/product/RuntimeInfo";
import {
  loadProducts,
  saveProducts,
  upsertProduct,
  type ProductRecord,
} from "./lib/productStore";
import { fetchLaws, type LawCatalogItem } from "./lib/api";
import { ensureCatalogLoaded } from "./lib/ruleCatalog";

function routeFromHash(): AppRoute {
  const h = (window.location.hash || "").replace(/^#\/?/, "");
  const allowed: AppRoute[] = ["start", "product", "law", "monitoring"];
  return allowed.includes(h as AppRoute) ? (h as AppRoute) : "start";
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => routeFromHash());
  const [products, setProducts] = useState<ProductRecord[]>(() => loadProducts());
  const [lawCatalog, setLawCatalog] = useState<LawCatalogItem[]>([]);
  const [lawPathCodes, setLawPathCodes] = useState<string[]>([]);
  const [startLawSelection, setStartLawSelection] = useState<string[]>(["gdpr", "ai_act"]);
  const [playbookCompanyId] = useState("");

  function navigate(next: AppRoute) {
    setRoute(next);
    const hash = next === "start" ? "" : `#/${next}`;
    window.history.replaceState(null, "", hash || window.location.pathname);
  }

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    ensureCatalogLoaded();
    fetchLaws()
      .then(setLawCatalog)
      .catch(() => {});
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
      <AppShell onNavigateHome={() => navigate("start")}>
        {route === "start" && (
          <StartPage
            lawOptions={lawCatalog}
            selectedLaws={startLawSelection}
            onToggleLaw={(code) =>
              setStartLawSelection((s) =>
                s.includes(code) ? s.filter((c) => c !== code) : [...s, code]
              )
            }
            onProductPath={() => navigate("product")}
            onLawPath={(codes) => {
              setLawPathCodes(codes);
              navigate("law");
            }}
          />
        )}

        {route === "product" && (
          <ProductWorkflow
            playbookCompanyId={playbookCompanyId || undefined}
            onComplete={handleProductComplete}
            onNavigateHome={() => navigate("start")}
          />
        )}

        {route === "law" &&
          (lawPathCodes.length > 0 ? (
            <LawWorkflow lawCodes={lawPathCodes} onBack={() => navigate("start")} />
          ) : (
            <div className="ct-page">
              <p className="ct-page-sub">Select at least one law on the home screen first.</p>
              <button type="button" className="ct-btn-primary" onClick={() => navigate("start")}>
                Go to Home
              </button>
            </div>
          ))}

        {route === "monitoring" && <MonitoringPage products={products} />}
      </AppShell>
      {showDev && <RuntimeInfo />}
    </>
  );
}
