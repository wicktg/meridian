"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { formatEther } from "viem";
import { basePublicClient } from "@/lib/vaultClient";
import { useAccount, useDisconnect, useSwitchChain, useChainId } from "wagmi";
import { useModal } from "connectkit";

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const ETHEREUM_SEPOLIA_CHAIN_ID = 11155111;
export const DEFAULT_VIEW_ADDRESS =
  "0xe4d9E11a2D4824CD49DCA396eD01f20FEDE6065E" as const;
export const MUSD_ADDRESS =
  "0x22c7832ae38ebeb7003fa66b5184fc3361f3c2d1" as const;

export const MUSD_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export interface Web3ContextType {
  account: `0x${string}` | null;
  effectiveAddress: `0x${string}`;
  chainId: number | null;
  isCorrectNetwork: boolean;
  isConnecting: boolean;
  musdBalance: string;
  musdBalanceNum: number;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  switchNetwork: (targetChainId?: number) => Promise<void>;
  ensureNetwork: (
    targetChainId?: number,
    onNotify?: (msg: string) => void,
  ) => Promise<boolean>;
  getWalletProvider: () => Promise<any>;
  refreshMusdBalance: () => Promise<void>;
}

const Web3Context = createContext<Web3ContextType>({
  account: null,
  effectiveAddress: DEFAULT_VIEW_ADDRESS,
  chainId: BASE_SEPOLIA_CHAIN_ID,
  isCorrectNetwork: true,
  isConnecting: false,
  musdBalance: "0.00",
  musdBalanceNum: 0,
  connect: async () => false,
  disconnect: () => {},
  switchNetwork: async () => {},
  ensureNetwork: async () => true,
  getWalletProvider: async () => null,
  refreshMusdBalance: async () => {},
});

