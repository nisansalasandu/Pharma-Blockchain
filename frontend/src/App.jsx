/**
 * Sri Lankan Pharmaceutical Supply Chain Blockchain
 * Complete Frontend — All 8 Stakeholder Dashboards
 *
 * Uses: React 18 + ethers.js v6
 * Network: Ganache (Chain ID 1337, port 7545)
 *
 * To use:
 *   1. Copy this file to frontend/src/App.jsx (replace existing)
 *   2. npm install (in frontend/ folder)
 *   3. npm run dev
 *   4. Open http://localhost:5173
 *   5. Connect MetaMask, switch to Ganache network
 */

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT ADDRESSES (from your deployment-phase3.json)
// ─────────────────────────────────────────────────────────────────────────────
const ADDRESSES = {
  RoleAccessControl:    "0xc3AD08f71A8EB73f8E68b0F56581092b5befEc7F",
  TraceabilityContract: "0x50cA72eAF4FAE6eDA47c31A91D3936CD7189eC94",
  OrderingContract:     "0xe5a0e6927832754ca7Bb12bF83eb01231e416328",
  PredictiveAIOracle:   "0x8217002367288274318482b92A398b4B55c8fF72",
  ConsensusAdapter:     "0xe8798aE89a5CaBC1107205e0e3BF0E21DC5b5a3f",
};

// Known accounts from deployment
const KNOWN_ACCOUNTS = {
  NMRA:         "0x5289D9eD381d2C71Aa3C3ed124683A4ea3835b45",
  SPC:          "0x3eA889EfFb3235aEF9a99681466F4dB8298dF13F",
  MSD:          "0xFaf911e1597228bD6e1448DE4B8AB294CeA11D89",
  Manufacturer1:"0x819d63d9794f1cfFb7cB772aeE07bc375c4F7BED",
  Manufacturer2:"0x5720cEe08EFcDf02183c88D5ca42f6a5D3E5A226",
  Importer:     "0xD81274395E4980A557e9a54c1E56d58cD5f41Bc7",
  Wholesaler:   "0x2adac08d2f037062FF5Ecc5f2eE751dcF1bEc6D3",
  Pharmacy:     "0x18d838D7C2D5b79230deAA63AC3d5d9527C9770d",
  Hospital:     "0x0761Aac5768C8df6548B3f9F3C46e3166c16163C",
  Transporter:  "0x1e4fF0820e498392EBB78f817e96D2c8b6D6F2af",
};

// ─────────────────────────────────────────────────────────────────────────────
// MINIMAL ABIs
// ─────────────────────────────────────────────────────────────────────────────
const RAC_ABI = [
  "function getMember(address) view returns (bytes32, string, bool, address, uint256, uint256)",
  "function roleName(bytes32) view returns (string)",
  "function totalMembers() view returns (uint256)",
  "function grantRole(address, bytes32, string, uint256)",
  "function revokeRole(address)",
  "function issueLicense(address, string, uint256) returns (uint256)",
  "function revokeLicense(uint256)",
  "function getLicense(uint256) view returns (address, bytes32, string, uint256, uint256, bool)",
  "function addressToLicense(address) view returns (uint256)",
  "function hasValidLicense(address) view returns (bool)",
  "function ROLE_NMRA() view returns (bytes32)",
  "function ROLE_SPC() view returns (bytes32)",
  "function ROLE_MSD() view returns (bytes32)",
  "function ROLE_MANUFACTURER() view returns (bytes32)",
  "function ROLE_IMPORTER() view returns (bytes32)",
  "function ROLE_WHOLESALER() view returns (bytes32)",
  "function ROLE_PHARMACY() view returns (bytes32)",
  "function ROLE_HOSPITAL() view returns (bytes32)",
  "function ROLE_TRANSPORTER() view returns (bytes32)",
  "function ROLE_PATIENT() view returns (bytes32)",
];

const TC_ABI = [
  "function mintBatch((string,string,string,uint256,uint256,bool,int256,int256,string,string)) returns (uint256)",
  "function transferCustody(uint256,address,string,int256,string)",
  "function recallBatch(uint256,string)",
  "function verifyByQR(bytes32) view returns (tuple(uint256,bool,string,string,uint8,uint256))",
  "function getBatch(uint256) view returns (tuple(uint256,string,string,string,uint256,uint256,uint256,address,address,uint8,bool,int256,int256,bytes32,string,bool))",
  "function getCustodyHistory(uint256) view returns (tuple(address,address,uint256,string,int256,string)[])",
  "function getHolderBatches(address) view returns (uint256[])",
  "function totalBatches() view returns (uint256)",
  "function totalRecalls() view returns (uint256)",
];

const OC_ABI = [
  "function placeOrder(address,string,string,uint256,uint256,string) returns (uint256)",
  "function setRiskScore(uint256,uint256)",
  "function approveOrder(uint256)",
  "function approveEmergencyOrder(uint256)",
  "function rejectOrder(uint256,string)",
  "function fulfillOrder(uint256)",
  "function cancelOrder(uint256)",
  "function getOrder(uint256) view returns (tuple(uint256,address,address,string,string,uint256,uint256,uint256,uint8,uint8,uint256,string,uint256,uint256,address,string,bool))",
  "function getOrdersByPlacer(address) view returns (uint256[])",
  "function getOrdersForSupplier(address) view returns (uint256[])",
  "function totalOrders() view returns (uint256)",
  "function totalFulfilled() view returns (uint256)",
  "function totalEmergencyOrders() view returns (uint256)",
  "function EMERGENCY_THRESHOLD() view returns (uint256)",
];

const ORACLE_ABI = [
  "function getPrediction(string) view returns (tuple(string,uint256,uint256,uint256,uint256,uint256,uint256,bool))",
  "function getTrackedMedicines() view returns (string[])",
  "function totalPredictions() view returns (uint256)",
  "function getRiskScore(string) view returns (uint256)",
  "function submitPrediction(string,uint256,uint256,uint256,uint256,uint256)",
];

const CA_ABI = [
  "function getCurrentMode() view returns (uint8)",
  "function activeEventId() view returns (uint256)",
  "function totalSwitches() view returns (uint256)",
  "function switchToPBFT(uint256,uint256,uint8)",
  "function castVote(uint256,bool,bytes32)",
  "function restorePoA(uint256)",
  "function getEvent(uint256) view returns (tuple(uint256,uint8,uint8,uint8,uint256,uint256,uint256,address,bool))",
  "function getVote(uint256,address) view returns (tuple(address,bool,uint256,bytes32))",
  "function getVoteCount(uint256) view returns (uint256)",
  "function isInPBFT() view returns (bool)",
];

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const ORDER_STATUSES = ["PENDING","AI_REVIEW","APPROVED","EMERGENCY","FULFILLED","REJECTED","CANCELLED"];
const BATCH_STATUSES = ["MANUFACTURED","IN_TRANSIT","AT_WAREHOUSE","AT_PHARMACY","AT_HOSPITAL","DISPENSED","RECALLED","EXPIRED"];
const STATUS_COLORS = {
  PENDING:"#f59e0b", AI_REVIEW:"#8b5cf6", APPROVED:"#10b981", EMERGENCY:"#ef4444",
  FULFILLED:"#3b82f6", REJECTED:"#6b7280", CANCELLED:"#9ca3af",
  MANUFACTURED:"#10b981", IN_TRANSIT:"#f59e0b", AT_WAREHOUSE:"#3b82f6",
  AT_PHARMACY:"#8b5cf6", AT_HOSPITAL:"#ec4899", DISPENSED:"#6366f1", RECALLED:"#ef4444", EXPIRED:"#6b7280",
};
const ROLE_COLORS = {
  NMRA:"#dc2626", SPC:"#2563eb", MSD:"#7c3aed", MANUFACTURER:"#059669",
  IMPORTER:"#0891b2", WHOLESALER:"#d97706", PHARMACY:"#ea580c",
  HOSPITAL:"#db2777", TRANSPORTER:"#65a30d", PATIENT:"#0891b2", UNKNOWN:"#6b7280",
};

