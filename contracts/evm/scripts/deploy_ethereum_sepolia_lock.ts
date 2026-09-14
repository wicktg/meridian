import {
  createPublicClient,
  createWalletClient,
  http,
  fallback,
  formatEther,
  parseUnits,
  Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

async function main() {
  const privateKey = process.env.BURNER_WALLET_PRIVATE_KEY?.trim();
  if (!privateKey)
    throw new Error("No BURNER_WALLET_PRIVATE_KEY found in .env");
  const formattedKey = (
    privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`
  ) as `0x${string}`;

  const account = privateKeyToAccount(formattedKey);
  console.log(
    "===============================================================",
  );
  console.log("Deploying Ethereum Sepolia Collateral Lock Contract");
  console.log("Deployer Address:", account.address);
  console.log(
    "===============================================================\n",
  );

  const transport = fallback([
    http("https://rpc.sepolia.org"),
    http("https://ethereum-sepolia-rpc.publicnode.com"),
    http("https://1rpc.io/sepolia"),
    http("https://sepolia.drpc.org"),
  ]);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport,
  });

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport,
  });

  const ethBalance = await publicClient.getBalance({
    address: account.address,
  });
  console.log(`Deployer Sepolia ETH Balance: ${formatEther(ethBalance)} ETH`);

  // Addresses on Ethereum Sepolia
  const LZ_ENDPOINT_SEPOLIA =
    "0x6EDCE65403992e310A62460808c4b910D972f10f" as Address;
  const BASE_SEPOLIA_EID = 40245;

  const DAI_SEPOLIA = "0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357" as Address;
  const DAI_FEED_SEPOLIA =
    "0x14866185B1962B63C3Ea9E03Bc1da838bab34C19" as Address;

  const STETH_SEPOLIA = "0x3e3FE7dBc6B4C189E7128855dD526361c49b40Af" as Address;
  const ETH_FEED_SEPOLIA =
    "0x694AA1769357215DE4FAC081bf1f309aDC325306" as Address;

  // Load build artifacts
  const artifactsPath = path.resolve(process.cwd(), "evm/build/artifacts.json");
  const artifacts = JSON.parse(fs.readFileSync(artifactsPath, "utf-8"));
  const lockArtifact = artifacts.EthereumSepoliaCollateralLock;

  console.log("Deploying EthereumSepoliaCollateralLock contract...");
  const deployTxHash = await walletClient.deployContract({
    abi: lockArtifact.abi,
    bytecode: lockArtifact.bytecode,
    args: [
      LZ_ENDPOINT_SEPOLIA,
      BASE_SEPOLIA_EID,
      DAI_SEPOLIA,
      DAI_FEED_SEPOLIA,
      STETH_SEPOLIA,
      ETH_FEED_SEPOLIA,
    ],
  });

  console.log("Deploy Tx Hash:", deployTxHash);
  console.log(`Etherscan: https://sepolia.etherscan.io/tx/${deployTxHash}`);
  console.log("Waiting for confirmation on Ethereum Sepolia...");

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: deployTxHash,
  });

  if (!receipt.contractAddress) {
    throw new Error(
      "Contract deployment failed — no contract address returned.",
    );
  }

  const lockAddress = receipt.contractAddress;
  console.log("EthereumSepoliaCollateralLock deployed to:", lockAddress);
  console.log(
    `Etherscan Contract: https://sepolia.etherscan.io/address/${lockAddress}\n`,
  );

  // Verify oracle prices
  const daiPrice = (await publicClient.readContract({
    address: lockAddress,
    abi: lockArtifact.abi,
    functionName: "getLatestPrice",
    args: [DAI_SEPOLIA],
  })) as bigint;

  const stEthPrice = (await publicClient.readContract({
    address: lockAddress,
    abi: lockArtifact.abi,
    functionName: "getLatestPrice",
    args: [STETH_SEPOLIA],
  })) as bigint;

  console.log(`Live DAI Price on Lock: $${Number(daiPrice) / 1e18} USD`);
  console.log(`Live stETH Price on Lock: $${Number(stEthPrice) / 1e18} USD\n`);

  // Approve DAI and stETH to Lock contract
  console.log("Approving DAI to Lock contract...");
  const daiApproveTx = await walletClient.writeContract({
    address: DAI_SEPOLIA,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [lockAddress, parseUnits("1000000", 18)],
  });
  console.log("DAI Approve Tx:", daiApproveTx);
  await publicClient.waitForTransactionReceipt({ hash: daiApproveTx });

  console.log("Approving stETH to Lock contract...");
  const stEthApproveTx = await walletClient.writeContract({
    address: STETH_SEPOLIA,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [lockAddress, parseUnits("1000000", 18)],
  });
  console.log("stETH Approve Tx:", stEthApproveTx);
  await publicClient.waitForTransactionReceipt({ hash: stEthApproveTx });

  const deploymentData = {
    network: "ethereum-sepolia",
    chainId: 11155111,
    deployer: account.address,
    lock: {
      address: lockAddress,
      deploymentTx: deployTxHash,
      explorerUrl: `https://sepolia.etherscan.io/address/${lockAddress}`,
      txExplorerUrl: `https://sepolia.etherscan.io/tx/${deployTxHash}`,
      blockNumber: Number(receipt.blockNumber),
    },
    tokens: {
      DAI: {
        address: DAI_SEPOLIA,
        feed: DAI_FEED_SEPOLIA,
        decimals: 18,
        approveTx: daiApproveTx,
      },
      stETH: {
        address: STETH_SEPOLIA,
        feed: ETH_FEED_SEPOLIA,
        decimals: 18,
        approveTx: stEthApproveTx,
      },
    },
    endpoint: LZ_ENDPOINT_SEPOLIA,
    baseEndpointEid: BASE_SEPOLIA_EID,
    deployedAt: new Date().toISOString(),
  };

  const outputPath = path.resolve(
    process.cwd(),
    "evm/deployed_ethereum_lock.json",
  );
  fs.writeFileSync(
    outputPath,
    JSON.stringify(deploymentData, null, 2),
    "utf-8",
  );
  console.log(`Deployment saved to ${outputPath}`);
}

main().catch((err) => {
  console.error("Error deploying Ethereum Sepolia Lock:", err);
  process.exit(1);
});
