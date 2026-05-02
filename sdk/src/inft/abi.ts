/**
 * INFTMinter ABI — vendored as a `const` for full viem type inference.
 *
 * This file is generated from `contracts/out/INFTMinter.sol/INFTMinter.json`.
 * Regenerate after any contract change with `bash sdk/scripts/sync-abi.sh`.
 */

export const inftMinterAbi =
[
    {
        "type": "constructor",
        "inputs": [
            {
                "name": "minter_",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "getMintRecord",
        "inputs": [
            {
                "name": "tokenId",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "tuple",
                "internalType": "struct IINFTMinter.MintRecord",
                "components": [
                    {
                        "name": "sessionId",
                        "type": "uint256",
                        "internalType": "uint256"
                    },
                    {
                        "name": "modelBlobHash",
                        "type": "bytes32",
                        "internalType": "bytes32"
                    },
                    {
                        "name": "contributors",
                        "type": "address[]",
                        "internalType": "address[]"
                    },
                    {
                        "name": "mintedAt",
                        "type": "uint64",
                        "internalType": "uint64"
                    }
                ]
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getSealedKey",
        "inputs": [
            {
                "name": "tokenId",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "contributor",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "bytes",
                "internalType": "bytes"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getTokenBySession",
        "inputs": [
            {
                "name": "sessionId",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "tokenId",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "hasMinted",
        "inputs": [
            {
                "name": "sessionId",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "mint",
        "inputs": [
            {
                "name": "sessionId",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "modelBlobHash",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "contributors",
                "type": "address[]",
                "internalType": "address[]"
            },
            {
                "name": "sealedKeys",
                "type": "bytes[]",
                "internalType": "bytes[]"
            }
        ],
        "outputs": [
            {
                "name": "tokenId",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "minter",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "nextTokenId",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "event",
        "name": "Minted",
        "inputs": [
            {
                "name": "sessionId",
                "type": "uint256",
                "indexed": true,
                "internalType": "uint256"
            },
            {
                "name": "tokenId",
                "type": "uint256",
                "indexed": true,
                "internalType": "uint256"
            },
            {
                "name": "modelBlobHash",
                "type": "bytes32",
                "indexed": true,
                "internalType": "bytes32"
            },
            {
                "name": "contributors",
                "type": "address[]",
                "indexed": false,
                "internalType": "address[]"
            }
        ],
        "anonymous": false
    },
    {
        "type": "error",
        "name": "AlreadyMinted",
        "inputs": []
    },
    {
        "type": "error",
        "name": "EmptyContributors",
        "inputs": []
    },
    {
        "type": "error",
        "name": "EmptySealedKey",
        "inputs": []
    },
    {
        "type": "error",
        "name": "LengthMismatch",
        "inputs": []
    },
    {
        "type": "error",
        "name": "NotMinter",
        "inputs": []
    },
    {
        "type": "error",
        "name": "SessionNotMinted",
        "inputs": []
    },
    {
        "type": "error",
        "name": "TokenNotFound",
        "inputs": []
    },
    {
        "type": "error",
        "name": "ZeroAddress",
        "inputs": []
    },
    {
        "type": "error",
        "name": "ZeroHash",
        "inputs": []
    }
] as const;
