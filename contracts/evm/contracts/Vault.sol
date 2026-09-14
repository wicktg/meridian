// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
}

interface ImUSD {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

interface IBaseSepoliaBridgeReceiver {
    function dispatchUnlockMessage(address user, address token, uint256 amount) external returns (bytes32 guid);
}

/**
 * @title Vault (Multi-Collateral CDP with Bedrock AI Regime Wiring, Dynamic Stability Fees & Liquidation Engine)
 * @notice Supports WETH, USDC, LINK, and WBTC as native collateral, plus bridged collateral (DAI, stETH) locked on Ethereum Sepolia.
 *         Calculates blended collateral value in USD across all deposited tokens, enforces protocol-wide MCRs,
 *         accrues regime-modulated stability fees over time, and supports permissionless liquidation with a 10% penalty bonus.
 */
contract Vault {
    enum Regime {
        Stable,    // 0: Normal conditions, requiredCR = 150%, stability fee = 2% APY
        Unsettled, // 1: Elevated risk / turbulence, requiredCR = 180%, stability fee = 5% APY
        Undertow   // 2: Crisis / exploit breakdown, requiredCR = 250%, mint halted, stability fee = 15% APY
    }

    uint256 public constant BPS_BASE = 10000;
    uint256 public constant PRICE_PRECISION = 1e18;
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    // Stability Fee Rates per regime
    uint256 public constant STABLE_FEE_BPS = 200;    // 2.00% APY
    uint256 public constant UNSETTLED_FEE_BPS = 500; // 5.00% APY
    uint256 public constant UNDERTOW_FEE_BPS = 1500; // 15.00% APY

    // Liquidation Penalty: 10% bonus/penalty
    uint256 public constant LIQUIDATION_PENALTY_BPS = 1000;

    ImUSD public immutable musdToken;
    address public owner;
    address public authorizedReceiver; // Bedrock LZ Receiver
    address public bridgeReceiver;     // Base Sepolia Bridge Receiver for Cross-Chain Collateral

    // Supported Native Collateral Tokens (fixed array of 4 canonical assets)
    address[] public supportedTokens;
    mapping(address => bool) public isSupportedToken;
    mapping(address => address) public priceFeeds;
    mapping(address => uint8) public tokenDecimals;
    mapping(address => uint256) public priceOverrides; // Testing helper for deterministic price drops

    // Native multi-asset collateral storage: token => user => balance
    mapping(address => mapping(address => uint256)) public collateral;
    mapping(address => uint256) public totalTokenCollateral;

    // Bridged cross-chain collateral (e.g., DAI and stETH locked on Ethereum Sepolia)
    address[] public bridgedTokens;
    mapping(address => bool) public isBridgedToken;
    mapping(address => mapping(address => uint256)) public bridgedCollateral;
    mapping(address => uint256) public totalBridgedCollateral;
    mapping(address => uint256) public bridgedTokenPriceUSD; // 18 decimals
    mapping(address => uint8) public bridgedTokenDecimals;

    // Single unified mUSD debt per user
    mapping(address => uint256) public debt;
    uint256 public totalDebt;

    // Dynamic Bedrock Regime state & Stability Fee tracking
    Regime public currentRegime;
    Regime public previousRegime;
    uint256 public requiredCRBps; // e.g. 15000 = 150%, 18000 = 180%, 25000 = 250%
    uint256 public currentStabilityFeeBps; // e.g. 200 = 2%, 500 = 5%, 1500 = 15%
    bool public mintHalted;
    string public latestReasoning;
    uint256 public lastRegimeChangeTimestamp;
    bytes32 public lastRegimeLzTxHash;
    mapping(address => uint256) public lastAccrualTimestamp;

    // Per-asset regime state & risk parameters (scoped to ETH, DAI, USDC)
    mapping(address => Regime) public assetRegime;
    mapping(address => uint256) public assetRequiredCRBps;
    mapping(address => uint256) public assetStabilityFeeBps;
    mapping(address => bool) public assetMintHalted;
    mapping(address => string) public assetReasoning;
    mapping(address => uint256) public assetLastRegimeTimestamp;
    mapping(address => bytes32) public assetLastRegimeLzTxHash;
    mapping(address => bool) public isPerAssetEvaluationEnabled;

    // Reentrancy guard
    uint256 private _locked = 1;
    modifier nonReentrant() {
        if (_locked != 1) revert ReentrancyGuard();
        _locked = 2;
        _;
        _locked = 1;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyAuthorizedReceiver() {
        if (msg.sender != authorizedReceiver && msg.sender != owner) {
            revert UnauthorizedReceiver();
        }
        _;
    }

    modifier onlyBridgeReceiver() {
        if (msg.sender != bridgeReceiver && msg.sender != owner) {
            revert Unauthorized();
        }
        _;
    }

    modifier onlySupportedToken(address token) {
        if (!isSupportedToken[token]) revert UnsupportedToken(token);
        _;
    }

    modifier onlySupportedOrBridgedToken(address token) {
        if (!isSupportedToken[token] && !isBridgedToken[token]) revert UnsupportedToken(token);
        _;
    }

    event Deposited(address indexed asset, address indexed user, uint256 amount, uint256 timestamp, uint256 resultingCRBps);
    event Minted(address indexed asset, address indexed user, uint256 amount, uint256 timestamp, uint256 resultingCRBps);
    event Repaid(address indexed asset, address indexed user, uint256 amount, uint256 timestamp, uint256 resultingCRBps);
    event Withdrawn(address indexed asset, address indexed user, uint256 amount, uint256 timestamp, uint256 resultingCRBps);
    event BridgedCollateralCredited(address indexed asset, address indexed user, uint256 amount, uint256 timestamp, uint256 resultingCRBps);
    event BridgedCollateralWithdrawn(address indexed asset, address indexed user, uint256 amount, uint256 timestamp, uint256 resultingCRBps);
    event RegimeUpdated(
        Regime indexed oldRegime,
        Regime indexed newRegime,
        uint256 requiredCRBps,
        bool mintHalted,
        uint256 timestamp,
        string reasoning,
        bytes32 indexed lzTxHash
    );
    event AssetRegimeUpdated(
        address indexed token,
        Regime oldRegime,
        Regime indexed newRegime,
        uint256 requiredCRBps,
        bool mintHalted,
        uint256 timestamp,
        string reasoning,
        bytes32 indexed lzTxHash
    );
    event StabilityFeeAccrued(address indexed user, uint256 fee, uint256 newDebt, uint256 timeElapsed);
    event StabilityFeeRateUpdated(Regime newRegime, uint256 newFeeBps);
    event Liquidated(address indexed asset, address indexed user, address indexed liquidator, uint256 amount, uint256 timestamp, uint256 resultingCRBps);
    event PriceOverrideUpdated(address indexed token, uint256 newPriceUSD);
    event AuthorizedReceiverUpdated(address indexed previousReceiver, address indexed newReceiver);
    event BridgeReceiverUpdated(address indexed previousReceiver, address indexed newReceiver);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error ZeroAmount();
    error InsufficientCollateral(uint256 currentCRBps, uint256 requiredCRBps);
    error InsufficientBalance();
    error DebtExceeded();
    error TransferFailed();
    error ReentrancyGuard();
    error InvalidOraclePrice();
    error StaleOraclePrice();
    error MintHalted();
    error UnauthorizedReceiver();
    error Unauthorized();
    error ZeroAddress();
    error UnsupportedToken(address token);
    error NoDebtToLiquidate();
    error PositionHealthy(uint256 currentCRBps, uint256 requiredCRBps);
    error ZeroCollateralBalance(address token);
    error PerAssetEvaluationNotEnabled(address token);

    constructor(
        address _musdToken,
        address[] memory _tokens,
        address[] memory _feeds,
        uint8[] memory _decimals
    ) {
        if (_musdToken == address(0)) revert ZeroAddress();
        require(_tokens.length == 4, "Must initialize exactly 4 supported tokens");
        require(_tokens.length == _feeds.length && _tokens.length == _decimals.length, "Array length mismatch");

        musdToken = ImUSD(_musdToken);
        owner = msg.sender;

        for (uint256 i = 0; i < _tokens.length; i++) {
            address token = _tokens[i];
            address feed = _feeds[i];
            uint8 dec = _decimals[i];

            if (token == address(0) || feed == address(0)) revert ZeroAddress();
            require(!isSupportedToken[token], "Duplicate token");

            supportedTokens.push(token);
            isSupportedToken[token] = true;
            priceFeeds[token] = feed;
            tokenDecimals[token] = dec;

            // Enable per-asset evaluation for WETH (i=0) and USDC (i=1)
            // WBTC (i=3) and LINK (i=2) remain protocol-wide/disabled for this phase
            if (i == 0 || i == 1) {
                isPerAssetEvaluationEnabled[token] = true;
                assetRegime[token] = Regime.Stable;
                assetRequiredCRBps[token] = 15000;
                assetStabilityFeeBps[token] = STABLE_FEE_BPS;
                assetMintHalted[token] = false;
                assetReasoning[token] = "Operating normally in Stable regime.";
                assetLastRegimeTimestamp[token] = block.timestamp;
            } else {
                // Per-asset evaluation not yet enabled for this asset (WBTC, LINK)
                isPerAssetEvaluationEnabled[token] = false;
            }
        }

        // Initialize in Stable regime: 150% MCR, 2% stability fee
        currentRegime = Regime.Stable;
        previousRegime = Regime.Stable;
        requiredCRBps = 15000;
        currentStabilityFeeBps = STABLE_FEE_BPS;
        mintHalted = false;
        latestReasoning = "Protocol initialized in Stable regime.";
        lastRegimeChangeTimestamp = block.timestamp;
        lastRegimeLzTxHash = bytes32(0);

        emit OwnershipTransferred(address(0), msg.sender);
        emit RegimeUpdated(Regime.Stable, Regime.Stable, 15000, false, block.timestamp, latestReasoning, bytes32(0));
        emit StabilityFeeRateUpdated(Regime.Stable, STABLE_FEE_BPS);
    }

    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }

    function getBridgedTokens() external view returns (address[] memory) {
        return bridgedTokens;
    }

    function setAuthorizedReceiver(address _receiver) external onlyOwner {
        if (_receiver == address(0)) revert ZeroAddress();
        address prev = authorizedReceiver;
        authorizedReceiver = _receiver;
        emit AuthorizedReceiverUpdated(prev, _receiver);
    }

    function setBridgeReceiver(address _bridgeReceiver) external onlyOwner {
        if (_bridgeReceiver == address(0)) revert ZeroAddress();
        address prev = bridgeReceiver;
        bridgeReceiver = _bridgeReceiver;
        emit BridgeReceiverUpdated(prev, _bridgeReceiver);
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert ZeroAddress();
        address prev = owner;
        owner = _newOwner;
        emit OwnershipTransferred(prev, _newOwner);
    }

    function setPerAssetEvaluationEnabled(address token, bool enabled) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        isPerAssetEvaluationEnabled[token] = enabled;
        if (enabled && assetRequiredCRBps[token] == 0) {
            assetRegime[token] = Regime.Stable;
            assetRequiredCRBps[token] = 15000;
            assetStabilityFeeBps[token] = STABLE_FEE_BPS;
            assetMintHalted[token] = false;
            assetReasoning[token] = "Operating normally in Stable regime.";
            assetLastRegimeTimestamp[token] = block.timestamp;
        }
    }

