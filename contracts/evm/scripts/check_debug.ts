import { createPublicClient, http, fallback, formatEther } from "viem";
import { baseSepolia } from "viem/chains";
import * as fs from "fs";
import * as path from "path";

const artifacts = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "evm/build/artifacts.json"), "utf8"),
);
const client = createPublicClient({
  chain: baseSepolia,
  transport: fallback([
    http("https://sepolia.base.org", { retryCount: 5, retryDelay: 2000 }),
    http("https://base-sepolia-rpc.publicnode.com", {
      retryCount: 5,
      retryDelay: 2000,
    }),
  ]),
});
const vault = "0xc3f13ce0446e61ec1888e7bb7e9858d21aa7dd78";
const user = "0xe4d9E11a2D4824CD49DCA396eD01f20FEDE6065E";

async function main() {
  const debt = (await client.readContract({
    address: vault,
    abi: artifacts.Vault.abi,
    functionName: "debt",
    args: [user],
  })) as bigint;
  const lastTime = (await client.readContract({
    address: vault,
    abi: artifacts.Vault.abi,
    functionName: "lastAccrualTimestamp",
    args: [user],
  })) as bigint;
  const feeBps = (await client.readContract({
    address: vault,
    abi: artifacts.Vault.abi,
    functionName: "currentStabilityFeeBps",
  })) as bigint;
  console.log("debt:", debt.toString());
  console.log("lastAccrualTimestamp:", lastTime.toString());
  console.log("feeBps:", feeBps.toString());

  const musd = "0x22c7832ae38ebeb7003fa66b5184fc3361f3c2d1";
  const liquidator = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc";
  const borrowerEth = await client.getBalance({ address: user });
  const liquidatorEth = await client.getBalance({ address: liquidator });
  const borrowerMusd = await client.readContract({
    address: musd,
    abi: artifacts.mUSD.abi,
    functionName: "balanceOf",
    args: [user],
  });
  const liquidatorMusd = await client.readContract({
    address: musd,
    abi: artifacts.mUSD.abi,
    functionName: "balanceOf",
    args: [liquidator],
  });
  console.log("Borrower ETH:", formatEther(borrowerEth));
  console.log("Liquidator ETH:", formatEther(liquidatorEth));
  const weth = "0x4200000000000000000000000000000000000006";
  const erc20Abi = [
    {
      type: "function",
      name: "balanceOf",
      inputs: [{ type: "address", name: "account" }],
      outputs: [{ type: "uint256" }],
      stateMutability: "view",
    },
  ] as const;
  const wethInWallet = await client.readContract({
    address: weth,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [user],
  });
  const colWeth = await client.readContract({
    address: vault,
    abi: artifacts.Vault.abi,
    functionName: "collateral",
    args: [weth, user],
  });
  const totalValUSD = await client.readContract({
    address: vault,
    abi: artifacts.Vault.abi,
    functionName: "getTotalCollateralValueUSD",
    args: [user],
  });
  const vaultWeth = await client.readContract({
    address: weth,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [vault],
  });
  console.log("Vault Contract WETH Balance:", formatEther(vaultWeth));
  console.log("Borrower WETH in Wallet:", formatEther(wethInWallet));
  console.log("Borrower Collateral WETH:", formatEther(colWeth as bigint));
  console.log("Total Collateral USD:", formatEther(totalValUSD as bigint));
}
main().catch(console.error);
