import { useEffect, useMemo, useRef, useState } from "react";
import { whatif } from "../api";
import { DecisionBadge } from "./BorrowerSelector";
import ScoreGauge from "./ScoreGauge";
import Meter from "./Meter";
import { titleize, deltaColor } from "../lib/format";

// Debounce slider changes so we don't hammer /whatif on every pixel of drag.
const DEBOUNCE_MS = 350;

// Simulation tab content. Renders flush — the left panel owns the chrome.
export default function WhatIfPanel({ borrower }) {
  const [values, setValues] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    const seed = {};
    for (const f of borrower?.factors ?? []) seed[f.name] = f.value;
    setValues(seed);
    setResult(null);
    setError(null);
  }, [borrower?.id]);

  const dirty = useMemo(() => {
    if (!borrower) return false;
    return borrower.factors.some(
      (f) => Math.abs((values[f.name] ?? f.value) - f.value) > 1e-9
    );
  }, [values, borrower]);

  useEffect(() => {
    if (!borrower) return;
    if (!dirty) {
      setResult(null);
      return;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const overrides = {};
      for (const f of borrower.factors) {
        if (Math.abs(values[f.name] - f.value) > 1e-9) overrides[f.name] = Number(values[f.name]);
      }
      setLoading(true);
      setError(null);
      try {
        setResult(await whatif(borrower.id, overrides));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer.current);
  }, [values, dirty, borrower]);

  if (!borrower) {
    return <p className="px-1 py-6 text-[13px] text-muted">Loading factor record…</p>;
  }

  const delta = result?.delta ?? 0;
  const projScore = result?.new_score ?? borrower.score;
  const projDecision = result?.new_decision ?? borrower.decision;
  const oldScore = result?.old_score ?? borrower.score;

  function reset() {
    const seed = {};
    for (const f of borrower.factors) seed[f.name] = f.value;
    setValues(seed);
  }

  return (
    <div className="flex h-full flex-col">
      {/* projected reading */}
      <div className="flex items-center gap-4 border-b border-hairline pb-4">
        <ScoreGauge score={projScore} decision={projDecision} compact />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Projected score
            </span>
            <button
              onClick={reset}
              disabled={!dirty}
              className="text-[11px] font-semibold text-brand underline underline-offset-2 disabled:text-faint disabled:no-underline"
            >
              reset
            </button>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="tnum text-[13px] text-muted">{oldScore}</span>
            <span className="text-[12px] text-muted">to</span>
            <span className="tnum text-3xl font-extrabold tracking-tight text-ink">{projScore}</span>
            {result && delta !== 0 && (
              <span className="tnum text-[13px] font-bold" style={{ color: deltaColor(delta) }}>
                {delta > 0 ? `+${delta}` : delta}
              </span>
            )}
          </div>
          <div className="mt-1.5">
            <DecisionBadge decision={projDecision} />
          </div>
        </div>
      </div>

      {/* one control per factor */}
      <div className="no-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto py-4">
        {borrower.factors.map((f) => {
          const v = values[f.name] ?? f.value;
          const changed = Math.abs(v - f.value) > 1e-9;
          return (
            <div key={f.name}>
              <div className="flex items-baseline justify-between gap-4 text-[12px]">
                <span className="font-semibold text-ink">{titleize(f.name)}</span>
                <span className="tnum" style={{ color: changed ? "#17506E" : "#6B7680" }}>
                  {v.toFixed(2)}
                  {changed && <span className="ml-2 text-faint">was {f.value.toFixed(2)}</span>}
                </span>
              </div>
              <Meter value={v} base={f.value} showGhost={changed} />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={v}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [f.name]: Number(e.target.value) }))
                }
                className="mt-2 w-full accent-brand"
                aria-label={`${titleize(f.name)} value`}
              />
            </div>
          );
        })}
      </div>

      <div className="border-t border-hairline pt-3 text-[13px]">
        {!dirty && <p className="text-muted">Adjust a factor to project a revised score.</p>}
        {dirty && loading && <p className="text-muted">Recomputing…</p>}
        {dirty && error && <p style={{ color: "#C23B32" }}>Request failed: {error}</p>}
        {dirty && result && !loading && <p className="text-ink">{result.explanation}</p>}
      </div>
    </div>
  );
}
