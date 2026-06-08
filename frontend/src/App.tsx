import { useCallback, useEffect, useState } from "react";
import { AppShell, type AppRoute } from "./components/shell/AppShell";
import { StartPage } from "./pages/StartPage";
import { ProductWorkflow } from "./pages/ProductWorkflow";
import { ComplianceChatPage } from "./pages/ComplianceChatPage";
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
import { fetchUiMeta, type UiMeta, type UiMode } from "./lib/uiInstance";

const ROUTES: AppRoute[] = ["start", "chat", "product", "law", "monitoring"];

function routeFromHash(): AppRoute {
  const h = (window.location.hash || "").replace(/^#\/?/, "");
  return ROUTES.includes(h as AppRoute) ? (h as AppRoute) : "start";
}

function homeRoute(mode: UiMode): AppRoute {
  return mode === "workflow" ? "product" : "chat";
}

export default function App() {
  const [uiMeta, setUiMeta] = useState<UiMeta | null>(null);
  const [route, setRoute] = useState<AppRoute>(() => routeFromHash());
  const [ready, setReady] = useState(false);
  const [products, setProducts] = useState<ProductRecord[]>(() => loadProducts());
  const [lawCatalog, setLawCatalog] = useState<LawCatalogItem[]>([]);
  const [lawPathCodes, setLawPathCodes] = useState<string[]>([]);
  const [startLawSelection, setStartLawSelection] = useState<string[]>(["gdpr", "ai_act"]);
  const [playbookCompanyId] = useState("");

  const uiMode: UiMode = uiMeta?.ui_mode === "chat" ? "chat" : "workflow";

  function navigate(next: AppRoute) {
    setRoute(next);
    const hash = next === homeRoute(uiMode) ? "" : `#/${next}`;
    window.history.replaceState(null, "", hash || window.location.pathname);
  }

  useEffect(() => {
    fetchUiMeta().then((meta) => {
      setUiMeta(meta);
      const mode: UiMode = meta.ui_mode === "chat" ? "chat" : "workflow";
      const hash = (window.location.hash || "").replace(/^#\/?/, "");
      if (!hash || hash === "start") {
        const next = homeRoute(mode);
        setRoute(next);
        const pathHash = next === homeRoute(mode) ? "" : `#/${next}`;
        window.history.replaceState(null, "", pathHash || window.location.pathname);
      }
      setReady(true);
    });
  }, []);

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

  if (!ready) {
    return (
      <div className="ct-page">
        <p className="ct-muted">Loading…</p>
      </div>
    );
  }

  return (
    <>
      <AppShell
        uiMode={uiMode}
        peerUrl={uiMeta?.peer_url}
        onNavigateHome={() => navigate(homeRoute(uiMode))}
      >
        {route === "start" && uiMode === "workflow" && (
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

        {route === "chat" && <ComplianceChatPage />}

        {route === "product" && uiMode === "workflow" && (
          <ProductWorkflow
            playbookCompanyId={playbookCompanyId || undefined}
            onComplete={handleProductComplete}
            onNavigateHome={() => navigate(homeRoute(uiMode))}
          />
        )}

        {route === "law" && uiMode === "workflow" &&
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

        {route === "monitoring" && uiMode === "workflow" && (
          <MonitoringPage products={products} />
        )}
      </AppShell>
      {showDev && <RuntimeInfo />}
    </>
  );
}
