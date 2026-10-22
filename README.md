# EVM Wallet

A browser-based self-custody wallet prototype for Ethereum-compatible networks, built with React, TypeScript, Vite, and ethers v6.

## Implemented

- Create a BIP-39 recovery phrase or restore a valid phrase locally.
- Encrypt the phrase in browser storage using Web Crypto AES-GCM (256-bit) with a PBKDF2-SHA-256-derived key (310,000 iterations).
- Derive EVM accounts locally using the standard Ethereum HD derivation path.
- Query native balances and fee data from public RPC endpoints for Ethereum, Base, Arbitrum One, Optimism, Polygon, and BNB Smart Chain.
- Prepare, estimate, confirm, sign, and broadcast native-asset transfers, checking chain ID and balance against the estimated fee first.
- Display local transaction records and link to each network's block explorer.
- Lock the wallet in the current UI session and delete the encrypted local vault with confirmation.
- Deploy on Cloudflare Pages from GitHub `main` using `npm run build` and output directory `dist`.

## Important limitations

**This is not an audited production wallet. Do not use a recovery phrase containing valuable funds until the application has received independent security review and extensive testing.** Encryption at rest does not protect against malware, compromised browser extensions, malicious scripts, phishing, or an already-compromised device. Anyone with the recovery phrase or an unlocked wallet can control the assets. Use a dedicated device and small test amounts first.

The app currently supports native assets only. ERC-20 tokens, NFTs, contract interactions, hardware wallets, WalletConnect, RPC failover, verified fee simulation, transaction replacement/cancellation, and reliable cross-device backups are not implemented. The public RPC providers may rate-limit or become unavailable. Local transaction history is a best-effort browser cache, not an authoritative ledger. The app has not been independently audited.

Never commit seed phrases, private keys, passwords, API keys, or other secrets to this repository.

## Local development

Requires Node.js 20+.

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Cloudflare Pages deployment

- Framework preset: Vite (or none)
- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`

A GitHub push to `main` triggers a Cloudflare Pages deployment. Check the build and deploy stages in Cloudflare Pages before announcing a release.

## Release checklist

1. Ensure CI passes and inspect the Cloudflare Pages build logs.
2. Verify each chain's chain ID, RPC availability, balance and fee response.
3. Test create/import, encrypted vault lock/unlock, wrong-password handling, and deletion using a disposable test phrase.
4. Test sends only on test networks or with tiny amounts from a dedicated test wallet; verify recipient, amount, fee, chain and transaction hash.
5. Run dependency/security scanning and obtain an independent wallet security review before real-fund use.
