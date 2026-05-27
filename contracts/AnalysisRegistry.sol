// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AnalysisRegistry
 * @notice On-chain registry for ClawMind analysis reports.
 *
 * Each analysis is anchored with:
 * - task hash
 * - 0G Storage root hash
 * - storage URI
 * - score
 * - recommendation
 * - operator-signed timestamp
 *
 * The contract verifies an EIP-712 signature from an authorized operator before
 * accepting a record. Relayers may submit transactions, but the stored submitter
 * is always the recovered operator.
 */
contract AnalysisRegistry {
    enum Recommendation {
        GO,
        INVESTIGATE_MORE,
        NO_GO
    }

    struct AnalysisRecord {
        address submitter;
        bytes32 taskHash;
        bytes32 rootHash;
        string storageUri;
        uint8 score;
        Recommendation recommendation;
        uint256 timestamp;
    }

    bytes32 public constant ANALYSIS_TYPEHASH = keccak256(
        "Analysis(bytes32 taskHash,bytes32 rootHash,uint8 score,string storageUri,string recommendation,uint256 timestamp)"
    );

    bytes32 private constant EIP712_DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    bytes32 private constant NAME_HASH = keccak256("ClawMindAnalysisRegistry");
    bytes32 private constant VERSION_HASH = keccak256("4");

    uint256 private constant SECP256K1_HALF_ORDER =
        0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    uint256 public constant RATE_LIMIT_INTERVAL = 60 seconds;
    uint256 public constant SIGNATURE_VALIDITY = 5 minutes;
    uint256 public constant SIGNATURE_FUTURE_TOLERANCE = 30 seconds;
    uint256 public constant MAX_STORAGE_URI_LENGTH = 512;
    uint256 public constant MAX_BATCH_SIZE = 100;

    address public owner;
    address public pendingOwner;
    uint256 public analysisCount;

    mapping(address => bool) public authorizedOperators;
    mapping(address => uint256) public lastSubmissionAt;
    mapping(uint256 => AnalysisRecord) private analyses;
    mapping(bytes32 => uint256) public hashToAnalysisId;

    event OperatorUpdated(address indexed operator, bool authorized);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferCanceled(address indexed previousOwner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

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
        require(newOwner != owner, "Owner already set");

        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function cancelOwnershipTransfer() external onlyOwner {
        address canceledOwner = pendingOwner;
        require(canceledOwner != address(0), "No pending owner");

        pendingOwner = address(0);
        emit OwnershipTransferCanceled(owner, canceledOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Only pending owner");

        address previousOwner = owner;
        owner = msg.sender;
        pendingOwner = address(0);

        emit OwnershipTransferred(previousOwner, msg.sender);
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
        string calldata storageUri,
        string calldata recommendation,
        uint256 timestamp
    ) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                ANALYSIS_TYPEHASH,
                taskHash,
                rootHash,
                score,
                keccak256(bytes(storageUri)),
                keccak256(bytes(recommendation)),
                timestamp
            )
        );

        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
    }

    function recoverAnalysisSigner(
        bytes32 taskHash,
        bytes32 rootHash,
        uint8 score,
        string calldata storageUri,
        string calldata recommendation,
        uint256 timestamp,
        bytes calldata signature
    ) public view returns (address) {
        return _recoverSigner(
            hashAnalysis(taskHash, rootHash, score, storageUri, recommendation, timestamp),
            signature
        );
    }

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

        _validateStorageUri(storageUri);
        _validateSignatureTimestamp(timestamp);

        address signer = recoverAnalysisSigner(
            taskHash,
            rootHash,
            score,
            storageUri,
            recommendation,
            timestamp,
            signature
        );
        require(authorizedOperators[signer], "Unauthorized operator signature");

        _enforceRateLimit(signer);

        return _storeAndEmitAnalysis(
            signer,
            taskHash,
            rootHash,
            storageUri,
            score,
            recommendation,
            timestamp,
            signature
        );
    }

    function getAnalysis(uint256 analysisId)
        external
        view
        returns (
            address submitter,
            bytes32 rootHash,
            string memory storageUri,
            uint8 score,
            string memory recommendation,
            uint256 timestamp
        )
    {
        AnalysisRecord storage record = _requireExists(analysisId);
        return (
            record.submitter,
            record.rootHash,
            record.storageUri,
            record.score,
            _recommendationToString(record.recommendation),
            record.timestamp
        );
    }

    function getAnalysisAuth(uint256 analysisId)
        external
        view
        returns (bytes32 taskHash, bool submitterAuthorized)
    {
        AnalysisRecord storage record = _requireExists(analysisId);
        return (record.taskHash, authorizedOperators[record.submitter]);
    }

    function isRootHashRegistered(bytes32 rootHash) external view returns (bool) {
        return hashToAnalysisId[rootHash] > 0;
    }

    function getLatestAnalysis()
        external
        view
        returns (
            address submitter,
            bytes32 rootHash,
            string memory storageUri,
            uint8 score,
            string memory recommendation,
            uint256 timestamp
        )
    {
        require(analysisCount > 0, "No analyses recorded");

        AnalysisRecord storage record = analyses[analysisCount];
        return (
            record.submitter,
            record.rootHash,
            record.storageUri,
            record.score,
            _recommendationToString(record.recommendation),
            record.timestamp
        );
    }

    function getLatestAnalysisAuth()
        external
        view
        returns (bytes32 taskHash, bool submitterAuthorized)
    {
        require(analysisCount > 0, "No analyses recorded");

        AnalysisRecord storage record = analyses[analysisCount];
        return (record.taskHash, authorizedOperators[record.submitter]);
    }

    function getAnalysisBatch(uint256 fromId, uint256 limit)
        external
        view
        returns (
            uint256[] memory ids,
            address[] memory submitters,
            bytes32[] memory taskHashes,
            bytes32[] memory rootHashes,
            string[] memory storageUris,
            uint8[] memory scores,
            string[] memory recommendations,
            uint256[] memory timestamps
        )
    {
        require(fromId >= 1, "fromId must be >= 1");
        require(limit > 0, "limit must be > 0");
        require(limit <= MAX_BATCH_SIZE, "limit too large");

        uint256 count = analysisCount;
        if (fromId > count) {
            return (
                new uint256[](0),
                new address[](0),
                new bytes32[](0),
                new bytes32[](0),
                new string[](0),
                new uint8[](0),
                new string[](0),
                new uint256[](0)
            );
        }

        uint256 remaining = count - fromId + 1;
        uint256 length = remaining < limit ? remaining : limit;

        ids = new uint256[](length);
        submitters = new address[](length);
        taskHashes = new bytes32[](length);
        rootHashes = new bytes32[](length);
        storageUris = new string[](length);
        scores = new uint8[](length);
        recommendations = new string[](length);
        timestamps = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            uint256 id = fromId + i;
            AnalysisRecord storage record = analyses[id];

            ids[i] = id;
            submitters[i] = record.submitter;
            taskHashes[i] = record.taskHash;
            rootHashes[i] = record.rootHash;
            storageUris[i] = record.storageUri;
            scores[i] = record.score;
            recommendations[i] = _recommendationToString(record.recommendation);
            timestamps[i] = record.timestamp;
        }
    }

    function _requireExists(uint256 analysisId) internal view returns (AnalysisRecord storage) {
        AnalysisRecord storage record = analyses[analysisId];
        require(record.timestamp > 0, "Analysis not found");
        return record;
    }

    function _enforceRateLimit(address signer) internal {
        uint256 lastSubmission = lastSubmissionAt[signer];
        require(
            lastSubmission == 0 || block.timestamp >= lastSubmission + RATE_LIMIT_INTERVAL,
            "Rate limited: wait before submitting again"
        );

        lastSubmissionAt[signer] = block.timestamp;
    }

    function _storeAndEmitAnalysis(
        address signer,
        bytes32 taskHash,
        bytes32 rootHash,
        string calldata storageUri,
        uint8 score,
        string calldata recommendation,
        uint256 timestamp,
        bytes calldata signature
    ) internal returns (uint256) {
        return _storeAnalysis(
            signer,
            taskHash,
            rootHash,
            storageUri,
            score,
            recommendation,
            timestamp,
            signature
        );
    }

    function _storeAnalysis(
        address signer,
        bytes32 taskHash,
        bytes32 rootHash,
        string calldata storageUri,
        uint8 score,
        string calldata recommendation,
        uint256 timestamp,
        bytes calldata signature
    ) internal returns (uint256) {
        uint256 analysisId = analysisCount + 1;
        analysisCount = analysisId;

        AnalysisRecord storage record = analyses[analysisId];
        record.submitter = signer;
        record.taskHash = taskHash;
        record.rootHash = rootHash;
        record.storageUri = storageUri;
        record.score = score;
        record.recommendation = _parseRecommendation(recommendation);
        record.timestamp = timestamp;

        hashToAnalysisId[rootHash] = analysisId;

        emit AnalysisRecorded(
            analysisId,
            record.submitter,
            record.taskHash,
            record.rootHash,
            record.score,
            _recommendationToString(record.recommendation),
            record.storageUri,
            record.timestamp,
            signature
        );

        return analysisId;
    }

    function _validateStorageUri(string calldata storageUri) internal pure {
        bytes memory uri = bytes(storageUri);

        require(uri.length > 0, "Storage URI cannot be empty");
        require(uri.length <= MAX_STORAGE_URI_LENGTH, "Storage URI too long");
        require(
            uri.length >= 5 &&
                uri[0] == 0x30 &&
                uri[1] == 0x67 &&
                uri[2] == 0x3a &&
                uri[3] == 0x2f &&
                uri[4] == 0x2f,
            "Storage URI must start with 0g://"
        );
    }

    function _validateSignatureTimestamp(uint256 timestamp) internal view {
        require(timestamp <= block.timestamp + SIGNATURE_FUTURE_TOLERANCE, "Timestamp too far in future");
        require(timestamp + SIGNATURE_VALIDITY >= block.timestamp, "Signature expired");
    }

    function _parseRecommendation(string calldata recommendation) internal pure returns (Recommendation) {
        bytes32 valueHash = keccak256(bytes(recommendation));

        if (valueHash == keccak256("GO")) {
            return Recommendation.GO;
        }

        if (valueHash == keccak256("INVESTIGATE_MORE")) {
            return Recommendation.INVESTIGATE_MORE;
        }

        if (valueHash == keccak256("NO_GO")) {
            return Recommendation.NO_GO;
        }

        revert("Invalid recommendation");
    }

    function _recommendationToString(Recommendation recommendation) internal pure returns (string memory) {
        if (recommendation == Recommendation.GO) {
            return "GO";
        }

        if (recommendation == Recommendation.INVESTIGATE_MORE) {
            return "INVESTIGATE_MORE";
        }

        return "NO_GO";
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
        require(uint256(s) <= SECP256K1_HALF_ORDER, "Invalid signature s");

        address signer = ecrecover(digest, v, r, s);
        require(signer != address(0), "Invalid signature");

        return signer;
    }
}
