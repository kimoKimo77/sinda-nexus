const SUPPORTED_NETWORKS = Object.freeze({
  ethereum: 1,
  bsc: 56,
  polygon: 137,
  ethereumSepolia: 11155111,
  bscTestnet: 97,
  polygonAmoy: 80002
});

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const DATA_PATTERN = /^0x(?:[a-fA-F0-9]{2})*$/;
const QUANTITY_PATTERN = /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;
const ALLOWED_FIELDS = new Set([
  "to", "value", "data", "gas", "gasLimit",
  "gasPrice", "maxFeePerGas", "maxPriorityFeePerGas", "nonce"
]);

function normalizeQuantity(value, field) {
  if (typeof value !== "string" || !QUANTITY_PATTERN.test(value)) {
    throw new TypeError(`${field} must be a canonical hexadecimal quantity`);
  }
  return value.toLowerCase();
}

export function prepareEvmTransaction({ network, transaction } = {}) {
  const chainId = SUPPORTED_NETWORKS[network];
  if (!chainId) throw new TypeError("unsupported_network");
  if (!transaction || typeof transaction !== "object" || Array.isArray(transaction)) {
    throw new TypeError("transaction must be an object");
  }

  for (const key of Object.keys(transaction)) {
    if (!ALLOWED_FIELDS.has(key)) throw new TypeError(`unsupported_transaction_field:${key}`);
  }
  if (typeof transaction.to !== "string" || !ADDRESS_PATTERN.test(transaction.to)) {
    throw new TypeError("transaction.to must be a 20-byte EVM address");
  }
  if (transaction.data !== undefined && (typeof transaction.data !== "string" || !DATA_PATTERN.test(transaction.data))) {
    throw new TypeError("transaction.data must be even-length hexadecimal data");
  }
  if (transaction.gas !== undefined && transaction.gasLimit !== undefined) {
    throw new TypeError("use gas or gasLimit, not both");
  }
  if (transaction.gasPrice !== undefined &&
      (transaction.maxFeePerGas !== undefined || transaction.maxPriorityFeePerGas !== undefined)) {
    throw new TypeError("legacy gasPrice cannot be combined with EIP-1559 fee fields");
  }
  if (transaction.maxPriorityFeePerGas !== undefined && transaction.maxFeePerGas === undefined) {
    throw new TypeError("maxFeePerGas is required with maxPriorityFeePerGas");
  }

  const prepared = {
    to: transaction.to,
    value: normalizeQuantity(transaction.value ?? "0x0", "value"),
    data: (transaction.data ?? "0x").toLowerCase()
  };
  for (const field of ["gas", "gasLimit", "gasPrice", "maxFeePerGas", "maxPriorityFeePerGas", "nonce"]) {
    if (transaction[field] !== undefined) {
      const target = field === "gasLimit" ? "gas" : field;
      if (Object.hasOwn(prepared, target)) throw new TypeError("gas and gasLimit cannot both be set");
      prepared[target] = normalizeQuantity(transaction[field], field);
    }
  }

  return Object.freeze({ network, chainId, transaction: Object.freeze(prepared) });
}

/**
 * Call only from an explicit user gesture (for example, a "Review in MetaMask" button).
 * MetaMask displays the final transaction confirmation; eth_sendTransaction broadcasts
 * only after the user approves it in the wallet.
 */
export async function sendWithMetaMask({ provider = globalThis.window?.ethereum, network, transaction } = {}) {
  if (!provider || typeof provider.request !== "function") {
    throw new Error("metamask_or_eip1193_wallet_not_found");
  }
  const prepared = prepareEvmTransaction({ network, transaction });
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  if (!Array.isArray(accounts) || typeof accounts[0] !== "string" || !ADDRESS_PATTERN.test(accounts[0])) {
    throw new Error("wallet_account_unavailable");
  }

  const chainIdHex = await provider.request({ method: "eth_chainId" });
  if (typeof chainIdHex !== "string" || !/^0x[0-9a-f]+$/i.test(chainIdHex)) {
    throw new Error("wallet_returned_invalid_chain_id");
  }
  const actualChainId = Number.parseInt(chainIdHex, 16);
  if (actualChainId !== prepared.chainId) {
    throw new Error(`wallet_network_mismatch:expected_${prepared.chainId}_actual_${actualChainId}`);
  }

  const hash = await provider.request({
    method: "eth_sendTransaction",
    params: [{ ...prepared.transaction, from: accounts[0] }]
  });
  if (typeof hash !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    throw new Error("wallet_returned_invalid_transaction_hash");
  }
  return { network, chainId: prepared.chainId, from: accounts[0], transactionHash: hash.toLowerCase() };
}

export const supportedEvmNetworks = Object.freeze({ ...SUPPORTED_NETWORKS });
