export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#2f5fd0" />
      <rect x="6" y="8" width="20" height="5" rx="1.5" fill="#fdf3c9" />
      <rect x="6" y="15" width="6" height="3.5" rx="1" fill="#fff" />
      <rect x="13" y="15" width="6" height="3.5" rx="1" fill="#fff" opacity=".7" />
      <rect x="20" y="15" width="6" height="3.5" rx="1" fill="#fff" />
      <rect x="6" y="20.5" width="6" height="3.5" rx="1" fill="#fff" opacity=".7" />
      <rect x="13" y="20.5" width="6" height="3.5" rx="1" fill="#fff" />
      <rect x="20" y="20.5" width="6" height="3.5" rx="1" fill="#fff" opacity=".7" />
    </svg>
  );
}
