export function PersonalAgentLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 120"
      width="120"
      height="120"
      fill="none"
      className={className}
      aria-label="Personal Agent"
    >
      <rect
        x="12"
        y="12"
        width="96"
        height="96"
        rx="28"
        className="stroke-foreground"
        strokeWidth="8"
      />
      <circle cx="60" cy="60" r="18" className="fill-primary" />
    </svg>
  );
}
