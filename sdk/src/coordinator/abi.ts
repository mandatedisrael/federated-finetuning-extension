/**
 * Coordinator ABI — vendored as a `const` for full viem type inference.
 *
 * This file is generated from `contracts/out/Coordinator.sol/Coordinator.json`.
 * Regenerate after any contract change with `bash sdk/scripts/sync-abi.sh`.
 */

export const coordinatorAbi =
[
    {
        "type": "function",
        "name": "createSession",
        "inputs": [
            {
                "name": "baseModel",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "participants_",
                "type": "address[]",
                "internalType": "address[]"
            },
            {
                "name": "ownerPubkeys_",
                "type": "bytes[]",
                "internalType": "bytes[]"
            },
            {
                "name": "quorum_",
                "type": "uint8",
                "internalType": "uint8"
            }
        ],
        "outputs": [
            {
                "name": "sessionId",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "getOwnerPubkey",
        "inputs": [
            {
                "name": "sessionId",
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
        "name": "getParticipants",
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
                "type": "address[]",
                "internalType": "address[]"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getSession",
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
                "type": "tuple",
                "internalType": "struct ICoordinator.Session",
                "components": [
                    {
                        "name": "creator",
                        "type": "address",
                        "internalType": "address"
                    },
                    {
                        "name": "baseModel",
                        "type": "bytes32",
                        "internalType": "bytes32"
                    },
                    {
                        "name": "quorum",
                        "type": "uint8",
                        "internalType": "uint8"
                    },
                    {
                        "name": "submittedCount",
                        "type": "uint8",
                        "internalType": "uint8"
                    },
                    {
                        "name": "status",
                        "type": "uint8",
                        "internalType": "enum ICoordinator.Status"
                    },
                    {
                        "name": "aggregatorPubkey",
                        "type": "bytes",
                        "internalType": "bytes"
                    }
                ]
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getSubmission",
        "inputs": [
            {
                "name": "sessionId",
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
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getSubmitters",
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
                "type": "address[]",
                "internalType": "address[]"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "isParticipant",
        "inputs": [
            {
                "name": "sessionId",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "account",
                "type": "address",
                "internalType": "address"
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
        "name": "nextSessionId",
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
        "type": "function",
        "name": "setAggregatorPubkey",
        "inputs": [
            {
                "name": "sessionId",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "pubkey",
                "type": "bytes",
                "internalType": "bytes"
            },
            {
                "name": "attestation",
                "type": "bytes",
                "internalType": "bytes"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "submit",
        "inputs": [
            {
                "name": "sessionId",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "blobHash",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "event",
        "name": "AggregatorPubkeySet",
        "inputs": [
            {
                "name": "sessionId",
                "type": "uint256",
                "indexed": true,
                "internalType": "uint256"
            },
            {
                "name": "pubkey",
                "type": "bytes",
                "indexed": false,
                "internalType": "bytes"
            },
            {
                "name": "attestation",
                "type": "bytes",
                "indexed": false,
                "internalType": "bytes"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "QuorumReached",
        "inputs": [
            {
                "name": "sessionId",
                "type": "uint256",
                "indexed": true,
                "internalType": "uint256"
            },
            {
                "name": "submitters",
                "type": "address[]",
                "indexed": false,
                "internalType": "address[]"
            },
            {
                "name": "blobHashes",
                "type": "bytes32[]",
                "indexed": false,
                "internalType": "bytes32[]"
            },
            {
                "name": "ownerPubkeys",
                "type": "bytes[]",
                "indexed": false,
                "internalType": "bytes[]"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "SessionCreated",
        "inputs": [
            {
                "name": "sessionId",
                "type": "uint256",
                "indexed": true,
                "internalType": "uint256"
            },
            {
                "name": "creator",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "baseModel",
                "type": "bytes32",
                "indexed": true,
                "internalType": "bytes32"
            },
            {
                "name": "quorum",
                "type": "uint8",
                "indexed": false,
                "internalType": "uint8"
            },
            {
                "name": "participants",
                "type": "address[]",
                "indexed": false,
                "internalType": "address[]"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "Submitted",
        "inputs": [
            {
                "name": "sessionId",
                "type": "uint256",
                "indexed": true,
                "internalType": "uint256"
            },
            {
                "name": "contributor",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "blobHash",
                "type": "bytes32",
                "indexed": false,
                "internalType": "bytes32"
            }
        ],
        "anonymous": false
    },
    {
        "type": "error",
        "name": "AggregatorPubkeyAlreadySet",
        "inputs": []
    },
    {
        "type": "error",
        "name": "AggregatorPubkeyNotSet",
        "inputs": []
    },
    {
        "type": "error",
        "name": "AlreadySubmitted",
        "inputs": []
    },
    {
        "type": "error",
        "name": "DuplicateParticipant",
        "inputs": []
    },
    {
        "type": "error",
        "name": "EmptyParticipants",
        "inputs": []
    },
    {
        "type": "error",
        "name": "EmptyPubkey",
        "inputs": []
    },
    {
        "type": "error",
        "name": "InvalidQuorum",
        "inputs": []
    },
    {
        "type": "error",
        "name": "LengthMismatch",
        "inputs": []
    },
    {
        "type": "error",
        "name": "NotCreator",
        "inputs": []
    },
    {
        "type": "error",
        "name": "NotParticipant",
        "inputs": []
    },
    {
        "type": "error",
        "name": "SessionNotFound",
        "inputs": []
    },
    {
        "type": "error",
        "name": "SessionNotOpen",
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
