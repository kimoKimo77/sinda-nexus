const NETWORKS = [
  { name: "ethereum", chainId: 1, env: "ETHEREUM_RPC_URL", fallback: "https://ethereum-rpc.publicnode.com" },
  { name: "bsc", chainId: 56, env: "BSC_RPC_URL", fallback: "https://bsc-rpc.publicnode.com" },
  { name: "polygon", chainId: 137, env: "POLYGON_RPC_URL", fallback: "https://polygon-bor-rpc.publicnode.com" }
];

async function rpc(url, method) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: [] }),
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
  const body = await response.json();
  if (body?.jsonrpc !== "2.0" || body.id !== 1 || body.error || typeof body.result !== "string") {
    throw new Error(`${method}: invalid JSON-RPC response`);
  }
  if (!/^0x[0-9a-f]+$/i.test(body.result)) throw new Error(`${method}: invalid quantity`);
  return body.result;
}

async function checkNetwork(network) {
  const url = process.env[network.env] || network.fallback;
  const [chainIdHex, latestBlockHex] = await Promise.all([
    rpc(url, "eth_chainId"),
    rpc(url, "eth_blockNumber")
  ]);
  const chainId = Number.parseInt(chainIdHex, 16);
  const latestBlock = Number.parseInt(latestBlockHex, 16);
  if (chainId !== network.chainId) {
    throw new Error(`${network.name}: expected chain ID ${network.chainId}, received ${chainId}`);
  }
  if (!Number.isSafeInteger(latestBlock) || latestBlock < 0) {
    throw new Error(`${network.name}: invalid latest block number`);
  }
  return { network: network.name, chainId, latestBlock };
}

const results = await Promise.allSettled(NETWORKS.map(checkNetwork));
let failed = false;
for (let index = 0; index < results.length; index += 1) {
  const result = results[index];
  if (result.status === "fulfilled") {
    const { network, chainId, latestBlock } = result.value;
    console.log(`PASS ${network}: chainId=${chainId}, latestBlock=${latestBlock}`);
  } else {
    failed = true;
    console.error(`FAIL ${NETWORKS[index].name}: ${result.reason?.message || "RPC check failed"}`);
  }
}
if (failed) process.exitCode = 1;
else console.log("All live read-only RPC checks passed.");
