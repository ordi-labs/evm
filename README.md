# EVM Wallet

A self-custody wallet prototype for Ethereum-compatible networks, built with React, TypeScript, Vite, and ethers v6.

## Current status

This is an early UI and wallet-derivation prototype, **not a production wallet**. It supports generating a 12-word phrase and importing a valid BIP-39 phrase in the browser, deriving EVM accounts, and selecting Ethereum, Base, Arbitrum, Optimism, Polygon, and BNB Smart Chain. Transaction sending, live balance retrieval, encrypted persistent vault storage, token support, and automated security tests are not implemented.

**Do not use real funds or reuse a valuable recovery phrase.** The app has not been independently audited. Never share seed phrases or private keys, and never commit API keys or RPC secrets.

## Development

```bash
npm install
npm run dev
npm run build
```

## Cloudflare Pages

The project is configured for Cloudflare Pages with `npm run build` as the build command and `dist` as the output directory. Production deployments are connected to the `main` branch.

## Planned before any real-fund use

- Dedicated RPC configuration and server-side secret handling
- Encrypted local vault with tested unlock, lock, backup, and recovery flows
- Transaction simulation, fee estimation, chain-ID verification, and explicit confirmation
- Token support, transaction history, error handling, and automated tests
- Independent security review and threat model
