import { titleize } from "../lib/format";

// Restrained citation tag. `dark` variant sits on the AI hero card.
export default function FactorChip({ name, dark = false }) {
  return (
    <span
      className={
        dark
          ? "inline-block rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] leading-none text-white/90"
          : "inline-block rounded-full border border-hairline bg-paper px-2 py-0.5 text-[11px] leading-none text-ink"
      }
    >
      {titleize(name)}
    </span>
  );
}
