// ---------------------------------------------------------------------------
// Shared 0G Storage configuration — supports both mainnet and testnet
// ---------------------------------------------------------------------------

/** Placeholder strings that indicate a private key has not been set. */
const PLACEHOLDER_PRIVATE_KEYS = new Set([
  "your_wallet_private_key_here",
  "your_testnet_wallet_private_key",
  "your_testnet_burner_wallet_private_key",
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NetworkConfig = {
  network: "mainnet" | "testnet";
  evmRpc: string;
  indexerRpc: string;
  explorerBaseUrl: string;
  chainId: number;
};

export type StorageConfig = {
  enabled: boolean;
  privateKey: string | undefined;
  evmRpc: string;
  indexerRpc: string;
  isConfigured: boolean;
  network: "mainnet" | "testnet";
  explorerBaseUrl: string;
  chainId: number;
};

// ---------------------------------------------------------------------------
// Network defaults
// ---------------------------------------------------------------------------

const MAINNET_DEFAULTS: Omit<NetworkConfig, "network"> = {
  evmRpc: "https://evmrpc.0g.ai",
  indexerRpc: "https://indexer-storage-turbo.0g.ai",
  explorerBaseUrl: "https://chainscan.0g.ai",
  chainId: 16661,
};

const TESTNET_DEFAULTS: Omit<NetworkConfig, "network"> = {
  evmRpc: "https://evmrpc-testnet.0g.ai",
  indexerRpc: "https://indexer-storage-testnet-turbo.0g.ai",
  explorerBaseUrl: "https://chainscan-galileo.0g.ai",
  chainId: 16602,
};

// ---------------------------------------------------------------------------
// getNetworkConfig
// ---------------------------------------------------------------------------

/**
 * Reads environment variables and returns the resolved 0G network
 * configuration.
 *
 * - `ZERO_G_NETWORK` selects mainnet or testnet (default: "testnet").
 * - `ZERO_G_STORAGE_EVM_RPC` and `ZERO_G_STORAGE_INDEXER_RPC` override the
 *   default RPC URLs for the selected network.
 */
export function getNetworkConfig(): NetworkConfig {
  const rawNetwork = process.env.ZERO_G_NETWORK ?? "testnet";
  const network: "mainnet" | "testnet" =
    rawNetwork === "mainnet" ? "mainnet" : "testnet";

  const defaults =
    network === "mainnet" ? MAINNET_DEFAULTS : TESTNET_DEFAULTS;

  return {
    network,
    evmRpc: process.env.ZERO_G_STORAGE_EVM_RPC ?? defaults.evmRpc,
    indexerRpc:
      process.env.ZERO_G_STORAGE_INDEXER_RPC ?? defaults.indexerRpc,
    explorerBaseUrl: defaults.explorerBaseUrl,
    chainId: defaults.chainId,
  };
}

// ---------------------------------------------------------------------------
// getStorageConfig
// ---------------------------------------------------------------------------

/**
 * Returns the full 0G storage configuration, combining network settings with
 * credential / enabled-state information.
 */
export function getStorageConfig(): StorageConfig {
  const networkConfig = getNetworkConfig();

  const enabled = process.env.ZERO_G_STORAGE_ENABLED === "true";
  const privateKey = process.env.ZERO_G_STORAGE_PRIVATE_KEY;

  const isValidPrivateKey =
    typeof privateKey === "string" &&
    privateKey.trim().length > 0 &&
    !PLACEHOLDER_PRIVATE_KEYS.has(privateKey.trim());

  const isConfigured = enabled && isValidPrivateKey;

  return {
    enabled,
    privateKey,
    evmRpc: networkConfig.evmRpc,
    indexerRpc: networkConfig.indexerRpc,
    isConfigured,
    network: networkConfig.network,
    explorerBaseUrl: networkConfig.explorerBaseUrl,
    chainId: networkConfig.chainId,
  };
}

// ---------------------------------------------------------------------------
// createHashLikeValue
// ---------------------------------------------------------------------------

/**
 * Creates a deterministic hash-like hex string from an arbitrary input string.
 *
 * This is a lightweight, non-cryptographic hash used as a local fallback
 * identifier when 0G storage is not available.
 */
export function createHashLikeValue(input: string): string {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    const character = input.charCodeAt(index);
    hash = (hash << 5) - hash + character;
    hash |= 0;
  }

  const positiveHash = Math.abs(hash).toString(16).padStart(8, "0");

  return `0x${positiveHash}${positiveHash}${positiveHash}${positiveHash}`;
}

// ---------------------------------------------------------------------------
// Explorer URL helpers
// ---------------------------------------------------------------------------

/** Returns the full URL for a transaction on the 0G chain explorer. */
export function getExplorerTxUrl(txHash: string): string {
  const { explorerBaseUrl } = getNetworkConfig();
  return `${explorerBaseUrl}/tx/${txHash}`;
}

/** Returns the full URL for an address on the 0G chain explorer. */
export function getExplorerAddressUrl(address: string): string {
  const { explorerBaseUrl } = getNetworkConfig();
  return `${explorerBaseUrl}/address/${address}`;
}

/** Returns the full URL for a block on the 0G chain explorer. */
export function getExplorerBlockUrl(blockNumber: string | number): string {
  const { explorerBaseUrl } = getNetworkConfig();
  return `${explorerBaseUrl}/block/${blockNumber}`;
}
