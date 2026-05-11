// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AnalysisRegistry
 * @notice On-chain registry for ClawMind analysis reports.
 *         Each analysis is anchored with its task hash, 0G Storage root hash,
 *         score, recommendation, storage URI, and the EIP-712 operator
 *         signature that authorized the record.
 *
 * Security features:
 *   - Operator allowlist: only authorized ClawMind operator signatures are accepted
 *   - EIP-712 typed-data verification for Analysis records
 *   - Rate limiting per authorized operator
 *   - Duplicate prevention: same rootHash cannot be registered twice
 *   - Input validation: taskHash/rootHash non-zero, score 0-100, valid signature
 */
contract AnalysisRegistry {
    struct AnalysisRecord {
        address submitter;         // Authorized operator recovered from signature
        bytes32 taskHash;          // Hash of the task text signed by the operator
        bytes32 rootHash;          // 0G Storage root hash of the report
        string storageUri;         // 0g:// URI for the stored report
        uint8 score;               // Analysis score 0-100
        string recommendation;     // "GO", "NO_GO", or "INVESTIGATE_MORE"
        uint256 timestamp;         // Operator-signed timestamp
        bytes signature;           // EIP-712 operator signature
    }

    bytes32 public constant ANALYSIS_TYPEHASH =
        keccak256("Analysis(bytes32 taskHash,bytes32 rootHash,uint8 score,uint256 timestamp)");
    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant NAME_HASH = keccak256("ClawMindAnalysisRegistry");
    bytes32 private constant VERSION_HASH = keccak256("3");

    uint256 public constant RATE_LIMIT_INTERVAL = 60 seconds;

    address public owner;
    uint256 public analysisCount;

    mapping(address => bool) public authorizedOperators;
    mapping(address => uint256) public lastSubmissionAt;
    mapping(uint256 => AnalysisRecord) private analyses;
    mapping(bytes32 => uint256) public hashToAnalysisId;

    event OperatorUpdated(address indexed operator, bool authorized);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    event AnalysisRecorded(
        uint256 indexed analysisId,
        address indexed submitter,
        bytes32 indexed taskHash,
        bytes32 rootHash,
        uint8 score,
        string recommendation,
        string storageUri,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedOperators[msg.sender] = true;

        emit OwnershipTransferred(address(0), msg.sender);
        emit OperatorUpdated(msg.sender, true);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Owner cannot be zero");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setAuthorizedOperator(address operator, bool authorized) external onlyOwner {
        require(operator != address(0), "Operator cannot be zero");
        authorizedOperators[operator] = authorized;
        emit OperatorUpdated(operator, authorized);
    }

    function domainSeparator() public view returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                NAME_HASH,
                VERSION_HASH,
                block.chainid,
                address(this)
            )
        );
    }

    function hashAnalysis(
        bytes32 taskHash,
        bytes32 rootHash,
        uint8 score,
        uint256 timestamp
    ) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                ANALYSIS_TYPEHASH,
                taskHash,
                rootHash,
                score,
                timestamp
            )
        );

        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
    }

    function recoverAnalysisSigner(
        bytes32 taskHash,
        bytes32 rootHash,
        uint8 score,
        uint256 timestamp,
        bytes calldata signature
    ) public view returns (address) {
        return _recoverSigner(hashAnalysis(taskHash, rootHash, score, timestamp), signature);
    }

    /**
     * @notice Record a completed analysis on-chain.
     * @param taskHash Hash of the task text that was analyzed.
     * @param rootHash The 0G Storage root hash of the stored report.
     * @param storageUri The 0g:// URI for the report.
     * @param score The analysis score (0-100).
     * @param recommendation The decision recommendation.
     * @param timestamp Operator-signed timestamp.
     * @param signature EIP-712 signature from an authorized operator.
     */
    function recordAnalysis(
        bytes32 taskHash,
        bytes32 rootHash,
        string calldata storageUri,
        uint8 score,
        string calldata recommendation,
        uint256 timestamp,
        bytes calldata signature
    ) external returns (uint256) {
        require(taskHash != bytes32(0), "Task hash cannot be zero");
        require(rootHash != bytes32(0), "Root hash cannot be zero");
        require(score <= 100, "Score must be 0-100");
        require(hashToAnalysisId[rootHash] == 0, "Root hash already registered");

        address signer = recoverAnalysisSigner(taskHash, rootHash, score, timestamp, signature);
        require(authorizedOperators[signer], "Unauthorized operator signature");

        uint256 lastSubmission = lastSubmissionAt[signer];
        require(
            lastSubmission == 0 || block.timestamp >= lastSubmission + RATE_LIMIT_INTERVAL,
            "Rate limited: wait before submitting again"
        );

        uint256 analysisId = analysisCount + 1;
        analysisCount = analysisId;

        analyses[analysisId] = AnalysisRecord({
            submitter: signer,
            taskHash: taskHash,
            rootHash: rootHash,
            storageUri: storageUri,
            score: score,
            recommendation: recommendation,
            timestamp: timestamp,
            signature: signature
        });

        hashToAnalysisId[rootHash] = analysisId;
        lastSubmissionAt[signer] = block.timestamp;

        emit AnalysisRecorded(
            analysisId,
            signer,
            taskHash,
            rootHash,
            score,
            recommendation,
            storageUri,
            timestamp
        );

        return analysisId;
    }

    /**
     * @notice Get the legacy analysis view by ID.
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
     * @notice Get the EIP-712 authorization proof for an analysis.
     */
    function getAnalysisAuth(uint256 analysisId) external view returns (
        bytes32 taskHash,
        bytes memory signature,
        bool submitterAuthorized
    ) {
        AnalysisRecord storage record = analyses[analysisId];
        require(record.timestamp > 0, "Analysis not found");
        return (
            record.taskHash,
            record.signature,
            authorizedOperators[record.submitter]
        );
    }

    function isRootHashRegistered(bytes32 rootHash) external view returns (bool) {
        return hashToAnalysisId[rootHash] > 0;
    }

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

    function getLatestAnalysisAuth() external view returns (
        bytes32 taskHash,
        bytes memory signature,
        bool submitterAuthorized
    ) {
        require(analysisCount > 0, "No analyses recorded");
        return this.getAnalysisAuth(analysisCount);
    }

    function _recoverSigner(bytes32 digest, bytes calldata signature) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        if (v < 27) {
            v += 27;
        }

        require(v == 27 || v == 28, "Invalid signature v");

        address signer = ecrecover(digest, v, r, s);
        require(signer != address(0), "Invalid signature");

        return signer;
    }
}
