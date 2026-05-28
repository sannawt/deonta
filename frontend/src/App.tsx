import { useState, useRef, useEffect } from "react";
import { ensureCatalogLoaded } from "./lib/ruleCatalog";
import type { Session, Message, ChatResponse } from "./types/chat";
import { nanoid } from "./lib/utils";
import { PolygonBackground } from "./components/compliance-twin/PolygonBackground";
import { Sidebar } from "./components/compliance-twin/Sidebar";
import { ChatHeader } from "./components/compliance-twin/ChatHeader";
import { ChatInputBar } from "./components/compliance-twin/ChatInputBar";
import { WelcomeScreen } from "./components/compliance-twin/WelcomeScreen";
import { ChatMessage } from "./components/cards/ChatMessage";
import { AssessmentPanel } from "./components/workbench/AssessmentPanel";
import { resolveAssessment } from "./lib/assessment";
import { ProductsMatrix } from "./components/workbench/ProductsMatrix";
import { ProductDetailView } from "./components/workbench/ProductDetailView";

// ── LocalStorage persistence ──────────────────────────────────────────────
// Bump key when response card shape changes (old saved messages lack bottom_line / facts_table).
const SESSIONS_STORAGE_KEY = "ct_sessions_v2";
const SIDEBAR_COLLAPSED_KEY = "ct_sidebar_collapsed";

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
  const [activeId, setActiveId] = useState<string | null>(
    sessions.length > 0 ? sessions[0].id : null
  );
  const [playbookCompany, setPlaybookCompany] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadSidebarCollapsed);
  const [loading, setLoading] = useState(false);
  const streamRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"chat" | "products" | "product_detail">("chat");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

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

    setLoading(true);

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
      setLoading(false);
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

  return (
    <>
      <PolygonBackground />
      <div className="app-shell">
        <Sidebar
          sessions={sessions}
          activeId={activeId}
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
          onSelect={setActiveId}
          // If user selects a session, switch back to chat view
          // (products view is separate)
          onNew={() => {
            const s: Session = {
              id: nanoid(),
              title: "New session",
              messages: [],
              playbook_company_id: playbookCompany.trim() || undefined,
              created_at: Date.now(),
            };
            setSessions((prev) => { const u = [s, ...prev]; saveSessions(u); return u; });
            setActiveId(s.id);
          }}
          onResetUi={() => {
            try {
              localStorage.removeItem(SESSIONS_STORAGE_KEY);
              localStorage.removeItem("ct_sessions");
            } catch {}
            window.location.reload();
          }}
        />

        <div className="main-col">
          <ChatHeader
            title={sessionTitle}
            playbookCompanyId={playbookCompany}
            onPlaybookCompanyChange={handlePlaybookCompanyChange}
          />

          <div className="workbench-row">
            <div className="chat-col">
              <div style={{ display: "flex", gap: 8, padding: "10px 10px 0" }}>
                <button
                  type="button"
                  className={`hdr-btn${view === "chat" ? " hdr-btn-active" : ""}`}
                  onClick={() => setView("chat")}
                >
                  Chat
                </button>
                <button
                  type="button"
                  className={`hdr-btn${view === "products" ? " hdr-btn-active" : ""}`}
                  onClick={() => setView("products")}
                >
                  Products
                </button>
              </div>

              {view === "products" ? (
                <div style={{ padding: 10 }}>
                  <ProductsMatrix
                    playbookCompanyId={playbookCompany.trim() || undefined}
                    onOpenProduct={(pid) => {
                      setSelectedProductId(pid);
                      setView("product_detail");
                    }}
                  />
                </div>
              ) : view === "product_detail" ? (
                <div style={{ padding: 10 }}>
                  {selectedProductId ? (
                    <ProductDetailView
                      productId={selectedProductId}
                      onBack={() => setView("products")}
                    />
                  ) : (
                    <div className="empty">No product selected.</div>
                  )}
                </div>
              ) : (
                <>
                  <div className="message-stream" ref={streamRef}>
                    {messages.length === 0 ? (
                      <WelcomeScreen onSend={handleSend} />
                    ) : (
                      messages.map((msg) => (
                        <ChatMessage key={msg.id} message={msg} onSend={handleSend} />
                      ))
                    )}
                  </div>
                  <ChatInputBar onSend={handleSend} loading={loading} />
                </>
              )}
            </div>

            <AssessmentPanel
              assessment={panelAssessment}
              sessionTitle={sessionTitle}
              onSend={handleSend}
            />
          </div>
        </div>
      </div>
    </>
  );
}
