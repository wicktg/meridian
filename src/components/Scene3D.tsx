import React from "react";

/**
 * 3D Cylinder / Column (Bottom Left)
 */
export function CyanCylinder({ className = "" }: { className?: string }) {
  return (
    <div className={`relative pointer-events-none select-none ${className}`}>
      <svg
        viewBox="0 0 110 240"
        width="100%"
        height="100%"
        className="overflow-visible"
      >
        <defs>
          {/* Top Ellipse Gradient */}
          <linearGradient
            id="cylinder-top-grad"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#00e5ff" />
            <stop offset="45%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>

          {/* Body Vertical Gradient */}
          <linearGradient
            id="cylinder-body-grad"
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="18%" stopColor="#1e3a8a" />
            <stop offset="45%" stopColor="#1c1638" />
            <stop offset="100%" stopColor="#120c24" />
          </linearGradient>

          {/* Ambient rim light on left body */}
          <linearGradient
            id="cylinder-rim-grad"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.45" />
            <stop offset="25%" stopColor="#00e5ff" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Cylinder Body */}
        <path
          d="M 12 30 L 12 240 L 98 240 L 98 30 Z"
          fill="url(#cylinder-body-grad)"
        />

        {/* Ambient Rim Highlight on Body */}
        <path
          d="M 12 30 L 12 240 L 98 240 L 98 30 Z"
          fill="url(#cylinder-rim-grad)"
        />

        {/* Cylinder Top Ellipse */}
        <ellipse
          cx="55"
          cy="30"
          rx="43"
          ry="25"
          fill="url(#cylinder-top-grad)"
          stroke="#0f172a"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}

/**
 * 3D NAI Coin (Center Hero)
 */
export function NaiCoin({
  size = 56,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative select-none ${className}`}
    >
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        className="overflow-visible"
      >
        <defs>
          {/* Coin Front Face Gradient */}
          <linearGradient
            id="coin-face-grad"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#a45ae6" />
            <stop offset="45%" stopColor="#d377bf" />
            <stop offset="85%" stopColor="#f3b89e" />
            <stop offset="100%" stopColor="#fadcb7" />
          </linearGradient>

          {/* Coin 3D Edge Gradient */}
          <linearGradient id="coin-edge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#5d3eb5" />
            <stop offset="50%" stopColor="#8d56c4" />
            <stop offset="100%" stopColor="#c382bf" />
          </linearGradient>
        </defs>

        {/* 3D Reeding Edge / Rim on Right */}
        <g opacity="0.95">
          {/* Base 3D rim offset */}
          <ellipse
            cx="36"
            cy="32"
            rx="24"
            ry="24"
            fill="url(#coin-edge-grad)"
          />
        </g>

        {/* Front Coin Face */}
        <circle
          cx="30"
          cy="32"
          r="24"
          fill="url(#coin-face-grad)"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="0.8"
        />

        {/* Center Meridian Logo on Coin */}
        <image
          href="/meridian-logo.png"
          x="18"
          y="27"
          width="24"
          height="10"
          preserveAspectRatio="xMidYMid meet"
        />
      </svg>
    </div>
  );
}
