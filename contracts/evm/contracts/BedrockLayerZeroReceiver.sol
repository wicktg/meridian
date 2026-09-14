// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./ILayerZeroReceiver.sol";

interface IVault {
    enum Regime { Stable, Unsettled, Undertow }

    function updateRegime(
        Regime _regime,
        uint256 _requiredCRBps,
        bool _mintHalted,
        string calldata _reasoning,
        bytes32 _lzTxHash
    ) external;

    function updateRegime(
        Regime _regime,
        uint256 _requiredCRBps,
        bool _mintHalted,
        string calldata _reasoning
    ) external;

    function updateAssetRegime(
        address token,
        Regime _regime,
        uint256 _requiredCRBps,
        bool _mintHalted,
        string calldata _reasoning,
        bytes32 _lzTxHash
    ) external;

    function currentRegime() external view returns (Regime);
    function requiredCRBps() external view returns (uint256);
    function mintHalted() external view returns (bool);
}

/**
 * @title BedrockLayerZeroReceiver
 * @notice LayerZero cross-chain receiver on Base Sepolia that accepts Bedrock risk assessment outputs
 *         and calls Vault.updateRegime() to modulate collateral ratios and minting permissions.
 */
contract BedrockLayerZeroReceiver is ILayerZeroReceiver {
    address public immutable endpoint;
    IVault public vault;
    address public owner;
    address public authorizedRelayer;

    event RegimeRelayed(
        uint8 indexed regimeIndex,
        uint256 requiredCRBps,
        bool mintHalted,
        string reasoning,
        bytes32 guid
    );
    event AssetRegimeRelayed(
        address indexed token,
        uint8 indexed regimeIndex,
        uint256 requiredCRBps,
        bool mintHalted,
        string reasoning,
        bytes32 guid
    );
    event AuthorizedRelayerUpdated(address indexed previousRelayer, address indexed newRelayer);
    event VaultUpdated(address indexed previousVault, address indexed newVault);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error Unauthorized();
    error ZeroAddress();
    error InvalidRegime(uint8 regime);

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

    constructor(address _endpoint, address _vault) {
        if (_endpoint == address(0)) revert ZeroAddress();
        if (_vault == address(0)) revert ZeroAddress();
        endpoint = _endpoint;
        vault = IVault(_vault);
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
     * @notice Standard LayerZero V2 endpoint entrypoint.
     */
    function lzReceive(
        Origin calldata /* _origin */,
        bytes32 _guid,
        bytes calldata _message,
        address /* _executor */,
        bytes calldata /* _extraData */
    ) external payable override onlyAuthorizedCaller {
        _processRegimePayload(_message, _guid);
    }

    /**
     * @notice Direct relay entrypoint for authorized cross-chain relayer with message packet.
     */
    function relayRegime(bytes calldata _message, bytes32 _guid)
        external
        onlyAuthorizedCaller
    {
        _processRegimePayload(_message, _guid);
    }

    /**
     * @notice Relays per-asset regimes directly to the Vault.
     */
    function relayAssetRegimes(
        address[] calldata tokens,
        uint8[] calldata regimes,
        string[] calldata reasonings,
        bytes32 _guid
    ) external onlyAuthorizedCaller {
        require(tokens.length == regimes.length && regimes.length == reasonings.length, "Length mismatch");
        for (uint256 i = 0; i < tokens.length; i++) {
            uint8 regimeIndex = regimes[i];
            if (regimeIndex > 2) revert InvalidRegime(regimeIndex);

            uint256 requiredCRBps;
            bool mintHalted;

            if (regimeIndex == 0) {
                // Stable: 150% MCR, normal operations
                requiredCRBps = 15000;
                mintHalted = false;
            } else if (regimeIndex == 1) {
                // Unsettled: 180% MCR, elevated borrow buffer
                requiredCRBps = 18000;
                mintHalted = false;
            } else {
                // Undertow: 250% MCR, crisis defense & fresh minting completely halted
                requiredCRBps = 25000;
                mintHalted = true;
            }

            vault.updateAssetRegime(
                tokens[i],
                IVault.Regime(regimeIndex),
                requiredCRBps,
                mintHalted,
                reasonings[i],
                _guid
            );

            emit AssetRegimeRelayed(tokens[i], regimeIndex, requiredCRBps, mintHalted, reasonings[i], _guid);
        }
    }

    /**
     * @dev Decodes Bedrock assessment message, maps risk parameters, and calls Vault.updateRegime.
     */
    function _processRegimePayload(bytes calldata _message, bytes32 _guid) internal {
        (
            uint8 regimeIndex,
            string memory reasoning,
            uint64 reqNonce
        ) = abi.decode(_message, (uint8, string, uint64));

        if (regimeIndex > 2) revert InvalidRegime(regimeIndex);

        uint256 requiredCRBps;
        bool mintHalted;

        if (regimeIndex == 0) {
            // Stable: 150% MCR, normal operations
            requiredCRBps = 15000;
            mintHalted = false;
        } else if (regimeIndex == 1) {
            // Unsettled: 180% MCR, elevated borrow buffer
            requiredCRBps = 18000;
            mintHalted = false;
        } else {
            // Undertow: 250% MCR, crisis defense & fresh minting completely halted
            requiredCRBps = 25000;
            mintHalted = true;
        }

        // Apply update directly to Vault state with LayerZero GUID / hash
        vault.updateRegime(
            IVault.Regime(regimeIndex),
            requiredCRBps,
            mintHalted,
            reasoning,
            _guid
        );

        emit RegimeRelayed(regimeIndex, requiredCRBps, mintHalted, reasoning, _guid);
    }
}
