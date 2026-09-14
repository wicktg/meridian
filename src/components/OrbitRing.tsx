import React from "react";
import CryptoBadge, { TokenType } from "./CryptoBadge";

interface TokenPosition {
  type: TokenType;
  top: string;
  left: string;
  size: number;
}

const tokens: TokenPosition[] = [
  {
    type: "wsteth",
    top: "8%",
    left: "22%",
    size: 48,
  },
  {
    type: "ethereum",
    top: "4%",
    left: "76%",
    size: 44,
  },
  {
    type: "link",
    top: "54%",
    left: "92%",
    size: 44,
  },
  {
    type: "dai",
    top: "88%",
    left: "78%",
    size: 46,
  },
  {
    type: "usdc",
    top: "92%",
    left: "40%",
    size: 44,
  },
  {
    type: "wbtc",
    top: "46%",
    left: "4%",
    size: 46,
  },
];

export default function OrbitRing({ className = "" }: { className?: string }) {
  return (
    <div
      className={`absolute inset-0 pointer-events-none select-none ${className}`}
      aria-hidden="true"
    >
      {/* SVG Elliptical Orbit Track - Clean stroke without glow or shadow */}
      <svg
        viewBox="0 0 700 600"
        className="w-full h-full absolute inset-0 overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="orbit-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.4)" />
            <stop offset="40%" stopColor="rgba(230, 200, 255, 0.3)" />
            <stop offset="70%" stopColor="rgba(255, 210, 180, 0.35)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0.45)" />
          </linearGradient>
        </defs>

        {/* Tilted Ellipse matching original perspective */}
        <g transform="translate(350, 300) rotate(-12) translate(-350, -300)">
          <ellipse
            cx="350"
            cy="300"
            rx="275"
            ry="235"
            stroke="url(#orbit-grad)"
            strokeWidth="1.6"
          />
        </g>
      </svg>

      {/* Orbit Tokens in Original Static Positions (No hover effects, no tooltips) */}
      <div className="absolute inset-0 w-full h-full pointer-events-none">
        {tokens.map((token) => (
          <div
            key={token.type}
            style={{
              position: "absolute",
              top: token.top,
              left: token.left,
              transform: "translate(-50%, -50%)",
            }}
            className="pointer-events-none"
          >
            <CryptoBadge type={token.type} size={token.size} />
          </div>
        ))}
      </div>
    </div>
  );
}
