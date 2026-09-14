// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title Meridian USD (mUSD)
 * @notice Standard ERC-20 debt token for the Meridian protocol.
 * @dev Minting and burning are strictly restricted to a single authorized minter (the Vault).
 */
contract mUSD {
    string public constant name = "Meridian USD";
    string public constant symbol = "mUSD";
    uint8 public constant decimals = 18;

    uint256 public totalSupply;
    address public owner;
    address public authorizedMinter;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event AuthorizedMinterUpdated(address indexed previousMinter, address indexed newMinter);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error Unauthorized();
    error ZeroAddress();
    error InsufficientBalance();
    error InsufficientAllowance();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyAuthorizedMinter() {
        if (msg.sender != authorizedMinter) revert Unauthorized();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /**
     * @notice Set the sole authorized minter contract (the Vault).
     * @param _minter Address of the Vault contract.
     */
    function setAuthorizedMinter(address _minter) external onlyOwner {
        if (_minter == address(0)) revert ZeroAddress();
        address prev = authorizedMinter;
        authorizedMinter = _minter;
        emit AuthorizedMinterUpdated(prev, _minter);
    }

    /**
     * @notice Transfer ownership of the token contract.
     * @param _newOwner Address of the new owner.
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert ZeroAddress();
        address prev = owner;
        owner = _newOwner;
        emit OwnershipTransferred(prev, _newOwner);
    }

    /**
     * @notice Mint mUSD to a specified account.
     * @dev Restricted to the authorized minter (Vault).
     */
    function mint(address to, uint256 amount) external onlyAuthorizedMinter {
        if (to == address(0)) revert ZeroAddress();
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    /**
     * @notice Burn mUSD from a specified account.
     * @dev Restricted to the authorized minter (Vault).
     */
    function burn(address from, uint256 amount) external onlyAuthorizedMinter {
        if (from == address(0)) revert ZeroAddress();
        uint256 currentBalance = balanceOf[from];
        if (currentBalance < amount) revert InsufficientBalance();
        
        balanceOf[from] = currentBalance - amount;
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        if (spender == address(0)) revert ZeroAddress();
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (to == address(0)) revert ZeroAddress();
        uint256 senderBal = balanceOf[msg.sender];
        if (senderBal < amount) revert InsufficientBalance();

        balanceOf[msg.sender] = senderBal - amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (to == address(0)) revert ZeroAddress();
        uint256 currentAllowance = allowance[from][msg.sender];
        if (currentAllowance < amount) revert InsufficientAllowance();
        
        uint256 currentBalance = balanceOf[from];
        if (currentBalance < amount) revert InsufficientBalance();

        if (currentAllowance != type(uint256).max) {
            allowance[from][msg.sender] = currentAllowance - amount;
            emit Approval(from, msg.sender, allowance[from][msg.sender]);
        }

        balanceOf[from] = currentBalance - amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

