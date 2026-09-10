import { useEffect, useState } from "react";
import { getAudit } from "../api";
import FactorChip from "./FactorChip";

// Audit trail tab. A ledger: monospace for the entry number, timestamp and
// model string only; everything else is set in the body face. Renders flush —
// the left panel owns the chrome and the scroll container.
export default function AuditLog({ borrowerId, refreshKey }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!borrowerId) return;
    let cancelled = false;
    getAudit(borrowerId)
      .then((r) => !cancelled && setRows(r))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [borrowerId, refreshKey]);

  if (error) {
    return (
      <p className="px-1 py-4 text-[13px]" style={{ color: "#C23B32" }}>
        Failed to load: {error}
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="px-1 py-4 text-[13px] text-muted">No enquiries recorded for this case yet.</p>
    );
  }

  return (
    <div className="divide-y divide-hairline">
      {rows.map((r, i) => (
        <div
          key={i}
          className="grid grid-cols-1 gap-x-5 gap-y-2 py-3.5 first:pt-1 sm:grid-cols-[9.5rem_1fr]"
        >
          <div className="text-[11px] text-muted">
            <div className="font-mono text-ink">#{String(i + 1).padStart(3, "0")}</div>
            <div className="font-mono">{new Date(r.timestamp).toLocaleString()}</div>
            <div className="mt-1.5">
              {r.model_used ? (
                <span className="font-mono break-all">{r.model_used}</span>
              ) : (
                "no model call"
              )}
            </div>
            {r.was_fallback && (
              <div className="mt-1 font-semibold" style={{ color: "#C23B32" }}>
                fallback response
              </div>
            )}
          </div>

          <div>
            <p className="text-[13px] font-semibold text-ink">{r.question}</p>
            <p className="mt-1 text-[13px] text-muted">{r.answer}</p>
            {r.cited_factors?.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-muted">Cited</span>
                {r.cited_factors.map((c) => (
                  <FactorChip key={c} name={c} />
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
