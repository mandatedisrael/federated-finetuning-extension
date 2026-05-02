// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {INFTMinter} from "../src/INFTMinter.sol";

/// @notice Deploys INFTMinter with a configurable minter address.
///
///         Run against Galileo:
///           MINTER_ADDRESS=0x... \
///           forge script script/DeployINFTMinter.s.sol \
///             --rpc-url $GALILEO_RPC_URL \
///             --private-key $DEPLOYER_PRIVATE_KEY \
///             --broadcast
///
///         If MINTER_ADDRESS is not set, the deployer wallet is used as the
///         minter (convenient for local testing and demo runs).
contract DeployINFTMinter is Script {
    function run() external returns (INFTMinter inftMinter) {
        address minterAddr = vm.envOr("MINTER_ADDRESS", msg.sender);

        vm.startBroadcast();
        inftMinter = new INFTMinter(minterAddr);
        vm.stopBroadcast();

        console2.log("INFTMinter deployed at:", address(inftMinter));
        console2.log("Minter address:        ", minterAddr);
    }
}
