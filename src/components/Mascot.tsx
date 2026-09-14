import React from "react";

interface MascotProps {
  size?: number;
  className?: string;
  withGroundLine?: boolean;
}

export default function Mascot({
  size = 40,
  className = "",
  withGroundLine = false,
}: MascotProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 70 70"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`overflow-visible select-none ${className}`}
    >
      {/* Left arm - curved upward/waving */}
      <path
        d="M 22 25 C 16 22, 14 16, 15 11"
        stroke="#000000"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Right arm - angled down */}
      <path
        d="M 48 28 L 57 34"
        stroke="#000000"
        strokeWidth="2.8"
        strokeLinecap="round"
      />

      {/* Left running leg (stepping forward) */}
      <path
        d="M 31 43 L 23 54 L 18 53"
        stroke="#000000"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Right running leg (bent back) */}
      <path
        d="M 36 43 L 42 50 L 38 52"
        stroke="#000000"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Head / Body circle */}
      <circle
        cx="35"
        cy="27"
        r="17"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="2.8"
      />

      {/* Face diagonal slash */}
      <line
        x1="29"
        y1="21"
        x2="41"
        y2="33"
        stroke="#000000"
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* Ground line under feet */}
      {withGroundLine && (
        <line
          x1="24"
          y1="62"
          x2="44"
          y2="62"
          stroke="#000000"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
