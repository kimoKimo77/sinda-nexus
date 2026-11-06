import { createHash } from "node:crypto";

const NETWORKS = Object.freeze({
  ethereum: { chainId: 1, env: "ETHEREUM_RPC_URL" },
  bsc: { chainId: 56, env: "BSC_RPC_URL" },
  polygon: { chainId: 137, env: "POLYGON_RPC_URL" },
  ethereumSepolia: { chainId: 11155111, env: "ETHEREUM_SEPOLIA_RPC_URL" },
  bscTestnet: { chainId: 97, env: "BSC_TESTNET_RPC_URL" },
  polygonAmoy: { chainId: 80002, env: "POLYGON_AMOY_RPC_URL" }
});
const HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;
const QUANTITY_PATTERN = /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;

async function rpcCall(fetchImpl, url, method, params = []) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(8_000)
  });
  if (!response.ok) throw new Error("RPC provider returned an unsuccessful response");
  const payload = await response.json();
  if (payload?.jsonrpc !== "2.0" || payload.id !== 1 || payload.error || !Object.hasOwn(payload, "result")) throw new Error("RPC provider returned an invalid response");
  return payload.result;
}

export function validatePayloadHash(payload) {
  if (typeof payload !== "string" || Buffer.byteLength(payload, "utf8") > 1_000_000) {
    throw new TypeError("payload must be a string up to 1 MB");
  }
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export async function validateEvmTransaction({ network, transactionHash, rpcUrls = process.env, fetchImpl = globalThis.fetch }) {
  const config = typeof network === "string" && Object.hasOwn(NETWORKS, network) ? NETWORKS[network] : null;
  if (!config) return { status: "invalid", reason: "unsupported_network", network };
  if (typeof transactionHash !== "string" || !HASH_PATTERN.test(transactionHash)) {
    return { status: "invalid", reason: "invalid_transaction_hash", network };
  }
  const rpcUrl = rpcUrls?.[config.env];
  if (!rpcUrl) return { status: "unverified", reason: "rpc_not_configured", network, expectedChainId: config.chainId };
  try {
    const chainIdHex = await rpcCall(fetchImpl, rpcUrl, "eth_chainId");
    if (typeof chainIdHex !== "string" || !QUANTITY_PATTERN.test(chainIdHex)) {
      return { status: "unverified", reason: "invalid_provider_chain_id", network };
    }
    const actualChainId = Number.parseInt(chainIdHex, 16);
    if (!Number.isSafeInteger(actualChainId)) return { status: "unverified", reason: "invalid_provider_chain_id", network };
    if (actualChainId !== config.chainId) {
      return { status: "invalid", reason: "network_mismatch", network, expectedChainId: config.chainId, actualChainId };
    }
    const transaction = await rpcCall(fetchImpl, rpcUrl, "eth_getTransactionByHash", [transactionHash]);
    if (!transaction) return { status: "unverified", reason: "transaction_not_found", network, chainId: actualChainId };
    const receipt = await rpcCall(fetchImpl, rpcUrl, "eth_getTransactionReceipt", [transactionHash]);
    if (!receipt) return { status: "unverified", reason: "transaction_pending_or_receipt_unavailable", network, chainId: actualChainId };
    if (transaction.hash?.toLowerCase() !== transactionHash.toLowerCase()) {
      return { status: "unverified", reason: "provider_transaction_hash_mismatch", network, chainId: actualChainId };
    }
    if (receipt.transactionHash?.toLowerCase() !== transactionHash.toLowerCase()) {
      return { status: "unverified", reason: "provider_receipt_hash_mismatch", network, chainId: actualChainId };
    }
    if (receipt.status === "0x0") return { status: "invalid", reason: "transaction_reverted", network, chainId: actualChainId, blockNumber: receipt.blockNumber ?? null };
    if (receipt.status !== "0x1") return { status: "unverified", reason: "unknown_receipt_status", network, chainId: actualChainId };
    if (typeof receipt.blockNumber !== "string" || !QUANTITY_PATTERN.test(receipt.blockNumber)) {
      return { status: "unverified", reason: "invalid_receipt_block_number", network, chainId: actualChainId };
    }
    const latestBlockHex = await rpcCall(fetchImpl, rpcUrl, "eth_blockNumber");
    if (typeof latestBlockHex !== "string" || !QUANTITY_PATTERN.test(latestBlockHex)) {
      return { status: "unverified", reason: "invalid_latest_block_number", network, chainId: actualChainId };
    }
    const receiptBlock = BigInt(receipt.blockNumber);
    const latestBlock = BigInt(latestBlockHex);
    const confirmations = latestBlock >= receiptBlock ? (latestBlock - receiptBlock + 1n) : 0n;
    return {
      status: "valid",
      reason: "confirmed_successfully",
      // A successful receipt and confirmation count do not establish consensus finality.
      finality: "not_assessed",
      network,
      chainId: actualChainId,
      transactionHash: transactionHash.toLowerCase(),
      blockNumber: receipt.blockNumber,
      confirmations: confirmations.toString()
    };
  } catch {
    return { status: "unverified", reason: "rpc_unavailable_or_invalid_response", network };
  }
}