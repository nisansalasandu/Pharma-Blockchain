// frontend/src/App.jsx
// Sri Lankan Pharmaceutical Blockchain — Phase 2 React Frontend
// 
// Prerequisites:
//   cd frontend
//   npm install ethers
//   npm run dev
//
// Then open: http://localhost:5173
//
// IMPORTANT: Update CONTRACT_ADDRESSES below after deploying Phase 2 contracts.

import { useState, useEffect } from "react";
import { ethers } from "ethers";

// ── Paste your deployed addresses here ──────────────────────────────────────
const CONTRACT_ADDRESSES = {
  RoleAccessControl:    "0xae5EFBA9DE36d3d7206d18d10572F3a3aE601c1D",
  TraceabilityContract: "0x4Ac61aebF5A2391223559b04D575Ef8346CaC6a9",
  OrderingContract:     "0x3c8A67F235C57e2Cd2ac0dAb9323697Bdb1061d6",
};

// ── Minimal ABIs (only the functions the UI needs) ───────────────────────────
const ROLE_CONTROL_ABI = [
  "function getMember(address) view returns (bytes32, string, bool, address, uint256, uint256)",
  "function roleName(bytes32) view returns (string)",
  "function totalMembers() view returns (uint256)",
  "function ROLE_NMRA() view returns (bytes32)",
  "function ROLE_SPC() view returns (bytes32)",
  "function ROLE_MSD() view returns (bytes32)",
  "function ROLE_PHARMACY() view returns (bytes32)",
  "function ROLE_HOSPITAL() view returns (bytes32)",
];

const TRACEABILITY_ABI = [
  "function getBatch(uint256) view returns (tuple(uint256,string,string,string,uint256,uint256,uint256,address,address,uint8,bool,int256,int256,bytes32,string,bool))",
  "function getCustodyHistory(uint256) view returns (tuple(address,address,uint256,string,int256,string)[])",
  "function totalBatches() view returns (uint256)",
  "function getHolderBatches(address) view returns (uint256[])",
];

const ORDERING_ABI = [
  "function placeOrder(address,string,string,uint256,uint256,string) returns (uint256)",
  "function getOrder(uint256) view returns (tuple(uint256,address,address,string,string,uint256,uint256,uint256,uint8,uint8,uint256,string,uint256,uint256,address,string,bool))",
  "function getOrdersByPlacer(address) view returns (uint256[])",
  "function totalOrders() view returns (uint256)",
  "event OrderPlaced(uint256 indexed,address indexed,address indexed,string,uint256)",
];

// ── Role label colours ────────────────────────────────────────────────────────
const ROLE_COLOURS = {
  NMRA: "#ff6b6b", SPC: "#4ecdc4", MSD: "#45b7d1",
  MANUFACTURER: "#a29bfe", IMPORTER: "#fd79a8",
  WHOLESALER: "#fdcb6e", PHARMACY: "#00b894",
  HOSPITAL: "#0984e3", TRANSPORTER: "#e17055", UNKNOWN: "#b2bec3",
};

const STATUS_LABELS = [
  "PENDING","AI_REVIEW","APPROVED","EMERGENCY","FULFILLED","REJECTED","CANCELLED"
];
const STATUS_COLOURS = [
  "#fdcb6e","#a29bfe","#00b894","#d63031","#0984e3","#ff7675","#b2bec3"
];

// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [account,       setAccount]       = useState(null);
  const [role,          setRole]          = useState("UNKNOWN");
  const [orgName,       setOrgName]       = useState("");
  const [provider,      setProvider]      = useState(null);
  const [signer,        setSigner]        = useState(null);
  const [tab,           setTab]           = useState("dashboard");
  const [txStatus,      setTxStatus]      = useState("");
  const [myOrders,      setMyOrders]      = useState([]);
  const [stats,         setStats]         = useState({ totalOrders:0, totalBatches:0, totalMembers:0 });

  // Order form state
  const [supplierAddr,  setSupplierAddr]  = useState("");
  const [medicineName,  setMedicineName]  = useState("");
  const [genericName,   setGenericName]   = useState("");
  const [quantity,      setQuantity]      = useState("");
  const [urgency,       setUrgency]       = useState("");

  // ── Connect MetaMask ────────────────────────────────────────────────────
  async function connectWallet() {
    if (!window.ethereum) {
      alert("MetaMask not found! Please install MetaMask.");
      return;
    }
    try {
      const _provider = new ethers.BrowserProvider(window.ethereum);
      await _provider.send("eth_requestAccounts", []);
      const _signer   = await _provider.getSigner();
      const _account  = await _signer.getAddress();

      setProvider(_provider);
      setSigner(_signer);
      setAccount(_account);

      await fetchRole(_signer, _account);
      await fetchStats(_provider);
    } catch (err) {
      setTxStatus("❌ Connection failed: " + err.message);
    }
  }

  // ── Fetch role from RoleAccessControl ───────────────────────────────────
  async function fetchRole(_signer, _account) {
    try {
      const rc = new ethers.Contract(CONTRACT_ADDRESSES.RoleAccessControl, ROLE_CONTROL_ABI, _signer);
      const [roleBytes, name] = await rc.getMember(_account);
      const roleStr = await rc.roleName(roleBytes);
      setRole(roleStr);
      setOrgName(name);
    } catch {
      setRole("UNKNOWN");
      setOrgName("Not registered");
    }
  }

  // ── Fetch network stats ──────────────────────────────────────────────────
  async function fetchStats(_provider) {
    try {
      const rc = new ethers.Contract(CONTRACT_ADDRESSES.RoleAccessControl,    ROLE_CONTROL_ABI,  _provider);
      const tc = new ethers.Contract(CONTRACT_ADDRESSES.TraceabilityContract,  TRACEABILITY_ABI, _provider);
      const oc = new ethers.Contract(CONTRACT_ADDRESSES.OrderingContract,      ORDERING_ABI,     _provider);
      const [members, batches, orders] = await Promise.all([
        rc.totalMembers(), tc.totalBatches(), oc.totalOrders()
      ]);
      setStats({ totalOrders: orders.toString(), totalBatches: batches.toString(), totalMembers: members.toString() });
    } catch {}
  }

  // ── Load my orders ───────────────────────────────────────────────────────
  async function loadMyOrders() {
    if (!signer || !account) return;
    try {
      const oc = new ethers.Contract(CONTRACT_ADDRESSES.OrderingContract, ORDERING_ABI, signer);
      const ids = await oc.getOrdersByPlacer(account);
      const orders = await Promise.all(ids.map(id => oc.getOrder(id)));
      setMyOrders(orders);
    } catch (err) {
      setTxStatus("❌ Could not load orders: " + err.message);
    }
  }

  useEffect(() => { if (tab === "orders") loadMyOrders(); }, [tab]);

  // ── Place order ──────────────────────────────────────────────────────────
  async function handlePlaceOrder() {
    if (!signer) { setTxStatus("❌ Connect wallet first"); return; }
    if (!supplierAddr || !medicineName || !genericName || !quantity) {
      setTxStatus("❌ Fill all required fields"); return;
    }
    try {
      setTxStatus("⏳ Placing order...");
      const oc = new ethers.Contract(CONTRACT_ADDRESSES.OrderingContract, ORDERING_ABI, signer);
      const tx = await oc.placeOrder(
        supplierAddr,
        medicineName,
        genericName,
        parseInt(quantity),
        ethers.parseEther("0.0001"),
        urgency || "Standard procurement"
      );
      setTxStatus("⏳ Mining transaction...");
      const receipt = await tx.wait();
      setTxStatus(`✅ Order placed! Tx: ${receipt.hash.slice(0,18)}...`);
      setMedicineName(""); setGenericName(""); setQuantity(""); setUrgency("");
      await fetchStats(provider);
    } catch (err) {
      setTxStatus("❌ Error: " + (err.reason || err.message));
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const styles = {
    app: { fontFamily:"Arial,sans-serif", minHeight:"100vh", background:"#f0f4f8", padding:"20px" },
    header: { background:"linear-gradient(135deg,#2d3436,#0984e3)", color:"#fff", borderRadius:"12px", padding:"24px 32px", marginBottom:"24px", display:"flex", justifyContent:"space-between", alignItems:"center" },
    title: { margin:0, fontSize:"22px", fontWeight:700 },
    subtitle: { margin:"4px 0 0", fontSize:"13px", opacity:0.8 },
    connectBtn: { background:"#00b894", color:"#fff", border:"none", borderRadius:"8px", padding:"10px 20px", cursor:"pointer", fontWeight:600, fontSize:"14px" },
    roleTag: { background: ROLE_COLOURS[role] || "#b2bec3", color:"#fff", borderRadius:"20px", padding:"4px 14px", fontSize:"13px", fontWeight:600 },
    statsRow: { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"16px", marginBottom:"24px" },
    statCard: { background:"#fff", borderRadius:"12px", padding:"20px", textAlign:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.08)" },
    statNum: { fontSize:"32px", fontWeight:700, color:"#0984e3" },
    statLabel: { fontSize:"13px", color:"#636e72", marginTop:"4px" },
    tabs: { display:"flex", gap:"8px", marginBottom:"20px" },
    tab: { padding:"10px 20px", borderRadius:"8px", border:"none", cursor:"pointer", fontWeight:600, fontSize:"14px" },
    card: { background:"#fff", borderRadius:"12px", padding:"24px", boxShadow:"0 2px 8px rgba(0,0,0,0.08)", marginBottom:"16px" },
    label: { display:"block", fontWeight:600, fontSize:"13px", color:"#2d3436", marginBottom:"6px" },
    input: { width:"100%", padding:"10px 14px", border:"1px solid #dfe6e9", borderRadius:"8px", fontSize:"14px", boxSizing:"border-box", marginBottom:"12px" },
    btn: { background:"#0984e3", color:"#fff", border:"none", borderRadius:"8px", padding:"12px 24px", cursor:"pointer", fontWeight:600, fontSize:"14px", width:"100%" },
    status: { marginTop:"12px", padding:"12px", borderRadius:"8px", background:"#f8f9fa", fontSize:"13px", color:"#2d3436" },
    orderRow: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderBottom:"1px solid #f0f4f8" },
    orderStatus: (s) => ({ background: STATUS_COLOURS[s] || "#b2bec3", color:"#fff", borderRadius:"12px", padding:"3px 10px", fontSize:"12px", fontWeight:600 }),
  };

  return (
    <div style={styles.app}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>🏥 Sri Lanka PharmaChain</h1>
          <p style={styles.subtitle}>AI-Powered Pharmaceutical Supply Chain Blockchain</p>
        </div>
        <div style={{display:"flex", alignItems:"center", gap:"12px"}}>
          {account && <span style={styles.roleTag}>{role}</span>}
          {account
            ? <div style={{textAlign:"right"}}>
                <div style={{fontSize:"13px", opacity:0.9}}>{orgName}</div>
                <div style={{fontSize:"11px", opacity:0.7}}>{account.slice(0,8)}...{account.slice(-6)}</div>
              </div>
            : <button style={styles.connectBtn} onClick={connectWallet}>🦊 Connect MetaMask</button>
          }
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={styles.statsRow}>
        {[
          { num: stats.totalMembers,  label:"Registered Organisations" },
          { num: stats.totalBatches,  label:"Medicine Batches Tracked" },
          { num: stats.totalOrders,   label:"Total Orders Placed" },
        ].map((s,i) => (
          <div key={i} style={styles.statCard}>
            <div style={styles.statNum}>{s.num}</div>
            <div style={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={styles.tabs}>
        {["dashboard","placeOrder","orders","verify"].map(t => (
          <button
            key={t}
            style={{...styles.tab, background: tab===t ? "#0984e3":"#fff", color: tab===t ? "#fff":"#2d3436"}}
            onClick={() => setTab(t)}
          >
            {{ dashboard:"📊 Dashboard", placeOrder:"📝 Place Order", orders:"📋 My Orders", verify:"🔍 Verify QR" }[t]}
          </button>
        ))}
      </div>

      {/* ── Tab: Dashboard ── */}
      {tab === "dashboard" && (
        <div style={styles.card}>
          <h2 style={{marginTop:0}}>📊 Network Overview</h2>
          <p>Connected to <strong>Ganache (Chain ID 1337)</strong> — Sri Lanka PharmaChain local testnet.</p>
          <div style={{background:"#f8f9fa", borderRadius:"8px", padding:"16px", marginTop:"16px"}}>
            <h3 style={{marginTop:0}}>🏗️ Deployed Contracts</h3>
            {Object.entries(CONTRACT_ADDRESSES).map(([name, addr]) => (
              <div key={name} style={{marginBottom:"8px", fontSize:"13px"}}>
                <strong>{name}:</strong><br/>
                <code style={{fontSize:"12px", color:"#0984e3"}}>{addr}</code>
              </div>
            ))}
          </div>
          <div style={{background:"#e8f5e9", borderRadius:"8px", padding:"16px", marginTop:"16px"}}>
            <h3 style={{marginTop:0}}>🎯 Demo Scenarios</h3>
            <p style={{fontSize:"13px"}}><strong>Scenario 1</strong>: Pharmacy orders Paracetamol → AI risk 0.3 → PoA approval → Delivery</p>
            <p style={{fontSize:"13px"}}><strong>Scenario 2</strong>: AI detects Insulin shortage → risk 0.9 → PBFT emergency → NMRA approval</p>
            <p style={{fontSize:"13px", color:"#636e72"}}>Run these via terminal: <code>npx hardhat run scripts/demo-scenario1.js --network ganache</code></p>
          </div>
        </div>
      )}

      {/* ── Tab: Place Order ── */}
      {tab === "placeOrder" && (
        <div style={styles.card}>
          <h2 style={{marginTop:0}}>📝 Place Medicine Order</h2>
          {(role !== "PHARMACY" && role !== "HOSPITAL") && (
            <div style={{background:"#fff3e0", borderRadius:"8px", padding:"12px", marginBottom:"16px", fontSize:"13px"}}>
              ⚠️ Only PHARMACY and HOSPITAL accounts can place orders. Your role: <strong>{role}</strong>
            </div>
          )}
          <label style={styles.label}>Supplier Address (SPC or MSD) *</label>
          <input style={styles.input} placeholder="0x... (paste from ACCOUNT_MAPPING.md)" value={supplierAddr} onChange={e => setSupplierAddr(e.target.value)} />

          <label style={styles.label}>Medicine Trade Name *</label>
          <input style={styles.input} placeholder="e.g. Panadol 500mg" value={medicineName} onChange={e => setMedicineName(e.target.value)} />

          <label style={styles.label}>Generic (INN) Name *</label>
          <input style={styles.input} placeholder="e.g. Paracetamol 500mg" value={genericName} onChange={e => setGenericName(e.target.value)} />

          <label style={styles.label}>Quantity (units) *</label>
          <input style={styles.input} type="number" placeholder="e.g. 10000" value={quantity} onChange={e => setQuantity(e.target.value)} />

          <label style={styles.label}>Urgency Reason (optional)</label>
          <input style={styles.input} placeholder="e.g. Low stock — 7 days remaining" value={urgency} onChange={e => setUrgency(e.target.value)} />

          <button style={styles.btn} onClick={handlePlaceOrder}>🚀 Place Order</button>
          {txStatus && <div style={styles.status}>{txStatus}</div>}
        </div>
      )}

      {/* ── Tab: My Orders ── */}
      {tab === "orders" && (
        <div style={styles.card}>
          <h2 style={{marginTop:0, display:"flex", justifyContent:"space-between"}}>
            📋 My Orders
            <button style={{...styles.btn, width:"auto", fontSize:"12px", padding:"6px 14px"}} onClick={loadMyOrders}>🔄 Refresh</button>
          </h2>
          {myOrders.length === 0
            ? <p style={{color:"#b2bec3", textAlign:"center"}}>No orders found for this account.</p>
            : myOrders.map((o, i) => (
              <div key={i} style={styles.orderRow}>
                <div>
                  <strong>{o[3]}</strong> — {o[5].toString()} units
                  <div style={{fontSize:"12px", color:"#636e72"}}>Order #{o[0].toString()} • {new Date(Number(o[12])*1000).toLocaleDateString()}</div>
                  {o[11] && <div style={{fontSize:"12px", color:"#e17055"}}>⚠️ {o[11]}</div>}
                </div>
                <span style={styles.orderStatus(Number(o[8]))}>{STATUS_LABELS[Number(o[8])]}</span>
              </div>
            ))
          }
        </div>
      )}

      {/* ── Tab: QR Verify ── */}
      {tab === "verify" && (
        <div style={styles.card}>
          <h2 style={{marginTop:0}}>🔍 Verify Medicine (Patient QR)</h2>
          <p style={{fontSize:"13px", color:"#636e72"}}>Patients scan the QR code on the medicine box. This page simulates the verification.</p>
          <div style={{background:"#f8f9fa", borderRadius:"8px", padding:"16px", textAlign:"center"}}>
            <div style={{fontSize:"48px"}}>📱</div>
            <p>In a real deployment, patients would scan the medicine QR code with their phone camera and see the verification result here.</p>
            <p style={{fontSize:"13px", color:"#636e72"}}>
              For demo: call <code>traceability.verifyByQR(qrHash)</code> from the Hardhat console<br/>
              or see demo-scenario1.js Step 8 output.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
