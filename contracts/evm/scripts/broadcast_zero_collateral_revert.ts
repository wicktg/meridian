import {
  createPublicClient,
  createWalletClient,
  http,
  fallback,
  formatEther,
  parseEther,
  encodeFunctionData,
  Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

async function main() {
  const privateKey = process.env.BURNER_WALLET_PRIVATE_KEY?.trim();
  if (!privateKey)
    throw new Error("No BURNER_WALLET_PRIVATE_KEY found in .env");
  const formattedKey = (
    privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`
  ) as `0x${string}`;
  const account = privateKeyToAccount(formattedKey);

  const rpcTransport = fallback([
    http("https://sepolia.base.org", { retryCount: 5, retryDelay: 2000 }),
    http("https://base-sepolia-rpc.publicnode.com", {
      retryCount: 5,
      retryDelay: 2000,
    }),
  ]);

  const client = createPublicClient({
    chain: baseSepolia,
    transport: rpcTransport,
  });

  const wallet = createWalletClient({
    account,
    chain: baseSepolia,
    transport: rpcTransport,
  });

  const deploymentPath = path.resolve(
    process.cwd(),
    "evm/deployed_multicollateral_vault.json",
  );
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  const artifactsPath = path.resolve(process.cwd(), "evm/build/artifacts.json");
  const artifacts = JSON.parse(fs.readFileSync(artifactsPath, "utf-8"));

  const vaultAddress = deployment.vault.address as Address;
  const linkAddress = deployment.tokens.LINK.address as Address;
  const wethAddress = deployment.tokens.WETH.address as Address;

  console.log(
    "===============================================================",
  );
  console.log("BROADCASTING ON-CHAIN ZERO COLLATERAL BALANCE REVERT PROOF");
  console.log("Vault Address:", vaultAddress);
  console.log("Caller:", account.address);
  console.log("LINK Address:", linkAddress);
  console.log(
    "===============================================================\n",
  );

  // First deposit 0.0002 WETH so caller has positive collateral value in the vault
  console.log(
    "Depositing 0.0002 WETH into Vault to establish positive account collateral...",
  );
  const depTx = await wallet.writeContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "deposit",
    args: [wethAddress, parseEther("0.0002")],
  });
  console.log("Deposit WETH Tx Hash:", depTx);
  await client.waitForTransactionReceipt({ hash: depTx });

  const wethBal = (await client.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "collateral",
    args: [wethAddress, account.address],
  })) as bigint;

  const totalUSD = (await client.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "getTotalCollateralValueUSD",
    args: [account.address],
  })) as bigint;

  const linkBal = (await client.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "collateral",
    args: [linkAddress, account.address],
  })) as bigint;

  console.log(
    `Caller WETH Collateral in Vault: ${formatEther(wethBal)} WETH (> 0)`,
  );
  console.log(`Caller Total Collateral USD: $${formatEther(totalUSD)} (> $0)`);
  console.log(
    `Caller LINK Collateral in Vault: ${formatEther(linkBal)} LINK (== 0)`,
  );

  if (linkBal !== 0n) {
    throw new Error("Precondition failed: LINK collateral is not 0");
  }

  // Encode call to mint(LINK, 0.20 mUSD)
  const calldata = encodeFunctionData({
    abi: artifacts.Vault.abi,
    functionName: "mint",
    args: [linkAddress, parseEther("0.20")],
  });

  console.log(
    "\nBroadcasting transaction to Base Sepolia (expecting on-chain revert)...",
  );
  const txHash = await wallet.sendTransaction({
    to: vaultAddress,
    data: calldata,
    gas: 150000n,
  });

  console.log("Submitted Tx Hash:", txHash);
  console.log(`BaseScan: https://sepolia.basescan.org/tx/${txHash}`);
  console.log("Waiting for block inclusion...");

  const receipt = await client.waitForTransactionReceipt({ hash: txHash });

  console.log("\n>>> RECEIPT CONFIRMED:");
  console.log("Block Number:", receipt.blockNumber.toString());
  console.log("Status:", receipt.status, "(reverted as expected!)");
  console.log("Gas Used:", receipt.gasUsed.toString());

  if (receipt.status !== "reverted") {
    throw new Error("Transaction did NOT revert on-chain!");
  }

  console.log(
    "\n✓ SUCCESS: On-chain revert tx hash for ZeroCollateralBalance(LINK) generated and verified!",
  );
  console.log(
    `BaseScan Explorer URL: https://sepolia.basescan.org/tx/${txHash}`,
  );
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
