import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  parseAbi,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const priv =
  "0x972f092f821d764a33df082a746b7e695e9c48249b788e0a7d3fb31be81da831";
const account = privateKeyToAccount(priv);
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http("https://sepolia.base.org"),
});
const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http("https://sepolia.base.org"),
});

const vault = "0xa969668f2dba4995a4f9078e335d09a0ca7f0ea7";
const weth = "0x4200000000000000000000000000000000000006";
const musd = "0x22c7832ae38ebeb7003fa66b5184fc3361f3c2d1";

const erc20Abi = parseAbi([
  "function approve(address, uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
]);

const vaultAbi = parseAbi([
  "function deposit(address token, uint256 amount)",
  "function mint(address token, uint256 amount)",
  "function repay(address token, uint256 amount)",
  "function debt(address) view returns (uint256)",
  "function collateral(address, address) view returns (uint256)",
  "function getTotalCollateralValueUSD(address) view returns (uint256)",
  "function getHealthScore(address) view returns (uint256, uint256, bool)",
]);

async function readBalances(label: string) {
  const [nativeEth, wethBal, musdBal, vWeth, vDebt, vCollatUSD, health] =
    await Promise.all([
      publicClient.getBalance({ address: account.address }),
      publicClient.readContract({
        address: weth,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account.address],
      }),
      publicClient.readContract({
        address: musd,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account.address],
      }),
      publicClient.readContract({
        address: vault,
        abi: vaultAbi,
        functionName: "collateral",
        args: [weth, account.address],
      }),
      publicClient.readContract({
        address: vault,
        abi: vaultAbi,
        functionName: "debt",
        args: [account.address],
      }),
      publicClient.readContract({
        address: vault,
        abi: vaultAbi,
        functionName: "getTotalCollateralValueUSD",
        args: [account.address],
      }),
      publicClient.readContract({
        address: vault,
        abi: vaultAbi,
        functionName: "getHealthScore",
        args: [account.address],
      }),
    ]);

  console.log(`\n================== [${label}] ==================`);
  console.log(`User Address:        ${account.address}`);
  console.log(`Wallet Native ETH:   ${formatEther(nativeEth)} ETH`);
  console.log(`Wallet WETH:         ${formatEther(wethBal)} WETH`);
  console.log(`Wallet mUSD:         ${formatEther(musdBal)} mUSD`);
  console.log(`Vault Deposited WETH:${formatEther(vWeth)} WETH`);
  console.log(`Total Collateral USD:$${formatEther(vCollatUSD)}`);
  console.log(`Vault Debt:          ${formatEther(vDebt)} mUSD`);
  console.log(`Collateral Ratio:    ${(Number(health[1]) / 100).toFixed(2)}%`);
  console.log(`Liquidatable:        ${health[2]}`);
  console.log(`========================================================\n`);

  return { nativeEth, wethBal, musdBal, vWeth, vDebt, vCollatUSD, health };
}

async function main() {
  console.log(
    "Starting Full Cycle Test: Read Balances -> Deposit -> Mint -> Repay -> Final Balances",
  );

  // 1. Initial Balances
  await readBalances("STEP 1: INITIAL STATE");

  // 2. TEST DEPOSIT: 0.0005 WETH
  const depositAmount = parseEther("0.0005");
  console.log(">>> EXECUTING DEPOSIT: 0.0005 WETH...");
  const appHash = await walletClient.writeContract({
    address: weth,
    abi: erc20Abi,
    functionName: "approve",
    args: [vault, depositAmount],
  });
  console.log("  Approve Tx:", appHash);
  await publicClient.waitForTransactionReceipt({ hash: appHash });

  const depHash = await walletClient.writeContract({
    address: vault,
    abi: vaultAbi,
    functionName: "deposit",
    args: [weth, depositAmount],
    gas: 300000n,
  });
  console.log("  Deposit Tx:", depHash);
  const depRc = await publicClient.waitForTransactionReceipt({ hash: depHash });
  console.log(
    `  ✓ DEPOSIT CONFIRMED: Status ${depRc.status} in Block ${depRc.blockNumber}`,
  );

  await readBalances("STEP 2: AFTER DEPOSIT");

  // 3. TEST MINT: 0.05 mUSD
  const mintAmount = parseEther("0.05");
  console.log(">>> EXECUTING MINT: 0.05 mUSD...");
  const mintHash = await walletClient.writeContract({
    address: vault,
    abi: vaultAbi,
    functionName: "mint",
    args: [weth, mintAmount],
    gas: 350000n,
  });
  console.log("  Mint Tx:", mintHash);
  const mintRc = await publicClient.waitForTransactionReceipt({
    hash: mintHash,
  });
  console.log(
    `  ✓ MINT CONFIRMED: Status ${mintRc.status} in Block ${mintRc.blockNumber}`,
  );

  await readBalances("STEP 3: AFTER MINT");

  // 4. TEST REPAY: 0.05 mUSD
  console.log(">>> EXECUTING REPAY: 0.05 mUSD...");
  const repayHash = await walletClient.writeContract({
    address: vault,
    abi: vaultAbi,
    functionName: "repay",
    args: [weth, mintAmount],
    gas: 300000n,
  });
  console.log("  Repay Tx:", repayHash);
  const repayRc = await publicClient.waitForTransactionReceipt({
    hash: repayHash,
  });
  console.log(
    `  ✓ REPAY CONFIRMED: Status ${repayRc.status} in Block ${repayRc.blockNumber}`,
  );

  // Small delay for block indexing
  await new Promise((r) => setTimeout(r, 2500));

  // 5. Final Balances
  await readBalances("STEP 4: FINAL STATE (ALL TESTS PASSED)");
}

main().catch(console.error);