    /**
     * @notice Test helper: override oracle price for a supported token (0 clears override).
     */
    function setPriceOverride(address token, uint256 priceUSD) external onlyOwner onlySupportedToken(token) {
        priceOverrides[token] = priceUSD;
        emit PriceOverrideUpdated(token, priceUSD);
    }

    /**
     * @notice Updates the Vault risk regime and required collateral ratio with LayerZero transaction hash.
     * @dev Called via existing Bedrock LayerZero pipeline. Automatically updates stabilityFeeBps.
     */
    function updateRegime(
        Regime _regime,
        uint256 _requiredCRBps,
        bool _mintHalted,
        string calldata _reasoning,
        bytes32 _lzTxHash
    ) public onlyAuthorizedReceiver {
        require(_requiredCRBps >= 10000, "CR cannot be below 100%");
        Regime oldRegime = currentRegime;
        previousRegime = oldRegime;
        currentRegime = _regime;
        requiredCRBps = _requiredCRBps;
        mintHalted = _mintHalted;
        latestReasoning = _reasoning;
        lastRegimeChangeTimestamp = block.timestamp;
        lastRegimeLzTxHash = _lzTxHash;

        // Automatically update stability fee rate according to regime
        if (_regime == Regime.Stable) {
            currentStabilityFeeBps = STABLE_FEE_BPS;
        } else if (_regime == Regime.Unsettled) {
            currentStabilityFeeBps = UNSETTLED_FEE_BPS;
        } else {
            currentStabilityFeeBps = UNDERTOW_FEE_BPS;
        }

        emit RegimeUpdated(oldRegime, _regime, _requiredCRBps, _mintHalted, block.timestamp, _reasoning, _lzTxHash);
        emit StabilityFeeRateUpdated(_regime, currentStabilityFeeBps);
    }

