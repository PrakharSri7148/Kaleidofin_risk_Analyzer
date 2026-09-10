// Kaleidofin brand marks, using the supplied assets in /assets.
import markUrl from "../../assets/logo.jpg";
import wordmarkUrl from "../../assets/name.png";

// The chevron mark on a white chip — mirrors the inspo's logo treatment on
// dark surfaces (icon rail, hero card header).
export function LogoMark({ size = 28, className = "" }) {
  return (
    <span
      className={`inline-flex items-center justify-center overflow-hidden rounded-xl bg-white ${className}`}
      style={{ width: size, height: size }}
    >
      <img src={markUrl} alt="Kaleidofin" className="h-full w-full object-contain p-[3px]" />
    </span>
  );
}

// The full "kaleidofin" wordmark (navy + teal) for the sidebar header.
export function LogoWordmark({ className = "", height = 40 }) {
  return (
    <img
      src={wordmarkUrl}
      alt="Kaleidofin"
      style={{ height, mixBlendMode: "multiply" }}
      className={`w-auto ${className}`}
    />
  );
}

// Minimal stroke icons for the rail.
const I = ({ d, size = 19 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {d}
  </svg>
);

export const Icons = {
  assessment: <I d={<><path d="M3 3v18h18" /><path d="M7 14l3-4 3 3 4-6" /></>} />,
  ai: (
    <I
      d={
        <>
          <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z" />
          <path d="M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z" />
        </>
      }
    />
  ),
  simulation: (
    <I
      d={
        <>
          <path d="M4 7h16M4 12h16M4 17h16" />
          <circle cx="9" cy="7" r="2" fill="currentColor" stroke="none" />
          <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
          <circle cx="8" cy="17" r="2" fill="currentColor" stroke="none" />
        </>
      }
    />
  ),
  audit: <I d={<><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>} />,
  gear: (
    <I
      d={
        <>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1l2.1-2.1M17 7l2.1-2.1" />
        </>
      }
    />
  ),
};
