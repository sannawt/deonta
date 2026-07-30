import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppShell, type AppRoute } from "./components/shell/AppShell";
import { WorkspacePage } from "./pages/WorkspacePage";
import { HistoryPage } from "./pages/HistoryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { PlaybookPage } from "./pages/PlaybookPage";
import { ReportsPage } from "./pages/ReportsPage";
import { AiGovernancePage } from "./pages/AiGovernancePage";
import { AssessmentDetailPage } from "./pages/AssessmentDetailPage";
import { ProductWorkflow } from "./pages/ProductWorkflow";
import { ProductWorkflowLab } from "./pages/ProductWorkflowLab";
import { ComplianceChatPage } from "./pages/ComplianceChatPage";
import { LoginPage } from "./pages/LoginPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { DesignSystemPage } from "./pages/DesignSystemPage";
import { RuntimeInfo } from "./components/product/RuntimeInfo";
import {
  loadProductsFromLocal,
  migrateLocalProductsIfNeeded,
  patchAccountProduct,
  saveAccountProducts,
  upsertProduct,
  type ProductRecord,
  type ProductWorkflowId,
} from "./lib/productStore";
import { fetchLaws } from "./lib/api";
import { ensureCatalogLoaded } from "./lib/ruleCatalog";
import { getSelectedPlaybookId, setSelectedPlaybookId } from "./lib/playbookSelection";
import { seedDemoAssessmentsIfNeeded } from "./lib/seedDemoAssessments";
const ROUTES: AppRoute[] = [
  "dashboard",
  "workspace",
  "history",
  "reports",
  "ai-governance",
  "assessment-detail",
  "settings",
  "chat",
  "playbook",
  "product",
  "product-lab",
  "law",
  "design-system",
];
function routeFromHash(): AppRoute {
  const h = (window.location.hash || "").replace(/^#\/?/, "");
  if (h === "login" || h === "auth") return "workspace";
  if (h.startsWith("assessment/")) return "assessment-detail";
  if (h === "dashboard" || h === "library" || h === "monitoring") {
    return "workspace";
  }
  return ROUTES.includes(h as AppRoute) ? (h as AppRoute) : "workspace";
}
function assessmentIdFromHash(): string | null {
  const h = (window.location.hash || "").replace(/^#\/?/, "");
  const match = h.match(/^assessment\/(.+)$/);
  return match?.[1] ?? null;
}
function AppContent() {
  const { user, loading: authLoading, refresh } = useAuth();
  const [route, setRoute] = useState<AppRoute>(() => routeFromHash());
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [, setLabProducts] = useState<ProductRecord[]>(() => loadProductsFromLocal("lab"));
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [detailProductId, setDetailProductId] = useState<string | null>(() => assessmentIdFromHash());
  const [workflowKey, setWorkflowKey] = useState(() => String(Date.now()));
  const [playbookCompanyId] = useState("");
  const [playbookId, setPlaybookId] = useState(() => getSelectedPlaybookId());
  const [aiRegisterPrefillId, setAiRegisterPrefillId] = useState<string | null>(null);
  function navigate(next: AppRoute, assessmentId?: string) {
    setRoute(next);
    if (next === "assessment-detail" && assessmentId) {
      setDetailProductId(assessmentId);
      window.history.replaceState(null, "", `#/assessment/${assessmentId}`);
      return;
    }
    const hash = next === "workspace" ? "" : `#/${next}`;
    window.history.replaceState(null, "", hash || window.location.pathname);
  }
  useEffect(() => {
    const onHash = () => {
      setRoute(routeFromHash());
      setDetailProductId(assessmentIdFromHash());
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (!user) {
      setProducts([]);
      setProductsLoading(false);
      return;
    }
    setProductsLoading(true);
    migrateLocalProductsIfNeeded("default")
      .then((rows) => seedDemoAssessmentsIfNeeded(rows))
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false));
  }, [user]);
  useEffect(() => {
    if (!user) return;
    ensureCatalogLoaded();
    fetchLaws().catch(() => {});
  }, [user]);
  const authRetryRef = useRef(false);
  useEffect(() => {
    if (authLoading || user || authRetryRef.current) return;
    const h = (window.location.hash || "").replace(/^#\/?/, "");
    if (h === "workspace" || h === "") {
      authRetryRef.current = true;
      void refresh();
    }
  }, [authLoading, user, refresh]);
  useEffect(() => {
    const onFocus = () => {
      if (!user) void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user, refresh]);
  const activeProduct = useMemo(
    () => products.find((p) => p.id === activeProductId) ?? null,
    [products, activeProductId],
  );
  const detailProduct = useMemo(
    () => products.find((p) => p.id === detailProductId) ?? null,
    [products, detailProductId],
  );
  const handleNewAssessment = useCallback(() => {
    setActiveProductId(null);
    setWorkflowKey(String(Date.now()));
    navigate("product");
  }, []);
  const handleOpenAssessment = useCallback((productId: string) => {
    setActiveProductId(productId);
    setWorkflowKey(productId);
    navigate("product");
  }, []);
  const handleOpenAssessmentDetail = useCallback((productId: string) => {
    setDetailProductId(productId);
    navigate("assessment-detail", productId);
  }, []);
  const handleProductComplete = useCallback(
    (workflow: ProductWorkflowId, product: ProductRecord) => {
      if (workflow === "lab") {
        setLabProducts((prev) => upsertProduct(prev, product));
        return;
      }
      setProducts((prev) => {
        const next = upsertProduct(prev, product);
        void patchAccountProduct(product).catch(() => {
          void saveAccountProducts(next);
        });
        return next;
      });
      setActiveProductId(product.id);
    },
    [],
  );
  const handleAddToAiRegister = useCallback((assessmentId: string) => {
    setAiRegisterPrefillId(assessmentId);
    navigate("ai-governance");
  }, []);
  const showDev = import.meta.env.DEV;
  const hash = (window.location.hash || "").replace(/^#\/?/, "");
  if (authLoading) {
    return (
      <div className="ct-page ct-app-page">
        <p className="ct-page-sub">Loading…</p>
      </div>
    );
  }
  if (!user) {
    if (hash === "auth" || hash === "auth-callback") {
      return <AuthCallbackPage />;
    }
    return <LoginPage />;
  }
  if (productsLoading) {
    return (
      <div className="ct-page ct-app-page">
        <p className="ct-page-sub">Loading your workspace…</p>
      </div>
    );
  }
  return (
    <>
      <AppShell
        currentRoute={route}
        onNavigate={navigate}
        onNewAssessment={handleNewAssessment}
      >
        {(route === "dashboard" || route === "workspace") && (
          <WorkspacePage
            products={products}
            onNewAssessment={handleNewAssessment}
            onOpenAssessment={handleOpenAssessment}
            onOpenAssessmentDetail={handleOpenAssessmentDetail}
            onPlaybook={() => navigate("playbook")}
            onOpenHistory={() => navigate("history")}
          />
        )}
        {route === "history" && (
          <HistoryPage
            products={products}
            onOpenAssessment={(id) => {
              const product = products.find((p) => p.id === id);
              if (product?.lastWorksheet) {
                handleOpenAssessmentDetail(id);
              } else {
                handleOpenAssessment(id);
              }
            }}
          />
        )}
        {route === "reports" && (
          <ReportsPage products={products} onOpenAssessmentDetail={handleOpenAssessmentDetail} />
        )}
        {route === "ai-governance" && (
          <AiGovernancePage
            onNavigateHome={() => navigate("workspace")}
            prefillAssessmentId={aiRegisterPrefillId}
            onClearPrefill={() => setAiRegisterPrefillId(null)}
          />
        )}
        {route === "assessment-detail" && detailProduct ? (
          <AssessmentDetailPage
            product={detailProduct}
            onBack={() => navigate("workspace")}
            onResume={() => handleOpenAssessment(detailProduct.id)}
          />
        ) : null}
        {route === "assessment-detail" && !detailProduct ? (
          <div className="ct-page ct-app-page">
            <p className="ct-muted">Assessment not found.</p>
            <button type="button" className="ct-btn-primary" onClick={() => navigate("workspace")}>
              Go to workspace
            </button>
          </div>
        ) : null}
        {route === "settings" && <SettingsPage />}
        {route === "chat" && (
          <ComplianceChatPage onNavigateHome={() => navigate("workspace")} />
        )}
        {route === "playbook" && (
          <PlaybookPage
            onNavigateHome={() => navigate("workspace")}
            selectedPlaybookId={playbookId || null}
            onSelectPlaybook={(id) => {
              setPlaybookId(id);
              setSelectedPlaybookId(id);
            }}
          />
        )}
        {route === "product" && (
          <ProductWorkflow
            key={workflowKey}
            resumeProduct={activeProduct}
            playbookCompanyId={playbookCompanyId || undefined}
            playbookId={playbookId || undefined}
            onComplete={(product) => handleProductComplete("default", product)}
            onNavigateHome={() => navigate("workspace")}
            onOpenAssessmentDetail={handleOpenAssessmentDetail}
            onAddToAiRegister={handleAddToAiRegister}
          />
        )}
        {route === "product-lab" && (
          <ProductWorkflowLab
            playbookCompanyId={playbookCompanyId || undefined}
            onComplete={(product) => handleProductComplete("lab", product)}
            onNavigateHome={() => navigate("workspace")}
          />
        )}
        {route === "law" && (
          <div className="ct-page ct-app-page">
            <header className="ct-app-page-header">
              <h1 className="ct-dashboard-title">Law workflow</h1>
            </header>
            <p className="ct-page-sub">Law workflow is available from a direct link only.</p>
            <button type="button" className="ct-btn-primary" onClick={() => navigate("workspace")}>
              Go to workspace
            </button>
          </div>
        )}
        {route === "design-system" && (
          <DesignSystemPage onExit={() => navigate("workspace")} />
        )}
      </AppShell>
      {showDev && <RuntimeInfo />}
    </>
  );
}
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