    /**
     * @notice Updates risk regime and parameters for a specific asset.
     */
    function updateAssetRegime(
        address token,
        Regime _regime,
        uint256 _requiredCRBps,
        bool _mintHalted,
        string calldata _reasoning,
        bytes32 _lzTxHash
    ) public onlyAuthorizedReceiver {
        require(isPerAssetEvaluationEnabled[token], "Asset not enabled for per-asset eval");
        require(_requiredCRBps >= 10000, "CR cannot be below 100%");

        Regime oldRegime = assetRegime[token];
        assetRegime[token] = _regime;
        assetRequiredCRBps[token] = _requiredCRBps;
        assetMintHalted[token] = _mintHalted;
        assetReasoning[token] = _reasoning;
        assetLastRegimeTimestamp[token] = block.timestamp;
        assetLastRegimeLzTxHash[token] = _lzTxHash;

        if (_regime == Regime.Stable) {
            assetStabilityFeeBps[token] = STABLE_FEE_BPS;
        } else if (_regime == Regime.Unsettled) {
            assetStabilityFeeBps[token] = UNSETTLED_FEE_BPS;
        } else {
            assetStabilityFeeBps[token] = UNDERTOW_FEE_BPS;
        }

        emit AssetRegimeUpdated(token, oldRegime, _regime, _requiredCRBps, _mintHalted, block.timestamp, _reasoning, _lzTxHash);
    }

