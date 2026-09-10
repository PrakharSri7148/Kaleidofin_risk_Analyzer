import { decisionOf } from "../lib/format";

// Decision stated as a word plus a small functional swatch — never a filled pill.
export function DecisionBadge({ decision, className = "" }) {
  const d = decisionOf(decision);
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${className}`}
      style={{ color: d.color }}
    >
      <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: d.color }} aria-hidden="true" />
      {d.word}
    </span>
  );
}

// A 0..100 bar with faint decision-band tints and one ink tick at the score.
function MiniBar({ score }) {
  const pct = Math.max(0, Math.min(100, Number(score) || 0));
  return (
    <div className="relative h-1.5">
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-hairline" />
      <div className="absolute top-1/2 h-[3px] -translate-y-1/2" style={{ left: 0, width: "40%", background: "#C23B32", opacity: 0.16 }} />
      <div className="absolute top-1/2 h-[3px] -translate-y-1/2" style={{ left: "40%", width: "30%", background: "#B07414", opacity: 0.16 }} />
      <div className="absolute top-1/2 h-[3px] -translate-y-1/2" style={{ left: "70%", width: "30%", background: "#3C7A4B", opacity: 0.16 }} />
      <div className="absolute top-0 h-1.5 w-[2px] -ml-px bg-ink" style={{ left: `${pct}%` }} />
    </div>
  );
}

// The sidebar case list. No outer chrome — the sidebar container provides it.
export default function BorrowerSelector({ borrowers, selectedId, onSelect }) {
  return (
    <ul className="space-y-0.5">
      {borrowers.map((b) => {
        const active = b.id === selectedId;
        const d = decisionOf(b.decision);
        return (
          <li key={b.id}>
            <button
              onClick={() => onSelect(b.id)}
              aria-current={active ? "true" : undefined}
              className={`flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left transition-colors ${
                active
                  ? "bg-panel shadow-sm ring-1 ring-brand-100"
                  : "hover:bg-panel/70"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-semibold text-ink">{b.name}</span>
                <span className="tnum shrink-0 text-[12px] font-bold" style={{ color: d.color }}>
                  {b.score}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] text-muted">{b.sector}</span>
                <span className="shrink-0 text-[10px] font-semibold" style={{ color: d.color }}>
                  {d.word}
                </span>
              </div>
              <MiniBar score={b.score} />
            </button>
          </li>
        );
      })}
      {borrowers.length === 0 && (
        <li className="px-3 py-3 text-[12px] text-muted">No cases on file.</li>
      )}
    </ul>
  );
}
