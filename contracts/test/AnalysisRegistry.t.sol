// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../AnalysisRegistry.sol";

contract AnalysisRegistryTest is Test {
    AnalysisRegistry public registry;

    uint256 internal ownerPk;
    uint256 internal operatorPk;
    uint256 internal unauthorizedPk;

    address public owner;
    address public operator;
    address public unauthorizedOperator;
    address public relayer;
    address public bob;

    function _rootHash(uint256 seed) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("root", seed));
    }

    function _taskHash(uint256 seed) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("task", seed));
    }

    function _signature(
        uint256 privateKey,
        bytes32 taskHash,
        bytes32 rootHash,
        uint8 score,
        uint256 signedAt
    ) internal view returns (bytes memory) {
        bytes32 digest = registry.hashAnalysis(taskHash, rootHash, score, signedAt);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function setUp() public {
        ownerPk = 0xA11CE;
        operatorPk = 0xB0B;
        unauthorizedPk = 0xCAFE;

        owner = vm.addr(ownerPk);
        operator = vm.addr(operatorPk);
        unauthorizedOperator = vm.addr(unauthorizedPk);
        relayer = makeAddr("relayer");
        bob = makeAddr("bob");

        vm.prank(owner);
        registry = new AnalysisRegistry();

        vm.prank(owner);
        registry.setAuthorizedOperator(operator, true);
    }

    function test_deploy() public view {
        assertEq(registry.owner(), owner, "owner should be deployer");
        assertEq(registry.analysisCount(), 0, "analysisCount should be 0 on deploy");
        assertEq(registry.RATE_LIMIT_INTERVAL(), 60, "RATE_LIMIT_INTERVAL should be 60 seconds");
        assertTrue(registry.authorizedOperators(owner), "owner should be an operator by default");
        assertTrue(registry.authorizedOperators(operator), "configured operator should be authorized");
    }

    function test_recordAnalysisWithAuthorizedSignature() public {
        bytes32 taskHash = _taskHash(1);
        bytes32 rootHash = _rootHash(1);
        string memory uri = "0g://abc123";
        uint8 score = 75;
        string memory rec = "INVESTIGATE_MORE";
        uint256 signedAt = block.timestamp;
        bytes memory sig = _signature(operatorPk, taskHash, rootHash, score, signedAt);

        vm.expectEmit(true, true, true, true);
        emit AnalysisRegistry.AnalysisRecorded(
            1,
            operator,
            taskHash,
            rootHash,
            score,
            rec,
            uri,
            signedAt
        );

        vm.prank(relayer);
        uint256 id = registry.recordAnalysis(taskHash, rootHash, uri, score, rec, signedAt, sig);

        assertEq(id, 1, "First analysis should have id 1");
        assertEq(registry.analysisCount(), 1, "analysisCount should be 1");

        (
            address submitter,
            bytes32 storedHash,
            string memory storedUri,
            uint8 storedScore,
            string memory storedRec,
            uint256 timestamp
        ) = registry.getAnalysis(1);

        assertEq(submitter, operator, "submitter should be recovered operator, not relayer");
        assertEq(storedHash, rootHash);
        assertEqualStrings(storedUri, uri);
        assertEq(storedScore, score);
        assertEqualStrings(storedRec, rec);
        assertEq(timestamp, signedAt);

        (bytes32 storedTaskHash, bytes memory storedSig, bool submitterAuthorized) =
            registry.getAnalysisAuth(1);
        assertEq(storedTaskHash, taskHash);
        assertEq(keccak256(storedSig), keccak256(sig));
        assertTrue(submitterAuthorized);
    }

    function test_rejectsUnauthorizedOperatorSignature() public {
        bytes32 taskHash = _taskHash(2);
        bytes32 rootHash = _rootHash(2);
        uint8 score = 80;
        uint256 signedAt = block.timestamp;
        bytes memory sig = _signature(unauthorizedPk, taskHash, rootHash, score, signedAt);

        vm.prank(relayer);
        vm.expectRevert("Unauthorized operator signature");
        registry.recordAnalysis(taskHash, rootHash, "0g://bad", score, "GO", signedAt, sig);
    }

    function test_rejectsTamperedScore() public {
        bytes32 taskHash = _taskHash(3);
        bytes32 rootHash = _rootHash(3);
        uint256 signedAt = block.timestamp;
        bytes memory sig = _signature(operatorPk, taskHash, rootHash, 80, signedAt);

        vm.prank(relayer);
        vm.expectRevert("Unauthorized operator signature");
        registry.recordAnalysis(taskHash, rootHash, "0g://bad", 81, "GO", signedAt, sig);
    }

    function test_ownerControlsOperatorAllowlist() public {
        vm.prank(bob);
        vm.expectRevert("Only owner");
        registry.setAuthorizedOperator(unauthorizedOperator, true);

        vm.prank(owner);
        registry.setAuthorizedOperator(unauthorizedOperator, true);

        assertTrue(registry.authorizedOperators(unauthorizedOperator));

        vm.prank(owner);
        registry.setAuthorizedOperator(unauthorizedOperator, false);

        assertFalse(registry.authorizedOperators(unauthorizedOperator));
    }

    function test_duplicateHashRejected() public {
        bytes32 taskHash = _taskHash(4);
        bytes32 rootHash = _rootHash(4);
        uint256 signedAt = block.timestamp;
        bytes memory sig = _signature(operatorPk, taskHash, rootHash, 80, signedAt);

        vm.prank(relayer);
        registry.recordAnalysis(taskHash, rootHash, "0g://first", 80, "GO", signedAt, sig);

        vm.warp(block.timestamp + 61);

        uint256 secondSignedAt = block.timestamp;
        bytes memory secondSig = _signature(operatorPk, taskHash, rootHash, 50, secondSignedAt);

        vm.prank(relayer);
        vm.expectRevert("Root hash already registered");
        registry.recordAnalysis(taskHash, rootHash, "0g://second", 50, "NO_GO", secondSignedAt, secondSig);
    }

    function test_hashToAnalysisIdMapping() public {
        bytes32 taskHash1 = _taskHash(100);
        bytes32 rootHash1 = _rootHash(100);
        uint256 signedAt1 = block.timestamp;
        bytes memory sig1 = _signature(operatorPk, taskHash1, rootHash1, 70, signedAt1);

        vm.prank(relayer);
        registry.recordAnalysis(taskHash1, rootHash1, "0g://a", 70, "GO", signedAt1, sig1);

        vm.warp(block.timestamp + 61);

        bytes32 taskHash2 = _taskHash(200);
        bytes32 rootHash2 = _rootHash(200);
        uint256 signedAt2 = block.timestamp;
        bytes memory sig2 = _signature(operatorPk, taskHash2, rootHash2, 40, signedAt2);

        vm.prank(relayer);
        registry.recordAnalysis(taskHash2, rootHash2, "0g://b", 40, "NO_GO", signedAt2, sig2);

        assertEq(registry.hashToAnalysisId(rootHash1), 1);
        assertEq(registry.hashToAnalysisId(rootHash2), 2);
        assertTrue(registry.isRootHashRegistered(rootHash1));
        assertTrue(registry.isRootHashRegistered(rootHash2));
        assertFalse(registry.isRootHashRegistered(_rootHash(999)));
    }

    function test_rateLimitedByOperatorNotRelayer() public {
        bytes32 taskHash1 = _taskHash(5);
        bytes32 rootHash1 = _rootHash(5);
        uint256 signedAt1 = block.timestamp;
        bytes memory sig1 = _signature(operatorPk, taskHash1, rootHash1, 60, signedAt1);

        vm.prank(relayer);
        registry.recordAnalysis(taskHash1, rootHash1, "0g://first", 60, "GO", signedAt1, sig1);

        bytes32 taskHash2 = _taskHash(6);
        bytes32 rootHash2 = _rootHash(6);
        uint256 signedAt2 = block.timestamp;
        bytes memory sig2 = _signature(operatorPk, taskHash2, rootHash2, 50, signedAt2);

        vm.prank(bob);
        vm.expectRevert("Rate limited: wait before submitting again");
        registry.recordAnalysis(taskHash2, rootHash2, "0g://second", 50, "NO_GO", signedAt2, sig2);

        vm.warp(block.timestamp + 60);

        uint256 signedAt3 = block.timestamp;
        bytes memory sig3 = _signature(operatorPk, taskHash2, rootHash2, 50, signedAt3);

        vm.prank(bob);
        uint256 id = registry.recordAnalysis(taskHash2, rootHash2, "0g://second", 50, "NO_GO", signedAt3, sig3);
        assertEq(id, 2);
    }

    function test_zeroHashesRejected() public {
        bytes32 rootHash = _rootHash(7);
        uint256 signedAt = block.timestamp;
        bytes memory sig = _signature(operatorPk, bytes32(0), rootHash, 50, signedAt);

        vm.prank(relayer);
        vm.expectRevert("Task hash cannot be zero");
        registry.recordAnalysis(bytes32(0), rootHash, "0g://zero", 50, "GO", signedAt, sig);

        bytes32 taskHash = _taskHash(7);
        sig = _signature(operatorPk, taskHash, bytes32(0), 50, signedAt);

        vm.prank(relayer);
        vm.expectRevert("Root hash cannot be zero");
        registry.recordAnalysis(taskHash, bytes32(0), "0g://zero", 50, "GO", signedAt, sig);
    }

    function test_invalidScoreRejected() public {
        bytes32 taskHash = _taskHash(8);
        bytes32 rootHash = _rootHash(8);
        uint8 invalidScore = 101;
        uint256 signedAt = block.timestamp;
        bytes memory sig = _signature(operatorPk, taskHash, rootHash, invalidScore, signedAt);

        vm.prank(relayer);
        vm.expectRevert("Score must be 0-100");
        registry.recordAnalysis(taskHash, rootHash, "0g://bad", invalidScore, "GO", signedAt, sig);
    }

    function test_invalidSignatureLengthRejected() public {
        bytes memory badSig = hex"1234";

        vm.prank(relayer);
        vm.expectRevert("Invalid signature length");
        registry.recordAnalysis(_taskHash(9), _rootHash(9), "0g://bad", 50, "GO", block.timestamp, badSig);
    }

    function test_getLatestAnalysis() public {
        bytes32 taskHash1 = _taskHash(10);
        bytes32 rootHash1 = _rootHash(10);
        uint256 signedAt1 = block.timestamp;
        bytes memory sig1 = _signature(operatorPk, taskHash1, rootHash1, 60, signedAt1);

        vm.prank(relayer);
        registry.recordAnalysis(taskHash1, rootHash1, "0g://first", 60, "GO", signedAt1, sig1);

        vm.warp(block.timestamp + 61);

        bytes32 taskHash2 = _taskHash(11);
        bytes32 rootHash2 = _rootHash(11);
        uint256 signedAt2 = block.timestamp;
        bytes memory sig2 = _signature(operatorPk, taskHash2, rootHash2, 40, signedAt2);

        vm.prank(bob);
        registry.recordAnalysis(taskHash2, rootHash2, "0g://second", 40, "NO_GO", signedAt2, sig2);

        (
            address submitter,
            bytes32 rootHash,
            string memory uri,
            uint8 score,
            string memory rec,
            uint256 timestamp
        ) = registry.getLatestAnalysis();

        assertEq(submitter, operator);
        assertEq(rootHash, rootHash2);
        assertEqualStrings(uri, "0g://second");
        assertEq(score, 40);
        assertEqualStrings(rec, "NO_GO");
        assertEq(timestamp, signedAt2);

        (bytes32 taskHash, bytes memory storedSig, bool submitterAuthorized) =
            registry.getLatestAnalysisAuth();
        assertEq(taskHash, taskHash2);
        assertEq(keccak256(storedSig), keccak256(sig2));
        assertTrue(submitterAuthorized);
    }

    function test_getAnalysisNotFound() public {
        vm.expectRevert("Analysis not found");
        registry.getAnalysis(999);

        vm.expectRevert("Analysis not found");
        registry.getAnalysisAuth(999);
    }

    function test_transferOwnership() public {
        vm.prank(bob);
        vm.expectRevert("Only owner");
        registry.transferOwnership(bob);

        vm.prank(owner);
        registry.transferOwnership(bob);

        assertEq(registry.owner(), bob);
    }

    function assertEqualStrings(string memory a, string memory b) internal pure {
        assertEq(keccak256(bytes(a)), keccak256(bytes(b)));
    }
}