    /**
     * @notice Backwards-compatible overload for 4-parameter calls.
     */
    function updateRegime(
        Regime _regime,
        uint256 _requiredCRBps,
        bool _mintHalted,
        string calldata _reasoning
    ) external onlyAuthorizedReceiver {
        updateRegime(_regime, _requiredCRBps, _mintHalted, _reasoning, bytes32(0));
    }

    /**
     * @notice Calculate pending accrued stability fee for a position without state mutation.
     */
    function getPendingFee(address user) public view returns (uint256 pendingFee, uint256 projectedDebt) {
        uint256 userDebt = debt[user];
        if (userDebt == 0) return (0, 0);

        uint256 lastTime = lastAccrualTimestamp[user];
        if (lastTime == 0 || block.timestamp <= lastTime) {
            return (0, userDebt);
        }

        uint256 timeElapsed = block.timestamp - lastTime;
        pendingFee = (userDebt * currentStabilityFeeBps * timeElapsed) / (SECONDS_PER_YEAR * BPS_BASE);
        projectedDebt = userDebt + pendingFee;
    }

    /**
     * @notice Accrues accumulated stability fee into a user's open debt position.
     */
    function _accrueInterest(address user) internal returns (uint256 fee) {
        uint256 userDebt = debt[user];
        if (userDebt == 0) {
            lastAccrualTimestamp[user] = block.timestamp;
            return 0;
        }

        uint256 lastTime = lastAccrualTimestamp[user];
        if (lastTime == 0) {
            lastAccrualTimestamp[user] = block.timestamp;
            return 0;
        }

        if (block.timestamp <= lastTime) {
            return 0;
        }

        uint256 timeElapsed = block.timestamp - lastTime;
        fee = (userDebt * currentStabilityFeeBps * timeElapsed) / (SECONDS_PER_YEAR * BPS_BASE);

        if (fee > 0) {
            debt[user] = userDebt + fee;
            totalDebt += fee;
            emit StabilityFeeAccrued(user, fee, debt[user], timeElapsed);
        }

        lastAccrualTimestamp[user] = block.timestamp;
    }

    /**
     * @notice Public permissionless entrypoint to trigger fee accrual on any position.
     */
    function accrueInterest(address user) external returns (uint256 fee) {
        return _accrueInterest(user);
    }

    /**
     * @notice Fetch latest price for a native supported token normalized to 18 decimals (1e18).
     */
    function getLatestPrice(address token) public view onlySupportedToken(token) returns (uint256) {
        if (priceOverrides[token] > 0) {
            return priceOverrides[token];
        }

        address feedAddress = priceFeeds[token];
        AggregatorV3Interface feed = AggregatorV3Interface(feedAddress);

        (
            ,
            int256 price,
            ,
            uint256 updatedAt,
            
        ) = feed.latestRoundData();

        if (price <= 0) revert InvalidOraclePrice();
        if (updatedAt == 0) revert StaleOraclePrice();

        uint8 feedDecimals = feed.decimals();
        if (feedDecimals < 18) {
            return uint256(price) * (10 ** (18 - feedDecimals));
        } else if (feedDecimals > 18) {
            return uint256(price) / (10 ** (feedDecimals - 18));
        }
        return uint256(price);
    }

