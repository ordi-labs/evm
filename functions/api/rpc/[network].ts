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
  "eth_getTransactionCount"
]);

export async function onRequestPost(context: { request: Request; params: { network: string } }): Promise<Response> {
  const chainId = context.params.network;
  const endpoints = RPCS[chainId];
  if (!endpoints) return Response.json({ error: "Unsupported chain" }, { status: 404 });
  const contentLength = Number(context.request.headers.get("content-length") || 0);
  if (contentLength > 256_000) return Response.json({ error: "Request too large" }, { status: 413 });

  let payload: { jsonrpc?: string; id?: string | number | null; method?: string; params?: unknown[] };
  try {
    payload = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON-RPC request" }, { status: 400 });
  }
  if (!payload || typeof payload.method !== "string" || !ALLOWED_METHODS.has(payload.method)) {
    return Response.json({ jsonrpc: "2.0", id: payload?.id ?? null, error: { code: -32601, message: "RPC method not allowed" } }, { status: 400 });
  }

  let lastResponse: Response | null = null;
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
      let body: any;
      try { body = JSON.parse(raw); } catch { body = null; }
      lastResponse = response;
      lastBody = body;
      if (response.ok && body && !body.error) {
        return Response.json(body, { headers: { "cache-control": "no-store" } });
      }
      // Retry another upstream for HTTP errors, malformed responses, or transient JSON-RPC errors.
      if (response.ok && body?.error && ![-32603, -32005, -32000].includes(Number(body.error.code))) {
        return Response.json(body, { headers: { "cache-control": "no-store" } });
      }
    } catch {
      // Continue to the next fixed, allowlisted RPC endpoint.
    }
  }

  if (lastBody && typeof lastBody === "object") {
    return Response.json(lastBody, { status: 502, headers: { "cache-control": "no-store" } });
  }
  return Response.json({
    jsonrpc: "2.0",
    id: payload.id ?? null,
    error: { code: -32603, message: "All upstream RPC endpoints failed. Retry shortly." }
  }, { status: 502, headers: { "cache-control": "no-store" } });
}
