// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../AnalysisRegistry.sol";

contract AnalysisRegistryTest is Test {
    AnalysisRegistry public registry;

    uint256 internal constant CURVE_ORDER =
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    event AnalysisRecorded(
        uint256 indexed analysisId,
        address indexed submitter,
        bytes32 indexed taskHash,
        bytes32 rootHash,
        uint8 score,
        string recommendation,
        string storageUri,
        uint256 timestamp,
        bytes signature
    );

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
        string memory storageUri,
        string memory recommendation,
        uint256 signedAt
    ) internal view returns (bytes memory) {
        bytes32 digest = registry.hashAnalysis(
            taskHash,
            rootHash,
            score,
            storageUri,
            recommendation,
            signedAt
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _highSSignature(
        uint256 privateKey,
        bytes32 taskHash,
        bytes32 rootHash,
        uint8 score,
        string memory storageUri,
        string memory recommendation,
        uint256 signedAt
    ) internal view returns (bytes memory) {
        bytes32 digest = registry.hashAnalysis(
            taskHash,
            rootHash,
            score,
            storageUri,
            recommendation,
            signedAt
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        uint8 highV = v == 27 ? 28 : 27;
        bytes32 highS = bytes32(CURVE_ORDER - uint256(s));
        return abi.encodePacked(r, highS, highV);
    }

    function setUp() public {
        vm.warp(1_700_000_000);

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
        assertEq(registry.pendingOwner(), address(0), "pending owner should be empty");
        assertEq(registry.analysisCount(), 0, "analysisCount should be 0 on deploy");
        assertEq(registry.RATE_LIMIT_INTERVAL(), 60, "RATE_LIMIT_INTERVAL should be 60 seconds");
        assertEq(registry.SIGNATURE_VALIDITY(), 300, "SIGNATURE_VALIDITY should be 5 minutes");
        assertEq(registry.SIGNATURE_FUTURE_TOLERANCE(), 30, "future tolerance should be 30 seconds");
        assertEq(registry.MAX_BATCH_SIZE(), 100, "MAX_BATCH_SIZE should be 100");
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
        bytes memory sig = _signature(operatorPk, taskHash, rootHash, score, uri, rec, signedAt);

        vm.expectEmit(true, true, true, true);
        emit AnalysisRecorded(
            1,
            operator,
            taskHash,
            rootHash,
            score,
            rec,
            uri,
            signedAt,
            sig
        );

        vm.prank(relayer);
        uint256 id = registry.recordAnalysis(taskHash, rootHash, uri, score, rec, signedAt, sig);

        assertEq(id, 1, "first analysis should have id 1");
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

        (bytes32 storedTaskHash, bool submitterAuthorized) = registry.getAnalysisAuth(1);
        assertEq(storedTaskHash, taskHash);
        assertTrue(submitterAuthorized);
    }

    function test_rejectsUnauthorizedOperatorSignature() public {
        bytes32 taskHash = _taskHash(2);
        bytes32 rootHash = _rootHash(2);
        string memory uri = "0g://bad";
        string memory rec = "GO";
        uint8 score = 80;
        uint256 signedAt = block.timestamp;
        bytes memory sig = _signature(unauthorizedPk, taskHash, rootHash, score, uri, rec, signedAt);

        vm.prank(relayer);
        vm.expectRevert("Unauthorized operator signature");
        registry.recordAnalysis(taskHash, rootHash, uri, score, rec, signedAt, sig);
    }

    function test_rejectsTamperedScore() public {
        bytes32 taskHash = _taskHash(3);
        bytes32 rootHash = _rootHash(3);
        string memory uri = "0g://bad";
        string memory rec = "GO";
        uint256 signedAt = block.timestamp;
        bytes memory sig = _signature(operatorPk, taskHash, rootHash, 80, uri, rec, signedAt);

        vm.prank(relayer);
        vm.expectRevert("Unauthorized operator signature");
        registry.recordAnalysis(taskHash, rootHash, uri, 81, rec, signedAt, sig);
    }

    function test_rejectsTamperedStorageUri() public {
        bytes32 taskHash = _taskHash(30);
        bytes32 rootHash = _rootHash(30);
        string memory rec = "GO";
        uint256 signedAt = block.timestamp;
        bytes memory sig = _signature(operatorPk, taskHash, rootHash, 80, "0g://signed", rec, signedAt);

        vm.prank(relayer);
        vm.expectRevert("Unauthorized operator signature");
        registry.recordAnalysis(taskHash, rootHash, "0g://tampered", 80, rec, signedAt, sig);
    }

    function test_rejectsTamperedRecommendation() public {
        bytes32 taskHash = _taskHash(31);
        bytes32 rootHash = _rootHash(31);
        string memory uri = "0g://rec";
        uint256 signedAt = block.timestamp;
        bytes memory sig = _signature(operatorPk, taskHash, rootHash, 80, uri, "GO", signedAt);

        vm.prank(relayer);
        vm.expectRevert("Unauthorized operator signature");
        registry.recordAnalysis(taskHash, rootHash, uri, 80, "NO_GO", signedAt, sig);
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
        bytes memory sig = _signature(operatorPk, taskHash, rootHash, 80, "0g://first", "GO", signedAt);

        vm.prank(relayer);
        registry.recordAnalysis(taskHash, rootHash, "0g://first", 80, "GO", signedAt, sig);

        vm.warp(block.timestamp + 61);

        uint256 secondSignedAt = block.timestamp;
        bytes memory secondSig = _signature(
            operatorPk,
            taskHash,
            rootHash,
            50,
            "0g://second",
            "NO_GO",
            secondSignedAt
        );

        vm.prank(relayer);
        vm.expectRevert("Root hash already registered");
        registry.recordAnalysis(taskHash, rootHash, "0g://second", 50, "NO_GO", secondSignedAt, secondSig);
    }

    function test_duplicateHashRejectedBeforeSignatureRecovery() public {
        bytes32 taskHash = _taskHash(40);
        bytes32 rootHash = _rootHash(40);
        uint256 signedAt = block.timestamp;
        bytes memory sig = _signature(operatorPk, taskHash, rootHash, 80, "0g://first", "GO", signedAt);

        vm.prank(relayer);
        registry.recordAnalysis(taskHash, rootHash, "0g://first", 80, "GO", signedAt, sig);

        vm.prank(relayer);
        vm.expectRevert("Root hash already registered");
        registry.recordAnalysis(taskHash, rootHash, "0g://second", 80, "GO", signedAt, hex"1234");
    }

    function test_hashToAnalysisIdMapping() public {
        bytes32 taskHash1 = _taskHash(100);
        bytes32 rootHash1 = _rootHash(100);
        uint256 signedAt1 = block.timestamp;
        bytes memory sig1 = _signature(operatorPk, taskHash1, rootHash1, 70, "0g://a", "GO", signedAt1);

        vm.prank(relayer);
        registry.recordAnalysis(taskHash1, rootHash1, "0g://a", 70, "GO", signedAt1, sig1);

        vm.warp(block.timestamp + 61);

        bytes32 taskHash2 = _taskHash(200);
        bytes32 rootHash2 = _rootHash(200);
        uint256 signedAt2 = block.timestamp;
        bytes memory sig2 = _signature(operatorPk, taskHash2, rootHash2, 40, "0g://b", "NO_GO", signedAt2);

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
        bytes memory sig1 = _signature(operatorPk, taskHash1, rootHash1, 60, "0g://first", "GO", signedAt1);

        vm.prank(relayer);
        registry.recordAnalysis(taskHash1, rootHash1, "0g://first", 60, "GO", signedAt1, sig1);

        bytes32 taskHash2 = _taskHash(6);
        bytes32 rootHash2 = _rootHash(6);
        uint256 signedAt2 = block.timestamp;
        bytes memory sig2 = _signature(operatorPk, taskHash2, rootHash2, 50, "0g://second", "NO_GO", signedAt2);

        vm.prank(bob);
        vm.expectRevert("Rate limited: wait before submitting again");
        registry.recordAnalysis(taskHash2, rootHash2, "0g://second", 50, "NO_GO", signedAt2, sig2);

        vm.warp(block.timestamp + 60);

        uint256 signedAt3 = block.timestamp;
        bytes memory sig3 = _signature(operatorPk, taskHash2, rootHash2, 50, "0g://second", "NO_GO", signedAt3);

        vm.prank(bob);
        uint256 id = registry.recordAnalysis(taskHash2, rootHash2, "0g://second", 50, "NO_GO", signedAt3, sig3);
        assertEq(id, 2);
    }

    function test_zeroHashesRejected() public {
        bytes32 rootHash = _rootHash(7);
        uint256 signedAt = block.timestamp;
        bytes memory sig = _signature(operatorPk, bytes32(0), rootHash, 50, "0g://zero", "GO", signedAt);

        vm.prank(relayer);
        vm.expectRevert("Task hash cannot be zero");
        registry.recordAnalysis(bytes32(0), rootHash, "0g://zero", 50, "GO", signedAt, sig);

        bytes32 taskHash = _taskHash(7);
        sig = _signature(operatorPk, taskHash, bytes32(0), 50, "0g://zero", "GO", signedAt);

        vm.prank(relayer);
        vm.expectRevert("Root hash cannot be zero");
        registry.recordAnalysis(taskHash, bytes32(0), "0g://zero", 50, "GO", signedAt, sig);
    }

    function test_invalidScoreRejected() public {
        bytes32 taskHash = _taskHash(8);
        bytes32 rootHash = _rootHash(8);
        uint8 invalidScore = 101;
        uint256 signedAt = block.timestamp;
        bytes memory sig = _signature(operatorPk, taskHash, rootHash, invalidScore, "0g://bad", "GO", signedAt);

        vm.prank(relayer);
        vm.expectRevert("Score must be 0-100");
        registry.recordAnalysis(taskHash, rootHash, "0g://bad", invalidScore, "GO", signedAt, sig);
    }

    function test_invalidRecommendationRejected() public {
        bytes32 taskHash = _taskHash(81);
        bytes32 rootHash = _rootHash(81);
        uint256 signedAt = block.timestamp;
        bytes memory sig = _signature(operatorPk, taskHash, rootHash, 80, "0g://bad-rec", "MAYBE", signedAt);

        vm.prank(relayer);
        vm.expectRevert("Invalid recommendation");
        registry.recordAnalysis(taskHash, rootHash, "0g://bad-rec", 80, "MAYBE", signedAt, sig);
    }

    function test_invalidStorageUriRejected() public {
        bytes32 taskHash = _taskHash(82);
        bytes32 rootHash = _rootHash(82);
        uint256 signedAt = block.timestamp;
        bytes memory sig = _signature(operatorPk, taskHash, rootHash, 80, "0g://valid", "GO", signedAt);

        vm.prank(relayer);
        vm.expectRevert("Storage URI cannot be empty");
        registry.recordAnalysis(taskHash, rootHash, "", 80, "GO", signedAt, sig);

        vm.prank(relayer);
        vm.expectRevert("Storage URI must start with 0g://");
        registry.recordAnalysis(taskHash, rootHash, "ipfs://bad", 80, "GO", signedAt, sig);
    }

    function test_expiredSignatureRejected() public {
        bytes32 taskHash = _taskHash(83);
        bytes32 rootHash = _rootHash(83);
        uint256 signedAt = block.timestamp - registry.SIGNATURE_VALIDITY() - 1;
        bytes memory sig = _signature(operatorPk, taskHash, rootHash, 80, "0g://expired", "GO", signedAt);

        vm.prank(relayer);
        vm.expectRevert("Signature expired");
        registry.recordAnalysis(taskHash, rootHash, "0g://expired", 80, "GO", signedAt, sig);
    }

    function test_farFutureSignatureRejected() public {
        bytes32 taskHash = _taskHash(84);
        bytes32 rootHash = _rootHash(84);
        uint256 signedAt = block.timestamp + registry.SIGNATURE_FUTURE_TOLERANCE() + 1;
        bytes memory sig = _signature(operatorPk, taskHash, rootHash, 80, "0g://future", "GO", signedAt);

        vm.prank(relayer);
        vm.expectRevert("Timestamp too far in future");
        registry.recordAnalysis(taskHash, rootHash, "0g://future", 80, "GO", signedAt, sig);
    }

    function test_acceptsSmallFutureClockSkew() public {
        bytes32 taskHash = _taskHash(85);
        bytes32 rootHash = _rootHash(85);
        uint256 signedAt = block.timestamp + registry.SIGNATURE_FUTURE_TOLERANCE();
        bytes memory sig = _signature(operatorPk, taskHash, rootHash, 80, "0g://skew", "GO", signedAt);

        vm.prank(relayer);
        uint256 id = registry.recordAnalysis(taskHash, rootHash, "0g://skew", 80, "GO", signedAt, sig);

        assertEq(id, 1);
    }

    function test_invalidSignatureLengthRejected() public {
        bytes memory badSig = hex"1234";

        vm.prank(relayer);
        vm.expectRevert("Invalid signature length");
        registry.recordAnalysis(_taskHash(9), _rootHash(9), "0g://bad", 50, "GO", block.timestamp, badSig);
    }

    function test_highSSignatureRejected() public {
        bytes32 taskHash = _taskHash(91);
        bytes32 rootHash = _rootHash(91);
        uint256 signedAt = block.timestamp;
        bytes memory sig = _highSSignature(operatorPk, taskHash, rootHash, 80, "0g://high-s", "GO", signedAt);

        vm.prank(relayer);
        vm.expectRevert("Invalid signature s");
        registry.recordAnalysis(taskHash, rootHash, "0g://high-s", 80, "GO", signedAt, sig);
    }

    function test_getLatestAnalysis() public {
        bytes32 taskHash1 = _taskHash(10);
        bytes32 rootHash1 = _rootHash(10);
        uint256 signedAt1 = block.timestamp;
        bytes memory sig1 = _signature(operatorPk, taskHash1, rootHash1, 60, "0g://first", "GO", signedAt1);

        vm.prank(relayer);
        registry.recordAnalysis(taskHash1, rootHash1, "0g://first", 60, "GO", signedAt1, sig1);

        vm.warp(block.timestamp + 61);

        bytes32 taskHash2 = _taskHash(11);
        bytes32 rootHash2 = _rootHash(11);
        uint256 signedAt2 = block.timestamp;
        bytes memory sig2 = _signature(operatorPk, taskHash2, rootHash2, 40, "0g://second", "NO_GO", signedAt2);

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

        (bytes32 taskHash, bool submitterAuthorized) = registry.getLatestAnalysisAuth();
        assertEq(taskHash, taskHash2);
        assertTrue(submitterAuthorized);
    }

    function test_getAnalysisBatch() public {
        bytes32 taskHash1 = _taskHash(1010);
        bytes32 rootHash1 = _rootHash(1010);
        uint256 signedAt1 = block.timestamp;
        bytes memory sig1 = _signature(operatorPk, taskHash1, rootHash1, 60, "0g://batch-a", "GO", signedAt1);

        vm.prank(relayer);
        registry.recordAnalysis(taskHash1, rootHash1, "0g://batch-a", 60, "GO", signedAt1, sig1);

        vm.warp(block.timestamp + 61);

        bytes32 taskHash2 = _taskHash(1011);
        bytes32 rootHash2 = _rootHash(1011);
        uint256 signedAt2 = block.timestamp;
        bytes memory sig2 = _signature(
            operatorPk,
            taskHash2,
            rootHash2,
            45,
            "0g://batch-b",
            "INVESTIGATE_MORE",
            signedAt2
        );

        vm.prank(relayer);
        registry.recordAnalysis(taskHash2, rootHash2, "0g://batch-b", 45, "INVESTIGATE_MORE", signedAt2, sig2);

        {
            (uint256[] memory ids, address[] memory submitters,,,,,,) = registry.getAnalysisBatch(1, 10);

            assertEq(ids.length, 2);
            assertEq(ids[0], 1);
            assertEq(ids[1], 2);
            assertEq(submitters[0], operator);
        }

        {
            (,, bytes32[] memory taskHashes, bytes32[] memory rootHashes,,,,) = registry.getAnalysisBatch(1, 10);

            assertEq(taskHashes[1], taskHash2);
            assertEq(rootHashes[0], rootHash1);
        }

        {
            (,,,, string[] memory storageUris, uint8[] memory scores, string[] memory recommendations,) =
                registry.getAnalysisBatch(1, 10);

            assertEqualStrings(storageUris[0], "0g://batch-a");
            assertEq(scores[1], 45);
            assertEqualStrings(recommendations[1], "INVESTIGATE_MORE");
        }

        {
            (,,,,,,, uint256[] memory timestamps) = registry.getAnalysisBatch(1, 10);

            assertEq(timestamps[0], 1_700_000_000);
            assertEq(timestamps[1], 1_700_000_061);
        }
    }

    function test_getAnalysisBatchValidation() public {
        vm.expectRevert("fromId must be >= 1");
        registry.getAnalysisBatch(0, 1);

        vm.expectRevert("limit must be > 0");
        registry.getAnalysisBatch(1, 0);

        uint256 tooLarge = registry.MAX_BATCH_SIZE() + 1;
        vm.expectRevert("limit too large");
        registry.getAnalysisBatch(1, tooLarge);
    }

    function test_getAnalysisNotFound() public {
        vm.expectRevert("Analysis not found");
        registry.getAnalysis(999);

        vm.expectRevert("Analysis not found");
        registry.getAnalysisAuth(999);
    }

    function test_transferOwnershipTwoStep() public {
        vm.prank(bob);
        vm.expectRevert("Only owner");
        registry.transferOwnership(bob);

        vm.prank(owner);
        registry.transferOwnership(bob);

        assertEq(registry.owner(), owner);
        assertEq(registry.pendingOwner(), bob);

        vm.prank(relayer);
        vm.expectRevert("Only pending owner");
        registry.acceptOwnership();

        vm.prank(bob);
        registry.acceptOwnership();

        assertEq(registry.owner(), bob);
        assertEq(registry.pendingOwner(), address(0));
    }

    function test_cancelOwnershipTransfer() public {
        vm.prank(owner);
        registry.transferOwnership(bob);

        vm.prank(owner);
        registry.cancelOwnershipTransfer();

        assertEq(registry.owner(), owner);
        assertEq(registry.pendingOwner(), address(0));

        vm.prank(bob);
        vm.expectRevert("Only pending owner");
        registry.acceptOwnership();
    }

    function assertEqualStrings(string memory a, string memory b) internal pure {
        assertEq(keccak256(bytes(a)), keccak256(bytes(b)));
    }
}
