import { useState, useRef, useEffect } from "react";
import { ensureCatalogLoaded } from "./lib/ruleCatalog";
import type { Session, Message, ChatResponse } from "./types/chat";
import { nanoid } from "./lib/utils";
import { PolygonBackground } from "./components/compliance-twin/PolygonBackground";
import { Sidebar, type PrimaryView } from "./components/compliance-twin/Sidebar";
import { ChatHeader } from "./components/compliance-twin/ChatHeader";
import { AssessmentPanel } from "./components/workbench/AssessmentPanel";
import { resolveAssessment } from "./lib/assessment";
import { Wizard } from "./components/product/Wizard";
import { ProductsLibrary } from "./components/product/ProductsLibrary";
import { ProductPage } from "./components/product/ProductPage";
import { RuntimeInfo } from "./components/product/RuntimeInfo";
import { ChatHelperDrawer } from "./components/product/ChatHelperDrawer";
import { loadProducts, saveProducts, upsertProduct, type ProductRecord } from "./lib/productStore";

// ── LocalStorage persistence ──────────────────────────────────────────────
// Bump key when response card shape changes (old saved messages lack bottom_line / facts_table).
const SESSIONS_STORAGE_KEY = "ct_sessions_v2";
const SIDEBAR_COLLAPSED_KEY = "ct_sidebar_collapsed";
const PRODUCTS_KEY_MIGRATE = "ct_products_v1";

function loadSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: Session[]) {
  try {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch {}
}

// ── API call ──────────────────────────────────────────────────────────────

async function callChat(
  question: string,
  session_id: string,
  company_name?: string,
  playbook_company_id?: string
): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      session_id,
      company_name: company_name || undefined,
      playbook_company_id:
        playbook_company_id && playbook_company_id.trim()
          ? playbook_company_id.trim()
          : undefined,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ── App ───────────────────────────────────────────────────────────────────

export default function App() {
  const [sessions, setSessions] = useState<Session[]>(loadSessions);
  const [activeId, setActiveId] = useState<string | null>(sessions.length > 0 ? sessions[0].id : null);
  const [playbookCompany, setPlaybookCompany] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadSidebarCollapsed);
  const streamRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<PrimaryView>("wizard");
  const [products, setProducts] = useState<ProductRecord[]>(() => {
    try {
      // ensure key exists for local-only redesign; old installs won’t have it.
      localStorage.getItem(PRODUCTS_KEY_MIGRATE);
      return loadProducts();
    } catch {
      return [];
    }
  });
  const [activeProductId, setActiveProductId] = useState<string | null>(products[0]?.id ?? null);
  const [chatOpen, setChatOpen] = useState(false);

  // Pre-load rule catalog on mount
  useEffect(() => { ensureCatalogLoaded(); }, []);

  const activeSession = sessions.find((s) => s.id === activeId) ?? null;

  useEffect(() => {
    if (activeSession) {
      setPlaybookCompany(activeSession.playbook_company_id ?? "");
    }
  }, [activeSession?.id, activeSession?.playbook_company_id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [activeSession?.messages.length]);

  function updateSessions(updated: Session[]) {
    setSessions(updated);
    saveSessions(updated);
  }

  function updateProducts(next: ProductRecord[]) {
    setProducts(next);
    try {
      saveProducts(next);
    } catch {}
  }

  function patchSession(id: string, patch: Partial<Session>) {
    const updated = sessions.map((s) => (s.id === id ? { ...s, ...patch } : s));
    updateSessions(updated);
  }

  async function handleSend(text: string) {
    const title = text.length > 42 ? text.slice(0, 42) + "…" : text;
    const userMsg: Message = { id: nanoid(), role: "user", text };
    const loadingMsg: Message = { id: nanoid(), role: "loading" };

    // Determine or create session, build the new sessions list atomically
    let sid: string;
    let sessionsWithMsg: Session[];

    setSessions((prev) => {
      const existing = prev.find((s) => s.id === activeId);
      if (existing) {
        sid = existing.id;
        sessionsWithMsg = prev.map((s) =>
          s.id === sid
            ? {
                ...s,
                title: s.messages.length === 0 ? title : s.title,
                messages: [...s.messages, userMsg, loadingMsg],
              }
            : s
        );
      } else {
        sid = nanoid();
        const newSession: Session = {
          id: sid,
          title,
          messages: [userMsg, loadingMsg],
          playbook_company_id: playbookCompany.trim() || undefined,
          created_at: Date.now(),
        };
        sessionsWithMsg = [newSession, ...prev];
        // schedule activeId update outside setState
        setTimeout(() => setActiveId(sid), 0);
      }
      saveSessions(sessionsWithMsg);
      return sessionsWithMsg;
    });

    // Chat helper mode will manage its own loading state (wizard/products are primary).

    try {
      const data = await callChat(
        text,
        sid!,
        undefined,
        playbookCompany.trim() || undefined
      );
      const aiMsg: Message = { id: nanoid(), role: "assistant", data };
      setSessions((prev) => {
        const updated = prev.map((s) => {
          if (s.id !== sid) return s;
          const msgs = [...s.messages];
          msgs[msgs.length - 1] = aiMsg;
          return {
            ...s,
            messages: msgs,
            playbook_company_id: playbookCompany.trim() || undefined,
          };
        });
        saveSessions(updated);
        return updated;
      });
    } catch (err) {
      const errMsg: Message = {
        id: nanoid(),
        role: "assistant",
        error: err instanceof Error ? err.message : "Unknown error",
      };
      setSessions((prev) => {
        const updated = prev.map((s) => {
          if (s.id !== sid) return s;
          const msgs = [...s.messages];
          msgs[msgs.length - 1] = errMsg;
          return { ...s, messages: msgs };
        });
        saveSessions(updated);
        return updated;
      });
    } finally {
      // no-op
    }
  }

  function handlePlaybookCompanyChange(id: string) {
    const next = id.trim();
    setPlaybookCompany(next);
    if (activeId) {
      patchSession(activeId, {
        playbook_company_id: next || undefined,
      });
    }
  }

  const messages = activeSession?.messages ?? [];
  const sessionTitle = activeSession?.title ?? "";
  const panelAssessment = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "assistant") continue;
      const a = resolveAssessment(m.data);
      if (a) return a;
    }
    return null;
  })();

  const activeProduct = products.find((p) => p.id === activeProductId) ?? null;

  return (
    <>
      <PolygonBackground />
      <div className="app-shell">
        <Sidebar
          view={view}
          onNavigate={(v) => setView(v)}
          products={products}
          activeProductId={activeProductId}
          onSelectProduct={(id) => {
            setActiveProductId(id);
            setView("products");
          }}
          playbookCompanyId={playbookCompany}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => {
            setSidebarCollapsed((c) => {
              const next = !c;
              try {
                localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
              } catch {}
              return next;
            });
          }}
          onResetUi={() => {
            try {
              localStorage.removeItem(SESSIONS_STORAGE_KEY);
              localStorage.removeItem("ct_sessions");
              localStorage.removeItem(PRODUCTS_KEY_MIGRATE);
            } catch {}
            window.location.reload();
          }}
        />

        <div className="main-col">
          <ChatHeader
            title={activeProduct?.label || "ComplianceTwin"}
            playbookCompanyId={playbookCompany}
            onPlaybookCompanyChange={handlePlaybookCompanyChange}
          />

          <div className="workbench-row">
            <div className="chat-col">
              <div style={{ padding: 10, height: "100%", overflow: "auto" }}>
                {view === "wizard" && (
                  <Wizard
                    playbookCompanyId={playbookCompany.trim() || undefined}
                    runAssessment={(prompt, sessionId, pb) => callChat(prompt, sessionId, undefined, pb)}
                    onAssessment={(product, prompt, resp) => {
                      const updated: ProductRecord = {
                        ...product,
                        updated_at: Date.now(),
                        lastAssessment: { created_at: Date.now(), prompt, response: resp },
                      };
                      const next = upsertProduct(products, updated);
                      updateProducts(next);
                      setActiveProductId(updated.id);
                      setView("products");
                    }}
                  />
                )}
                {view === "wizard" && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                    <button type="button" className="hdr-btn" onClick={() => setChatOpen(true)}>
                      Ask a follow‑up
                    </button>
                  </div>
                )}

                {view === "products" && (
                  <>
                    <ProductsLibrary
                      products={products}
                      onOpen={(id) => {
                        setActiveProductId(id);
                        setView("products");
                      }}
                    />
                    {activeProduct && (
                      <div style={{ marginTop: 12 }}>
                        <ProductPage product={activeProduct} />
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                      <button type="button" className="hdr-btn" onClick={() => setChatOpen(true)}>
                        Ask a follow‑up
                      </button>
                    </div>
                  </>
                )}

                {view === "regulations" && (
                  <div className="card" style={{ padding: 14 }}>
                    <div className="card-title">Regulations</div>
                    <div className="card-subtitle">Authoritative sources browser (next milestone)</div>
                    <div className="empty" style={{ marginTop: 12 }}>
                      This will surface articles/recitals with EUR‑Lex links and relationships to rules/facts.
                    </div>
                  </div>
                )}

                {view === "evidence" && (
                  <div className="card" style={{ padding: 14 }}>
                    <div className="card-title">Evidence</div>
                    <div className="card-subtitle">Exportable record + memo (next milestone)</div>
                    <div className="empty" style={{ marginTop: 12 }}>
                      This will generate a defensible export with citations and a trace appendix.
                    </div>
                  </div>
                )}

                {view === "playbook" && (
                  <div className="card" style={{ padding: 14 }}>
                    <div className="card-title">Playbook</div>
                    <div className="card-subtitle">Company knowledge (currently selected in header)</div>
                    <div className="empty" style={{ marginTop: 12 }}>
                      Playbook integration stays available via the company playbook selector.
                    </div>
                  </div>
                )}
              </div>
            </div>

            <AssessmentPanel
              assessment={panelAssessment}
              sessionTitle={sessionTitle}
              onSend={handleSend}
            />
          </div>
        </div>

        <RuntimeInfo />
        <ChatHelperDrawer
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          productLabel={activeProduct?.label}
          runChat={(question) =>
            callChat(
              question,
              activeProduct?.id || nanoid(),
              undefined,
              playbookCompany.trim() || undefined
            )
          }
        />
      </div>
    </>
  );
}
