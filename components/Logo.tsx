type LogoProps = {
  className?: string;
  /** Color used for the monogram + ring. Defaults to gold. */
  accent?: string;
  /** Background circle color. */
  background?: string;
};

/**
 * Mobile Mulligans circular monogram: dark teal disc, gold ring, golf
 * ball + club accents, "MM" monogram. Replaceable placeholder brand mark.
 */
export function Logo({
  className,
  accent = "#A78B63",
  background = "#1F3A3B",
}: LogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      role="img"
      aria-label="Mobile Mulligans"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="60" cy="60" r="58" fill={background} />
      <circle cx="60" cy="60" r="52" fill="none" stroke={accent} strokeWidth="2.5" />
      <circle cx="60" cy="60" r="46" fill="none" stroke="#4C7B72" strokeWidth="1" opacity="0.5" />
      <circle cx="84" cy="38" r="9" fill="#F4E8D5" />
      <g fill={background} opacity="0.35">
        <circle cx="81" cy="35" r="1" />
        <circle cx="85" cy="35" r="1" />
        <circle cx="83" cy="39" r="1" />
        <circle cx="87" cy="39" r="1" />
        <circle cx="84" cy="42.5" r="1" />
      </g>
      <line x1="84" y1="47" x2="60" y2="86" stroke={accent} strokeWidth="3" strokeLinecap="round" />
      <path d="M54 84 q-6 4 -2 9 q5 3 10 -1 z" fill={accent} />
      <text
        x="60"
        y="68"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="34"
        fontWeight="700"
        fill={accent}
        letterSpacing="-2"
      >
        MM
      </text>
    </svg>
  );
}
