// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AnalysisRegistry
 * @notice On-chain registry for ClawMind analysis reports.
 *         Each analysis is anchored with its storage root hash,
 *         score, recommendation, and 0G Storage URI.
 */
contract AnalysisRegistry {
    struct AnalysisRecord {
        address submitter;
        bytes32 rootHash;          // 0G Storage root hash of the report
        string storageUri;         // 0g:// URI for the stored report
        uint8 score;               // Analysis score 0-100
        string recommendation;     // "GO", "NO_GO", or "INVESTIGATE_MORE"
        uint256 timestamp;
    }

    // Counter for analysis IDs
    uint256 public analysisCount;

    // analysisId => AnalysisRecord
    mapping(uint256 => AnalysisRecord) public analyses;

    // rootHash => analysisId (for lookup by storage hash)
    mapping(bytes32 => uint256) public hashToAnalysisId;

    // Events
    event AnalysisRecorded(
        uint256 indexed analysisId,
        address indexed submitter,
        bytes32 rootHash,
        uint8 score,
        string recommendation,
        string storageUri,
        uint256 timestamp
    );

    /**
     * @notice Record a completed analysis on-chain.
     * @param rootHash The 0G Storage root hash of the stored report.
     * @param storageUri The 0g:// URI for the report.
     * @param score The analysis score (0-100).
     * @param recommendation The decision recommendation.
     */
    function recordAnalysis(
        bytes32 rootHash,
        string calldata storageUri,
        uint8 score,
        string calldata recommendation
    ) external returns (uint256) {
        require(rootHash != bytes32(0), "Root hash cannot be zero");
        require(score <= 100, "Score must be 0-100");
        require(
            hashToAnalysisId[rootHash] == 0,
            "Root hash already registered"
        );

        uint256 analysisId = analysisCount + 1;
        analysisCount = analysisId;

        analyses[analysisId] = AnalysisRecord({
            submitter: msg.sender,
            rootHash: rootHash,
            storageUri: storageUri,
            score: score,
            recommendation: recommendation,
            timestamp: block.timestamp
        });

        hashToAnalysisId[rootHash] = analysisId;

        emit AnalysisRecorded(
            analysisId,
            msg.sender,
            rootHash,
            score,
            recommendation,
            storageUri,
            block.timestamp
        );

        return analysisId;
    }

    /**
     * @notice Get an analysis record by ID.
     */
    function getAnalysis(uint256 analysisId) external view returns (
        address submitter,
        bytes32 rootHash,
        string memory storageUri,
        uint8 score,
        string memory recommendation,
        uint256 timestamp
    ) {
        AnalysisRecord storage record = analyses[analysisId];
        require(record.timestamp > 0, "Analysis not found");
        return (
            record.submitter,
            record.rootHash,
            record.storageUri,
            record.score,
            record.recommendation,
            record.timestamp
        );
    }

    /**
     * @notice Check if a root hash has been registered.
     */
    function isRootHashRegistered(bytes32 rootHash) external view returns (bool) {
        return hashToAnalysisId[rootHash] > 0;
    }

    /**
     * @notice Get the latest analysis record.
     */
    function getLatestAnalysis() external view returns (
        address submitter,
        bytes32 rootHash,
        string memory storageUri,
        uint8 score,
        string memory recommendation,
        uint256 timestamp
    ) {
        require(analysisCount > 0, "No analyses recorded");
        return this.getAnalysis(analysisCount);
    }
}
