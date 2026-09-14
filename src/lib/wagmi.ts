import { createConfig, http, fallback } from "wagmi";
import { baseSepolia, sepolia } from "wagmi/chains";
import { getDefaultConfig } from "connectkit";

export const wagmiConfig = createConfig(
  getDefaultConfig({
    chains: [baseSepolia, sepolia],
    transports: {
      [baseSepolia.id]: fallback([
        http("https://sepolia.base.org"),
        http("https://base-sepolia-rpc.publicnode.com"),
        http("https://base-sepolia.gateway.tenderly.co"),
        http("https://base-sepolia.blockpi.network/v1/rpc/public"),
      ]),
      [sepolia.id]: fallback([
        http("https://ethereum-sepolia-rpc.publicnode.com"),
        http("https://rpc.sepolia.org"),
      ]),
    },
    walletConnectProjectId:
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
      "3fcc6bba6f1de962d911bb5b5c3dba68",
    appName: "Meridian",
    appDescription: "Money that gets smarter when the market gets riskier.",
    appUrl: "https://meridian.fi",
    appIcon: "https://meridian.fi/meridian-logo.png",
  }),
);
