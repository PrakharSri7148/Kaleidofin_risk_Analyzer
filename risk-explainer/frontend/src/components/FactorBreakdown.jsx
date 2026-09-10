import Meter from "./Meter";
import { titleize } from "../lib/format";

// Every contributing factor as its own row: label, value, a thin meter with a
// tick, and the weight / direction noted in small type. Renders rows only —
// the caller owns the scroll container.
export default function FactorBreakdown({ borrower }) {
  if (!borrower) {
    return <p className="px-1 py-6 text-[13px] text-muted">Loading factor record…</p>;
  }

  return (
    <div className="divide-y divide-hairline">
      {borrower.factors.map((f) => (
        <div key={f.name} className="py-3.5 first:pt-1">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[13px] font-semibold text-ink">{titleize(f.name)}</span>
            <span className="tnum text-[13px] font-semibold text-ink">{f.value.toFixed(2)}</span>
          </div>

          <Meter value={f.value} />

          <div className="mt-2 flex items-baseline justify-between gap-6 text-[11px] text-muted">
            <span className="max-w-[60%]">{f.description}</span>
            <span className="tnum shrink-0 whitespace-nowrap">
              weight {f.weight.toFixed(2)}
              <span className="ml-3">
                {f.direction === "negative" ? "lowers score" : "raises score"}
              </span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
