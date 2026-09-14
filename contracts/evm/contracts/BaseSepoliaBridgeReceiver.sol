// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./ILayerZeroReceiver.sol";

interface IVault {
    function creditBridgedCollateral(
        address user,
        address token,
        uint256 amount,
        uint256 priceUSD,
        uint8 decimals
    ) external;
}

/**
 * @title BaseSepoliaBridgeReceiver
 * @notice Receives LayerZero collateral lock messages from Ethereum Sepolia and credits bridged collateral
 *         directly into the user's unified Base Sepolia Vault position. Also dispatches LayerZero unlock messages
 *         back to Ethereum Sepolia when a user executes a verified collateral withdrawal.
 */
contract BaseSepoliaBridgeReceiver is ILayerZeroReceiver {
    address public immutable endpoint;
    uint32 public ethEndpointEid;
    address public ethLockContract;
    IVault public vault;
    address public owner;
    address public authorizedRelayer;

    uint64 public unlockNonce;

    // Prevents replay of lock messages
    mapping(bytes32 => bool) public executedLocks;

    event BridgedCollateralRelayed(
        address indexed user,
        address indexed token,
        uint256 amount,
        uint256 priceUSD,
        bytes32 guid,
        uint64 lockNonce
    );
    event UnlockDispatched(
        address indexed user,
        address indexed token,
        uint256 amount,
        bytes32 guid,
        uint64 nonce,
        uint256 timestamp
    );
    event VaultUpdated(address indexed previousVault, address indexed newVault);
    event EthLockContractUpdated(address indexed previousLock, address indexed newLock);
    event AuthorizedRelayerUpdated(address indexed previousRelayer, address indexed newRelayer);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error Unauthorized();
    error ZeroAddress();
    error ZeroAmount();
    error LockAlreadyExecuted(bytes32 guid);
    error OnlyVault();

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

    modifier onlyVault() {
        if (msg.sender != address(vault) && msg.sender != owner) revert OnlyVault();
        _;
    }

    constructor(
        address _endpoint,
        uint32 _ethEndpointEid,
        address _vault,
        address _ethLockContract
    ) {
        if (_endpoint == address(0)) revert ZeroAddress();
        if (_vault == address(0)) revert ZeroAddress();

        endpoint = _endpoint;
        ethEndpointEid = _ethEndpointEid;
        vault = IVault(_vault);
        ethLockContract = _ethLockContract;
        owner = msg.sender;
        authorizedRelayer = msg.sender;

        emit OwnershipTransferred(address(0), msg.sender);
    }

    function setVault(address _vault) external onlyOwner {
        if (_vault == address(0)) revert ZeroAddress();
        address prev = address(vault);
        vault = IVault(_vault);
        emit VaultUpdated(prev, _vault);
    }

    function setEthLockContract(address _lock) external onlyOwner {
        if (_lock == address(0)) revert ZeroAddress();
        address prev = ethLockContract;
        ethLockContract = _lock;
        emit EthLockContractUpdated(prev, _lock);
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

    /**
     * @notice Standard LayerZero V2 endpoint entrypoint for lock messages from Ethereum Sepolia.
     */
    function lzReceive(
        Origin calldata /* _origin */,
        bytes32 _guid,
        bytes calldata _message,
        address /* _executor */,
        bytes calldata /* _extraData */
    ) external payable override onlyAuthorizedCaller {
        _decodeAndProcessLock(_message, _guid);
    }

    /**
     * @notice Direct relay entrypoint for authorized cross-chain relayer with message packet.
     */
    function relayLockMessage(bytes calldata _message, bytes32 _guid)
        external
        onlyAuthorizedCaller
    {
        _decodeAndProcessLock(_message, _guid);
    }

    function _decodeAndProcessLock(bytes calldata _message, bytes32 _guid) internal {
        if (executedLocks[_guid]) revert LockAlreadyExecuted(_guid);

        (
            address user,
            address token,
            uint256 amount,
            uint256 priceUSD,
            uint8 decimals,
            uint64 lockNonce
        ) = abi.decode(_message, (address, address, uint256, uint256, uint8, uint64));

        executedLocks[_guid] = true;

        // Credit directly into the unified position in Vault
        vault.creditBridgedCollateral(user, token, amount, priceUSD, decimals);

        emit BridgedCollateralRelayed(user, token, amount, priceUSD, _guid, lockNonce);
    }

    /**
     * @notice Dispatches an unlock message to Ethereum Sepolia after collateral is burned/released in Vault.
     * @dev Callable only by the Vault contract.
     */
    function dispatchUnlockMessage(
        address user,
        address token,
        uint256 amount
    ) external onlyVault returns (bytes32 guid) {
        if (user == address(0) || token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint64 nonce = ++unlockNonce;
        guid = keccak256(
            abi.encodePacked(
                block.chainid,
                address(this),
                ethLockContract,
                user,
                token,
                amount,
                nonce,
                block.timestamp
            )
        );

        emit UnlockDispatched(user, token, amount, guid, nonce, block.timestamp);
    }
}