const fmtAddr = (a) => a ? `${a.slice(0,6)}…${a.slice(-4)}` : "—";
const fmtDate = (ts) => ts ? new Date(Number(ts)*1000).toLocaleString() : "—";
const riskColor = (s) => Number(s)>800?"#ef4444":Number(s)>400?"#f59e0b":"#10b981";
const riskLabel = (s) => Number(s)>800?"HIGH":Number(s)>400?"MEDIUM":"LOW";

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL CSS (injected once)
// ─────────────────────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#0f1117;--bg2:#161b27;--bg3:#1e2539;--bg4:#252d42;
    --border:#2d3555;--border2:#3d4a6a;
    --text:#e8ecf5;--text2:#9aa3bc;--text3:#6b7899;
    --accent:#4f8ef7;--accent2:#3b7de8;--accent-glow:rgba(79,142,247,0.25);
    --green:#10d9a0;--red:#f05252;--yellow:#f59e0b;--purple:#9b72ef;
    --radius:12px;--radius-sm:8px;--radius-xs:6px;
    --shadow:0 4px 24px rgba(0,0,0,0.4);
    --font-display:'Syne',sans-serif;--font-body:'DM Sans',sans-serif;
  }
  body{background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:14px;line-height:1.6;min-height:100vh}
  input,select,textarea{
    background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-sm);
    color:var(--text);font-family:var(--font-body);font-size:14px;padding:10px 14px;
    width:100%;transition:border-color 0.2s,box-shadow 0.2s;outline:none;
  }
  input:focus,select:focus,textarea:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow)}
  button{cursor:pointer;font-family:var(--font-body);font-weight:600;transition:all 0.2s;border:none;outline:none}

  .app-shell{display:flex;min-height:100vh}
  .sidebar{
    width:240px;flex-shrink:0;background:var(--bg2);border-right:1px solid var(--border);
    display:flex;flex-direction:column;padding:0;position:sticky;top:0;height:100vh;overflow-y:auto
  }
  .sidebar-logo{padding:24px 20px 16px;border-bottom:1px solid var(--border)}
  .logo-mark{font-family:var(--font-display);font-size:20px;font-weight:800;color:var(--accent);letter-spacing:-0.5px}
  .logo-sub{font-size:11px;color:var(--text3);margin-top:2px}
  .sidebar-user{padding:16px 20px;border-bottom:1px solid var(--border)}
  .user-role{font-family:var(--font-display);font-size:13px;font-weight:700;letter-spacing:0.5px;margin-bottom:4px}
  .user-name{font-size:12px;color:var(--text2)}
  .user-addr{font-size:11px;color:var(--text3);font-family:monospace;margin-top:2px}
  .sidebar-nav{flex:1;padding:12px 12px}
  .nav-section{font-size:10px;font-weight:700;color:var(--text3);letter-spacing:1.5px;text-transform:uppercase;padding:8px 8px 4px}
  .nav-item{
    display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:var(--radius-xs);
    color:var(--text2);font-size:13px;font-weight:500;cursor:pointer;transition:all 0.15s;margin-bottom:2px
  }
  .nav-item:hover{background:var(--bg3);color:var(--text)}
  .nav-item.active{background:var(--accent-glow);color:var(--accent);border:1px solid rgba(79,142,247,0.3)}
  .nav-item .icon{font-size:16px;width:20px;text-align:center}
  .sidebar-footer{padding:12px 16px;border-top:1px solid var(--border)}
  .logout-btn{
    width:100%;display:flex;align-items:center;gap:8px;padding:9px 12px;
    border-radius:var(--radius-xs);background:transparent;color:var(--red);
    font-size:13px;font-weight:600;transition:all 0.15s;border:1px solid transparent
  }
  .logout-btn:hover{background:rgba(240,82,82,0.1);border-color:rgba(240,82,82,0.3)}

  .main-content{flex:1;overflow:auto;padding:0}
  .page-header{
    padding:24px 32px 20px;border-bottom:1px solid var(--border);
    display:flex;align-items:center;justify-content:space-between;
    background:var(--bg2);position:sticky;top:0;z-index:10
  }
  .page-title{font-family:var(--font-display);font-size:22px;font-weight:800;color:var(--text)}
  .page-sub{font-size:12px;color:var(--text3);margin-top:2px}
  .page-body{padding:28px 32px}

  .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:24px}
  .stat-card{
    background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);
    padding:20px;transition:border-color 0.2s
  }
  .stat-card:hover{border-color:var(--border2)}
  .stat-icon{font-size:24px;margin-bottom:8px}
  .stat-num{font-family:var(--font-display);font-size:32px;font-weight:800;color:var(--accent);line-height:1}
  .stat-label{font-size:12px;color:var(--text3);margin-top:6px;text-transform:uppercase;letter-spacing:0.5px}

  .card{
    background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);
    padding:24px;margin-bottom:20px
  }
  .card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
  .card-title{font-family:var(--font-display);font-size:16px;font-weight:700}

  .btn{
    display:inline-flex;align-items:center;gap:6px;padding:9px 18px;
    border-radius:var(--radius-sm);font-size:13px;font-weight:600;transition:all 0.2s;cursor:pointer;border:none
  }
  .btn-primary{background:var(--accent);color:#fff}
  .btn-primary:hover{background:var(--accent2);transform:translateY(-1px);box-shadow:0 4px 12px var(--accent-glow)}
  .btn-primary:disabled{background:var(--bg4);color:var(--text3);cursor:not-allowed;transform:none;box-shadow:none}
  .btn-danger{background:#ef4444;color:#fff}
  .btn-danger:hover{background:#dc2626;transform:translateY(-1px)}
  .btn-success{background:#10b981;color:#fff}
  .btn-success:hover{background:#059669;transform:translateY(-1px)}
  .btn-ghost{background:transparent;color:var(--text2);border:1px solid var(--border)}
  .btn-ghost:hover{background:var(--bg3);color:var(--text);border-color:var(--border2)}
  .btn-sm{padding:6px 12px;font-size:12px}
  .btn-xs{padding:4px 10px;font-size:11px}

  .form-group{margin-bottom:16px}
  .form-label{display:block;font-size:12px;font-weight:600;color:var(--text2);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px}
  .form-grid{display:grid;gap:16px}
  .form-grid-2{grid-template-columns:1fr 1fr}
  .form-grid-3{grid-template-columns:1fr 1fr 1fr}
  .form-hint{font-size:11px;color:var(--text3);margin-top:4px}
  .checkbox-label{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;color:var(--text2)}
  input[type="checkbox"]{width:auto;accent-color:var(--accent)}

  .table-wrap{overflow-x:auto;border-radius:var(--radius-sm);border:1px solid var(--border)}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{background:var(--bg3);padding:10px 14px;text-align:left;font-size:11px;font-weight:700;
     color:var(--text3);text-transform:uppercase;letter-spacing:0.8px;white-space:nowrap}
  td{padding:10px 14px;border-top:1px solid var(--border);vertical-align:middle}
  tr:hover td{background:var(--bg3)}

  .badge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.4px}
  .risk-bar{height:6px;background:var(--bg4);border-radius:3px;overflow:hidden;width:80px}
  .risk-fill{height:100%;border-radius:3px;transition:width 0.3s}

  .alert{padding:12px 16px;border-radius:var(--radius-sm);font-size:13px;display:flex;align-items:flex-start;gap:8px}
  .alert-info{background:rgba(79,142,247,0.1);border:1px solid rgba(79,142,247,0.25);color:#93c5fd}
  .alert-success{background:rgba(16,217,160,0.1);border:1px solid rgba(16,217,160,0.25);color:#6ee7b7}
  .alert-warning{background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);color:#fcd34d}
  .alert-danger{background:rgba(240,82,82,0.1);border:1px solid rgba(240,82,82,0.25);color:#fca5a5}

  .tx-status{margin-top:12px;padding:12px 14px;border-radius:var(--radius-sm);font-size:13px;animation:fadeIn 0.3s}
  .tx-pending{background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);color:#fcd34d}
  .tx-success{background:rgba(16,217,160,0.1);border:1px solid rgba(16,217,160,0.25);color:#6ee7b7}
  .tx-error{background:rgba(240,82,82,0.1);border:1px solid rgba(240,82,82,0.25);color:#fca5a5}

  .separator{height:1px;background:var(--border);margin:20px 0}

  .empty-state{text-align:center;padding:48px 24px;color:var(--text3)}
  .empty-icon{font-size:48px;margin-bottom:12px}
  .empty-text{font-size:14px}

  /* Login page */
  .login-shell{
    min-height:100vh;background:var(--bg);display:flex;align-items:center;justify-content:center;
    background-image:radial-gradient(ellipse at 20% 50%,rgba(79,142,247,0.08) 0%,transparent 60%),
                     radial-gradient(ellipse at 80% 20%,rgba(155,114,239,0.06) 0%,transparent 50%);
  }
  .login-box{
    background:var(--bg2);border:1px solid var(--border);border-radius:20px;
    padding:40px;width:440px;box-shadow:var(--shadow)
  }
  .login-logo{font-family:var(--font-display);font-size:28px;font-weight:800;color:var(--accent);margin-bottom:4px}
  .login-title{font-family:var(--font-display);font-size:18px;font-weight:700;margin:16px 0 8px}
  .login-desc{font-size:13px;color:var(--text2);margin-bottom:28px;line-height:1.6}
  .login-step{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)}
  .step-num{
    width:26px;height:26px;border-radius:50%;background:var(--accent-glow);color:var(--accent);
    display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;
    border:1px solid rgba(79,142,247,0.3)
  }
  .connect-btn{
    width:100%;padding:14px;border-radius:var(--radius-sm);font-size:15px;font-weight:700;
    background:var(--accent);color:#fff;margin-top:20px;
    display:flex;align-items:center;justify-content:center;gap:8px;
    transition:all 0.2s
  }
  .connect-btn:hover{background:var(--accent2);transform:translateY(-1px);box-shadow:0 4px 20px var(--accent-glow)}
  .connect-btn:disabled{background:var(--bg4);color:var(--text3);cursor:not-allowed;transform:none}
  .account-pill{
    margin-top:14px;padding:10px 14px;border-radius:var(--radius-sm);background:var(--bg3);
    border:1px solid var(--border);display:flex;align-items:center;gap:8px;font-size:13px
  }
  .dot-green{width:8px;height:8px;border-radius:50%;background:var(--green);flex-shrink:0}

  .roles-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
  .role-pill{padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:var(--bg3);color:var(--text2);border:1px solid var(--border)}

  /* Consensus mode indicator */
  .consensus-mode{
    display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;
  }
  .mode-poa{background:rgba(16,217,160,0.1);color:var(--green);border:1px solid rgba(16,217,160,0.3)}
  .mode-pbft{background:rgba(240,82,82,0.1);color:var(--red);border:1px solid rgba(240,82,82,0.3)}

  .pulse{animation:pulse 2s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
  @keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}

  /* QR display */
  .qr-result-authentic{
    background:rgba(16,217,160,0.08);border:1px solid rgba(16,217,160,0.3);border-radius:var(--radius);padding:20px;
  }
  .qr-result-fake{
    background:rgba(240,82,82,0.08);border:1px solid rgba(240,82,82,0.3);border-radius:var(--radius);padding:20px;
  }
  .qr-icon{font-size:64px;text-align:center;margin-bottom:12px}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .info-item{background:var(--bg3);border-radius:var(--radius-xs);padding:10px 12px}
  .info-key{font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px}
  .info-val{font-size:13px;font-weight:600;margin-top:2px}

  @media(max-width:768px){
    .sidebar{display:none}
    .page-body{padding:16px}
    .form-grid-2{grid-template-columns:1fr}
    .stats-grid{grid-template-columns:1fr 1fr}
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function injectCSS() {
  if (document.getElementById("pharma-css")) return;
  const el = document.createElement("style");
  el.id = "pharma-css";
  el.textContent = GLOBAL_CSS;
  document.head.appendChild(el);
}

function TxStatus({ msg }) {
  if (!msg) return null;
  const cls = msg.startsWith("✅") ? "tx-success" : msg.startsWith("⏳") ? "tx-pending" : "tx-error";
  return <div className={`tx-status ${cls}`}>{msg}</div>;
}

function Badge({ children, color }) {
  return (
    <span className="badge" style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}>
      {children}
    </span>
  );
}

function StatusBadge({ status, type = "order" }) {
  const label = type === "order" ? ORDER_STATUSES[status] : BATCH_STATUSES[status];
  const color = STATUS_COLORS[label] || "#6b7280";
  return <Badge color={color}>{label || status}</Badge>;
}

function RiskBar({ score }) {
  const s = Number(score);
  const color = riskColor(s);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div className="risk-bar">
        <div className="risk-fill" style={{ width: `${s/10}%`, background: color }} />
      </div>
      <span style={{ color, fontWeight: 700, fontSize: 12 }}>{s}</span>
    </div>
  );
}

function EmptyState({ icon = "📭", text = "Nothing here yet" }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <div className="empty-text">{text}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NAV CONFIG PER ROLE
// ─────────────────────────────────────────────────────────────────────────────
const NAV_CONFIG = {
  NMRA:         [{ id:"overview",icon:"📊",label:"Overview"},{ id:"grantRole",icon:"👤",label:"Grant Role"},{ id:"revoke",icon:"🚫",label:"Revoke Member"},{ id:"license",icon:"📜",label:"Licenses"},{ id:"recall",icon:"⚠️",label:"Recall Batch"},{ id:"consensus",icon:"🔐",label:"Consensus Mode"},{ id:"orders",icon:"📋",label:"All Orders"},{ id:"emergency",icon:"🚨",label:"Emergency Orders"},{ id:"ai",icon:"🧠",label:"AI Monitor"}],  // FIX #37: ADDED ai tab
  SPC:          [{ id:"overview",icon:"📊",label:"Overview"},{ id:"orders",icon:"📋",label:"Pending Orders"},{ id:"fulfill",icon:"🚚",label:"Fulfill Orders"},{ id:"rejected",icon:"❌",label:"Reject Orders"},{ id:"pbft",icon:"🗳️",label:"PBFT Vote"}],  // FIX #16: ADDED pbft tab
  MSD:          [{ id:"overview",icon:"📊",label:"Overview"},{ id:"emergency",icon:"🚨",label:"Emergency Orders"},{ id:"hospital",icon:"🏥",label:"Hospital Orders"},{ id:"fulfill",icon:"🚚",label:"Fulfill Orders"}],
  MANUFACTURER: [{ id:"overview",icon:"📊",label:"Overview"},{ id:"mint",icon:"➕",label:"Mint Batch"},{ id:"batches",icon:"📦",label:"My Batches"},{ id:"transfer",icon:"📤",label:"Transfer Custody"}],
  IMPORTER:     [{ id:"overview",icon:"📊",label:"Overview"},{ id:"mint",icon:"➕",label:"Mint Batch"},{ id:"batches",icon:"📦",label:"My Batches"},{ id:"transfer",icon:"📤",label:"Transfer Custody"}],
  WHOLESALER:   [{ id:"overview",icon:"📊",label:"Overview"},{ id:"batches",icon:"📦",label:"My Stock"},{ id:"transfer",icon:"📤",label:"Transfer Stock"}],
  PHARMACY:     [{ id:"overview",icon:"📊",label:"Overview"},{ id:"placeOrder",icon:"➕",label:"Place Order"},{ id:"orders",icon:"📋",label:"My Orders"},{ id:"batches",icon:"📦",label:"Received Stock"},{ id:"verify",icon:"🔍",label:"Verify Medicine"}],
  HOSPITAL:     [{ id:"overview",icon:"📊",label:"Overview"},{ id:"placeOrder",icon:"➕",label:"Place Order"},{ id:"orders",icon:"📋",label:"My Orders"},{ id:"batches",icon:"📦",label:"Received Stock"},{ id:"verify",icon:"🔍",label:"Verify Medicine"}],
  TRANSPORTER:  [{ id:"overview",icon:"📊",label:"Overview"},{ id:"batches",icon:"📦",label:"In My Custody"},{ id:"transfer",icon:"📤",label:"Transfer Custody"}],
  PATIENT:      [{ id:"verify",icon:"🔍",label:"Verify Medicine"},{ id:"track",icon:"🗺️",label:"Track Batch"}],
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED: use contracts hook
// ─────────────────────────────────────────────────────────────────────────────
function useContracts(signer) {
  if (!signer) return {};
  return {
    rac:    new ethers.Contract(ADDRESSES.RoleAccessControl,    RAC_ABI,    signer),
    tc:     new ethers.Contract(ADDRESSES.TraceabilityContract, TC_ABI,     signer),
    oc:     new ethers.Contract(ADDRESSES.OrderingContract,     OC_ABI,     signer),
    oracle: new ethers.Contract(ADDRESSES.PredictiveAIOracle,   ORACLE_ABI, signer),
    ca:     new ethers.Contract(ADDRESSES.ConsensusAdapter,     CA_ABI,     signer),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function connectWallet() {
    if (!window.ethereum) { setErr("MetaMask not found. Please install MetaMask."); return; }
    setErr(""); setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      setAccount(addr);

      // Detect chain
      const net = await provider.getNetwork();
      if (net.chainId !== 1337n) {
        setErr("Please switch MetaMask to Ganache network (Chain ID: 1337)");
        setLoading(false); return;
      }

      // Fetch role
      const rac = new ethers.Contract(ADDRESSES.RoleAccessControl, RAC_ABI, signer);
      const [roleBytes, orgName, isActive] = await rac.getMember(addr);
      const roleName = await rac.roleName(roleBytes);

      if (!isActive || roleName === "UNKNOWN") {
        setErr("Account not registered. Contact NMRA for access.");
        setLoading(false); return;
      }

      onLogin({ account: addr, role: roleName, orgName, provider, signer });
    } catch (e) {
      setErr(e.message || "Connection failed");
    } finally { setLoading(false); }
  }

  // ── FIX #3: Patient light-client — read-only provider, no MetaMask ──────
  async function handlePatientAccess() {
    setLoading(true); setErr("");
    try {
      const provider = new ethers.JsonRpcProvider("http://127.0.0.1:7545");
      // Random throwaway wallet — used only for view calls, never signs real txs
      const signer = ethers.Wallet.createRandom().connect(provider);
      onLogin({
        account: "patient-guest",
        role: "PATIENT",
        orgName: "Medicine Verification Portal",
        provider,
        signer,
      });
    } catch (e) {
      setErr("Cannot connect to Ganache. Make sure it is running on port 7545.");
    }
    setLoading(false);
  }

  return (
    <div className="login-shell">
      <div className="login-box">
        <div className="login-logo">⚕ PharmaChain</div>
        <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 2 }}>Sri Lanka Pharmaceutical Blockchain</div>
        <div className="login-title">Secure Access Portal</div>
        <div className="login-desc">
          Connect your MetaMask wallet to access your role-based dashboard.
          Your credentials are verified directly from the blockchain.
        </div>

        {[
          ["Connect your MetaMask wallet", "🦊"],
          ["Role is verified on-chain via smart contract", "🔗"],
          ["Access your personalized dashboard", "📊"],
        ].map(([text, icon], i) => (
          <div className="login-step" key={i}>
            <div className="step-num">{i + 1}</div>
            <span style={{ fontSize: 13, color: "var(--text2)" }}>{icon} {text}</span>
          </div>
        ))}

        {account && (
          <div className="account-pill">
            <div className="dot-green" />
            <div>
              <div style={{ fontWeight: 600, fontSize: 12 }}>Wallet Connected</div>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text3)" }}>{account}</div>
            </div>
          </div>
        )}

        <button className="connect-btn" onClick={connectWallet} disabled={loading}>
          {loading ? "⏳ Verifying…" : account ? "🚀 Enter Dashboard" : "🦊 Connect MetaMask"}
        </button>

        {/* ── FIX #3: Patient light-client login — no MetaMask wallet needed ── */}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: "var(--text3)", textAlign: "center", marginBottom: 8 }}>
            Just want to verify a medicine?
          </div>
          <button
            className="btn btn-ghost"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={handlePatientAccess}
            disabled={loading}
          >
            🔍 Verify Medicine as Patient (no wallet needed)
          </button>
        </div>

        {err && <div className="alert alert-danger" style={{ marginTop: 14 }}>⚠️ {err}</div>}

        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 8 }}>REGISTERED ROLES</div>
          <div className="roles-list">
            {["NMRA","SPC","MSD","MANUFACTURER","PHARMACY","HOSPITAL","TRANSPORTER","PATIENT"].map(r => (
              <span key={r} className="role-pill" style={{ color: ROLE_COLORS[r] }}>{r}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────
function Sidebar({ role, orgName, account, activeTab, onTabChange, onLogout }) {
  const navItems = NAV_CONFIG[role] || [];
  const color = ROLE_COLORS[role] || "#6b7280";

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">⚕ PharmaChain</div>
        <div className="logo-sub">Sri Lanka · Blockchain Network</div>
      </div>
      <div className="sidebar-user">
        <div className="user-role" style={{ color }}>{role}</div>
        <div className="user-name">{orgName || "Unknown"}</div>
        {/* FIX #3: patient-guest has no real wallet address */}
        <div className="user-addr">{account === "patient-guest" ? "Guest Access" : fmtAddr(account)}</div>
      </div>
      <div className="sidebar-nav">
        <div className="nav-section">Navigation</div>
        {navItems.map(item => (
          <div
            key={item.id}
            className={`nav-item${activeTab === item.id ? " active" : ""}`}
            onClick={() => onTabChange(item.id)}
          >
            <span className="icon">{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      <div className="sidebar-footer">
        <button className="logout-btn" onClick={onLogout}>
          <span>🚪</span> Logout
        </button>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NMRA DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function NMRADashboard({ signer, account }) {
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState({ members: 0, batches: 0, orders: 0, recalls: 0, emergency: 0 });
  const [orders, setOrders] = useState([]);
  const [consensusMode, setConsensusMode] = useState(0);
  const [activeEvent, setActiveEvent] = useState(0);
  const [totalSwitches, setTotalSwitches] = useState(0);
  const [txMsg, setTxMsg] = useState("");
  const [loading, setLoading] = useState(false);
  // ── FIX #37: added oracle contract for AI predictions panel ──────────
  const { rac, tc, oc, ca, oracle } = useContracts(signer);  // CHANGED: added oracle

  // ── FIX #37: AI predictions state ─────────────────────────────────────
  const [predictions, setPredictions] = useState([]);

  const [grantForm, setGrantForm] = useState({ address: "", roleKey: "ROLE_MANUFACTURER", orgName: "", expiry: "0" });
  const [revokeAddr, setRevokeAddr] = useState("");
  const [licForm, setLicForm] = useState({ address: "", number: "", days: "365" });
  const [recallForm, setRecallForm] = useState({ tokenId: "", reason: "" });
  const [riskForm, setRiskForm] = useState({ orderId: "", score: "" });
  const [pbftForm, setPbftForm] = useState({ orderId: "", riskScore: "", reason: "0" });
  const [voteForm, setVoteForm] = useState({ eventId: "", approve: true });

  const ROLE_KEYS = ["ROLE_SPC","ROLE_MSD","ROLE_MANUFACTURER","ROLE_IMPORTER","ROLE_WHOLESALER","ROLE_PHARMACY","ROLE_HOSPITAL","ROLE_TRANSPORTER","ROLE_PATIENT"];

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [m, b, o, r, e, mode, eid, sw] = await Promise.all([
        rac.totalMembers(), tc.totalBatches(), oc.totalOrders(), tc.totalRecalls(),
        oc.totalEmergencyOrders(), ca.getCurrentMode(), ca.getActiveEventId(), ca.totalSwitches()
      ]);
      setStats({ members: Number(m), batches: Number(b), orders: Number(o), recalls: Number(r), emergency: Number(e) });
      setConsensusMode(Number(mode));
      setActiveEvent(Number(eid));
      setTotalSwitches(Number(sw));
    } catch (e) { console.error(e); }
  }

  async function loadOrders() {
    try {
      const total = Number(await oc.totalOrders());
      const list = [];
      for (let i = 1; i <= total; i++) {
        const o = await oc.getOrder(i);
        list.push(o);
      }
      setOrders(list);
    } catch (e) { console.error(e); }
  }

  useEffect(() => { if (tab === "orders" || tab === "emergency") loadOrders(); }, [tab]);
  useEffect(() => { if (tab === "ai") loadPredictions(); }, [tab]);  // FIX #37: ADDED

  // ── FIX #37: Load AI predictions from PredictiveAIOracle ───────────────
  async function loadPredictions() {
    const TRACKED = [
      "paracetamol","amoxicillin","metformin","insulin",
      "amlodipine","atorvastatin","salbutamol","omeprazole"
    ];
    try {
      const results = await Promise.all(
        TRACKED.map(async (name) => {
          try {
            const p = await oracle.getPrediction(name);
            return {
              name,
              stock:       Number(p[1]),
              demand:      Number(p[2]),
              coldChain:   Number(p[3]),
              counterfeit: Number(p[4]),
              overall:     Number(p[5]),
              timestamp:   Number(p[6]),
              isValid:     p[7],
            };
          } catch { return { name, isValid: false, overall: 0 }; }
        })
      );
      setPredictions(results.filter(p => p.isValid));
    } catch (e) { console.error("Prediction load failed:", e); }
  }

  async function handleGrantRole() {
    setLoading(true); setTxMsg("⏳ Granting role…");
    try {
      const roleBytes = await rac[grantForm.roleKey]();
      const tx = await rac.grantRole(grantForm.address, roleBytes, grantForm.orgName, Number(grantForm.expiry));
      await tx.wait();
      setTxMsg("✅ Role granted successfully!");
      setGrantForm({ address: "", roleKey: "ROLE_MANUFACTURER", orgName: "", expiry: "0" });
      loadAll();
    } catch (e) { setTxMsg("❌ " + (e.reason || e.message)); }
    setLoading(false);
  }

  async function handleRevoke() {
    setLoading(true); setTxMsg("⏳ Revoking…");
    try {
      const tx = await rac.revokeRole(revokeAddr);
      await tx.wait();
      setTxMsg("✅ Member revoked!");
      setRevokeAddr("");
    } catch (e) { setTxMsg("❌ " + (e.reason || e.message)); }
    setLoading(false);
  }

  async function handleIssueLicense() {
    setLoading(true); setTxMsg("⏳ Issuing license…");
    try {
      const tx = await rac.issueLicense(licForm.address, licForm.number, Number(licForm.days));
      await tx.wait();
      setTxMsg("✅ License issued!");
      setLicForm({ address: "", number: "", days: "365" });
    } catch (e) { setTxMsg("❌ " + (e.reason || e.message)); }
    setLoading(false);
  }

  async function handleRecall() {
    setLoading(true); setTxMsg("⏳ Recalling batch…");
    try {
      const tx = await tc.recallBatch(Number(recallForm.tokenId), recallForm.reason);
      await tx.wait();
      setTxMsg("✅ Batch recalled!");
      setRecallForm({ tokenId: "", reason: "" });
      loadAll();
    } catch (e) { setTxMsg("❌ " + (e.reason || e.message)); }
    setLoading(false);
  }

  async function handleSetRisk() {
    setLoading(true); setTxMsg("⏳ Setting risk score…");
    try {
      const tx = await oc.setRiskScore(Number(riskForm.orderId), Number(riskForm.score));
      await tx.wait();
      setTxMsg("✅ Risk score set!");
      setRiskForm({ orderId: "", score: "" });
      loadOrders();
    } catch (e) { setTxMsg("❌ " + (e.reason || e.message)); }
    setLoading(false);
  }

  async function handleApproveEmergency(orderId) {
    setLoading(true); setTxMsg("⏳ Approving emergency order…");
    try {
      const tx = await oc.approveEmergencyOrder(Number(orderId));
      await tx.wait();
      setTxMsg("✅ Emergency order approved!");
      loadOrders();
    } catch (e) { setTxMsg("❌ " + (e.reason || e.message)); }
    setLoading(false);
  }

  async function handleSwitchToPBFT() {
    setLoading(true); setTxMsg("⏳ Switching to PBFT…");
    try {
      const tx = await ca.switchToPBFT(Number(pbftForm.orderId), Number(pbftForm.riskScore), Number(pbftForm.reason));
      await tx.wait();
      setTxMsg("✅ Switched to PBFT mode!");
      loadAll();
    } catch (e) { setTxMsg("❌ " + (e.reason || e.message)); }
    setLoading(false);
  }

  async function handleRestorePoA() {
    setLoading(true); setTxMsg("⏳ Restoring PoA…");
    try {
      const tx = await ca.restorePoA(activeEvent);
      await tx.wait();
      setTxMsg("✅ Restored to PoA mode!");
      loadAll();
    } catch (e) { setTxMsg("❌ " + (e.reason || e.message)); }
    setLoading(false);
  }

  async function handleCastVote() {
    setLoading(true); setTxMsg("⏳ Casting vote…");
    try {
      const dataHash = ethers.id(`vote-${voteForm.eventId}-${account}`);
      const tx = await ca.castVote(Number(voteForm.eventId), voteForm.approve, dataHash);
      await tx.wait();
      setTxMsg(`✅ Vote cast: ${voteForm.approve ? "APPROVE" : "REJECT"}`);
    } catch (e) { setTxMsg("❌ " + (e.reason || e.message)); }
    setLoading(false);
  }

  const navItems = NAV_CONFIG.NMRA;

  return (
    <div className="app-shell">
      <Sidebar role="NMRA" orgName="National Medicines Regulatory Authority" account={account}
        activeTab={tab} onTabChange={(t) => { setTab(t); setTxMsg(""); }}
        onLogout={() => window.location.reload()} />
      <div className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">🏛️ NMRA Regulatory Dashboard</div>
            <div className="page-sub">National Medicines Regulatory Authority · Sri Lanka</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className={`consensus-mode ${consensusMode === 0 ? "mode-poa" : "mode-pbft pulse"}`}>
              {consensusMode === 0 ? "⚙️ PoA Active" : "⚡ PBFT Active"}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={loadAll}>🔄 Refresh</button>
          </div>
        </div>
        <div className="page-body">

          {tab === "overview" && (
            <>
              <div className="stats-grid">
                {[
                  { icon: "👥", num: stats.members, label: "Registered Members" },
                  { icon: "📦", num: stats.batches, label: "Medicine Batches" },
                  { icon: "📋", num: stats.orders, label: "Total Orders" },
                  { icon: "⚠️", num: stats.recalls, label: "Batch Recalls" },
                  { icon: "🚨", num: stats.emergency, label: "Emergency Orders" },
                  { icon: "🔄", num: totalSwitches, label: "Consensus Switches" },
                ].map((s, i) => (
                  <div className="stat-card" key={i}>
                    <div className="stat-icon">{s.icon}</div>
                    <div className="stat-num">{s.num}</div>
                    <div className="stat-label">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="card">
                <div className="card-header"><div className="card-title">📋 Registered Accounts</div></div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Role</th><th>Address</th><th>Label</th></tr></thead>
                    <tbody>
                      {Object.entries(KNOWN_ACCOUNTS).map(([label, addr]) => (
                        <tr key={label}>
                          <td><Badge color={ROLE_COLORS[label.replace(/\d/, "")] || "#6b7280"}>{label}</Badge></td>
                          <td><code style={{ fontSize: 12 }}>{addr}</code></td>
                          <td style={{ color: "var(--text2)", fontSize: 12 }}>{label}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {tab === "grantRole" && (
            <div className="card">
              <div className="card-header"><div className="card-title">👤 Grant Role to New Member</div></div>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Wallet Address *</label>
                  <input placeholder="0x…" value={grantForm.address} onChange={e => setGrantForm({...grantForm,address:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Role *</label>
                  <select value={grantForm.roleKey} onChange={e => setGrantForm({...grantForm,roleKey:e.target.value})}>
                    {ROLE_KEYS.map(k => <option key={k} value={k}>{k.replace("ROLE_","")}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Organization Name *</label>
                  <input placeholder="e.g. Colombo General Pharmacy" value={grantForm.orgName} onChange={e => setGrantForm({...grantForm,orgName:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">License Expiry (Unix ts, 0 = none)</label>
                  <input type="number" value={grantForm.expiry} onChange={e => setGrantForm({...grantForm,expiry:e.target.value})} />
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleGrantRole} disabled={loading}>✅ Grant Role</button>
              <TxStatus msg={txMsg} />
            </div>
          )}

          {tab === "revoke" && (
            <div className="card">
              <div className="card-header"><div className="card-title">🚫 Revoke Member Access</div></div>
              <div className="alert alert-warning" style={{ marginBottom: 16 }}>⚠️ This will deactivate the member and prevent them from performing any on-chain actions.</div>
              <div className="form-group">
                <label className="form-label">Member Wallet Address *</label>
                <input placeholder="0x…" value={revokeAddr} onChange={e => setRevokeAddr(e.target.value)} />
              </div>
              <button className="btn btn-danger" onClick={handleRevoke} disabled={loading}>🚫 Revoke Access</button>
              <TxStatus msg={txMsg} />
            </div>
          )}

          {tab === "license" && (
            <div className="card">
              <div className="card-header"><div className="card-title">📜 Issue License NFT</div></div>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Holder Address *</label>
                  <input placeholder="0x…" value={licForm.address} onChange={e => setLicForm({...licForm,address:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">License Number *</label>
                  <input placeholder="e.g. NMRA/MFG/2025/001" value={licForm.number} onChange={e => setLicForm({...licForm,number:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Valid for (days)</label>
                  <input type="number" value={licForm.days} onChange={e => setLicForm({...licForm,days:e.target.value})} />
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleIssueLicense} disabled={loading}>📜 Issue License</button>
              <TxStatus msg={txMsg} />
            </div>
          )}

          {tab === "recall" && (
            <div className="card">
              <div className="card-header"><div className="card-title">⚠️ Recall Medicine Batch</div></div>
              <div className="alert alert-danger" style={{ marginBottom: 16 }}>🚨 Recalling a batch permanently marks it as unsafe and blocks all further transfers.</div>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Batch Token ID *</label>
                  <input type="number" placeholder="e.g. 1" value={recallForm.tokenId} onChange={e => setRecallForm({...recallForm,tokenId:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Recall Reason *</label>
                  <input placeholder="e.g. Contamination detected in Batch PCM-2025-001" value={recallForm.reason} onChange={e => setRecallForm({...recallForm,reason:e.target.value})} />
                </div>
              </div>
              <button className="btn btn-danger" onClick={handleRecall} disabled={loading}>⚠️ Issue Recall</button>
              <TxStatus msg={txMsg} />
            </div>
          )}

          {tab === "consensus" && (
            <>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">🔐 Consensus Mode Control</div>
                  <span className={`consensus-mode ${consensusMode === 0 ? "mode-poa" : "mode-pbft pulse"}`}>
                    {consensusMode === 0 ? "⚙️ PoA Active" : "⚡ PBFT Active"}
                  </span>
                </div>
                <div className="form-grid form-grid-2" style={{ marginBottom: 16 }}>
                  <div>
                    <div className="form-group">
                      <label className="form-label">Set AI Risk Score for Order</label>
                      <input type="number" placeholder="Order ID" value={riskForm.orderId} onChange={e => setRiskForm({...riskForm,orderId:e.target.value})} style={{ marginBottom: 8 }} />
                      <input type="number" placeholder="Risk Score (0-1000)" value={riskForm.score} onChange={e => setRiskForm({...riskForm,score:e.target.value})} />
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={handleSetRisk} disabled={loading}>📊 Set Risk Score</button>
                  </div>
                  <div>
                    <div className="form-group">
                      <label className="form-label">Switch to PBFT</label>
                      <input type="number" placeholder="Triggered by Order ID" value={pbftForm.orderId} onChange={e => setPbftForm({...pbftForm,orderId:e.target.value})} style={{ marginBottom: 8 }} />
                      <input type="number" placeholder="Risk Score" value={pbftForm.riskScore} onChange={e => setPbftForm({...pbftForm,riskScore:e.target.value})} style={{ marginBottom: 8 }} />
                      <select value={pbftForm.reason} onChange={e => setPbftForm({...pbftForm,reason:e.target.value})}>
                        <option value="0">HIGH_RISK_ORDER</option>
                        <option value="1">EMERGENCY_RECALL</option>
                        <option value="2">VALIDATOR_FAULT</option>
                        <option value="3">MANUAL_OVERRIDE</option>
                      </select>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={handleSwitchToPBFT} disabled={loading || consensusMode !== 0}>⚡ Switch to PBFT</button>
                  </div>
                </div>
                {consensusMode === 1 && (
                  <>
                    <div className="separator" />
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 12, color: "var(--text3)" }}>Active Event ID</div>
                        <div style={{ fontWeight: 700, fontSize: 20, color: "var(--red)" }}>#{activeEvent}</div>
                      </div>
                      <button className="btn btn-success" onClick={handleRestorePoA} disabled={loading}>⚙️ Restore PoA</button>
                    </div>
                    <div className="separator" />
                    <div className="form-group">
                      <label className="form-label">Cast Validator Vote (PBFT)</label>
                    </div>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
                      <div style={{ flex: 1 }}>
                        <input type="number" placeholder="Event ID" value={voteForm.eventId} onChange={e => setVoteForm({...voteForm,eventId:e.target.value})} />
                      </div>
                      <button className="btn btn-success" onClick={() => { setVoteForm({...voteForm,approve:true}); handleCastVote(); }} disabled={loading}>✅ Approve</button>
                      <button className="btn btn-danger" onClick={() => { setVoteForm({...voteForm,approve:false}); handleCastVote(); }} disabled={loading}>❌ Reject</button>
                    </div>
                  </>
                )}
                <TxStatus msg={txMsg} />
              </div>
            </>
          )}

          {tab === "orders" && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">📋 All Orders</div>
                <button className="btn btn-ghost btn-sm" onClick={loadOrders}>🔄 Refresh</button>
              </div>
              {orders.length === 0 ? <EmptyState icon="📋" text="No orders found" /> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>#</th><th>Medicine</th><th>Qty</th><th>Placer</th><th>Status</th><th>Risk</th><th>Path</th></tr></thead>
                    <tbody>
                      {orders.map((o, i) => (
                        <tr key={i}>
                          <td>#{o[0]?.toString()}</td>
                          <td><strong>{o[3]}</strong><br/><span style={{fontSize:11,color:"var(--text3)"}}>{o[4]}</span></td>
                          <td>{o[5]?.toString()}</td>
                          <td><code style={{fontSize:11}}>{fmtAddr(o[1])}</code></td>
                          <td><StatusBadge status={Number(o[8])} /></td>
                          <td><RiskBar score={o[10]} /></td>
                          <td><Badge color={Number(o[9])===1?"#ef4444":"#10b981"}>{Number(o[9])===1?"⚡ PBFT":"⚙️ PoA"}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "emergency" && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">🚨 Emergency Orders (PBFT Required)</div>
                <button className="btn btn-ghost btn-sm" onClick={loadOrders}>🔄 Refresh</button>
              </div>
              <div className="alert alert-danger" style={{ marginBottom: 16 }}>
                Emergency orders (risk &gt; 800) require PBFT consensus. As NMRA, you can approve after all 3 validators vote.
              </div>
              {orders.filter(o => Number(o[8]) === 3).length === 0 ? <EmptyState icon="✅" text="No emergency orders pending" /> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>#</th><th>Medicine</th><th>Qty</th><th>Risk</th><th>Action</th></tr></thead>
                    <tbody>
                      {orders.filter(o => Number(o[8]) === 3).map((o, i) => (
                        <tr key={i}>
                          <td>#{o[0]?.toString()}</td>
                          <td><strong>{o[3]}</strong></td>
                          <td>{o[5]?.toString()}</td>
                          <td><RiskBar score={o[10]} /></td>
                          <td>
                            <button className="btn btn-success btn-xs" onClick={() => handleApproveEmergency(o[0])} disabled={loading}>
                              ✅ Approve Emergency
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <TxStatus msg={txMsg} />
            </div>
          )}

          {/* ── FIX #37: ADDED — AI Risk Monitor tab ───────────────────────── */}
          {tab === "ai" && (
            <>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">🧠 AI Risk Monitor (LSTM Oracle)</div>
                  <button className="btn btn-ghost btn-sm" onClick={loadPredictions}>🔄 Refresh</button>
                </div>
                <div className="alert alert-info" style={{ marginBottom: 16 }}>
                  Live risk scores from the LSTM model submitted to PredictiveAIOracle.
                  Scores above <strong>800/1000</strong> automatically route new orders
                  to PBFT consensus. Start the oracle server to populate this panel.
                </div>
                {predictions.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🤖</div>
                    <div className="empty-text">No predictions yet.</div>
                    <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 8 }}>
                      Start the oracle: <code>node pbft_coordinator/oracle_server.js</code><br />
                      Run the LSTM:     <code>python ai_model/lstm_model.py</code>
                    </div>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Medicine</th>
                          <th>Overall Risk</th>
                          <th>Stock Risk</th>
                          <th>Demand Forecast</th>
                          <th>Cold Chain</th>
                          <th>Counterfeit</th>
                          <th>Order Routing</th>
                        </tr>
                      </thead>
                      <tbody>
                        {predictions.map((p, i) => {
                          const col = p.overall > 800 ? "#ef4444" : p.overall > 400 ? "#f59e0b" : "#10b981";
                          return (
                            <tr key={i}>
                              <td style={{ fontWeight: 600, textTransform: "capitalize" }}>{p.name}</td>
                              <td>
                                <span style={{ color: col, fontWeight: 700 }}>{p.overall}/1000</span>
                                <div style={{ height: 4, background: "var(--bg4)", borderRadius: 2, width: 80, marginTop: 4 }}>
                                  <div style={{ height: 4, background: col, borderRadius: 2, width: `${p.overall / 10}%` }} />
                                </div>
                              </td>
                              <td>{p.stock}/1000</td>
                              <td>{p.demand?.toLocaleString()} units/wk</td>
                              <td>{p.coldChain}/1000</td>
                              <td>{p.counterfeit}/1000</td>
                              <td>
                                <Badge color={p.overall > 800 ? "#ef4444" : "#10b981"}>
                                  {p.overall > 800 ? "⚡ PBFT" : "⚙️ PoA"}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MANUFACTURER / IMPORTER DASHBOARD (shared)
// ─────────────────────────────────────────────────────────────────────────────
function ManufacturerDashboard({ signer, account, role }) {
  const [tab, setTab] = useState("overview");
  const [batches, setBatches] = useState([]);
  const [txMsg, setTxMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const { tc } = useContracts(signer);

  const [mintForm, setMintForm] = useState({
    medicineName:"", batchNumber:"", genericName:"", quantity:"",
    expiryDate:"", coldChain:false, minTemp:"200", maxTemp:"800",
    qrPayload:"", ipfsCert:""
  });
  const [transferForm, setTransferForm] = useState({ tokenId:"", to:"", location:"", temp:"2500", notes:"" });
  const [custodyBatch, setCustodyBatch] = useState("");
  const [custody, setCustody] = useState([]);

  useEffect(() => { if (tab === "batches" || tab === "overview") loadBatches(); }, [tab]);

  async function loadBatches() {
    try {
      const total = Number(await tc.totalBatches());
      const list = [];
      for (let i = 1; i <= total; i++) {
        const b = await tc.getBatch(i);
        if (b[7]?.toLowerCase() === account.toLowerCase()) list.push({id:i,...b});
      }
      setBatches(list);
    } catch (e) { console.error(e); }
  }

  async function handleMint() {
    setLoading(true); setTxMsg("⏳ Minting batch on blockchain…");
    try {
      const expiry = Math.floor(new Date(mintForm.expiryDate).getTime() / 1000);
      if (expiry <= Date.now()/1000) { setTxMsg("❌ Expiry date must be in the future"); setLoading(false); return; }
      const params = {
        medicineName: mintForm.medicineName, batchNumber: mintForm.batchNumber,
        genericName: mintForm.genericName || mintForm.medicineName,
        quantity: Number(mintForm.quantity), expiryDate: expiry,
        coldChainRequired: mintForm.coldChain,
        minTemp: mintForm.coldChain ? Number(mintForm.minTemp) : 0,
        maxTemp: mintForm.coldChain ? Number(mintForm.maxTemp) : 3500,
        qrPayload: mintForm.qrPayload || `QR-${mintForm.batchNumber}-${Date.now()}`,
        ipfsCert: mintForm.ipfsCert || `ipfs://QmExample${Date.now()}`
      };
      const tx = await tc.mintBatch([
        params.medicineName, params.batchNumber, params.genericName,
        params.quantity, params.expiryDate, params.coldChainRequired,
        params.minTemp, params.maxTemp, params.qrPayload, params.ipfsCert
      ]);
      await tx.wait();
      setTxMsg("✅ Batch minted! NFT created on blockchain.");
      setMintForm({medicineName:"",batchNumber:"",genericName:"",quantity:"",expiryDate:"",coldChain:false,minTemp:"200",maxTemp:"800",qrPayload:"",ipfsCert:""});
      loadBatches();
    } catch (e) { setTxMsg("❌ " + (e.reason || e.message)); }
    setLoading(false);
  }

  async function handleTransfer() {
    setLoading(true); setTxMsg("⏳ Transferring custody…");
    try {
      const tx = await tc.transferCustody(
        Number(transferForm.tokenId), transferForm.to,
        transferForm.location, Number(transferForm.temp), transferForm.notes
      );
      await tx.wait();
      setTxMsg("✅ Custody transferred successfully!");
      setTransferForm({ tokenId:"", to:"", location:"", temp:"2500", notes:"" });
      loadBatches();
    } catch (e) { setTxMsg("❌ " + (e.reason || e.message)); }
    setLoading(false);
  }

  async function loadCustody() {
    if (!custodyBatch) return;
    try {
      const hist = await tc.getCustodyHistory(Number(custodyBatch));
      setCustody(hist);
    } catch (e) { setTxMsg("❌ " + (e.reason || e.message)); }
  }

  return (
    <div className="app-shell">
      <Sidebar role={role} orgName={role === "MANUFACTURER" ? "Lanka Pharmaceuticals Ltd" : "Global Meds Import Agency"}
        account={account} activeTab={tab} onTabChange={(t) => { setTab(t); setTxMsg(""); }}
        onLogout={() => window.location.reload()} />
      <div className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">{role === "MANUFACTURER" ? "🏭 Manufacturer Dashboard" : "🚢 Importer Dashboard"}</div>
            <div className="page-sub">Batch Creation & Custody Management</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={loadBatches}>🔄 Refresh</button>
        </div>
        <div className="page-body">

          {(tab === "overview" || tab === "batches") && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">📦 My Medicine Batches ({batches.length})</div>
              </div>
              {batches.length === 0 ? <EmptyState icon="📦" text="No batches minted yet. Go to Mint Batch to create one." /> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Token ID</th><th>Medicine</th><th>Batch #</th><th>Qty</th><th>Status</th><th>Cold Chain</th><th>Expiry</th></tr></thead>
                    <tbody>
                      {batches.map((b, i) => (
                        <tr key={i}>
                          <td>#{b.id}</td>
                          <td><strong>{b[1]}</strong><br/><span style={{fontSize:11,color:"var(--text3)"}}>{b[3]}</span></td>
                          <td><code style={{fontSize:11}}>{b[2]}</code></td>
                          <td>{b[4]?.toString()}</td>
                          <td><StatusBadge status={Number(b[9])} type="batch" /></td>
                          <td>{b[10] ? <Badge color="#f59e0b">❄️ Required</Badge> : <Badge color="#10b981">✓ None</Badge>}</td>
                          <td style={{fontSize:12,color:"var(--text2)"}}>{fmtDate(b[6])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "mint" && (
            <div className="card">
              <div className="card-header"><div className="card-title">➕ Mint New Medicine Batch</div></div>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Medicine Name *</label>
                  <input placeholder="e.g. Panadol 500mg" value={mintForm.medicineName} onChange={e => setMintForm({...mintForm,medicineName:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Batch Number *</label>
                  <input placeholder="e.g. PCM-2025-001" value={mintForm.batchNumber} onChange={e => setMintForm({...mintForm,batchNumber:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Generic (INN) Name</label>
                  <input placeholder="e.g. Paracetamol 500mg" value={mintForm.genericName} onChange={e => setMintForm({...mintForm,genericName:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity (units) *</label>
                  <input type="number" placeholder="e.g. 50000" value={mintForm.quantity} onChange={e => setMintForm({...mintForm,quantity:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Expiry Date *</label>
                  <input type="date" value={mintForm.expiryDate} onChange={e => setMintForm({...mintForm,expiryDate:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">QR Payload</label>
                  <input placeholder="Auto-generated if blank" value={mintForm.qrPayload} onChange={e => setMintForm({...mintForm,qrPayload:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">IPFS Certificate URI</label>
                  <input placeholder="ipfs://Qm…" value={mintForm.ipfsCert} onChange={e => setMintForm({...mintForm,ipfsCert:e.target.value})} />
                </div>
                <div className="form-group" style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={mintForm.coldChain} onChange={e => setMintForm({...mintForm,coldChain:e.target.checked})} />
                    ❄️ Cold Chain Required
                  </label>
                </div>
              </div>
              {mintForm.coldChain && (
                <div className="form-grid form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Min Temp (°C × 100, e.g. 200 = 2°C)</label>
                    <input type="number" value={mintForm.minTemp} onChange={e => setMintForm({...mintForm,minTemp:e.target.value})} />
                    <div className="form-hint">Current: {(Number(mintForm.minTemp)/100).toFixed(2)}°C</div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Max Temp (°C × 100, e.g. 800 = 8°C)</label>
                    <input type="number" value={mintForm.maxTemp} onChange={e => setMintForm({...mintForm,maxTemp:e.target.value})} />
                    <div className="form-hint">Current: {(Number(mintForm.maxTemp)/100).toFixed(2)}°C</div>
                  </div>
                </div>
              )}
              <button className="btn btn-primary" onClick={handleMint} disabled={loading}>🔗 Mint Batch NFT</button>
              <TxStatus msg={txMsg} />
            </div>
          )}

          {tab === "transfer" && (
            <div className="card">
              <div className="card-header"><div className="card-title">📤 Transfer Batch Custody</div></div>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Token ID (Batch) *</label>
                  <input type="number" placeholder="e.g. 1" value={transferForm.tokenId} onChange={e => setTransferForm({...transferForm,tokenId:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Recipient Address *</label>
                  <input placeholder="0x… (SPC, MSD, Pharmacy…)" value={transferForm.to} onChange={e => setTransferForm({...transferForm,to:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Transfer Location *</label>
                  <input placeholder="e.g. SPC Central Warehouse, Colombo" value={transferForm.location} onChange={e => setTransferForm({...transferForm,location:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Recorded Temperature (°C × 100)</label>
                  <input type="number" value={transferForm.temp} onChange={e => setTransferForm({...transferForm,temp:e.target.value})} />
                  <div className="form-hint">Current: {(Number(transferForm.temp)/100).toFixed(2)}°C</div>
                </div>
                <div className="form-group" style={{ gridColumn: "1/-1" }}>
                  <label className="form-label">Transfer Notes</label>
                  <input placeholder="Any additional notes about the transfer" value={transferForm.notes} onChange={e => setTransferForm({...transferForm,notes:e.target.value})} />
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleTransfer} disabled={loading}>📤 Transfer Custody</button>
              <TxStatus msg={txMsg} />
              <div className="separator" />
              <div className="card-header"><div className="card-title">🗺️ View Custody History</div></div>
              <div style={{ display: "flex", gap: 10 }}>
                <input type="number" placeholder="Token ID" value={custodyBatch} onChange={e => setCustodyBatch(e.target.value)} style={{ maxWidth: 160 }} />
                <button className="btn btn-ghost btn-sm" onClick={loadCustody}>🔍 Load History</button>
              </div>
              {custody.length > 0 && (
                <div className="table-wrap" style={{ marginTop: 12 }}>
                  <table>
                    <thead><tr><th>From</th><th>To</th><th>Location</th><th>Temp</th><th>Notes</th><th>Time</th></tr></thead>
                    <tbody>
                      {custody.map((c, i) => (
                        <tr key={i}>
                          <td><code style={{fontSize:11}}>{fmtAddr(c[0])}</code></td>
                          <td><code style={{fontSize:11}}>{fmtAddr(c[1])}</code></td>
                          <td>{c[3]}</td>
                          <td>{(Number(c[4])/100).toFixed(1)}°C</td>
                          <td style={{fontSize:12,color:"var(--text3)"}}>{c[5]}</td>
                          <td style={{fontSize:12}}>{fmtDate(c[2])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SPC DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function SPCDashboard({ signer, account }) {
  const [tab, setTab] = useState("overview");
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ total: 0, fulfilled: 0, emergency: 0 });
  const [txMsg, setTxMsg] = useState("");
  const [loading, setLoading] = useState(false);
  // ── FIX #16: added ca (ConsensusAdapter) for PBFT voting ──────────────
  const { oc, ca } = useContracts(signer);  // CHANGED: was { oc }
  const [castVoteForm, setCastVoteForm] = useState({ eventId: "" }); // FIX #16: ADDED

  useEffect(() => { loadAll(); }, [tab]);

  async function loadAll() {
    try {
      const [t, f, e] = await Promise.all([oc.totalOrders(), oc.totalFulfilled(), oc.totalEmergencyOrders()]);
      setStats({ total: Number(t), fulfilled: Number(f), emergency: Number(e) });
      const ids = await oc.getOrdersForSupplier(account);
      const list = await Promise.all(ids.map(id => oc.getOrder(id)));
      setOrders(list);
    } catch (e) { console.error(e); }
  }

  async function handleApprove(orderId) {
    setLoading(true); setTxMsg("⏳ Approving order…");
    try {
      const tx = await oc.approveOrder(Number(orderId));
      await tx.wait();
      setTxMsg("✅ Order approved!");
      loadAll();
    } catch (e) { setTxMsg("❌ " + (e.reason || e.message)); }
    setLoading(false);
  }

  async function handleFulfill(orderId) {
    setLoading(true); setTxMsg("⏳ Marking as fulfilled…");
    try {
      const tx = await oc.fulfillOrder(Number(orderId));
      await tx.wait();
      setTxMsg("✅ Order fulfilled!");
      loadAll();
    } catch (e) { setTxMsg("❌ " + (e.reason || e.message)); }
    setLoading(false);
  }

  async function handleReject(orderId) {
    const reason = prompt("Rejection reason:");
    if (!reason) return;
    setLoading(true); setTxMsg("⏳ Rejecting order…");
    try {
      const tx = await oc.rejectOrder(Number(orderId), reason);
      await tx.wait();
      setTxMsg("✅ Order rejected.");
      loadAll();
    } catch (e) { setTxMsg("❌ " + (e.reason || e.message)); }
    setLoading(false);
  }

  // ── FIX #16: ADDED — SPC PBFT vote handler ──────────────────────────────
  async function handleVote(approve) {
    setLoading(true); setTxMsg("⏳ Casting SPC PBFT vote…");
    try {
      const dataHash = ethers.id(`spc-vote-${castVoteForm.eventId}-${account}`);
      const tx = await ca.castVote(Number(castVoteForm.eventId), approve, dataHash);
      await tx.wait();
      setTxMsg(`✅ SPC vote cast: ${approve ? "APPROVE ✓" : "REJECT ✗"}`);
    } catch (e) { setTxMsg("❌ " + (e.reason || e.message)); }
    setLoading(false);
  }

  const pending = orders.filter(o => Number(o[8]) === 0);
  const approved = orders.filter(o => Number(o[8]) === 2);
  const fulfilled = orders.filter(o => Number(o[8]) === 4);
  const rejected = orders.filter(o => Number(o[8]) === 5);

  return (
    <div className="app-shell">
      <Sidebar role="SPC" orgName="State Pharmaceuticals Corporation" account={account}
        activeTab={tab} onTabChange={(t) => { setTab(t); setTxMsg(""); }}
        onLogout={() => window.location.reload()} />
      <div className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">🏦 SPC Distribution Dashboard</div>
            <div className="page-sub">State Pharmaceuticals Corporation · Order Management</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={loadAll}>🔄 Refresh</button>
        </div>
        <div className="page-body">
          {tab === "overview" && (
            <>
              <div className="stats-grid">
                {[
                  {icon:"📋",num:stats.total,label:"Total Orders"},
                  {icon:"✅",num:stats.fulfilled,label:"Fulfilled"},
                  {icon:"⏳",num:pending.length,label:"Awaiting Approval"},
                  {icon:"🚨",num:stats.emergency,label:"Emergency Orders"},
                ].map((s,i) => (
                  <div className="stat-card" key={i}><div className="stat-icon">{s.icon}</div><div className="stat-num">{s.num}</div><div className="stat-label">{s.label}</div></div>
                ))}
              </div>
              <div className="card">
                <div className="card-header"><div className="card-title">📋 All Assigned Orders</div></div>
                <OrderTable orders={orders} onApprove={handleApprove} onFulfill={handleFulfill} onReject={handleReject} loading={loading} />
                <TxStatus msg={txMsg} />
              </div>
            </>
          )}
          {tab === "orders" && (
            <div className="card">
              <div className="card-header"><div className="card-title">⏳ Pending Approval ({pending.length})</div></div>
              <OrderTable orders={pending} onApprove={handleApprove} onFulfill={handleFulfill} onReject={handleReject} loading={loading} />
              <TxStatus msg={txMsg} />
            </div>
          )}
          {tab === "fulfill" && (
            <div className="card">
              <div className="card-header"><div className="card-title">🚚 Approved — Ready to Fulfill ({approved.length})</div></div>
              <OrderTable orders={approved} onApprove={handleApprove} onFulfill={handleFulfill} onReject={handleReject} loading={loading} />
              <TxStatus msg={txMsg} />
            </div>
          )}
          {tab === "rejected" && (
            <div className="card">
              <div className="card-header"><div className="card-title">❌ Rejected Orders</div></div>
              <OrderTable orders={rejected} onApprove={handleApprove} onFulfill={handleFulfill} onReject={handleReject} loading={loading} />
              <TxStatus msg={txMsg} />
            </div>
          )}

          {/* ── FIX #16: ADDED — SPC PBFT Voting tab ──────────────────── */}
          {tab === "pbft" && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">🗳️ PBFT Validator Vote</div>
              </div>
              <div className="alert alert-info" style={{ marginBottom: 16 }}>
                As SPC (Validator #2), you must cast your vote during an active PBFT
                consensus round. Enter the active Event ID shown on the NMRA dashboard
                and vote to approve or reject the emergency order.
              </div>
              <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Active Consensus Event ID</label>
                  <input
                    type="number"
                    placeholder="Event ID (from NMRA dashboard)"
                    value={castVoteForm.eventId}
                    onChange={e => setCastVoteForm({ eventId: e.target.value })}
                  />
                </div>
                <button className="btn btn-success" onClick={() => handleVote(true)} disabled={loading || !castVoteForm.eventId}>
                  ✅ Vote APPROVE
                </button>
                <button className="btn btn-danger" onClick={() => handleVote(false)} disabled={loading || !castVoteForm.eventId}>
                  ❌ Vote REJECT
                </button>
              </div>
              <TxStatus msg={txMsg} />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function OrderTable({ orders, onApprove, onFulfill, onReject, loading }) {
  if (!orders || orders.length === 0) return <EmptyState icon="📋" text="No orders in this category" />;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>#</th><th>Medicine</th><th>Qty</th><th>Placer</th><th>Status</th><th>Risk</th><th>Path</th><th>Actions</th></tr></thead>
        <tbody>
          {orders.map((o, i) => {
            const status = Number(o[8]);
            return (
              <tr key={i}>
                <td>#{o[0]?.toString()}</td>
                <td><strong>{o[3]}</strong><br/><span style={{fontSize:11,color:"var(--text3)"}}>{o[4]}</span></td>
                <td>{o[5]?.toString()}</td>
                <td><code style={{fontSize:11}}>{fmtAddr(o[1])}</code></td>
                <td><StatusBadge status={status} /></td>
                <td><RiskBar score={o[10]} /></td>
                <td><Badge color={Number(o[9])===1?"#ef4444":"#10b981"}>{Number(o[9])===1?"⚡ PBFT":"⚙️ PoA"}</Badge></td>
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    {status === 0 && <button className="btn btn-success btn-xs" onClick={() => onApprove(o[0])} disabled={loading}>✅ Approve</button>}
                    {status === 2 && <button className="btn btn-primary btn-xs" onClick={() => onFulfill(o[0])} disabled={loading}>🚚 Fulfill</button>}
                    {(status === 0) && <button className="btn btn-danger btn-xs" onClick={() => onReject(o[0])} disabled={loading}>❌</button>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MSD DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function MSDDashboard({ signer, account }) {
  const [tab, setTab] = useState("overview");
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ total: 0, fulfilled: 0, emergency: 0 });
  const [txMsg, setTxMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [castVoteForm, setCastVoteForm] = useState({ eventId: "" });
  const { oc, ca } = useContracts(signer);

  useEffect(() => { loadAll(); }, [tab]);

  async function loadAll() {
    try {
      const [t, f, e] = await Promise.all([oc.totalOrders(), oc.totalFulfilled(), oc.totalEmergencyOrders()]);
      setStats({ total: Number(t), fulfilled: Number(f), emergency: Number(e) });
      const ids = await oc.getOrdersForSupplier(account);
      const list = await Promise.all(ids.map(id => oc.getOrder(id)));
      setOrders(list);
    } catch (e) { console.error(e); }
  }

  async function handleFulfill(orderId) {
    setLoading(true); setTxMsg("⏳ Fulfilling order…");
    try {
      const tx = await oc.fulfillOrder(Number(orderId));
      await tx.wait();
      setTxMsg("✅ Order fulfilled!");
      loadAll();
    } catch (e) { setTxMsg("❌ " + (e.reason || e.message)); }
    setLoading(false);
  }

  async function handleVote(approve) {
    setLoading(true); setTxMsg("⏳ Casting PBFT vote…");
    try {
      const dataHash = ethers.id(`msd-vote-${castVoteForm.eventId}-${account}`);
      const tx = await ca.castVote(Number(castVoteForm.eventId), approve, dataHash);
      await tx.wait();
      setTxMsg(`✅ MSD vote cast: ${approve ? "APPROVE" : "REJECT"}`);
    } catch (e) { setTxMsg("❌ " + (e.reason || e.message)); }
    setLoading(false);
  }

  const emergency = orders.filter(o => Number(o[8]) === 3 || Number(o[8]) === 2);
  const hospital = orders.filter(o => Number(o[8]) !== 5 && Number(o[8]) !== 6);

  return (
    <div className="app-shell">
      <Sidebar role="MSD" orgName="Medical Supplies Division" account={account}
        activeTab={tab} onTabChange={(t) => { setTab(t); setTxMsg(""); }}
        onLogout={() => window.location.reload()} />
      <div className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">🏥 MSD Dashboard</div>
            <div className="page-sub">Medical Supplies Division · Emergency & Hospital Orders</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={loadAll}>🔄 Refresh</button>
        </div>
        <div className="page-body">
          {tab === "overview" && (
            <>
              <div className="stats-grid">
                {[
                  {icon:"📋",num:stats.total,label:"Total Orders"},
                  {icon:"✅",num:stats.fulfilled,label:"Fulfilled"},
                  {icon:"🚨",num:stats.emergency,label:"Emergency"},
                  {icon:"🏥",num:hospital.length,label:"Hospital Orders"},
                ].map((s,i) => (
                  <div className="stat-card" key={i}><div className="stat-icon">{s.icon}</div><div className="stat-num">{s.num}</div><div className="stat-label">{s.label}</div></div>
                ))}
              </div>
              <div className="card">
                <div className="card-header"><div className="card-title">📋 All MSD Orders</div></div>
                <OrderTable orders={orders} onApprove={() => {}} onFulfill={handleFulfill} onReject={() => {}} loading={loading} />
                <TxStatus msg={txMsg} />
              </div>
            </>
          )}
          {tab === "emergency" && (
            <div className="card">
              <div className="card-header"><div className="card-title">🚨 Emergency Orders — PBFT Voting</div></div>
              <div className="alert alert-danger" style={{ marginBottom: 16 }}>
                As MSD (Validator #3), you can cast your PBFT vote on active consensus events.
              </div>
              <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Active Consensus Event ID</label>
                  <input type="number" placeholder="Event ID" value={castVoteForm.eventId} onChange={e => setCastVoteForm({...castVoteForm,eventId:e.target.value})} />
                </div>
                <button className="btn btn-success" onClick={() => handleVote(true)} disabled={loading}>✅ Vote APPROVE</button>
                <button className="btn btn-danger" onClick={() => handleVote(false)} disabled={loading}>❌ Vote REJECT</button>
              </div>
              <OrderTable orders={emergency} onApprove={() => {}} onFulfill={handleFulfill} onReject={() => {}} loading={loading} />
              <TxStatus msg={txMsg} />
            </div>
          )}
          {tab === "hospital" && (
            <div className="card">
              <div className="card-header"><div className="card-title">🏥 Hospital Orders</div></div>
              <OrderTable orders={hospital} onApprove={() => {}} onFulfill={handleFulfill} onReject={() => {}} loading={loading} />
              <TxStatus msg={txMsg} />
            </div>
          )}
          {tab === "fulfill" && (
            <div className="card">
              <div className="card-header"><div className="card-title">🚚 Fulfill Approved Orders</div></div>
              <OrderTable orders={orders.filter(o => Number(o[8]) === 2)} onApprove={() => {}} onFulfill={handleFulfill} onReject={() => {}} loading={loading} />
              <TxStatus msg={txMsg} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHARMACY / HOSPITAL DASHBOARD (shared)
// ─────────────────────────────────────────────────────────────────────────────
function PharmacyHospitalDashboard({ signer, account, role }) {
  const [tab, setTab] = useState("overview");
  const [orders, setOrders] = useState([]);
  const [batches, setBatches] = useState([]);
  const [txMsg, setTxMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifyInput, setVerifyInput] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);
  const [trackInput, setTrackInput] = useState("");
  const [custody, setCustody] = useState([]);
  const { oc, tc } = useContracts(signer);

  const isHospital = role === "HOSPITAL";
  const supplierAddr = isHospital ? KNOWN_ACCOUNTS.MSD : KNOWN_ACCOUNTS.SPC;
  const supplierName = isHospital ? "MSD" : "SPC";

  const [orderForm, setOrderForm] = useState({ medicineName: "", genericName: "", quantity: "", notes: "" });

  useEffect(() => {
    if (tab === "overview" || tab === "orders") loadOrders();
    if (tab === "batches") loadBatches();
  }, [tab]);

  async function loadOrders() {
    try {
      const ids = await oc.getOrdersByPlacer(account);
      const list = await Promise.all(ids.map(id => oc.getOrder(id)));
      setOrders(list);
    } catch (e) { console.error(e); }
  }

  async function loadBatches() {
    try {
      const ids = await tc.getHolderBatches(account);
      const list = await Promise.all(ids.map(id => tc.getBatch(id)));
      setBatches(list);
    } catch (e) { console.error(e); }
  }

  async function handlePlaceOrder() {
    setLoading(true); setTxMsg("⏳ Placing order on blockchain…");
    try {
      const tx = await oc.placeOrder(
        supplierAddr, orderForm.medicineName, orderForm.genericName || orderForm.medicineName,
        Number(orderForm.quantity), 0, orderForm.notes || "Standard procurement"
      );
      await tx.wait();
      setTxMsg("✅ Order placed! Awaiting AI risk evaluation.");
      setOrderForm({ medicineName: "", genericName: "", quantity: "", notes: "" });
      loadOrders();
    } catch (e) { setTxMsg("❌ " + (e.reason || e.message)); }
    setLoading(false);
  }

  async function handleCancelOrder(orderId) {
    setLoading(true); setTxMsg("⏳ Cancelling order…");
    try {
      const tx = await oc.cancelOrder(Number(orderId));
      await tx.wait();
      setTxMsg("✅ Order cancelled.");
      loadOrders();
    } catch (e) { setTxMsg("❌ " + (e.reason || e.message)); }
    setLoading(false);
  }

  async function handleVerify() {
    setLoading(true); setVerifyResult(null);
    try {
      const qrHash = ethers.id(verifyInput);
      const result = await tc.verifyByQR(qrHash);
      setVerifyResult({
        tokenId: Number(result[0]),
        isAuthentic: result[1],
        medicineName: result[2],
        batchNumber: result[3],
        status: Number(result[4]),
        expiryDate: Number(result[5]),
      });
    } catch (e) { setVerifyResult({ isAuthentic: false, error: e.message }); }
    setLoading(false);
  }

  async function loadCustody() {
    if (!trackInput) return;
    try {
      const hist = await tc.getCustodyHistory(Number(trackInput));
      setCustody(hist);
    } catch (e) { setTxMsg("❌ " + e.message); }
  }

  const pending = orders.filter(o => [0, 1].includes(Number(o[8])));
  const active = orders.filter(o => [0, 1, 2, 3].includes(Number(o[8])));

  return (
    <div className="app-shell">
      <Sidebar role={role} orgName={isHospital ? "Colombo Teaching Hospital Pharmacy" : "CareLife Pharmacy Chain"}
        account={account} activeTab={tab} onTabChange={(t) => { setTab(t); setTxMsg(""); setVerifyResult(null); }}
        onLogout={() => window.location.reload()} />
      <div className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">{isHospital ? "🏥 Hospital Dashboard" : "💊 Pharmacy Dashboard"}</div>
            <div className="page-sub">{isHospital ? "Hospital Pharmacy · MSD Procurement" : "Retail Pharmacy · SPC Procurement"}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => { loadOrders(); loadBatches(); }}>🔄 Refresh</button>
        </div>
        <div className="page-body">

          {tab === "overview" && (
            <>
              <div className="stats-grid">
                {[
                  {icon:"📋",num:orders.length,label:"Total Orders"},
                  {icon:"⏳",num:pending.length,label:"Pending"},
                  {icon:"📦",num:batches.length,label:"Batches in Stock"},
                  {icon:"✅",num:orders.filter(o=>Number(o[8])===4).length,label:"Fulfilled"},
                ].map((s,i) => (
                  <div className="stat-card" key={i}><div className="stat-icon">{s.icon}</div><div className="stat-num">{s.num}</div><div className="stat-label">{s.label}</div></div>
                ))}
              </div>
              <div className="card">
                <div className="card-header"><div className="card-title">📋 My Recent Orders</div></div>
                {orders.length === 0 ? <EmptyState icon="📋" text="No orders yet. Place your first order." /> : (
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>#</th><th>Medicine</th><th>Qty</th><th>Status</th><th>Risk</th><th>Consensus</th><th>Date</th></tr></thead>
                      <tbody>
                        {orders.slice(-5).map((o, i) => (
                          <tr key={i}>
                            <td>#{o[0]?.toString()}</td>
                            <td><strong>{o[3]}</strong></td>
                            <td>{o[5]?.toString()}</td>
                            <td><StatusBadge status={Number(o[8])} /></td>
                            <td><RiskBar score={o[10]} /></td>
                            <td><Badge color={Number(o[9])===1?"#ef4444":"#10b981"}>{Number(o[9])===1?"⚡ PBFT":"⚙️ PoA"}</Badge></td>
                            <td style={{fontSize:12,color:"var(--text3)"}}>{fmtDate(o[12])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === "placeOrder" && (
            <div className="card">
              <div className="card-header"><div className="card-title">➕ Place New Order to {supplierName}</div></div>
              <div className="alert alert-info" style={{ marginBottom: 16 }}>
                📦 Orders are automatically routed to PoA or PBFT consensus based on AI risk score.
                Supplier: <strong>{supplierName}</strong> ({fmtAddr(supplierAddr)})
              </div>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Medicine Name *</label>
                  <select value={orderForm.medicineName} onChange={e => setOrderForm({...orderForm,medicineName:e.target.value})}>
                    <option value="">Select Medicine</option>
                    {["Paracetamol 500mg","Amoxicillin 250mg","Metformin 500mg","Amlodipine 5mg","Omeprazole 20mg","Insulin (Regular)","Salbutamol Inhaler","Atorvastatin 40mg"].map(m=>(
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Generic (INN) Name</label>
                  <input placeholder="Auto-fills if blank" value={orderForm.genericName} onChange={e => setOrderForm({...orderForm,genericName:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity (units) *</label>
                  <input type="number" placeholder="e.g. 1000" value={orderForm.quantity} onChange={e => setOrderForm({...orderForm,quantity:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Urgency Notes</label>
                  <input placeholder="e.g. Low stock — 7 days remaining" value={orderForm.notes} onChange={e => setOrderForm({...orderForm,notes:e.target.value})} />
                </div>
              </div>
              <button className="btn btn-primary" onClick={handlePlaceOrder} disabled={loading || !orderForm.medicineName || !orderForm.quantity}>
                🚀 Place Order
              </button>
              <TxStatus msg={txMsg} />
            </div>
          )}

          {tab === "orders" && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">📋 My Orders ({orders.length})</div>
                <button className="btn btn-ghost btn-sm" onClick={loadOrders}>🔄 Refresh</button>
              </div>
              {orders.length === 0 ? <EmptyState icon="📋" text="No orders placed yet" /> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>#</th><th>Medicine</th><th>Qty</th><th>Status</th><th>Risk</th><th>Consensus</th><th>Date</th><th>Action</th></tr></thead>
                    <tbody>
                      {orders.map((o, i) => (
                        <tr key={i}>
                          <td>#{o[0]?.toString()}</td>
                          <td><strong>{o[3]}</strong><br/><span style={{fontSize:11,color:"var(--text3)"}}>{o[11]}</span></td>
                          <td>{o[5]?.toString()}</td>
                          <td><StatusBadge status={Number(o[8])} /></td>
                          <td><RiskBar score={o[10]} /></td>
                          <td><Badge color={Number(o[9])===1?"#ef4444":"#10b981"}>{Number(o[9])===1?"⚡ PBFT":"⚙️ PoA"}</Badge></td>
                          <td style={{fontSize:12}}>{fmtDate(o[12])}</td>
                          <td>
                            {[0,1].includes(Number(o[8])) && (
                              <button className="btn btn-danger btn-xs" onClick={() => handleCancelOrder(o[0])} disabled={loading}>Cancel</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <TxStatus msg={txMsg} />
            </div>
          )}

          {tab === "batches" && (
            <div className="card">
              <div className="card-header"><div className="card-title">📦 Received Stock ({batches.length})</div></div>
              {batches.length === 0 ? <EmptyState icon="📦" text="No stock received yet" /> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Token ID</th><th>Medicine</th><th>Batch #</th><th>Qty</th><th>Status</th><th>Expiry</th><th>Cold Chain</th></tr></thead>
                    <tbody>
                      {batches.map((b, i) => (
                        <tr key={i}>
                          <td>#{b[0]?.toString()}</td>
                          <td><strong>{b[1]}</strong></td>
                          <td><code style={{fontSize:11}}>{b[2]}</code></td>
                          <td>{b[4]?.toString()}</td>
                          <td><StatusBadge status={Number(b[9])} type="batch" /></td>
                          <td style={{fontSize:12}}>{fmtDate(b[6])}</td>
                          <td>{b[10] ? <Badge color="#f59e0b">❄️ Yes</Badge> : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "verify" && (
            <div className="card">
              <div className="card-header"><div className="card-title">🔍 Verify Medicine Authenticity</div></div>
              <div className="alert alert-info" style={{ marginBottom: 16 }}>
                Enter the QR code payload from the medicine packaging to verify its authenticity on the blockchain.
              </div>
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <input placeholder="Enter QR code payload or batch-specific string…" value={verifyInput} onChange={e => setVerifyInput(e.target.value)} />
                <button className="btn btn-primary" onClick={handleVerify} disabled={loading || !verifyInput} style={{ whiteSpace: "nowrap" }}>🔍 Verify</button>
              </div>
              {verifyResult && (
                <div className={verifyResult.isAuthentic ? "qr-result-authentic" : "qr-result-fake"}>
                  <div className="qr-icon">{verifyResult.isAuthentic ? "✅" : "❌"}</div>
                  <div style={{ textAlign: "center", fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
                    {verifyResult.isAuthentic ? "AUTHENTIC MEDICINE" : "NOT VERIFIED"}
                  </div>
                  {verifyResult.isAuthentic && (
                    <div className="info-grid">
                      <div className="info-item"><div className="info-key">Medicine</div><div className="info-val">{verifyResult.medicineName}</div></div>
                      <div className="info-item"><div className="info-key">Batch #</div><div className="info-val">{verifyResult.batchNumber}</div></div>
                      <div className="info-item"><div className="info-key">Token ID</div><div className="info-val">#{verifyResult.tokenId}</div></div>
                      <div className="info-item"><div className="info-key">Expiry</div><div className="info-val">{fmtDate(verifyResult.expiryDate)}</div></div>
                      <div className="info-item"><div className="info-key">Status</div><div className="info-val"><StatusBadge status={verifyResult.status} type="batch" /></div></div>
                    </div>
                  )}
                  {!verifyResult.isAuthentic && <div style={{ textAlign: "center", color: "var(--text2)", fontSize: 13 }}>{verifyResult.error || "QR code not found in blockchain records."}</div>}
                </div>
              )}
              <div className="separator" />
              <div className="card-title" style={{ marginBottom: 12 }}>🗺️ Track Batch History</div>
              <div style={{ display: "flex", gap: 10 }}>
                <input type="number" placeholder="Batch Token ID" value={trackInput} onChange={e => setTrackInput(e.target.value)} style={{ maxWidth: 160 }} />
                <button className="btn btn-ghost btn-sm" onClick={loadCustody}>🔍 Load History</button>
              </div>
              {custody.length > 0 && (
                <div className="table-wrap" style={{ marginTop: 12 }}>
                  <table>
                    <thead><tr><th>From</th><th>To</th><th>Location</th><th>Temp</th><th>Notes</th><th>Time</th></tr></thead>
                    <tbody>
                      {custody.map((c, i) => (
                        <tr key={i}>
                          <td><code style={{fontSize:11}}>{fmtAddr(c[0])}</code></td>
                          <td><code style={{fontSize:11}}>{fmtAddr(c[1])}</code></td>
                          <td>{c[3]}</td>
                          <td>{(Number(c[4])/100).toFixed(1)}°C</td>
                          <td style={{fontSize:12,color:"var(--text3)"}}>{c[5]}</td>
                          <td style={{fontSize:12}}>{fmtDate(c[2])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WHOLESALER DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function WholesalerDashboard({ signer, account }) {
  const [tab, setTab] = useState("overview");
  const [batches, setBatches] = useState([]);
  const [txMsg, setTxMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [transferForm, setTransferForm] = useState({ tokenId:"", to:"", location:"", temp:"2500", notes:"" });
  const { tc } = useContracts(signer);

  useEffect(() => { loadBatches(); }, [tab]);

  async function loadBatches() {
    try {
      const ids = await tc.getHolderBatches(account);
      const list = await Promise.all(ids.map(id => tc.getBatch(id)));
      setBatches(list);
    } catch (e) { console.error(e); }
  }

  async function handleTransfer() {
    setLoading(true); setTxMsg("⏳ Transferring custody…");
    try {
      const tx = await tc.transferCustody(Number(transferForm.tokenId), transferForm.to, transferForm.location, Number(transferForm.temp), transferForm.notes);
      await tx.wait();
      setTxMsg("✅ Custody transferred!");
      setTransferForm({ tokenId:"", to:"", location:"", temp:"2500", notes:"" });
      loadBatches();
    } catch (e) { setTxMsg("❌ " + (e.reason || e.message)); }
    setLoading(false);
  }

  return (
    <div className="app-shell">
      <Sidebar role="WHOLESALER" orgName="National Medical Wholesalers" account={account}
        activeTab={tab} onTabChange={(t) => { setTab(t); setTxMsg(""); }}
        onLogout={() => window.location.reload()} />
      <div className="main-content">
        <div className="page-header">
          <div><div className="page-title">🏪 Wholesaler Dashboard</div><div className="page-sub">Distribution & Stock Management</div></div>
          <button className="btn btn-ghost btn-sm" onClick={loadBatches}>🔄 Refresh</button>
        </div>
        <div className="page-body">
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-icon">📦</div><div className="stat-num">{batches.length}</div><div className="stat-label">Batches in Custody</div></div>
          </div>
          {(tab === "overview" || tab === "batches") && (
            <div className="card">
              <div className="card-header"><div className="card-title">📦 My Stock</div></div>
              {batches.length === 0 ? <EmptyState icon="📦" text="No stock in custody" /> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Token ID</th><th>Medicine</th><th>Batch #</th><th>Qty</th><th>Status</th><th>Expiry</th></tr></thead>
                    <tbody>
                      {batches.map((b, i) => (
                        <tr key={i}>
                          <td>#{b[0]?.toString()}</td>
                          <td><strong>{b[1]}</strong></td>
                          <td><code style={{fontSize:11}}>{b[2]}</code></td>
                          <td>{b[4]?.toString()}</td>
                          <td><StatusBadge status={Number(b[9])} type="batch" /></td>
                          <td style={{fontSize:12}}>{fmtDate(b[6])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {tab === "transfer" && (
            <div className="card">
              <div className="card-header"><div className="card-title">📤 Transfer Stock to Pharmacy/Hospital</div></div>
              <div className="form-grid form-grid-2">
                <div className="form-group"><label className="form-label">Token ID *</label><input type="number" placeholder="e.g. 1" value={transferForm.tokenId} onChange={e=>setTransferForm({...transferForm,tokenId:e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Recipient Address *</label><input placeholder="0x…" value={transferForm.to} onChange={e=>setTransferForm({...transferForm,to:e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Location *</label><input placeholder="e.g. Kandy Pharmacy Hub" value={transferForm.location} onChange={e=>setTransferForm({...transferForm,location:e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Temperature (°C × 100)</label><input type="number" value={transferForm.temp} onChange={e=>setTransferForm({...transferForm,temp:e.target.value})} /><div className="form-hint">{(Number(transferForm.temp)/100).toFixed(1)}°C</div></div>
                <div className="form-group" style={{gridColumn:"1/-1"}}><label className="form-label">Notes</label><input placeholder="Transfer notes" value={transferForm.notes} onChange={e=>setTransferForm({...transferForm,notes:e.target.value})} /></div>
              </div>
              <button className="btn btn-primary" onClick={handleTransfer} disabled={loading}>📤 Transfer</button>
              <TxStatus msg={txMsg} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSPORTER DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function TransporterDashboard({ signer, account }) {
  const [tab, setTab] = useState("overview");
  const [batches, setBatches] = useState([]);
  const [txMsg, setTxMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [transferForm, setTransferForm] = useState({ tokenId:"", to:"", location:"", temp:"2500", notes:"" });
  const { tc } = useContracts(signer);

  useEffect(() => { loadBatches(); }, [tab]);

  async function loadBatches() {
    try {
      const ids = await tc.getHolderBatches(account);
      const list = await Promise.all(ids.map(id => tc.getBatch(id)));
      setBatches(list);
    } catch (e) { console.error(e); }
  }

  async function handleTransfer() {
    setLoading(true); setTxMsg("⏳ Transferring custody…");
    try {
      const tx = await tc.transferCustody(Number(transferForm.tokenId), transferForm.to, transferForm.location, Number(transferForm.temp), transferForm.notes || "Cold-chain transport completed");
      await tx.wait();
      setTxMsg("✅ Custody transferred!");
      setTransferForm({ tokenId:"", to:"", location:"", temp:"2500", notes:"" });
      loadBatches();
    } catch (e) { setTxMsg("❌ " + (e.reason || e.message)); }
    setLoading(false);
  }

  return (
    <div className="app-shell">
      <Sidebar role="TRANSPORTER" orgName="MediCold Transport Solutions" account={account}
        activeTab={tab} onTabChange={(t) => { setTab(t); setTxMsg(""); }}
        onLogout={() => window.location.reload()} />
      <div className="main-content">
        <div className="page-header">
          <div><div className="page-title">🚛 Transporter Dashboard</div><div className="page-sub">Cold-Chain Transport & Custody Management</div></div>
          <button className="btn btn-ghost btn-sm" onClick={loadBatches}>🔄 Refresh</button>
        </div>
        <div className="page-body">
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-icon">🚛</div><div className="stat-num">{batches.length}</div><div className="stat-label">Batches in Transit</div></div>
            <div className="stat-card"><div className="stat-icon">❄️</div><div className="stat-num">{batches.filter(b=>b[10]).length}</div><div className="stat-label">Cold Chain Batches</div></div>
          </div>
          {(tab === "overview" || tab === "batches") && (
            <div className="card">
              <div className="card-header"><div className="card-title">🚛 In My Custody ({batches.length})</div></div>
              {batches.length === 0 ? <EmptyState icon="🚛" text="No batches in custody for transport" /> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Token ID</th><th>Medicine</th><th>Qty</th><th>Cold Chain</th><th>Temp Range</th><th>Status</th></tr></thead>
                    <tbody>
                      {batches.map((b, i) => (
                        <tr key={i}>
                          <td>#{b[0]?.toString()}</td>
                          <td><strong>{b[1]}</strong></td>
                          <td>{b[4]?.toString()}</td>
                          <td>{b[10] ? <Badge color="#f59e0b">❄️ Required</Badge> : "—"}</td>
                          <td style={{fontSize:12}}>{b[10] ? `${(Number(b[11])/100).toFixed(1)}°C – ${(Number(b[12])/100).toFixed(1)}°C` : "Room temp"}</td>
                          <td><StatusBadge status={Number(b[9])} type="batch" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {tab === "transfer" && (
            <div className="card">
              <div className="card-header"><div className="card-title">📤 Transfer Custody on Delivery</div></div>
              <div className="alert alert-warning" style={{ marginBottom: 16 }}>
                ❄️ For cold-chain batches, ensure the recorded temperature is within the allowed range before transferring.
              </div>
              <div className="form-grid form-grid-2">
                <div className="form-group"><label className="form-label">Token ID *</label><input type="number" placeholder="e.g. 1" value={transferForm.tokenId} onChange={e=>setTransferForm({...transferForm,tokenId:e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Delivery Address *</label><input placeholder="0x… (Pharmacy or Hospital)" value={transferForm.to} onChange={e=>setTransferForm({...transferForm,to:e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Delivery Location *</label><input placeholder="e.g. Colombo National Hospital Pharmacy" value={transferForm.location} onChange={e=>setTransferForm({...transferForm,location:e.target.value})} /></div>
                <div className="form-group">
                  <label className="form-label">Recorded Temperature (°C × 100) *</label>
                  <input type="number" value={transferForm.temp} onChange={e=>setTransferForm({...transferForm,temp:e.target.value})} />
                  <div className="form-hint">Currently: {(Number(transferForm.temp)/100).toFixed(1)}°C — Must be within batch range</div>
                </div>
                <div className="form-group" style={{gridColumn:"1/-1"}}><label className="form-label">Transport Notes</label><input placeholder="e.g. Delivered in refrigerated container, temp maintained 4–6°C throughout" value={transferForm.notes} onChange={e=>setTransferForm({...transferForm,notes:e.target.value})} /></div>
              </div>
              <button className="btn btn-primary" onClick={handleTransfer} disabled={loading}>📤 Complete Delivery</button>
              <TxStatus msg={txMsg} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PATIENT DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function PatientDashboard({ signer, account }) {
  const [tab, setTab] = useState("verify");
  const [verifyInput, setVerifyInput] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [trackInput, setTrackInput] = useState("");
  const [custody, setCustody] = useState([]);
  const [batchInfo, setBatchInfo] = useState(null);
  const { tc } = useContracts(signer);

  async function handleVerify() {
    setLoading(true); setVerifyResult(null);
    try {
      const qrHash = ethers.id(verifyInput);
      const result = await tc.verifyByQR(qrHash);
      const res = {
        tokenId: Number(result[0]),
        isAuthentic: result[1],
        medicineName: result[2],
        batchNumber: result[3],
        status: Number(result[4]),
        expiryDate: Number(result[5]),
      };
      setVerifyResult(res);
      if (res.tokenId > 0) {
        const b = await tc.getBatch(res.tokenId);
        setBatchInfo(b);
      }
    } catch (e) { setVerifyResult({ isAuthentic: false, error: e.message }); }
    setLoading(false);
  }

  async function handleTrack() {
    if (!trackInput) return;
    setLoading(true);
    try {
      const b = await tc.getBatch(Number(trackInput));
      setBatchInfo(b);
      const hist = await tc.getCustodyHistory(Number(trackInput));
      setCustody(hist);
    } catch (e) { setBatchInfo(null); setCustody([]); }
    setLoading(false);
  }

  return (
    <div className="app-shell">
      <Sidebar role="PATIENT" orgName="Patient — Light Client" account={account}
        activeTab={tab} onTabChange={(t) => { setTab(t); setVerifyResult(null); setCustody([]); setBatchInfo(null); }}
        onLogout={() => window.location.reload()} />
      <div className="main-content">
        <div className="page-header">
          <div><div className="page-title">🔍 Medicine Verification</div><div className="page-sub">Verify your medicine is authentic and safe</div></div>
        </div>
        <div className="page-body">

          {tab === "verify" && (
            <>
              <div className="card">
                <div className="card-header"><div className="card-title">🔍 Verify Medicine Authenticity</div></div>
                <div className="alert alert-info" style={{ marginBottom: 16 }}>
                  📱 Scan the QR code on your medicine packaging, or enter the QR payload string manually to verify authenticity on the blockchain.
                </div>
                <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                  <input placeholder="Enter QR payload (e.g. QR-PCM-2025-001-1234567890)" value={verifyInput} onChange={e => setVerifyInput(e.target.value)} />
                  <button className="btn btn-primary" onClick={handleVerify} disabled={loading || !verifyInput} style={{ whiteSpace: "nowrap" }}>
                    {loading ? "⏳…" : "🔍 Verify"}
                  </button>
                </div>

                {verifyResult && (
                  <div className={verifyResult.isAuthentic ? "qr-result-authentic" : "qr-result-fake"}>
                    <div className="qr-icon">{verifyResult.isAuthentic ? "✅" : "❌"}</div>
                    <div style={{ textAlign: "center", fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, marginBottom: 16 }}>
                      {verifyResult.isAuthentic ? "GENUINE MEDICINE" : "UNVERIFIED — DO NOT USE"}
                    </div>
                    {verifyResult.isAuthentic && batchInfo ? (
                      <>
                        <div className="info-grid">
                          <div className="info-item"><div className="info-key">Medicine Name</div><div className="info-val">{batchInfo[1]}</div></div>
                          <div className="info-item"><div className="info-key">Generic Name</div><div className="info-val">{batchInfo[3]}</div></div>
                          <div className="info-item"><div className="info-key">Batch Number</div><div className="info-val"><code>{batchInfo[2]}</code></div></div>
                          <div className="info-item"><div className="info-key">Expiry Date</div><div className="info-val">{fmtDate(batchInfo[6])}</div></div>
                          <div className="info-item"><div className="info-key">Status</div><div className="info-val"><StatusBadge status={Number(batchInfo[9])} type="batch" /></div></div>
                          <div className="info-item"><div className="info-key">Cold Chain</div><div className="info-val">{batchInfo[10] ? "❄️ Required (maintained)" : "✓ Not required"}</div></div>
                          <div className="info-item"><div className="info-key">Manufacturer</div><div className="info-val"><code style={{fontSize:11}}>{fmtAddr(batchInfo[7])}</code></div></div>
                          <div className="info-item"><div className="info-key">Token ID</div><div className="info-val">#{verifyResult.tokenId}</div></div>
                        </div>
                        <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "var(--text2)" }}>
                          This medicine has been verified on the Sri Lanka Pharmaceutical Blockchain.
                          All information is tamper-proof and immutable.
                        </div>
                      </>
                    ) : !verifyResult.isAuthentic && (
                      <div style={{ textAlign: "center" }}>
                        <div style={{ color: "var(--red)", fontSize: 14, marginBottom: 8 }}>
                          ⚠️ This QR code was not found in the blockchain registry.
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text2)" }}>
                          Do not use this medicine. Report to NMRA immediately:<br />
                          <strong>NMRA Hotline: +94 11 2 687733</strong>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="card">
                <div className="card-header"><div className="card-title">ℹ️ How to Verify Your Medicine</div></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[
                    ["📱 Step 1", "Find the QR code on your medicine packaging or box."],
                    ["🔤 Step 2", "Enter the QR payload text in the verification field above."],
                    ["🔗 Step 3", "Click Verify — the blockchain is queried instantly."],
                    ["✅ Step 4", "If authentic, all details are displayed. If not, call NMRA."],
                  ].map(([title, text], i) => (
                    <div key={i} style={{ background: "var(--bg3)", borderRadius: "var(--radius-xs)", padding: 14, border: "1px solid var(--border)" }}>
                      <div style={{ fontWeight: 700, color: "var(--accent)", marginBottom: 4 }}>{title}</div>
                      <div style={{ fontSize: 13, color: "var(--text2)" }}>{text}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === "track" && (
            <div className="card">
              <div className="card-header"><div className="card-title">🗺️ Track Medicine Journey</div></div>
              <div className="alert alert-info" style={{ marginBottom: 16 }}>
                Enter the batch Token ID (from your verification result) to see the complete custody journey of your medicine.
              </div>
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <input type="number" placeholder="Batch Token ID (e.g. 1)" value={trackInput} onChange={e => setTrackInput(e.target.value)} style={{ maxWidth: 200 }} />
                <button className="btn btn-primary" onClick={handleTrack} disabled={loading || !trackInput}>🗺️ Track Journey</button>
              </div>
              {batchInfo && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{batchInfo[1]} — Batch #{batchInfo[2]}</div>
                </div>
              )}
              {custody.length > 0 && (
                <div>
                  {custody.map((c, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--accent-glow)", border: "1px solid rgba(79,142,247,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>{i+1}</div>
                        {i < custody.length - 1 && <div style={{ width: 1, flex: 1, background: "var(--border)", marginTop: 4 }} />}
                      </div>
                      <div style={{ flex: 1, background: "var(--bg3)", borderRadius: "var(--radius-xs)", padding: 12, marginBottom: 4, border: "1px solid var(--border)" }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{c[3] || "Transfer"}</div>
                        <div style={{ fontSize: 12, color: "var(--text2)" }}>
                          <span>{fmtAddr(c[0])} → {fmtAddr(c[1])}</span>
                          <span style={{ marginLeft: 12 }}>🌡️ {(Number(c[4])/100).toFixed(1)}°C</span>
                          <span style={{ marginLeft: 12 }}>📅 {fmtDate(c[2])}</span>
                        </div>
                        {c[5] && <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>{c[5]}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UNAUTHORIZED
// ─────────────────────────────────────────────────────────────────────────────
function Unauthorized({ role, onLogout }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🚫</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Access Restricted</div>
        <div style={{ color: "var(--text2)", marginBottom: 24 }}>
          Role <strong>{role || "UNKNOWN"}</strong> does not have a dedicated dashboard yet, or this account is not registered in the blockchain.
        </div>
        <button className="btn btn-primary" onClick={onLogout}>🔄 Try Another Account</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => { injectCSS(); }, []);

  function handleLogin(userData) {
    setUser(userData);
  }

  function handleLogout() {
    setUser(null);
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const { role, account, orgName, signer } = user;

  const commonProps = { signer, account, orgName };

  switch (role) {
    case "NMRA":         return <NMRADashboard {...commonProps} />;
    case "SPC":          return <SPCDashboard {...commonProps} />;
    case "MSD":          return <MSDDashboard {...commonProps} />;
    case "MANUFACTURER": return <ManufacturerDashboard {...commonProps} role="MANUFACTURER" />;
    case "IMPORTER":     return <ManufacturerDashboard {...commonProps} role="IMPORTER" />;
    case "WHOLESALER":   return <WholesalerDashboard {...commonProps} />;
    case "PHARMACY":     return <PharmacyHospitalDashboard {...commonProps} role="PHARMACY" />;
    case "HOSPITAL":     return <PharmacyHospitalDashboard {...commonProps} role="HOSPITAL" />;
    case "TRANSPORTER":  return <TransporterDashboard {...commonProps} />;
    case "PATIENT":      return <PatientDashboard {...commonProps} />;
    default:             return <Unauthorized role={role} onLogout={handleLogout} />;
  }
}