    /**
     * @notice Calculate value of a given native token amount in USD (18 decimals).
     */
    function getTokenValueUSD(address token, uint256 amount) public view onlySupportedToken(token) returns (uint256) {
        if (amount == 0) return 0;
        uint256 priceUSD = getLatestPrice(token);
        uint8 dec = tokenDecimals[token];

        uint256 scaledAmount;
        if (dec < 18) {
            scaledAmount = amount * (10 ** (18 - dec));
        } else if (dec > 18) {
            scaledAmount = amount / (10 ** (dec - 18));
        } else {
            scaledAmount = amount;
        }

        return (scaledAmount * priceUSD) / PRICE_PRECISION;
    }

    /**
     * @notice Calculate value of a given bridged token amount in USD (18 decimals).
     */
    function getBridgedTokenValueUSD(address token, uint256 amount) public view returns (uint256) {
        if (amount == 0) return 0;
        uint256 priceUSD = bridgedTokenPriceUSD[token];
        if (priceUSD == 0) revert InvalidOraclePrice();
        uint8 dec = bridgedTokenDecimals[token];

        uint256 scaledAmount;
        if (dec < 18) {
            scaledAmount = amount * (10 ** (18 - dec));
        } else if (dec > 18) {
            scaledAmount = amount / (10 ** (dec - 18));
        } else {
            scaledAmount = amount;
        }

        return (scaledAmount * priceUSD) / PRICE_PRECISION;
    }

    /**
     * @notice Total blended collateral value in USD across all native and bridged tokens deposited by user.
     */
    function getTotalCollateralValueUSD(address user) public view returns (uint256 totalValueUSD) {
        // 1. Native collateral assets (WETH, USDC, LINK, WBTC)
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            address token = supportedTokens[i];
            uint256 bal = collateral[token][user];
            if (bal > 0) {
                totalValueUSD += getTokenValueUSD(token, bal);
            }
        }

