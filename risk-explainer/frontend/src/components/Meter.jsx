// Thin linear meter, 0..1, with a precise tick at the value. Shared by the
// factor breakdown and the what-if console so both read in the same vocabulary.
// When `showGhost` is set the recorded value stays as a faint reference tick
// and the live tick eases across to the simulated value.

const clamp = (n) => Math.max(0, Math.min(1, Number(n) || 0));

export default function Meter({ value, base = null, showGhost = false }) {
  const pct = clamp(value) * 100;
  const basePct = base == null ? null : clamp(base) * 100;

  return (
    <div className="relative mt-2 h-4 select-none">
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-hairline" />

      {[0, 25, 50, 75, 100].map((p) => (
        <div
          key={p}
          className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-hairline"
          style={{ left: `${p}%` }}
        />
      ))}

      <div
        className="absolute top-1/2 h-[3px] -translate-y-1/2 bg-brand/30 transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%` }}
      />

      {showGhost && basePct != null && (
        <div
          className="absolute top-0 h-4 w-px bg-faint"
          style={{ left: `${basePct}%` }}
          aria-hidden="true"
        />
      )}

      <div
        className="absolute top-0 h-4 w-[2px] -ml-px bg-ink transition-[left] duration-300 ease-out"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}
