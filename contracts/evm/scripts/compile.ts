import solc from "solc";
import fs from "fs";
import path from "path";

function compile() {
  const contractsDir = path.resolve(process.cwd(), "evm/contracts");
  const musdSource = fs.readFileSync(
    path.join(contractsDir, "mUSD.sol"),
    "utf-8",
  );
  const vaultSource = fs.readFileSync(
    path.join(contractsDir, "Vault.sol"),
    "utf-8",
  );
  const ilzSource = fs.readFileSync(
    path.join(contractsDir, "ILayerZeroReceiver.sol"),
    "utf-8",
  );
  const dispatcherSource = fs.readFileSync(
    path.join(contractsDir, "BedrockLayerZeroDispatcher.sol"),
    "utf-8",
  );
  const receiverSource = fs.readFileSync(
    path.join(contractsDir, "BedrockLayerZeroReceiver.sol"),
    "utf-8",
  );
  const ethLockSource = fs.readFileSync(
    path.join(contractsDir, "EthereumSepoliaCollateralLock.sol"),
    "utf-8",
  );
  const bridgeReceiverSource = fs.readFileSync(
    path.join(contractsDir, "BaseSepoliaBridgeReceiver.sol"),
    "utf-8",
  );

  const input = {
    language: "Solidity",
    sources: {
      "mUSD.sol": { content: musdSource },
      "Vault.sol": { content: vaultSource },
      "ILayerZeroReceiver.sol": { content: ilzSource },
      "BedrockLayerZeroDispatcher.sol": { content: dispatcherSource },
      "BedrockLayerZeroReceiver.sol": { content: receiverSource },
      "EthereumSepoliaCollateralLock.sol": { content: ethLockSource },
      "BaseSepoliaBridgeReceiver.sol": { content: bridgeReceiverSource },
    },
    settings: {
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode"],
        },
      },
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  };

  console.log("Compiling all contracts using solc 0.8.28...");
  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    let hasError = false;
    for (const error of output.errors) {
      console.log(error.formattedMessage || error.message);
      if (error.severity === "error") hasError = true;
    }
    if (hasError) throw new Error("Compilation failed");
  }

  const buildDir = path.resolve(process.cwd(), "evm/build");
  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });

  const musdContract = output.contracts["mUSD.sol"]["mUSD"];
  const vaultContract = output.contracts["Vault.sol"]["Vault"];
  const dispatcherContract =
    output.contracts["BedrockLayerZeroDispatcher.sol"][
      "BedrockLayerZeroDispatcher"
    ];
  const receiverContract =
    output.contracts["BedrockLayerZeroReceiver.sol"][
      "BedrockLayerZeroReceiver"
    ];
  const ethLockContract =
    output.contracts["EthereumSepoliaCollateralLock.sol"][
      "EthereumSepoliaCollateralLock"
    ];
  const bridgeReceiverContract =
    output.contracts["BaseSepoliaBridgeReceiver.sol"][
      "BaseSepoliaBridgeReceiver"
    ];

  const artifacts = {
    mUSD: {
      abi: musdContract.abi,
      bytecode: "0x" + musdContract.evm.bytecode.object,
    },
    Vault: {
      abi: vaultContract.abi,
      bytecode: "0x" + vaultContract.evm.bytecode.object,
    },
    BedrockLayerZeroDispatcher: {
      abi: dispatcherContract.abi,
      bytecode: "0x" + dispatcherContract.evm.bytecode.object,
    },
    BedrockLayerZeroReceiver: {
      abi: receiverContract.abi,
      bytecode: "0x" + receiverContract.evm.bytecode.object,
    },
    EthereumSepoliaCollateralLock: {
      abi: ethLockContract.abi,
      bytecode: "0x" + ethLockContract.evm.bytecode.object,
    },
    BaseSepoliaBridgeReceiver: {
      abi: bridgeReceiverContract.abi,
      bytecode: "0x" + bridgeReceiverContract.evm.bytecode.object,
    },
  };

  fs.writeFileSync(
    path.join(buildDir, "artifacts.json"),
    JSON.stringify(artifacts, null, 2),
    "utf-8",
  );
  console.log(
    "Successfully compiled! All artifacts saved to evm/build/artifacts.json",
  );
}

compile();