        // 2. Bridged cross-chain assets (DAI, stETH)
        for (uint256 j = 0; j < bridgedTokens.length; j++) {
            address bToken = bridgedTokens[j];
            uint256 bBal = bridgedCollateral[bToken][user];
            if (bBal > 0) {
                totalValueUSD += getBridgedTokenValueUSD(bToken, bBal);
            }
        }
    }

    /**
     * @notice Computes normalized health score: (collateral value in USD / debt in USD) vs. requiredCRBps.
     * @return healthScore Normalized health factor (1e18 = exactly at required MCR, < 1e18 = liquidatable).
     * @return currentCRBps The user's current collateral ratio in BPS (e.g. 15000 = 150%).
     * @return isLiquidatable True if position CR is below the active requiredCRBps threshold.
     */
    function getHealthScore(address user)
        public
        view
        returns (
            uint256 healthScore,
            uint256 currentCRBps,
            bool isLiquidatable
        )
    {
        uint256 userDebt = debt[user];
        if (userDebt == 0) {
            return (type(uint256).max, type(uint256).max, false);
        }

        uint256 totalCollateralUSD = getTotalCollateralValueUSD(user);
        currentCRBps = (totalCollateralUSD * BPS_BASE) / userDebt;
        healthScore = (currentCRBps * 1e18) / requiredCRBps;
        isLiquidatable = currentCRBps < requiredCRBps;
    }

    /**
     * @notice Credits bridged collateral to user position upon receiving verified LayerZero message.
     */
    function creditBridgedCollateral(
        address user,
        address token,
        uint256 amount,
        uint256 priceUSD,
        uint8 decimals
    ) external onlyBridgeReceiver {
        if (user == address(0) || token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (!isPerAssetEvaluationEnabled[token]) {
            revert PerAssetEvaluationNotEnabled(token);
        }

        if (!isBridgedToken[token]) {
            isBridgedToken[token] = true;
            bridgedTokens.push(token);
            bridgedTokenDecimals[token] = decimals;
        }
        if (priceUSD > 0) {
            bridgedTokenPriceUSD[token] = priceUSD;
        }

        bridgedCollateral[token][user] += amount;
        totalBridgedCollateral[token] += amount;

        uint256 totalCollateralUSD = getTotalCollateralValueUSD(user);
        uint256 userDebt = debt[user];
        uint256 resultingCRBps = userDebt > 0 ? (totalCollateralUSD * BPS_BASE) / userDebt : type(uint256).max;

        emit BridgedCollateralCredited(token, user, amount, block.timestamp, resultingCRBps);
    }

    /**
     * @notice Withdraws bridged collateral, checking that remaining blended collateral covers debt at requiredCR.
     */
    function withdrawBridgedCollateral(address token, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (!isBridgedToken[token]) revert UnsupportedToken(token);

        // Accrue pending stability fee first
        _accrueInterest(msg.sender);

        uint256 currentBal = bridgedCollateral[token][msg.sender];
        if (currentBal < amount) revert InsufficientBalance();

        uint256 userDebt = debt[msg.sender];
        uint256 resultingCRBps;

        if (userDebt > 0) {
            uint256 totalValueUSD = getTotalCollateralValueUSD(msg.sender);
            uint256 withdrawnValueUSD = getBridgedTokenValueUSD(token, amount);

            uint256 activeReqCR = assetRequiredCRBps[token] > 0 ? assetRequiredCRBps[token] : requiredCRBps;
            if (totalValueUSD <= withdrawnValueUSD) {
                revert InsufficientCollateral(0, activeReqCR);
            }

            uint256 remainingValueUSD = totalValueUSD - withdrawnValueUSD;
            resultingCRBps = (remainingValueUSD * BPS_BASE) / userDebt;

            if (resultingCRBps < activeReqCR) {
                revert InsufficientCollateral(resultingCRBps, activeReqCR);
            }
        } else {
            resultingCRBps = type(uint256).max;
        }

        bridgedCollateral[token][msg.sender] = currentBal - amount;
        totalBridgedCollateral[token] -= amount;

        emit BridgedCollateralWithdrawn(token, msg.sender, amount, block.timestamp, resultingCRBps);

        if (bridgeReceiver != address(0)) {
            IBaseSepoliaBridgeReceiver(bridgeReceiver).dispatchUnlockMessage(msg.sender, token, amount);
        }
    }

    /**
     * @notice Deposit supported ERC-20 collateral token into the vault.
     */
    function deposit(address token, uint256 amount) external nonReentrant onlySupportedToken(token) {
        if (!isPerAssetEvaluationEnabled[token]) {
            revert PerAssetEvaluationNotEnabled(token);
        }
        if (amount == 0) revert ZeroAmount();

        // Accrue interest before modifying position
        _accrueInterest(msg.sender);

        collateral[token][msg.sender] += amount;
        totalTokenCollateral[token] += amount;

        bool success = IERC20(token).transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();

        uint256 totalCollateralUSD = getTotalCollateralValueUSD(msg.sender);
        uint256 userDebt = debt[msg.sender];
        uint256 resultingCRBps = userDebt > 0 ? (totalCollateralUSD * BPS_BASE) / userDebt : type(uint256).max;

        emit Deposited(token, msg.sender, amount, block.timestamp, resultingCRBps);
    }

    /**
     * @notice Mint mUSD against deposited native or bridged collateral.
     * @dev Rejects minting against assets where caller holds zero deposited balance.
     */
    function mint(address token, uint256 amount) external nonReentrant onlySupportedOrBridgedToken(token) {
        if (!isPerAssetEvaluationEnabled[token]) {
            revert PerAssetEvaluationNotEnabled(token);
        }
        if (assetMintHalted[token] || mintHalted) revert MintHalted();
        if (amount == 0) revert ZeroAmount();

        // Check caller holds non-zero collateral in this specific asset
        uint256 userTokenBalance = isSupportedToken[token]
            ? collateral[token][msg.sender]
            : bridgedCollateral[token][msg.sender];
        if (userTokenBalance == 0) revert ZeroCollateralBalance(token);

        // Accrue interest on existing debt before minting additional debt
        _accrueInterest(msg.sender);

        uint256 totalCollateralValueUSD = getTotalCollateralValueUSD(msg.sender);
        uint256 activeReqCR = assetRequiredCRBps[token] > 0 ? assetRequiredCRBps[token] : requiredCRBps;
        if (totalCollateralValueUSD == 0) revert InsufficientCollateral(0, activeReqCR);

        uint256 newDebt = debt[msg.sender] + amount;
        uint256 newCRBps = (totalCollateralValueUSD * BPS_BASE) / newDebt;

        if (newCRBps < activeReqCR) {
            revert InsufficientCollateral(newCRBps, activeReqCR);
        }

        debt[msg.sender] = newDebt;
        totalDebt += amount;

        musdToken.mint(msg.sender, amount);

        emit Minted(token, msg.sender, amount, block.timestamp, newCRBps);
    }

    /**
     * @notice Repay mUSD debt and burn tokens directly from sender.
     */
    function repay(address token, uint256 amount) external nonReentrant onlySupportedOrBridgedToken(token) {
        if (amount == 0) revert ZeroAmount();

        // Accrue interest before repaying
        _accrueInterest(msg.sender);

        uint256 currentDebt = debt[msg.sender];
        if (currentDebt < amount) revert DebtExceeded();

        debt[msg.sender] = currentDebt - amount;
        totalDebt -= amount;

        musdToken.burn(msg.sender, amount);

        uint256 totalCollateralUSD = getTotalCollateralValueUSD(msg.sender);
        uint256 remainingDebt = debt[msg.sender];
        uint256 resultingCRBps = remainingDebt > 0 ? (totalCollateralUSD * BPS_BASE) / remainingDebt : type(uint256).max;

        emit Repaid(token, msg.sender, amount, block.timestamp, resultingCRBps);
    }

    /**
     * @notice Withdraw native collateral token, ensuring remaining blended position satisfies requiredCR.
     */
    function withdraw(address token, uint256 amount) external nonReentrant onlySupportedToken(token) {
        if (amount == 0) revert ZeroAmount();

        // Accrue interest before withdrawing collateral
        _accrueInterest(msg.sender);

        uint256 currentBal = collateral[token][msg.sender];
        if (currentBal < amount) revert InsufficientBalance();

        uint256 userDebt = debt[msg.sender];
        uint256 resultingCRBps;

        uint256 activeReqCR = assetRequiredCRBps[token] > 0 ? assetRequiredCRBps[token] : requiredCRBps;

        if (userDebt > 0) {
            uint256 totalValueUSD = getTotalCollateralValueUSD(msg.sender);
            uint256 withdrawnValueUSD = getTokenValueUSD(token, amount);

            if (totalValueUSD <= withdrawnValueUSD) {
                revert InsufficientCollateral(0, activeReqCR);
            }

            uint256 remainingValueUSD = totalValueUSD - withdrawnValueUSD;
            resultingCRBps = (remainingValueUSD * BPS_BASE) / userDebt;

            if (resultingCRBps < activeReqCR) {
                revert InsufficientCollateral(resultingCRBps, activeReqCR);
            }
        } else {
            resultingCRBps = type(uint256).max;
        }

        collateral[token][msg.sender] = currentBal - amount;
        totalTokenCollateral[token] -= amount;

        bool success = IERC20(token).transfer(msg.sender, amount);
        if (!success) revert TransferFailed();

        emit Withdrawn(token, msg.sender, amount, block.timestamp, resultingCRBps);
    }

    /**
     * @notice Liquidate an under-collateralized position.
     * @dev Callable by anyone when position's CR < requiredCRBps.
     *      Liquidator repays `userDebt` in mUSD, cancels borrower debt, and receives borrower's
     *      collateral up to (userDebt * (10000 + LIQUIDATION_PENALTY_BPS)) / 10000 USD.
     * @param user The address of the borrower to liquidate.
     */
    function liquidate(address user) external nonReentrant {
        if (user == address(0)) revert ZeroAddress();

        // 1. Accrue pending interest to get true outstanding debt
        _accrueInterest(user);

        uint256 userDebt = debt[user];
        if (userDebt == 0) revert NoDebtToLiquidate();

        uint256 totalCollateralUSD = getTotalCollateralValueUSD(user);
        uint256 currentCRBps = totalCollateralUSD == 0 ? 0 : (totalCollateralUSD * BPS_BASE) / userDebt;

        if (currentCRBps >= requiredCRBps) {
            revert PositionHealthy(currentCRBps, requiredCRBps);
        }

        // 2. Liquidator repays user's full debt by burning mUSD from liquidator
        musdToken.burn(msg.sender, userDebt);

        // 3. Target USD value of collateral to seize (Debt + 10% Liquidation Penalty)
        uint256 maxSeizeValueUSD = (userDebt * (BPS_BASE + LIQUIDATION_PENALTY_BPS)) / BPS_BASE;
        uint256 remainingValueToSeizeUSD = maxSeizeValueUSD;
        uint256 actualCollateralSeizedUSD = 0;

        // 4. Seize native collateral assets first
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            if (remainingValueToSeizeUSD == 0) break;
            address token = supportedTokens[i];
            uint256 userBal = collateral[token][user];
            if (userBal == 0) continue;

            uint256 tokenValUSD = getTokenValueUSD(token, userBal);
            if (tokenValUSD <= remainingValueToSeizeUSD) {
                // Seize entire balance of this token
                collateral[token][user] = 0;
                totalTokenCollateral[token] -= userBal;
                remainingValueToSeizeUSD -= tokenValUSD;
                actualCollateralSeizedUSD += tokenValUSD;

                bool success = IERC20(token).transfer(msg.sender, userBal);
                if (!success) revert TransferFailed();
            } else {
                // Seize partial balance
                uint256 amountToSeize = (userBal * remainingValueToSeizeUSD) / tokenValUSD;
                if (amountToSeize > userBal) amountToSeize = userBal;

                collateral[token][user] = userBal - amountToSeize;
                totalTokenCollateral[token] -= amountToSeize;
                actualCollateralSeizedUSD += remainingValueToSeizeUSD;
                remainingValueToSeizeUSD = 0;

                bool success = IERC20(token).transfer(msg.sender, amountToSeize);
                if (!success) revert TransferFailed();
            }
        }

        // 5. Cancel borrower's debt
        debt[user] = 0;
        totalDebt -= userDebt;
        lastAccrualTimestamp[user] = block.timestamp;

        uint256 postCollateralUSD = getTotalCollateralValueUSD(user);
        uint256 resultingCRBps = postCollateralUSD > 0 ? type(uint256).max : 0;

        emit Liquidated(address(0), user, msg.sender, userDebt, block.timestamp, resultingCRBps);
    }

    /**
     * @notice View function returning full live Bedrock consensus regime state.
     */
    function getRegimeState()
        external
        view
        returns (
            Regime current,
            Regime previous,
            uint256 activeRequiredCRBps,
            uint256 activeStabilityFeeBps,
            bool isMintHalted,
            uint256 lastTimestamp,
            string memory reasoning,
            bytes32 lzTxHash
        )
    {
        return (
            currentRegime,
            previousRegime,
            requiredCRBps,
            currentStabilityFeeBps,
            mintHalted,
            lastRegimeChangeTimestamp,
            latestReasoning,
            lastRegimeLzTxHash
        );
    }

    /**
     * @notice View function returning independent per-asset Bedrock regime state.
     */
    function getAssetRegimeState(address token)
        external
        view
        returns (
            Regime regime,
            uint256 activeRequiredCRBps,
            uint256 activeStabilityFeeBps,
            bool isMintHalted,
            uint256 lastTimestamp,
            string memory reasoning,
            bytes32 lzTxHash,
            bool enabled
        )
    {
        enabled = isPerAssetEvaluationEnabled[token];
        if (!enabled) {
            regime = Regime.Stable;
            activeRequiredCRBps = 0;
            activeStabilityFeeBps = 0;
            isMintHalted = true;
            lastTimestamp = 0;
            reasoning = "Per-asset evaluation not yet enabled for this asset";
            lzTxHash = bytes32(0);
        } else {
            regime = assetRegime[token];
            activeRequiredCRBps = assetRequiredCRBps[token];
            activeStabilityFeeBps = assetStabilityFeeBps[token];
            isMintHalted = assetMintHalted[token];
            lastTimestamp = assetLastRegimeTimestamp[token];
            reasoning = assetReasoning[token];
            lzTxHash = assetLastRegimeLzTxHash[token];
        }
    }

    /**
     * @notice View account position helper with blended collateral and active regime.
     */
    function getAccountPosition(address user)
        external
        view
        returns (
            uint256 totalCollateralValueUSD,
            uint256 userDebtMusd,
            uint256 currentCRBps,
            uint256 maxMintableMusd,
            Regime regime,
            uint256 activeRequiredCRBps,
            bool isMintHalted
        )
    {
        totalCollateralValueUSD = getTotalCollateralValueUSD(user);
        (, userDebtMusd) = getPendingFee(user);
        regime = currentRegime;
        activeRequiredCRBps = requiredCRBps;
        isMintHalted = mintHalted;

        if (isMintHalted) {
            maxMintableMusd = 0;
        } else {
            uint256 maxDebtAllowed = (totalCollateralValueUSD * BPS_BASE) / activeRequiredCRBps;
            if (maxDebtAllowed > userDebtMusd) {
                maxMintableMusd = maxDebtAllowed - userDebtMusd;
            } else {
                maxMintableMusd = 0;
            }
        }

        if (userDebtMusd == 0) {
            currentCRBps = totalCollateralValueUSD > 0 ? type(uint256).max : 0;
        } else {
            currentCRBps = (totalCollateralValueUSD * BPS_BASE) / userDebtMusd;
        }
    }
}