export function Web3Provider({ children }: { children: ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  const { address, isConnected, isConnecting: wagmiConnecting, connector } = useAccount();
  const currentChainId = useChainId();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { setOpen } = useModal();

  const [musdBalance, setMusdBalance] = useState<string>("0.00");
  const [musdBalanceNum, setMusdBalanceNum] = useState<number>(0);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const account = (isMounted && isConnected && address ? address : null) as
    | `0x${string}`
    | null;
  const effectiveAddress = account || DEFAULT_VIEW_ADDRESS;
  const chainId = currentChainId || null;
  const isCorrectNetwork =
    chainId === BASE_SEPOLIA_CHAIN_ID || chainId === ETHEREUM_SEPOLIA_CHAIN_ID;

  const fetchMusdBalance = useCallback(async (targetAccount: `0x${string}`) => {
    try {
      const balRaw = await basePublicClient.readContract({
        address: MUSD_ADDRESS,
        abi: MUSD_ABI,
        functionName: "balanceOf",
        args: [targetAccount],
      });
      const balEther = formatEther(balRaw);
      const balNum = parseFloat(balEther);
      setMusdBalance(balNum.toFixed(2));
      setMusdBalanceNum(balNum);
    } catch {
      // Fallback gracefully retaining existing balance
    }
  }, []);

  const refreshMusdBalance = useCallback(async () => {
    await fetchMusdBalance(effectiveAddress);
  }, [fetchMusdBalance, effectiveAddress]);

  useEffect(() => {
    fetchMusdBalance(effectiveAddress);
    const timer = setInterval(() => fetchMusdBalance(effectiveAddress), 4000);
    return () => clearInterval(timer);
  }, [effectiveAddress, fetchMusdBalance]);

  // Connect wallet handler: opens standard ConnectKit modal
  const connect = useCallback(async (): Promise<boolean> => {
    setOpen(true);
    return true;
  }, [setOpen]);

  // Disconnect handler: calls Wagmi disconnect
  const disconnect = useCallback(() => {
    wagmiDisconnect();
  }, [wagmiDisconnect]);

  // Retrieves the active wallet provider specifically chosen by the user in ConnectKit
  const getWalletProvider = useCallback(async () => {
    if (connector) {
      try {
        const p = await connector.getProvider();
        if (p) return p;
      } catch {
        // Fallback to window.ethereum if connector fails
      }
    }
    return typeof window !== "undefined"
      ? (window as unknown as { ethereum?: unknown }).ethereum
      : null;
  }, [connector]);

  // Switch network handler: calls Wagmi switchChain
  const switchNetwork = useCallback(
    async (targetChainId: number = BASE_SEPOLIA_CHAIN_ID) => {
      try {
        if (switchChainAsync) {
          await switchChainAsync({ chainId: targetChainId });
        }
      } catch (err) {
        console.warn("Switch chain failed:", err);
      }
    },
    [switchChainAsync],
  );

  // Auto-switch network with real-time user notification and wallet add-chain fallback
  const ensureNetwork = useCallback(
    async (
      targetChainId: number = BASE_SEPOLIA_CHAIN_ID,
      onNotify?: (msg: string) => void,
    ): Promise<boolean> => {
      const chainName =
        targetChainId === BASE_SEPOLIA_CHAIN_ID
          ? "Base Sepolia"
          : "Ethereum Sepolia";

      if (currentChainId === targetChainId) {
        return true;
      }

      if (onNotify) {
        onNotify(`Switching network to ${chainName}...`);
      }

      // 1. Try Wagmi switchChainAsync
      if (switchChainAsync) {
        try {
          await switchChainAsync({ chainId: targetChainId });
          if (onNotify) {
            onNotify(`Network switched to ${chainName}!`);
          }
          return true;
        } catch {
          // Fall through to direct provider call
        }
      }

      // 2. Direct provider call
      const provider = await getWalletProvider();
      if (
        !provider ||
        typeof (provider as { request?: unknown }).request !== "function"
      ) {
        if (onNotify) {
          onNotify(`Please switch your wallet network to ${chainName}.`);
        }
        return false;
      }

      const eth = provider as {
        request: (args: { method: string; params?: any[] }) => Promise<any>;
      };
      const targetHex = "0x" + targetChainId.toString(16);

      try {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: targetHex }],
        });
        if (onNotify) {
          onNotify(`Network switched to ${chainName}!`);
        }
        return true;
      } catch (switchError: any) {
        if (
          switchError.code === 4902 ||
          switchError.data?.originalError?.code === 4902
        ) {
          try {
            if (targetChainId === BASE_SEPOLIA_CHAIN_ID) {
              await eth.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: targetHex,
                    chainName: "Base Sepolia",
                    nativeCurrency: {
                      name: "Ether",
                      symbol: "ETH",
                      decimals: 18,
                    },
                    rpcUrls: ["https://sepolia.base.org"],
                    blockExplorerUrls: ["https://sepolia.basescan.org"],
                  },
                ],
              });
            } else {
              await eth.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: targetHex,
                    chainName: "Ethereum Sepolia",
                    nativeCurrency: {
                      name: "Sepolia Ether",
                      symbol: "ETH",
                      decimals: 18,
                    },
                    rpcUrls: ["https://rpc.sepolia.org"],
                    blockExplorerUrls: ["https://sepolia.etherscan.io"],
                  },
                ],
              });
            }
            if (onNotify) {
              onNotify(`Network switched to ${chainName}!`);
            }
            return true;
          } catch {
            throw new Error(`Failed to add ${chainName} to wallet.`);
          }
        }
        throw new Error(
          `Please approve network switch to ${chainName} in your wallet.`,
        );
      }
    },
    [currentChainId, switchChainAsync, getWalletProvider],
  );

  return (
    <Web3Context.Provider
      value={{
        account,
        effectiveAddress,
        chainId,
        isCorrectNetwork,
        isConnecting: wagmiConnecting,
        musdBalance,
        musdBalanceNum,
        connect,
        disconnect,
        switchNetwork,
        ensureNetwork,
        getWalletProvider,
        refreshMusdBalance,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  return useContext(Web3Context);
}
