import React from "react";

export type TokenType =
  | "ethereum"
  | "wsteth"
  | "wbtc"
  | "usdc"
  | "dai"
  | "link";

interface CryptoBadgeProps {
  type: TokenType;
  size?: number;
  className?: string;
}

export default function CryptoBadge({
  type,
  size = 48,
  className = "",
}: CryptoBadgeProps) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative rounded-full flex items-center justify-center select-none ${className}`}
    >
      {type === "ethereum" && (
        <svg
          viewBox="0 0 48 48"
          width={size}
          height={size}
          className="w-full h-full rounded-full"
        >
          {/* White circle background */}
          <circle
            cx="24"
            cy="24"
            r="23"
            fill="#ffffff"
            stroke="#e6e8ee"
            strokeWidth="1"
          />

          {/* Ethereum 3D faceted crystal */}
          <g transform="translate(15, 10)">
            {/* Top pyramid left */}
            <polygon points="9,0 0,14.5 9,18.5" fill="#3c3c3d" />
            {/* Top pyramid right */}
            <polygon points="9,0 9,18.5 18,14.5" fill="#1c1c1d" />
            {/* Top pyramid front facet */}
            <polygon points="9,11.5 0,14.5 9,18.5" fill="#505052" />

            {/* Bottom pyramid left */}
            <polygon points="9,21 0,16 9,28" fill="#3c3c3d" />
            {/* Bottom pyramid right */}
            <polygon points="9,21 9,28 18,16" fill="#1c1c1d" />
          </g>
        </svg>
      )}

      {type === "wsteth" && (
        <img
          src="/token_wsteth.png"
          alt="wstETH"
          width={size}
          height={size}
          className="w-full h-full rounded-full object-contain select-none"
        />
      )}

      {type === "wbtc" && (
        <img
          src="/token_wbtc.png"
          alt="WBTC"
          width={size}
          height={size}
          className="w-full h-full rounded-full object-contain select-none"
        />
      )}

      {type === "usdc" && (
        <img
          src="/token_usdc.png"
          alt="USDC"
          width={size}
          height={size}
          className="w-full h-full rounded-full object-contain select-none"
        />
      )}

      {type === "dai" && (
        <img
          src="/token_dai.png"
          alt="DAI"
          width={size}
          height={size}
          className="w-full h-full rounded-full object-contain select-none"
        />
      )}

      {type === "link" && (
        <img
          src="/token_link.png"
          alt="LINK"
          width={size}
          height={size}
          className="w-full h-full rounded-full object-contain select-none"
        />
      )}
    </div>
  );
}
