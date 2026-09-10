// Arc gauge: a 240-degree scale, banded at the 40 / 70 decision thresholds,
// with a needle that eases to a new reading when the score changes (what-if).
// The score sits in the face of the instrument, the way a real gauge is read.

const START = -120; // needle angle at score 0 (degrees clockwise from 12 o'clock)
const SWEEP = 240; // total travel from 0 to 100

function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function arc(cx, cy, r, a0, a1) {
  const s = polar(cx, cy, r, a0);
  const e = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

const BANDS = [
  { from: 0, to: 0.4, color: "#C23B32" },
  { from: 0.4, to: 0.7, color: "#B07414" },
  { from: 0.7, to: 1, color: "#3C7A4B" },
];

export default function ScoreGauge({ score = 0, decision = "review", compact = false }) {
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  const t = s / 100;
  const needle = START + t * SWEEP;
  const cx = 120;
  const cy = 120;
  const r = 92;
  const width = compact ? 156 : 210;

  return (
    <svg
      viewBox="0 0 240 190"
      width={width}
      height={(width * 190) / 240}
      role="img"
      aria-label={`Risk score ${s} of 100, ${decision}`}
    >
      <path d={arc(cx, cy, r, START, START + SWEEP)} fill="none" stroke="#EAE7F0" strokeWidth="10" />

      {BANDS.map((b, i) => (
        <path
          key={i}
          d={arc(cx, cy, r, START + b.from * SWEEP, START + b.to * SWEEP)}
          fill="none"
          stroke={b.color}
          strokeOpacity="0.32"
          strokeWidth="10"
        />
      ))}

      {Array.from({ length: 11 }).map((_, i) => {
        const a = START + (i / 10) * SWEEP;
        const major = i % 5 === 0 || i === 4 || i === 7;
        const p1 = polar(cx, cy, r - 8, a);
        const p2 = polar(cx, cy, r + (major ? 9 : 5), a);
        return (
          <line
            key={i}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke="#1B1622"
            strokeOpacity={major ? 0.45 : 0.2}
            strokeWidth={major ? 1.4 : 1}
          />
        );
      })}

      {[0, 40, 70, 100].map((v) => {
        const a = START + (v / 100) * SWEEP;
        const p = polar(cx, cy, r + 21, a);
        return (
          <text
            key={v}
            x={p.x}
            y={p.y}
            fill="#9A96A4"
            fontSize="10"
            fontFamily='"Public Sans", system-ui, sans-serif'
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {v}
          </text>
        );
      })}

      {/* needle — the one animated element */}
      <g
        style={{
          transition: "transform .55s cubic-bezier(.22,1,.36,1)",
          transform: `rotate(${needle}deg)`,
          transformBox: "view-box",
          transformOrigin: "120px 120px",
        }}
      >
        <line x1={cx} y1={cy + 12} x2={cx} y2={cy - (r - 6)} stroke="#17506E" strokeWidth="2.6" strokeLinecap="round" />
      </g>
      <circle cx={cx} cy={cy} r="5.5" fill="#FFFFFF" stroke="#17506E" strokeWidth="2" />

      <text
        x={cx}
        y={cy + 48}
        textAnchor="middle"
        fill="#1B1622"
        fontSize={compact ? "30" : "36"}
        fontWeight="800"
        fontFamily='"Public Sans", system-ui, sans-serif'
        style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}
      >
        {s}
      </text>
      <text
        x={cx}
        y={cy + 63}
        textAnchor="middle"
        fill="#9A96A4"
        fontSize="10"
        fontFamily='"Public Sans", system-ui, sans-serif'
      >
        of 100
      </text>
    </svg>
  );
}
