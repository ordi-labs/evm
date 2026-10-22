const RPCS: Record<string, string[]> = {
  "1": ["https://ethereum-rpc.publicnode.com", "https://cloudflare-eth.com", "https://eth.llamarpc.com"],
  "8453": ["https://base-rpc.publicnode.com", "https://mainnet.base.org"],
  "42161": ["https://arbitrum-one-rpc.publicnode.com", "https://arb1.arbitrum.io/rpc"],
  "10": ["https://optimism-rpc.publicnode.com", "https://mainnet.optimism.io"],
  "137": ["https://polygon-bor-rpc.publicnode.com", "https://polygon-rpc.com"],
  "56": ["https://bsc-rpc.publicnode.com", "https://bsc-dataseed.binance.org"]
};

const ALLOWED_METHODS = new Set([
  "eth_chainId", "eth_getBalance", "eth_feeHistory", "eth_gasPrice",
  "eth_maxPriorityFeePerGas", "eth_estimateGas", "eth_sendRawTransaction",
  "eth_getTransactionReceipt", "eth_getTransactionByHash", "eth_blockNumber",
  "eth_getTransactionCount", "eth_getBlockByNumber"
]);

type RpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown[];
};

const rpcError = (id: string | number | null, code: number, message: string) => ({
  jsonrpc: "2.0",
  id,
  error: { code, message }
});

export async function onRequestPost(context: { request: Request; params: { network: string } }): Promise<Response> {
  const chainId = context.params.network;
  const endpoints = RPCS[chainId];
  if (!endpoints) return Response.json({ error: "Unsupported chain" }, { status: 404 });

  const contentLength = Number(context.request.headers.get("content-length") || 0);
  if (contentLength > 256_000) return Response.json({ error: "Request too large" }, { status: 413 });

  let payload: RpcRequest | RpcRequest[];
  try {
    payload = await context.request.json() as RpcRequest | RpcRequest[];
  } catch {
    return Response.json({ error: "Invalid JSON-RPC request" }, { status: 400 });
  }

  // ethers.js may send several JSON-RPC calls together as a batch array.
  const requests = Array.isArray(payload) ? payload : [payload];
  if (requests.length === 0 || requests.some((item) =>
    !item || typeof item !== "object" || typeof item.method !== "string"
  )) {
    return Response.json(rpcError(null, -32600, "Invalid JSON-RPC request"), { status: 400 });
  }

  const disallowed = requests.find((item) => !ALLOWED_METHODS.has(item.method!));
  if (disallowed) {
    const message = "RPC method not allowed";
    if (Array.isArray(payload)) {
      return Response.json(
        requests.map((item) => rpcError(item.id ?? null, -32601, message)),
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }
    return Response.json(rpcError(disallowed.id ?? null, -32601, message), {
      status: 400,
      headers: { "cache-control": "no-store" }
    });
  }

  let lastBody: unknown = null;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", "accept": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000)
      });
      const raw = await response.text();
      let body: unknown;
      try { body = JSON.parse(raw); } catch { body = null; }
      lastBody = body;

      const hasRpcError = (value: unknown) => {
        if (Array.isArray(value)) return value.some((entry) => Boolean(entry && typeof entry === "object" && "error" in entry));
        return Boolean(value && typeof value === "object" && "error" in value);
      };

      if (response.ok && body && !hasRpcError(body)) {
        return Response.json(body, { headers: { "cache-control": "no-store" } });
      }

      // Fail over on HTTP failures, malformed bodies, or transient JSON-RPC errors.
      const errors = Array.isArray(body) ? body : [body];
      const codes = errors
        .filter((entry): entry is { error: { code?: number } } => Boolean(entry && typeof entry === "object" && "error" in entry))
        .map((entry) => Number(entry.error.code));
      if (response.ok && codes.length > 0 && codes.every((code) => ![-32603, -32005, -32000].includes(code))) {
        return Response.json(body, { headers: { "cache-control": "no-store" } });
      }
    } catch {
      // Continue to the next fixed, allowlisted RPC endpoint.
    }
  }

  if (lastBody && typeof lastBody === "object") {
    return Response.json(lastBody, { status: 502, headers: { "cache-control": "no-store" } });
  }
  const fallback = Array.isArray(payload)
    ? payload.map((item) => rpcError(item.id ?? null, -32603, "All upstream RPC endpoints failed. Retry shortly."))
    : rpcError(payload.id ?? null, -32603, "All upstream RPC endpoints failed. Retry shortly.");
  return Response.json(fallback, { status: 502, headers: { "cache-control": "no-store" } });
}
