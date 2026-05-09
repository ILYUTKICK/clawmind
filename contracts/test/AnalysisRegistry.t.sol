// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../AnalysisRegistry.sol";

contract AnalysisRegistryTest is Test {
    AnalysisRegistry public registry;
    address public alice;
    address public bob;

    // Helper: generate a deterministic root hash from a seed
    function _rootHash(uint256 seed) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(seed));
    }

    function setUp() public {
        registry = new AnalysisRegistry();
        alice = makeAddr("alice");
        bob = makeAddr("bob");
    }

    // ─── test_deploy ─────────────────────────────────────────────────────
    // Contract deploys with correct initial state
    function test_deploy() public view {
        assertEq(registry.analysisCount(), 0, "analysisCount should be 0 on deploy");
        assertEq(
            registry.RATE_LIMIT_INTERVAL(),
            60,
            "RATE_LIMIT_INTERVAL should be 60 seconds"
        );
    }

    // ─── test_recordAnalysis ─────────────────────────────────────────────
    // Successful record emits event and updates state
    function test_recordAnalysis() public {
        bytes32 rootHash = _rootHash(1);
        string memory uri = "0g://abc123";
        uint8 score = 75;
        string memory rec = "INVESTIGATE_MORE";

        vm.expectEmit(true, true, false, true);
        emit AnalysisRegistry.AnalysisRecorded(
            1,
            alice,
            rootHash,
            score,
            rec,
            uri,
            block.timestamp
        );

        vm.prank(alice);
        uint256 id = registry.recordAnalysis(rootHash, uri, score, rec);

        assertEq(id, 1, "First analysis should have id 1");
        assertEq(registry.analysisCount(), 1, "analysisCount should be 1");

        // Verify stored data
        (
            address submitter,
            bytes32 storedHash,
            string memory storedUri,
            uint8 storedScore,
            string memory storedRec,
            uint256 timestamp
        ) = registry.getAnalysis(1);

        assertEq(submitter, alice);
        assertEq(storedHash, rootHash);
        assertEqualStrings(storedUri, uri);
        assertEq(storedScore, score);
        assertEqualStrings(storedRec, rec);
        assertGt(timestamp, 0);
    }

    // ─── test_duplicateHashRejected ──────────────────────────────────────
    // Cannot register the same rootHash twice
    function test_duplicateHashRejected() public {
        bytes32 rootHash = _rootHash(42);

        vm.prank(alice);
        registry.recordAnalysis(rootHash, "0g://first", 80, "GO");

        // Advance time past rate limit so same address can submit again
        vm.warp(block.timestamp + 61);

        vm.prank(alice);
        vm.expectRevert("Root hash already registered");
        registry.recordAnalysis(rootHash, "0g://second", 50, "NO_GO");
    }

    // ─── test_hashToAnalysisIdMapping ────────────────────────────────────
    // After recording, lookup by hash returns correct ID
    function test_hashToAnalysisIdMapping() public {
        bytes32 rootHash1 = _rootHash(100);
        bytes32 rootHash2 = _rootHash(200);

        vm.prank(alice);
        registry.recordAnalysis(rootHash1, "0g://a", 70, "GO");

        vm.warp(block.timestamp + 61);

        vm.prank(alice);
        registry.recordAnalysis(rootHash2, "0g://b", 40, "NO_GO");

        assertEq(registry.hashToAnalysisId(rootHash1), 1);
        assertEq(registry.hashToAnalysisId(rootHash2), 2);

        // isRootHashRegistered
        assertTrue(registry.isRootHashRegistered(rootHash1));
        assertTrue(registry.isRootHashRegistered(rootHash2));
        assertFalse(registry.isRootHashRegistered(_rootHash(999)));
    }

    // ─── test_rateLimited ────────────────────────────────────────────────
    // Same address cannot submit twice within RATE_LIMIT_INTERVAL
    function test_rateLimited() public {
        vm.prank(alice);
        registry.recordAnalysis(_rootHash(1), "0g://first", 60, "GO");

        // Immediate second attempt — should revert
        vm.prank(alice);
        vm.expectRevert("Rate limited: wait before submitting again");
        registry.recordAnalysis(_rootHash(2), "0g://second", 50, "NO_GO");

        // After 59 seconds — still rate limited
        vm.warp(block.timestamp + 59);
        vm.prank(alice);
        vm.expectRevert("Rate limited: wait before submitting again");
        registry.recordAnalysis(_rootHash(2), "0g://second", 50, "NO_GO");

        // After 60 seconds — allowed
        vm.warp(block.timestamp + 1);
        vm.prank(alice);
        uint256 id = registry.recordAnalysis(_rootHash(2), "0g://second", 50, "NO_GO");
        assertEq(id, 2);
    }

    // ─── test_differentAddressesNotRateLimited ───────────────────────────
    // Different addresses can submit independently
    function test_differentAddressesNotRateLimited() public {
        vm.prank(alice);
        registry.recordAnalysis(_rootHash(1), "0g://alice1", 70, "GO");

        // Bob can submit immediately — different address
        vm.prank(bob);
        uint256 id = registry.recordAnalysis(_rootHash(2), "0g://bob1", 55, "INVESTIGATE_MORE");
        assertEq(id, 2);
    }

    // ─── test_zeroHashRejected ───────────────────────────────────────────
    function test_zeroHashRejected() public {
        vm.prank(alice);
        vm.expectRevert("Root hash cannot be zero");
        registry.recordAnalysis(bytes32(0), "0g://zero", 50, "GO");
    }

    // ─── test_invalidScoreRejected ───────────────────────────────────────
    function test_invalidScoreRejected() public {
        vm.prank(alice);
        vm.expectRevert("Score must be 0-100");
        registry.recordAnalysis(_rootHash(1), "0g://bad", 101, "GO");
    }

    // ─── test_getLatestAnalysis ──────────────────────────────────────────
    function test_getLatestAnalysis() public {
        vm.prank(alice);
        registry.recordAnalysis(_rootHash(1), "0g://first", 60, "GO");

        vm.warp(block.timestamp + 61);

        vm.prank(bob);
        registry.recordAnalysis(_rootHash(2), "0g://second", 40, "NO_GO");

        (
            address submitter,
            bytes32 rootHash,
            string memory uri,
            uint8 score,
            string memory rec,
            uint256 timestamp
        ) = registry.getLatestAnalysis();

        assertEq(submitter, bob);
        assertEq(rootHash, _rootHash(2));
        assertEq(score, 40);
    }

    // ─── test_getAnalysisNotFound ────────────────────────────────────────
    function test_getAnalysisNotFound() public {
        vm.expectRevert("Analysis not found");
        registry.getAnalysis(999);
    }

    // ─── Helper ──────────────────────────────────────────────────────────
    function assertEqualStrings(string memory a, string memory b) internal pure {
        assertEq(keccak256(bytes(a)), keccak256(bytes(b)));
    }
}
