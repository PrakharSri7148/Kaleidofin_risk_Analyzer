import { useEffect, useMemo, useRef, useState } from "react";
import { getBorrowers, getBorrower } from "./api";
import BorrowerSelector, { DecisionBadge } from "./components/BorrowerSelector";
import ScoreGauge from "./components/ScoreGauge";
import FactorBreakdown from "./components/FactorBreakdown";
import ChatWindow from "./components/ChatWindow";
import WhatIfPanel from "./components/WhatIfPanel";
import AuditLog from "./components/AuditLog";
import { LogoMark, Icons } from "./components/brand";
import { decisionOf } from "./lib/format";
import avatarUrl from "../assets/logo.jpg";

const TABS = [
  { id: "assessment", label: "Assessment", icon: Icons.assessment },
  { id: "simulation", label: "Simulation", icon: Icons.simulation },
  { id: "audit", label: "Audit trail", icon: Icons.audit },
];

function RailButton({ active, onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
        active ? "bg-white text-brand" : "text-white/55 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Segmented({ value, onChange }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-tray p-1">
      {TABS.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
              active ? "bg-panel text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export default function App() {
  const [borrowers, setBorrowers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [borrower, setBorrower] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [tab, setTab] = useState("assessment");
  const [auditRefresh, setAuditRefresh] = useState(0);
  const chatInputRef = useRef(null);

  useEffect(() => {
    getBorrowers()
      .then((list) => {
        setBorrowers(list);
        if (list.length) setSelectedId(list[0].id);
      })
      .catch((e) => setLoadError(e.message));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setBorrower(null);
    getBorrower(selectedId).then(setBorrower).catch((e) => setLoadError(e.message));
  }, [selectedId]);

  const idx = useMemo(
    () => borrowers.findIndex((b) => b.id === selectedId),
    [borrowers, selectedId]
  );

  function step(dir) {
    if (!borrowers.length) return;
    const next = (idx + dir + borrowers.length) % borrowers.length;
    setSelectedId(borrowers[next].id);
  }

  const d = borrower ? decisionOf(borrower.decision) : null;

  return (
    <div className="flex h-full w-full gap-3 bg-frame p-3 sm:gap-4 sm:p-4">
      {/* ── panel 1: icon rail ───────────────────────────────── */}
      <nav className="flex w-14 shrink-0 flex-col items-center gap-1 rounded-2xl bg-rail py-3 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)]">
        <div className="mb-2">
          <LogoMark size={36} />
        </div>
        {TABS.map((t) => (
          <RailButton key={t.id} active={tab === t.id} onClick={() => setTab(t.id)} title={t.label}>
            {t.icon}
          </RailButton>
        ))}
        <RailButton title="Ask Kaleido" onClick={() => chatInputRef.current?.focus()}>
          {Icons.ai}
        </RailButton>
        <div className="mt-auto">
          <RailButton title="Settings">{Icons.gear}</RailButton>
        </div>
      </nav>

      {/* ── panel 2: sidebar ─────────────────────────────────── */}
      <aside className="flex w-[292px] shrink-0 flex-col overflow-hidden rounded-2xl bg-panel shadow-[0_10px_30px_-14px_rgba(0,0,0,0.2)] ring-1 ring-black/[0.04]">
        <div className="flex h-9 shrink-0 items-center px-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
          </div>
        </div>

        <div className="border-b border-hairline px-5 pb-4 pt-1">
          <div className="flex items-center gap-2.5">
            <img
              src={avatarUrl}
              alt="Venkatesh Kashi"
              className="h-9 w-9 shrink-0 rounded-full bg-brand-50 object-cover ring-1 ring-black/10"
            />
            <div className="leading-tight">
              <div className="text-[14px] font-semibold text-ink">Venkatesh Kashi</div>
              <div className="text-[11px] text-muted">Credit risk reviewer</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">Cases</span>
          <span className="tnum text-[11px] text-muted">{borrowers.length}</span>
        </div>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <BorrowerSelector borrowers={borrowers} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        <div className="flex items-center justify-between border-t border-hairline px-5 py-3">
          <span className="text-[11px] text-muted">Every question audited</span>
          <button className="text-[12px] font-semibold text-brand hover:underline">Sign out</button>
        </div>
      </aside>

      {/* ── panel 3: main ────────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-panel shadow-[0_10px_30px_-14px_rgba(0,0,0,0.2)] ring-1 ring-black/[0.04]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-hairline px-6 py-4">
          <div className="min-w-0">
            <h1 className="text-[21px] leading-tight text-ink">Ki-score</h1>
            <p className="mt-0.5 truncate text-[12px] text-muted">
              {borrower ? (
                <>
                  <span className="font-mono">{borrower.id}</span> &nbsp;·&nbsp; {borrower.name}{" "}
                  &nbsp;·&nbsp; {borrower.sector}
                </>
              ) : (
                "Loading case…"
              )}
            </p>
          </div>
          <Segmented value={tab} onChange={setTab} />
        </div>

        {loadError && (
          <div
            className="mx-6 mt-3 shrink-0 rounded-lg border px-3 py-2 text-[12px]"
            style={{ borderColor: "#C23B32", background: "rgba(194,59,50,0.06)", color: "#C23B32" }}
          >
            Could not reach the backend ({loadError}). Confirm the API is on{" "}
            <span className="font-mono">http://localhost:8000</span>.
          </div>
        )}

        <div className="min-h-0 flex-1 p-4">
          <div className="flex h-full min-h-0 gap-4 rounded-xl border border-hairline bg-tray p-4">
            {/* left: swappable analysis */}
            <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-hairline bg-panel p-4">
              {tab === "assessment" && (
                <>
                  <div className="flex shrink-0 items-center gap-4 border-b border-hairline pb-4">
                    <ScoreGauge
                      score={borrower?.score ?? 0}
                      decision={borrower?.decision ?? "review"}
                    />
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                        Decision
                      </div>
                      {borrower ? (
                        <>
                          <div
                            className="mt-1 text-2xl font-extrabold tracking-tight"
                            style={{ color: d.color }}
                          >
                            {d.word}
                          </div>
                          <p className="mt-1 max-w-xs text-[12px] text-muted">{d.line}</p>
                          <div className="mt-2 flex items-baseline gap-1.5">
                            <span className="tnum text-[15px] font-bold text-ink">
                              {borrower.score}
                            </span>
                            <span className="text-[11px] text-muted">/ 100 ki-score</span>
                          </div>
                        </>
                      ) : (
                        <p className="mt-2 text-[13px] text-muted">Loading case file…</p>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-wider text-faint">
                    Contributing factors
                  </div>
                  <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
                    <FactorBreakdown borrower={borrower} />
                  </div>
                </>
              )}

              {tab === "simulation" && <WhatIfPanel borrower={borrower} />}

              {tab === "audit" && (
                <>
                  <div className="shrink-0 border-b border-hairline pb-3 text-[11px] font-semibold uppercase tracking-wider text-faint">
                    Audit trail — every enquiry for this case
                  </div>
                  <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pr-1 pt-1">
                    <AuditLog borrowerId={selectedId} refreshKey={auditRefresh} />
                  </div>
                </>
              )}
            </section>

            {/* right: the AI hero, always present */}
            <section className="flex w-[360px] shrink-0 flex-col overflow-hidden rounded-lg bg-hero">
              <ChatWindow
                borrower={borrower}
                inputRef={chatInputRef}
                onAnswered={() => setAuditRefresh((n) => n + 1)}
              />
            </section>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-center gap-3 border-t border-hairline px-6 py-2.5 text-[12px] text-muted">
          <button onClick={() => step(-1)} className="font-semibold text-ink hover:text-brand">
            ← prev
          </button>
          <span className="tnum">
            case {borrowers.length ? idx + 1 : 0} of {borrowers.length}
          </span>
          <button onClick={() => step(1)} className="font-semibold text-ink hover:text-brand">
            next case →
          </button>
        </div>
      </main>
    </div>
  );
}
