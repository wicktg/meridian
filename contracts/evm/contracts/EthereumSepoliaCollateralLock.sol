// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./ILayerZeroReceiver.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
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

/**
 * @title EthereumSepoliaCollateralLock
 * @notice Accepts DAI and stETH collateral deposits on Ethereum Sepolia, pulls live Chainlink oracle prices,
 *         records locked user balances, and dispatches LayerZero cross-chain credit messages to Base Sepolia.
 *         Releases locked collateral only upon verified cross-chain unlock messages originating from Base Sepolia.
 */
contract EthereumSepoliaCollateralLock is ILayerZeroReceiver {
    address public immutable endpoint;
    uint32 public baseEndpointEid;
    address public baseBridgeReceiver;
    address public owner;
    address public authorizedRelayer;

    uint64 public lockNonce;

    address[] public supportedTokens;
    mapping(address => bool) public isSupportedToken;
    mapping(address => address) public priceFeeds;
    mapping(address => uint8) public tokenDecimals;

    // token => user => locked balance
    mapping(address => mapping(address => uint256)) public lockedCollateral;
    mapping(address => uint256) public totalLockedCollateral;

    // Prevents replay of unlock messages
    mapping(bytes32 => bool) public executedUnlocks;

    event CollateralLocked(
        address indexed user,
        address indexed token,
        uint256 amount,
        uint256 priceUSD,
        uint8 decimals,
        bytes32 guid,
        uint64 nonce,
        uint256 timestamp
    );
    event CollateralUnlocked(
        address indexed user,
        address indexed token,
        uint256 amount,
        bytes32 guid,
        uint256 timestamp
    );
    event BaseBridgeReceiverUpdated(address indexed previousReceiver, address indexed newReceiver);
    event AuthorizedRelayerUpdated(address indexed previousRelayer, address indexed newRelayer);
    event TokenConfigured(address indexed token, address indexed feed, uint8 decimals);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error Unauthorized();
    error ZeroAddress();
    error ZeroAmount();
    error UnsupportedToken(address token);
    error InvalidOraclePrice();
    error StaleOraclePrice();
    error InsufficientLockedBalance();
    error UnlockAlreadyExecuted(bytes32 guid);
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyAuthorizedCaller() {
        if (msg.sender != endpoint && msg.sender != authorizedRelayer && msg.sender != owner) {
            revert Unauthorized();
        }
        _;
    }

    constructor(
        address _endpoint,
        uint32 _baseEndpointEid,
        address _daiToken,
        address _daiFeed,
        address _stEthToken,
        address _stEthFeed
    ) {
        if (_endpoint == address(0)) revert ZeroAddress();
        if (_daiToken == address(0) || _daiFeed == address(0)) revert ZeroAddress();
        if (_stEthToken == address(0) || _stEthFeed == address(0)) revert ZeroAddress();

        endpoint = _endpoint;
        baseEndpointEid = _baseEndpointEid;
        owner = msg.sender;
        authorizedRelayer = msg.sender;

        _configureToken(_daiToken, _daiFeed, 18);
        _configureToken(_stEthToken, _stEthFeed, 18);

        emit OwnershipTransferred(address(0), msg.sender);
    }

    function setBaseBridgeReceiver(address _receiver) external onlyOwner {
        if (_receiver == address(0)) revert ZeroAddress();
        address prev = baseBridgeReceiver;
        baseBridgeReceiver = _receiver;
        emit BaseBridgeReceiverUpdated(prev, _receiver);
    }

    function setAuthorizedRelayer(address _relayer) external onlyOwner {
        if (_relayer == address(0)) revert ZeroAddress();
        address prev = authorizedRelayer;
        authorizedRelayer = _relayer;
        emit AuthorizedRelayerUpdated(prev, _relayer);
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert ZeroAddress();
        address prev = owner;
        owner = _newOwner;
        emit OwnershipTransferred(prev, _newOwner);
    }

    function configureToken(address token, address feed, uint8 decimals) external onlyOwner {
        _configureToken(token, feed, decimals);
    }

    function _configureToken(address token, address feed, uint8 decimals) internal {
        if (token == address(0) || feed == address(0)) revert ZeroAddress();
        if (!isSupportedToken[token]) {
            supportedTokens.push(token);
            isSupportedToken[token] = true;
        }
        priceFeeds[token] = feed;
        tokenDecimals[token] = decimals;
        emit TokenConfigured(token, feed, decimals);
    }

    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }

    /**
     * @notice Query live Chainlink price normalized to 18 decimals ($ USD).
     */
    function getLatestPrice(address token) public view returns (uint256) {
        if (!isSupportedToken[token]) revert UnsupportedToken(token);
        address feedAddress = priceFeeds[token];
        AggregatorV3Interface feed = AggregatorV3Interface(feedAddress);

        (, int256 price, , uint256 updatedAt, ) = feed.latestRoundData();
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
     * @notice Lock DAI or stETH collateral on Ethereum Sepolia and initiate LayerZero cross-chain credit.
     * @param token Address of DAI or stETH.
     * @param amount Amount to deposit in native token units (18 decimals).
     * @return guid Deterministic cross-chain tracking GUID.
     * @return nonce Sequential lock nonce.
     */
    function lock(address token, uint256 amount)
        external
        payable
        returns (bytes32 guid, uint64 nonce)
    {
        if (!isSupportedToken[token]) revert UnsupportedToken(token);
        if (amount == 0) revert ZeroAmount();

        // 1. Pull collateral into lock contract
        bool success = IERC20(token).transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();

        // 2. Query live Chainlink price feed on Ethereum Sepolia
        uint256 priceUSD = getLatestPrice(token);
        uint8 decimals = tokenDecimals[token];

        // 3. Update internal accounting
        lockedCollateral[token][msg.sender] += amount;
        totalLockedCollateral[token] += amount;

        // 4. Generate unique tracking identifiers
        nonce = ++lockNonce;
        guid = keccak256(
            abi.encodePacked(
                block.chainid,
                address(this),
                baseBridgeReceiver,
                msg.sender,
                token,
                amount,
                priceUSD,
                nonce,
                block.timestamp
            )
        );

        emit CollateralLocked(
            msg.sender,
            token,
            amount,
            priceUSD,
            decimals,
            guid,
            nonce,
            block.timestamp
        );
    }

    /**
     * @notice Standard LayerZero V2 endpoint entrypoint for unlock messages from Base Sepolia.
     */
    function lzReceive(
        Origin calldata /* _origin */,
        bytes32 _guid,
        bytes calldata _message,
        address /* _executor */,
        bytes calldata /* _extraData */
    ) external payable override onlyAuthorizedCaller {
        (address user, address token, uint256 amount) = abi.decode(_message, (address, address, uint256));
        _processUnlock(token, user, amount, _guid);
    }

    /**
     * @notice Direct relay entrypoint for authorized cross-chain relayer with verified unlock message.
     */
    function unlock(
        address token,
        address user,
        uint256 amount,
        bytes32 guid
    ) external onlyAuthorizedCaller {
        _processUnlock(token, user, amount, guid);
    }

    function _processUnlock(
        address token,
        address user,
        uint256 amount,
        bytes32 guid
    ) internal {
        if (executedUnlocks[guid]) revert UnlockAlreadyExecuted(guid);
        if (!isSupportedToken[token]) revert UnsupportedToken(token);
        if (amount == 0) revert ZeroAmount();

        uint256 currentLocked = lockedCollateral[token][user];
        if (currentLocked < amount) revert InsufficientLockedBalance();

        executedUnlocks[guid] = true;
        lockedCollateral[token][user] = currentLocked - amount;
        totalLockedCollateral[token] -= amount;

        bool success = IERC20(token).transfer(user, amount);
        if (!success) revert TransferFailed();

        emit CollateralUnlocked(user, token, amount, guid, block.timestamp);
    }

    function getLockedCollateral(address token, address user) external view returns (uint256) {
        return lockedCollateral[token][user];
    }
}

