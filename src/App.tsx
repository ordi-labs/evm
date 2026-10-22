import { useEffect, useMemo, useState } from "react";
import { HDNodeWallet, Mnemonic, Wallet, JsonRpcProvider, formatEther, parseEther, isAddress } from "ethers";
import { ArrowDownLeft, ArrowUpRight, Check, ChevronDown, Copy, Eye, EyeOff, Fingerprint, Globe2, KeyRound, LockKeyhole, Plus, ShieldCheck, Wallet as WalletIcon, X, RefreshCw, LogOut } from "lucide-react";

const networks = [
  { name: "Ethereum", symbol: "ETH", chainId: 1, rpc: "https://ethereum-rpc.publicnode.com", color: "#8c9cff", explorer: "https://etherscan.io" },
  { name: "Base", symbol: "ETH", chainId: 8453, rpc: "https://mainnet.base.org", color: "#5795ff", explorer: "https://basescan.org" },
  { name: "Arbitrum One", symbol: "ETH", chainId: 42161, rpc: "https://arb1.arbitrum.io/rpc", color: "#70aaff", explorer: "https://arbiscan.io" },
  { name: "Optimism", symbol: "ETH", chainId: 10, rpc: "https://mainnet.optimism.io", color: "#ff6464", explorer: "https://optimistic.etherscan.io" },
  { name: "Polygon", symbol: "POL", chainId: 137, rpc: "https://polygon-rpc.com", color: "#ad8aff", explorer: "https://polygonscan.com" },
  { name: "BNB Smart Chain", symbol: "BNB", chainId: 56, rpc: "https://bsc-dataseed.binance.org", color: "#f3c969", explorer: "https://bscscan.com" }
];
type Vault = { version: 1; salt: string; iv: string; ciphertext: string };
const VAULT_KEY = "evm-wallet-vault-v1";
const bytesToBase64 = (bytes: Uint8Array) => btoa(Array.from(bytes, b => String.fromCharCode(b)).join(""));
const base64ToBytes = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const deriveKey = async (password: string, salt: Uint8Array) => {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
};
const encryptPhrase = async (phrase: string, password: string): Promise<Vault> => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(phrase));
  return { version: 1, salt: bytesToBase64(salt), iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(encrypted)) };
};
const decryptPhrase = async (vault: Vault, password: string) => {
  const key = await deriveKey(password, base64ToBytes(vault.salt));
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(vault.iv) }, key, base64ToBytes(vault.ciphertext));
  return new TextDecoder().decode(clear);
};
type TxRecord = { hash: string; network: string; to: string; amount: string; time: number; status: "pending" | "confirmed" | "failed" };
export default function App() {
  const [phrase, setPhrase] = useState("");
  const [savedPhrase, setSavedPhrase] = useState("");
  const [accountIndex, setAccountIndex] = useState(0);
  const [selectedNetwork, setSelectedNetwork] = useState(0);
  const [showPhrase, setShowPhrase] = useState(false);
  const [importText, setImportText] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState<"welcome" | "create" | "import" | "password" | "unlock" | "wallet">("welcome");
  const [copied, setCopied] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [amount, setAmount] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [vaultExists, setVaultExists] = useState(false);
  const [txs, setTxs] = useState<TxRecord[]>([]);
  const [gasFee, setGasFee] = useState<string | null>(null);
  const network = networks[selectedNetwork];
  const account = useMemo(() => {
    if (!savedPhrase || !Mnemonic.isValidMnemonic(savedPhrase)) return null;
    try { const w = HDNodeWallet.fromPhrase(savedPhrase, "", "m/44'/60'/0'/0/" + accountIndex); return { index: accountIndex, address: w.address, privateKey: w.privateKey }; }
    catch { return null; }
  }, [savedPhrase, accountIndex]);
  useEffect(() => {
    try { const exists = Boolean(localStorage.getItem(VAULT_KEY)); setVaultExists(exists); if (exists) setMode("unlock"); } catch { setNotice("Local storage is unavailable. Use a private browser profile with storage enabled."); }
    try { const saved = localStorage.getItem("evm-wallet-activity-v1"); if (saved) setTxs(JSON.parse(saved)); } catch { /* ignore corrupt activity */ }
  }, []);
  const persistTxs = (next: TxRecord[]) => { setTxs(next); try { localStorage.setItem("evm-wallet-activity-v1", JSON.stringify(next.slice(0, 30))); } catch { /* activity history is best effort */ } };
  const create = () => {
    if (!globalThis.crypto?.subtle) { setNotice("Secure browser cryptography is unavailable. Open the site over HTTPS."); return; }
    const m = Wallet.createRandom().mnemonic?.phrase ?? "";
    setPhrase(m); setSavedPhrase(m); setAccountIndex(0); setPassword(""); setConfirmPassword(""); setMode("create"); setNotice("");
  };
  const importWallet = () => {
    const p = importText.trim().toLowerCase().replace(/\s+/g, " ");
    if (!Mnemonic.isValidMnemonic(p)) { setNotice("Invalid recovery phrase. Check all words and try again."); return; }
    if (!globalThis.crypto?.subtle) { setNotice("Secure browser cryptography is unavailable. Open the site over HTTPS."); return; }
    setSavedPhrase(p); setPhrase(p); setAccountIndex(0); setPassword(""); setConfirmPassword(""); setMode("password"); setNotice("");
  };
  const finishVault = async () => {
    if (password.length < 12) { setNotice("Choose a password of at least 12 characters."); return; }
    if (password !== confirmPassword) { setNotice("The passwords do not match."); return; }
    if (!savedPhrase || !Mnemonic.isValidMnemonic(savedPhrase)) { setNotice("Wallet phrase is invalid. Please restart creation or import."); return; }
    setBusy(true);
    try {
      const vault = await encryptPhrase(savedPhrase, password);
      localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
      setVaultExists(true); setMode("wallet"); setPhrase(""); setImportText(""); setPassword(""); setConfirmPassword(""); setNotice("Encrypted vault saved on this device. Keep an offline backup of your recovery phrase.");
    } catch { setNotice("Could not save the encrypted vault. Check browser storage settings."); }
    finally { setBusy(false); }
  };
  const unlock = async () => {
    setBusy(true);
    try {
      const raw = localStorage.getItem(VAULT_KEY);
      if (!raw) { setVaultExists(false); setMode("welcome"); setNotice("No local vault found. Create or import a wallet."); return; }
      const restored = await decryptPhrase(JSON.parse(raw) as Vault, password);
      if (!Mnemonic.isValidMnemonic(restored)) throw new Error("Invalid vault payload");
      setSavedPhrase(restored); setAccountIndex(0); setPassword(""); setMode("wallet"); setNotice("");
    } catch { setNotice("Unable to unlock. Check your password or restore from your offline recovery phrase."); }
    finally { setBusy(false); }
  };
  const lock = () => { setSavedPhrase(""); setPhrase(""); setPassword(""); setSendTo(""); setAmount(""); setBalance(null); setGasFee(null); setMode("unlock"); setNotice(""); };
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1400); }
    catch { setNotice("Clipboard access was blocked by this browser."); }
  };
  const rpcEndpoints = (_n: typeof networks[number]) => [window.location.origin + "/api/rpc/" + network.chainId];
  const provider = (rpcUrl = window.location.origin + "/api/rpc/" + network.chainId) => new JsonRpcProvider(rpcUrl, network.chainId, { staticNetwork: true });
  const refreshBalance = async () => {
    if (!account) return;
    setRefreshing(true);
    let lastError: unknown = null;
    try {
      for (const rpcUrl of rpcEndpoints(network)) {
        const p = provider(rpcUrl);
        try {
          const [chain, bal, fees] = await Promise.all([p.getNetwork(), p.getBalance(account.address), p.getFeeData()]);
          if (Number(chain.chainId) !== network.chainId) throw new Error("RPC returned the wrong network.");
          setBalance(formatEther(bal));
          setGasFee(fees.maxFeePerGas ? (Number(fees.maxFeePerGas) / 1e9).toFixed(2) + " gwei max fee" : fees.gasPrice ? (Number(fees.gasPrice) / 1e9).toFixed(2) + " gwei gas price" : "Fee unavailable");
          await p.destroy();
          return;
        } catch (e) {
          lastError = e;
          await p.destroy();
        }
      }
      setBalance(null);
      setGasFee(null);
      setNotice("Could not load " + network.name + " data. All configured RPC endpoints failed or were rate-limited. " + (lastError instanceof Error ? lastError.message : ""));
    } finally { setRefreshing(false); }
  };
  useEffect(() => { if (mode === "wallet" && account) void refreshBalance(); else setBalance(null); }, [mode, account?.address, selectedNetwork]);
  const send = async () => {
    if (!account || !isAddress(sendTo) || !amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) { setNotice("Enter a valid destination address and a positive amount."); return; }
    if (sendTo.toLowerCase() === account.address.toLowerCase()) { setNotice("Destination is the same as the sending account."); return; }
    if (!window.confirm("Send " + amount + " " + network.symbol + " on " + network.name + " to " + sendTo + "? Check the address and network carefully. This cannot be undone.")) return;
    setBusy(true); setNotice("");
    let p: JsonRpcProvider | null = null;
    let waitingForReceipt = false;
    try {
      p = provider();
      const [chain, bal, fees] = await Promise.all([p.getNetwork(), p.getBalance(account.address), p.getFeeData()]);
      if (Number(chain.chainId) !== network.chainId) throw new Error("Chain ID mismatch. Transaction stopped.");
      const signer = new Wallet(account.privateKey, p);
      const value = parseEther(amount);
      const request = { to: sendTo, value };
      const gasLimit = await signer.estimateGas(request);
      const feePerGas = fees.maxFeePerGas ?? fees.gasPrice;
      if (!feePerGas) throw new Error("Unable to estimate network fee.");
      const fee = gasLimit * feePerGas;
      if (bal < value + fee) throw new Error("Insufficient balance for amount plus estimated network fee.");
      const estimated = formatEther(fee);
      if (!window.confirm("Estimated maximum network fee: about " + estimated + " " + network.symbol + ". Continue to sign and broadcast?")) return;
      const response = await signer.sendTransaction({ ...request, gasLimit });
      const record: TxRecord = { hash: response.hash, network: network.name, to: sendTo, amount, time: Date.now(), status: "pending" };
      persistTxs([record, ...txs]);
      setNotice("Transaction broadcast. Hash: " + response.hash);
      setSendTo(""); setAmount("");
      waitingForReceipt = true;
      void response.wait(1).then(receipt => { if (receipt) { persistTxs([{ ...record, status: "confirmed" }, ...txs.filter(t => t.hash !== record.hash)]); setNotice("Transaction confirmed. Hash: " + response.hash); } else { setNotice("Transaction was broadcast; confirmation is not available yet. Hash: " + response.hash); } if (p) void p.destroy(); }).catch(() => { setNotice("Transaction was broadcast, but confirmation could not be verified. Check the transaction hash in the explorer: " + response.hash); if (p) void p.destroy(); });
      await refreshBalance();
    } catch (e) { setNotice("Transaction not completed: " + (e instanceof Error ? e.message : "Unknown error")); }
    finally { if (p && !waitingForReceipt) await p.destroy(); setBusy(false); }
  };
  const removeVault = () => {
    if (!window.confirm("Delete the encrypted vault from this browser? Make sure you have your recovery phrase backed up offline. This cannot be undone.")) return;
    try { localStorage.removeItem(VAULT_KEY); setVaultExists(false); setSavedPhrase(""); setPhrase(""); setMode("welcome"); setNotice("Encrypted local vault deleted. Your recovery phrase is not recoverable from this browser."); }
    catch { setNotice("Unable to delete vault from browser storage."); }
  };
  if (mode === "welcome" || mode === "create" || mode === "import" || mode === "password" || mode === "unlock") return <main className="auth-shell">
    <header className="topbar"><a className="brand" href="#"><span className="brand-mark"><WalletIcon size={21}/></span><span>EVM<span className="brand-light">WALLET</span></span></a><div className="top-status"><span className="live-dot"/> LOCAL ENCRYPTED VAULT</div></header>
    <section className="hero"><div className="eyebrow"><span/> YOUR KEYS. YOUR DEVICE.</div><h1>One wallet.<br/><em>Every EVM chain.</em></h1><p className="hero-copy">A self-custody wallet for sending and receiving native assets across supported EVM networks.</p>
    <div className="feature-row"><span><ShieldCheck size={16}/> Encrypted local vault</span><span><Globe2 size={16}/> Six EVM networks</span></div>
    <div className="auth-card">
      {mode === "welcome" && <><div className="card-icon"><Fingerprint size={24}/></div><h2>Welcome to your wallet</h2><p className="muted">Create a new wallet or restore one with your recovery phrase.</p><button className="primary-btn" onClick={create}><Plus size={17}/> Create new wallet <ArrowUpRight size={17}/></button><button className="secondary-btn" onClick={() => { setMode("import"); setNotice(""); }}><KeyRound size={17}/> Import recovery phrase</button><div className="secure-note"><LockKeyhole size={14}/> Never share your recovery phrase with anyone.</div></>}
      {mode === "create" && <><div className="card-icon"><KeyRound size={24}/></div><h2>Your recovery phrase</h2><p className="muted">Write these words down offline, in order. Anyone with this phrase can control your funds.</p><div className="phrase-grid">{phrase.split(" ").map((w, i) => <div className="word" key={i}><small>{i+1}</small><span>{showPhrase ? w : "••••••"}</span></div>)}</div><button className="text-btn" onClick={() => setShowPhrase(!showPhrase)}>{showPhrase ? <EyeOff size={15}/> : <Eye size={15}/>} {showPhrase ? "Hide phrase" : "Reveal phrase"}</button><button className="primary-btn" onClick={() => { if (!showPhrase) { setNotice("Reveal your recovery phrase and write it down offline before continuing."); return; } setMode("password"); setNotice(""); }}><Check size={17}/> I’ve backed up my phrase</button>{notice && <p className="notice">{notice}</p>}<div className="secure-note warning"><LockKeyhole size={14}/> Back it up offline before continuing.</div></>}
      {mode === "import" && <><div className="card-icon"><KeyRound size={24}/></div><h2>Restore your wallet</h2><p className="muted">Enter your 12- or 24-word recovery phrase. It is processed locally in this browser.</p><textarea className="phrase-input" value={importText} onChange={e => setImportText(e.target.value)} placeholder="Enter recovery words separated by spaces" rows={4} autoComplete="off" spellCheck={false}/>{notice && <p className="notice">{notice}</p>}<button className="primary-btn" onClick={importWallet}>Continue securely <ArrowUpRight size={17}/></button><button className="secondary-btn" onClick={() => { setMode("welcome"); setNotice(""); }}>Cancel</button></>}
      {mode === "password" && <><div className="card-icon"><LockKeyhole size={24}/></div><h2>Encrypt your wallet</h2><p className="muted">Choose a strong password. Your recovery phrase will be encrypted with AES-GCM and PBKDF2 before being stored on this device.</p><label className="field-label">Vault password</label><input className="wallet-input" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" placeholder="At least 12 characters"/><label className="field-label">Confirm password</label><input className="wallet-input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" placeholder="Repeat password"/>{notice && <p className="notice">{notice}</p>}<button className="primary-btn" disabled={busy} onClick={() => void finishVault()}>{busy ? "Encrypting…" : "Encrypt and open wallet"} <LockKeyhole size={16}/></button><button className="secondary-btn" onClick={() => { setMode(phrase ? "create" : "import"); setPassword(""); setConfirmPassword(""); }}>Back</button><div className="secure-note warning">If you forget this password, restore with your offline recovery phrase.</div></>}
      {mode === "unlock" && <><div className="card-icon"><LockKeyhole size={24}/></div><h2>Unlock your wallet</h2><p className="muted">The encrypted vault stays on this device. Your password is never sent to a server.</p><form onSubmit={e => { e.preventDefault(); void unlock(); }}><label className="field-label">Vault password</label><input className="wallet-input" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" placeholder="Enter your vault password"/>{notice && <p className="notice">{notice}</p>}<button className="primary-btn" type="submit" disabled={busy}>{busy ? "Unlocking…" : "Unlock wallet"} <LockKeyhole size={16}/></button></form><button className="secondary-btn" onClick={() => { setMode("import"); setNotice(""); }}>Restore with recovery phrase</button></>}
    </div><p className="footer-note">Self-custody prototype · Never share your recovery phrase</p></section>
  </main>;
  return <main className="app-shell"><aside className="sidebar"><a className="brand" href="#"><span className="brand-mark"><WalletIcon size={21}/></span><span>EVM<span className="brand-light">WALLET</span></span></a><div className="side-label">WALLET</div><button className="nav-item active"><WalletIcon size={17}/> Overview</button><button className="nav-item" onClick={() => setNotice("Activity shown below is saved locally in this browser; transaction status is best effort.")}><ArrowDownLeft size={17}/> Activity</button><div className="side-label network-label">NETWORKS</div>{networks.map((n, i) => <button key={n.name} className={"network-item " + (i === selectedNetwork ? "selected" : "")} onClick={() => setSelectedNetwork(i)}><span className="network-dot" style={{background:n.color}}/>{n.name}{i === selectedNetwork && <span className="network-check"><Check size={13}/></span>}</button>)}<div className="sidebar-bottom"><div className="security-mini"><ShieldCheck size={17}/><span><b>Encrypted vault</b><small>Stored on this device</small></span></div><button className="nav-item" onClick={lock}><LogOut size={16}/> Lock wallet</button><button className="nav-item" onClick={removeVault}><X size={16}/> Delete local vault</button></div></aside>
  <section className="dashboard"><header className="dash-top"><div><span className="breadcrumb">Wallet /</span> Overview</div><div className="chain-pill"><span className="network-dot" style={{background:network.color}}/>{network.name}<ChevronDown size={14}/></div></header>
  <div className="dash-content"><div className="welcome-line"><div><div className="eyebrow"><span/> WALLET OVERVIEW</div><h1>Your assets, <em>in one place.</em></h1><p className="muted">Native asset balance and transfers on the selected chain.</p></div><button className="outline-btn" onClick={() => { setAccountIndex(v => v + 1); setNotice(""); }}><Plus size={16}/> Add account</button></div>
  <div className="balance-card"><div className="balance-top"><span><span className="network-dot" style={{background:network.color}}/> {network.name}</span><span className="pill">CHAIN {network.chainId}</span></div><div className="balance-label">Native balance</div><div className="balance-value">{balance === null ? "—" : Number(balance).toLocaleString(undefined, {maximumFractionDigits: 6})} <small>{network.symbol}</small></div><p className="muted balance-caption">{gasFee ? "Estimated fee market: " + gasFee : "Refresh to query the public RPC."}</p><button className="outline-btn refresh-btn" disabled={refreshing} onClick={() => void refreshBalance()}><RefreshCw size={15} className={refreshing ? "spin" : ""}/> {refreshing ? "Refreshing…" : "Refresh balance and fees"}</button><div className="address-box"><span>{account?.address}</span><button title="Copy address" onClick={() => account && copy(account.address)}><Copy size={16}/></button></div><div className="balance-actions"><button className="primary-btn" onClick={() => setNotice("Receive assets by sharing your public address. Always verify the chain before sending funds.")}><ArrowDownLeft size={17}/> Receive</button><button className="secondary-btn" onClick={() => document.getElementById("send-panel")?.scrollIntoView({behavior:"smooth"})}><ArrowUpRight size={17}/> Send</button></div></div>
  {notice && <div className="notice-bar">{notice}<button onClick={() => setNotice("")}><X size={15}/></button></div>}
  <div className="section-heading"><div><h2>Send native assets</h2><p className="muted">Review the destination, amount, chain, and estimated fee before signing.</p></div></div>
  <div className="detail-card send-panel" id="send-panel"><div className="detail-main send-fields"><label className="field-label">Network</label><select className="wallet-input" value={selectedNetwork} onChange={e => setSelectedNetwork(Number(e.target.value))}>{networks.map((n,i)=><option key={n.chainId} value={i}>{n.name} · Chain ID {n.chainId}</option>)}</select><label className="field-label">Recipient address</label><input className="wallet-input" value={sendTo} onChange={e=>setSendTo(e.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false}/><label className="field-label">Amount ({network.symbol})</label><input className="wallet-input" type="number" min="0" step="any" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.01"/><button className="primary-btn" disabled={busy || refreshing} onClick={() => void send()}>{busy ? "Processing…" : "Review, sign and send"} <ArrowUpRight size={16}/></button><p className="muted">This sends only the network’s native asset. Token transfers and contract interactions are not enabled.</p></div></div>
  <div className="section-heading"><div><h2>Account details</h2><p className="muted">Derived locally from your recovery phrase.</p></div><span className="pill">ACCOUNT {accountIndex + 1}</span></div><div className="detail-card"><div className="detail-icon"><Fingerprint size={20}/></div><div className="detail-main"><b>Account {accountIndex + 1}</b><span>{account?.address}</span></div><button className="icon-btn" onClick={() => account && copy(account.address)}><Copy size={16}/></button></div>
  <div className="section-heading network-heading"><div><h2>Supported networks</h2><p className="muted">Switching networks refreshes balance and fee estimates.</p></div></div><div className="network-grid">{networks.map((n, i) => <button key={n.name} className={"network-card " + (i === selectedNetwork ? "network-active" : "")} onClick={() => setSelectedNetwork(i)}><span className="network-dot" style={{background:n.color}}/><span><b>{n.name}</b><small>{n.symbol} · Chain ID {n.chainId}</small></span>{i === selectedNetwork && <Check size={15}/>}</button>)}</div>
  <div className="section-heading"><div><h2>Recent transactions</h2><p className="muted">Locally cached transactions initiated in this browser.</p></div></div><div className="tx-list">{txs.filter(t=>t.network===network.name).length===0 ? <p className="muted">No locally recorded transactions for this network.</p> : txs.filter(t=>t.network===network.name).map(t=><div className="detail-card tx-row" key={t.hash}><div className="detail-main"><b>{t.amount} {network.symbol} · {t.status}</b><span>{t.hash.slice(0,12)}…{t.hash.slice(-8)}</span></div><a className="icon-btn" href={network.explorer+"/tx/"+t.hash} target="_blank" rel="noreferrer" aria-label="Open transaction explorer"><ArrowUpRight size={16}/></a></div>)}</div>
  <div className="prototype-warning"><ShieldCheck size={18}/><div><b>Security and deployment notice</b><p>Recovery phrase is encrypted locally with Web Crypto. This code has not undergone an independent audit. Public RPCs can be unavailable or rate-limited. Start with small test amounts; verify the chain, recipient, and fee. Never use a recovery phrase on a device you do not trust.</p></div></div>
  <footer className="dash-footer"><span>© 2026 EVM Wallet</span><span><LockKeyhole size={13}/> Self-custody · Verify every transaction</span></footer></div></section></main>;
}
