export function Emblem({
  size = 120,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`animate-rotate-slow ${className}`}
      aria-hidden="true"
    >
      <circle cx="60" cy="60" r="56" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 4" />
      <circle cx="60" cy="60" r="44" stroke="currentColor" strokeWidth="1" strokeDasharray="4 8" />
      <circle cx="60" cy="60" r="30" stroke="currentColor" strokeWidth="1.5" />
      <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <line x1="60" y1="16" x2="60" y2="28" />
        <line x1="60" y1="92" x2="60" y2="104" />
        <line x1="16" y1="60" x2="28" y2="60" />
        <line x1="92" y1="60" x2="104" y2="60" />
        <line x1="26" y1="26" x2="36" y2="36" />
        <line x1="84" y1="84" x2="94" y2="94" />
        <line x1="26" y1="94" x2="36" y2="84" />
        <line x1="84" y1="36" x2="94" y2="26" />
      </g>
      <circle cx="60" cy="60" r="18" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
      <path
        d="M60 48c0-6.6 5.4-12 12-12s12 5.4 12 12-5.4 12-12 12-12-5.4-12-12z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="60" cy="60" r="6" fill="currentColor" />
    </svg>
  );
}
