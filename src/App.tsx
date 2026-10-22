import { useMemo, useState } from "react";
import { HDNodeWallet, Mnemonic, Wallet, isAddress } from "ethers";
import { ArrowDownLeft, ArrowUpRight, Check, ChevronDown, CircleHelp, Copy, Eye, EyeOff, Fingerprint, Globe2, KeyRound, LockKeyhole, Plus, ShieldCheck, Wallet as WalletIcon, X } from "lucide-react";

const networks = [
  { name: "Ethereum", symbol: "ETH", chainId: 1, rpc: "https://cloudflare-eth.com", color: "#8c9cff" },
  { name: "Base", symbol: "ETH", chainId: 8453, rpc: "https://mainnet.base.org", color: "#5795ff" },
  { name: "Arbitrum One", symbol: "ETH", chainId: 42161, rpc: "https://arb1.arbitrum.io/rpc", color: "#70aaff" },
  { name: "Optimism", symbol: "ETH", chainId: 10, rpc: "https://mainnet.optimism.io", color: "#ff6464" },
  { name: "Polygon", symbol: "POL", chainId: 137, rpc: "https://polygon-rpc.com", color: "#ad8aff" },
  { name: "BNB Smart Chain", symbol: "BNB", chainId: 56, rpc: "https://bsc-dataseed.binance.org", color: "#f3c969" }
];
type Account = { index: number; address: string; privateKey: string };
export default function App() {
  const [phrase, setPhrase] = useState("");
  const [savedPhrase, setSavedPhrase] = useState("");
  const [accountIndex, setAccountIndex] = useState(0);
  const [selectedNetwork, setSelectedNetwork] = useState(0);
  const [showPhrase, setShowPhrase] = useState(false);
  const [importText, setImportText] = useState("");
  const [mode, setMode] = useState<"welcome" | "create" | "import" | "wallet">("welcome");
  const [copied, setCopied] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [amount, setAmount] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const network = networks[selectedNetwork];
  const account: Account | null = useMemo(() => {
    if (!savedPhrase || !Mnemonic.isValidMnemonic(savedPhrase)) return null;
    try {
      const w = HDNodeWallet.fromPhrase(savedPhrase, "", "m/44'/60'/0'/0/" + accountIndex);
      return { index: accountIndex, address: w.address, privateKey: w.privateKey };
    } catch { return null; }
  }, [savedPhrase, accountIndex]);
  const create = () => {
    const m = Wallet.createRandom().mnemonic?.phrase ?? "";
    setPhrase(m); setSavedPhrase(m); setAccountIndex(0); setMode("create"); setNotice("");
  };
  const importWallet = () => {
    const p = importText.trim().toLowerCase().replace(/\s+/g, " ");
    if (!Mnemonic.isValidMnemonic(p)) { setNotice("Invalid recovery phrase. Check the words and try again."); return; }
    setSavedPhrase(p); setPhrase(""); setAccountIndex(0); setMode("wallet"); setNotice("");
  };
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1400); }
    catch { setNotice("Clipboard access was blocked by this browser."); }
  };
  const send = async () => {
    if (!account || !isAddress(sendTo) || !amount || Number(amount) <= 0) { setNotice("Enter a valid destination address and amount."); return; }
    setNotice("Sending is disabled in this initial prototype. Add a reviewed signing flow before using real funds.");
  };
  if (mode === "welcome" || mode === "create" || mode === "import") return <main className="auth-shell">
    <header className="topbar"><a className="brand" href="#"><span className="brand-mark"><WalletIcon size={21}/></span><span>EVM<span className="brand-light">WALLET</span></span></a><div className="top-status"><span className="live-dot"/> SELF-CUSTODY WALLET</div></header>
    <section className="hero"><div className="eyebrow"><span/> YOUR KEYS. YOUR ASSETS.</div><h1>One wallet.<br/><em>Every EVM chain.</em></h1><p className="hero-copy">A calmer, clearer way to manage your digital assets across Ethereum-compatible networks.</p>
    <div className="feature-row"><span><ShieldCheck size={16}/> Keys stay on your device</span><span><Globe2 size={16}/> Multi-chain ready</span></div>
    <div className="auth-card">
      {mode === "welcome" && <><div className="card-icon"><Fingerprint size={24}/></div><h2>Welcome to your wallet</h2><p className="muted">Create a new wallet or restore one with your recovery phrase.</p><button className="primary-btn" onClick={create}><Plus size={17}/> Create new wallet <ArrowUpRight size={17}/></button><button className="secondary-btn" onClick={() => { setMode("import"); setNotice(""); }}><KeyRound size={17}/> Import recovery phrase</button><div className="secure-note"><LockKeyhole size={14}/> Never share your recovery phrase with anyone.</div></>}
      {mode === "create" && <><div className="card-icon"><KeyRound size={24}/></div><h2>Your recovery phrase</h2><p className="muted">Write these words down offline, in order. Anyone with this phrase can control your funds.</p><div className="phrase-grid">{phrase.split(" ").map((w, i) => <div className="word" key={i}><small>{i+1}</small><span>{showPhrase ? w : "••••••"}</span></div>)}</div><button className="text-btn" onClick={() => setShowPhrase(!showPhrase)}>{showPhrase ? <EyeOff size={15}/> : <Eye size={15}/>} {showPhrase ? "Hide phrase" : "Reveal phrase"}</button><button className="secondary-btn" onClick={() => copy(phrase)}><Copy size={16}/>{copied ? "Copied" : "Copy phrase"}</button><button className="primary-btn" onClick={() => { setMode("wallet"); setPhrase(""); setNotice("Wallet created in this browser session. This prototype does not persist an encrypted vault."); }}><Check size={17}/> I’ve saved my phrase</button><div className="secure-note warning"><CircleHelp size={14}/> This prototype is not audited. Do not use real funds.</div></>}
      {mode === "import" && <><div className="card-icon"><KeyRound size={24}/></div><h2>Restore your wallet</h2><p className="muted">Enter your 12- or 24-word recovery phrase. It is processed in this browser.</p><textarea className="phrase-input" value={importText} onChange={e => setImportText(e.target.value)} placeholder="Enter your recovery words separated by spaces" rows={4} autoComplete="off" spellCheck={false}/>{notice && <p className="notice">{notice}</p>}<button className="primary-btn" onClick={importWallet}>Restore wallet <ArrowUpRight size={17}/></button><button className="secondary-btn" onClick={() => { setMode("welcome"); setNotice(""); }}>Cancel</button><div className="secure-note"><LockKeyhole size={14}/> Never paste your phrase into a website you don’t trust.</div></>}
    </div><p className="footer-note">Designed for self-custody · Prototype v0.1</p></section>
  </main>;
  return <main className="app-shell"><aside className="sidebar"><a className="brand" href="#"><span className="brand-mark"><WalletIcon size={21}/></span><span>EVM<span className="brand-light">WALLET</span></span></a><div className="side-label">WALLET</div><button className="nav-item active"><WalletIcon size={17}/> Overview</button><button className="nav-item" onClick={() => setNotice("Token and activity views are planned for a later release.")}><ArrowDownLeft size={17}/> Activity</button><div className="side-label network-label">NETWORKS</div>{networks.map((n, i) => <button key={n.name} className={"network-item " + (i === selectedNetwork ? "selected" : "")} onClick={() => setSelectedNetwork(i)}><span className="network-dot" style={{background:n.color}}/>{n.name}{i === selectedNetwork && <span className="network-check"><Check size={13}/></span>}</button>)}<div className="sidebar-bottom"><div className="security-mini"><ShieldCheck size={17}/><span><b>Self-custody</b><small>Keys are yours to protect</small></span></div><button className="nav-item" onClick={() => { setMode("welcome"); setSavedPhrase(""); setNotice(""); }}><X size={16}/> Lock / exit</button></div></aside>
  <section className="dashboard"><header className="dash-top"><div><span className="breadcrumb">Wallet /</span> Overview</div><div className="chain-pill"><span className="network-dot" style={{background:network.color}}/>{network.name}<ChevronDown size={14}/></div></header>
  <div className="dash-content"><div className="welcome-line"><div><div className="eyebrow"><span/> WALLET OVERVIEW</div><h1>Your assets, <em>in one place.</em></h1><p className="muted">Manage your address across supported EVM networks.</p></div><button className="outline-btn" onClick={() => { setAccountIndex(v => v + 1); setNotice(""); }}><Plus size={16}/> Add account</button></div>
  <div className="balance-card"><div className="balance-top"><span><span className="network-dot" style={{background:network.color}}/> {network.name}</span><span className="pill">NETWORK SELECTED</span></div><div className="balance-label">Selected account</div><div className="balance-value">— <small>{network.symbol}</small></div><p className="muted balance-caption">Live balance lookup is not enabled in this prototype.</p><div className="address-box"><span>{account?.address}</span><button title="Copy address" onClick={() => account && copy(account.address)}><Copy size={16}/></button></div><div className="balance-actions"><button className="primary-btn" onClick={() => setNotice("Receive: share your public address above. Confirm the network before accepting funds.")}><ArrowDownLeft size={17}/> Receive</button><button className="secondary-btn" onClick={() => setNotice("Sending is disabled until a secure transaction flow is implemented and reviewed.")}><ArrowUpRight size={17}/> Send</button></div></div>
  {notice && <div className="notice-bar">{notice}<button onClick={() => setNotice("")}><X size={15}/></button></div>}
  <div className="section-heading"><div><h2>Account details</h2><p className="muted">HD account derived from your recovery phrase.</p></div><span className="pill">ACCOUNT {accountIndex + 1}</span></div>
  <div className="detail-card"><div className="detail-icon"><Fingerprint size={20}/></div><div className="detail-main"><b>Account {accountIndex + 1}</b><span>{account?.address}</span></div><button className="icon-btn" onClick={() => account && copy(account.address)}><Copy size={16}/></button></div>
  <div className="section-heading network-heading"><div><h2>Supported networks</h2><p className="muted">Choose a network to change the selected chain.</p></div></div><div className="network-grid">{networks.map((n, i) => <button key={n.name} className={"network-card " + (i === selectedNetwork ? "network-active" : "")} onClick={() => setSelectedNetwork(i)}><span className="network-dot" style={{background:n.color}}/><span><b>{n.name}</b><small>{n.symbol} · Chain ID {n.chainId}</small></span>{i === selectedNetwork && <Check size={15}/>}</button>)}</div>
  <div className="prototype-warning"><ShieldCheck size={18}/><div><b>Prototype security notice</b><p>This is an early prototype, not a security-audited wallet. Sending transactions, encrypted vault persistence, and live balance retrieval are not enabled. Do not use real funds.</p></div></div>
  <footer className="dash-footer"><span>© 2026 EVM Wallet</span><span><LockKeyhole size={13}/> Self-custody · Use at your own risk</span></footer></div></section></main>;
}
