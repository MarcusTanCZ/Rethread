// The Rethread mark: a thread looping back through a node. Inline SVG, inherits currentColor.
export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M4 17c0-5 3-9 8-9s8 4 8 9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M8 17c0-2.8 1.8-5 4-5s4 2.2 4 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.55" />
      <circle cx="12" cy="17" r="2.2" fill="currentColor" />
    </svg>
  );
}
