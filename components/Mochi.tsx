type Props = { size?: number; think?: boolean; bump?: number };

// Hand-drawn SVG mascot: consistent ink outline, blinks, floats, hops on `bump` change.
export default function Mochi({ size = 40, think = false, bump = 0 }: Props) {
  const ink = "var(--ink)";
  return (
    <svg className={`mochi${think ? " think" : ""}`} width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <ellipse cx="24" cy="45" rx="13" ry="2" fill={ink} opacity=".12" />
      <g key={bump} className="hop">
        <g className="float">
          <ellipse cx="16" cy="10" rx="4.4" ry="9" transform="rotate(-12 16 10)" fill="var(--lav)" stroke={ink} strokeWidth="1.6" />
          <ellipse cx="32" cy="10" rx="4.4" ry="9" transform="rotate(12 32 10)" fill="var(--lav)" stroke={ink} strokeWidth="1.6" />
          <path d="M8 29c0-9 7-15 16-15s16 6 16 15c0 8-6 14-16 14S8 37 8 29z" fill="#fbf6ff" stroke={ink} strokeWidth="1.6" />
          <ellipse className="eye" cx="18" cy="28" rx="1.9" ry="2.5" fill={ink} />
          <ellipse className="eye" cx="30" cy="28" rx="1.9" ry="2.5" fill={ink} />
          <circle cx="13.5" cy="33" r="2.6" fill="var(--pink)" opacity=".8" />
          <circle cx="34.5" cy="33" r="2.6" fill="var(--pink)" opacity=".8" />
          <path d="M22 32.5c1 1.4 3 1.4 4 0" fill="none" stroke={ink} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}
