"use client";

import { useId } from "react";

type LogoVariant = "badge" | "full";

type LogoProps = {
  className?: string;
  /** "badge" = M-in-ring + ball only. "full" = badge + stacked wordmark. */
  variant?: LogoVariant;
  /** Show the curved "MOBILEMULLIGANS.NET" along the bottom of the badge. */
  showUrl?: boolean;
  /** Use light-on-dark coloring so the mark stays legible on dark teal. */
  onDark?: boolean;
  /** Accessible label. */
  title?: string;
};

const PALETTE = {
  cream: "#F4E8D5",
  gold: "#A78B63",
  sage: "#4C7B72",
  darkTeal: "#1F3A3B",
};

/**
 * Mobile Mulligans brand mark.
 *
 * A stylized capital "M" inside an open ring: the left stroke and middle "V"
 * are solid dark teal, while the right leg is replaced by a gold golf club
 * (shaft + iron head). A cream golf ball rests at the base on a sage ground
 * line. The "full" variant adds the stacked MOBILE / MULLIGANS wordmark and a
 * "MOBILE GOLF SIMULATOR" subtitle; `showUrl` adds the curved web address.
 */
export function Logo({
  className,
  variant = "badge",
  showUrl = false,
  onDark = false,
  title = "Mobile Mulligans",
}: LogoProps) {
  const rawId = useId();
  const arcId = `mm-arc-${rawId.replace(/:/g, "")}`;

  const ink = onDark ? PALETTE.cream : PALETTE.darkTeal;
  const ring = PALETTE.gold;
  const gold = PALETTE.gold;
  const ball = PALETTE.cream;
  const dimple = onDark ? "#1F3A3B" : "#1F3A3B";

  const badge = (
    <g>
      {/* Outer + subtle inner ring */}
      <circle cx="60" cy="60" r="54" fill="none" stroke={ring} strokeWidth="2" />
      <circle
        cx="60"
        cy="60"
        r="48.5"
        fill="none"
        stroke={ink}
        strokeWidth="0.75"
        opacity="0.3"
      />

      {/* Ground line + ball shadow */}
      <line
        x1="46"
        y1="86"
        x2="92"
        y2="86"
        stroke={PALETTE.sage}
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity={onDark ? "0.7" : "0.55"}
      />
      <ellipse cx="62" cy="86.3" rx="9" ry="1.7" fill={PALETTE.sage} opacity="0.3" />

      {/* M — left leg + middle V (dark teal) */}
      <polyline
        points="35,82 35,40 59,66 83,40"
        fill="none"
        stroke={ink}
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Right leg = gold golf club (shaft + iron head) */}
      <line
        x1="83"
        y1="40"
        x2="83"
        y2="70"
        stroke={gold}
        strokeWidth="7.5"
        strokeLinecap="round"
      />
      <path
        d="M79 69 C82 68 85 69 87 72 L91 82 Q92 86 88 86 L76 86 Q73 86 74 83 Z"
        fill={gold}
      />

      {/* Golf ball */}
      <circle
        cx="62"
        cy="79"
        r="7"
        fill={ball}
        stroke="rgba(31,58,59,0.2)"
        strokeWidth="0.6"
      />
      <g fill={dimple} opacity="0.2">
        <circle cx="60" cy="77" r="0.8" />
        <circle cx="63.6" cy="77" r="0.8" />
        <circle cx="61.8" cy="80" r="0.8" />
        <circle cx="64.9" cy="80" r="0.8" />
        <circle cx="60" cy="81.4" r="0.8" />
      </g>

      {showUrl && (
        <>
          <defs>
            <path id={arcId} d="M16 60 A 44 44 0 0 0 104 60" fill="none" />
          </defs>
          <text
            fill={ink}
            fontSize="7"
            fontFamily="var(--font-inter), Arial, sans-serif"
            fontWeight="600"
            letterSpacing="1.4"
          >
            <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
              MOBILEMULLIGANS.NET
            </textPath>
          </text>
          <circle cx="26" cy="96" r="1.3" fill={gold} />
          <circle cx="94" cy="96" r="1.3" fill={gold} />
        </>
      )}
    </g>
  );

  if (variant === "badge") {
    return (
      <svg
        className={className}
        viewBox="0 0 120 120"
        role="img"
        aria-label={title}
        xmlns="http://www.w3.org/2000/svg"
      >
        {badge}
      </svg>
    );
  }

  return (
    <svg
      className={className}
      viewBox="0 0 120 192"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      {badge}
      <g
        fontFamily="var(--font-inter), Arial, sans-serif"
        textAnchor="middle"
      >
        <text x="60" y="145" fontSize="16.5" fontWeight="700" letterSpacing="6.5" fill={ink}>
          MOBILE
        </text>
        <text x="60" y="164" fontSize="16.5" fontWeight="700" letterSpacing="2.4" fill={gold}>
          MULLIGANS
        </text>
        <line x1="8" y1="177.5" x2="22" y2="177.5" stroke={gold} strokeWidth="0.8" />
        <line x1="98" y1="177.5" x2="112" y2="177.5" stroke={gold} strokeWidth="0.8" />
        <text
          x="60"
          y="180"
          fontSize="5"
          fontWeight="500"
          letterSpacing="1"
          fill={ink}
          opacity="0.85"
        >
          MOBILE GOLF SIMULATOR
        </text>
      </g>
    </svg>
  );
}
