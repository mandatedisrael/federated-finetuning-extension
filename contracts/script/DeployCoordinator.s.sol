// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Coordinator} from "../src/Coordinator.sol";

/// @notice Deploys the Coordinator. Run against Galileo with:
///         forge script script/DeployCoordinator.s.sol \
///           --rpc-url $GALILEO_RPC_URL \
///           --private-key $DEPLOYER_PRIVATE_KEY \
///           --broadcast
contract DeployCoordinator is Script {
    function run() external returns (Coordinator coord) {
        vm.startBroadcast();
        coord = new Coordinator();
        vm.stopBroadcast();

        console2.log("Coordinator deployed at:", address(coord));
    }
}
