// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { console2 } from "forge-std/console2.sol";
import { TestBase } from "../TestBase.sol";
import { TaikoL2 } from "../../contracts/L2/TaikoL2.sol";

contract TestTaikoL2_1559 is TestBase {
    function run() external {
        this.test_1559ParamCalculation();
    }

    function test_1559ParamCalculation() external {
        // Assume we scale L1 throughput by 10 times.
        uint64 scaleFactor = 10;

        // Assume we lower the L1 transaction cost by 25 times.
        uint64 costFactor = 25;

        // Calculate gas space issuance per second
        uint64 ethereumBlockTime = 12;

        // https://ultrasound.money/
        uint64 ethereumBasefeeNow = 28_000_000_000; // 28Gwei

        uint32 gasIssuedPerSecond = 1_250_000; // We make gasIssuedPerSecond
            // 15,000,000 / 12 = 1,250,000 gas/s

        // Tune this number manually so ratio2x1x is ~112.5%.
        uint64 maxSeconds = 7272;

        uint64 gasExcessMax = gasIssuedPerSecond * maxSeconds;

        uint64 initialBasefee = ethereumBasefeeNow / costFactor;

        TaikoL2.EIP1559Params memory param1559 = TaikoL2.EIP1559Params({
            basefee: initialBasefee,
            gasIssuedPerSecond: gasIssuedPerSecond,
            gasExcessMax: gasExcessMax,
            gasTarget: gasIssuedPerSecond * ethereumBlockTime,
            ratio2x1x: 11_250 // ~12.5% increase
         });

        console2.log("basefee           :", param1559.basefee);
        console2.log("gasIssuedPerSecond:", param1559.gasIssuedPerSecond);
        console2.log("gasExcessMax      :", param1559.gasExcessMax);
        console2.log("gasTarget         :", param1559.gasTarget);
        console2.log("ratio2x1x         :", param1559.ratio2x1x);

        // basefee           : 1120000000
        // gasIssuedPerSecond: 1250000
        // gasExcessMax      : 9090000000
        // gasTarget         : 15000000
        // ratio2x1x         : 11250

        TaikoL2 L2 = new TaikoL2();
        address dummyAddressManager = getRandomAddress();
        L2.init(dummyAddressManager, param1559);
    }
}