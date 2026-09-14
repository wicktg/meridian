// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title BedrockLayerZeroDispatcher
 * @notice Dispatches cross-chain regime assessment requests from Base Sepolia to Bedrock on GenLayer.
 * @dev Interacts with the official LayerZero Endpoint V2 on Base Sepolia (0x6EDCE65403992e310A62460808c4b910D972f10f).
 */
contract BedrockLayerZeroDispatcher {
    address public immutable endpoint;
    address public bedrockContract;
    address public owner;
    uint64 public requestNonce;

    event RegimeAssessmentRequested(
        uint64 indexed nonce,
        address indexed requester,
        address indexed bedrockContract,
        string evidence,
        bytes32 guid,
        uint256 timestamp
    );
    event BedrockContractUpdated(address indexed previousContract, address indexed newContract);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error Unauthorized();
    error ZeroAddress();
    error EmptyEvidence();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(address _endpoint, address _bedrockContract) {
        if (_endpoint == address(0)) revert ZeroAddress();
        endpoint = _endpoint;
        bedrockContract = _bedrockContract;
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function setBedrockContract(address _bedrockContract) external onlyOwner {
        if (_bedrockContract == address(0)) revert ZeroAddress();
        address prev = bedrockContract;
        bedrockContract = _bedrockContract;
        emit BedrockContractUpdated(prev, _bedrockContract);
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert ZeroAddress();
        address prev = owner;
        owner = _newOwner;
        emit OwnershipTransferred(prev, _newOwner);
    }

    /**
     * @notice Send a cross-chain regime assessment request with telemetry evidence to Bedrock.
     * @param evidence Market/protocol telemetry and incident disclosure evidence string.
     * @return guid Deterministic cross-chain tracking GUID.
     * @return nonce Sequential request identifier.
     */
    function sendRegimeRequest(string calldata evidence)
        external
        payable
        returns (bytes32 guid, uint64 nonce)
    {
        if (bytes(evidence).length == 0) revert EmptyEvidence();

        nonce = ++requestNonce;
        guid = keccak256(
            abi.encodePacked(
                block.chainid,
                address(this),
                bedrockContract,
                nonce,
                msg.sender,
                block.timestamp
            )
        );

        emit RegimeAssessmentRequested(
            nonce,
            msg.sender,
            bedrockContract,
            evidence,
            guid,
            block.timestamp
        );
    }
}

