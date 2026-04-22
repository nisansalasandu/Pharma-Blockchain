# ⚕ AI-Powered Predictive Blockchain Architecture for Proactive and Locally-Adaptive Pharmaceutical Supply Chain Management in Sri Lanka

<div align="center">

[![Solidity](https://img.shields.io/badge/Solidity-0.8.28-363636?style=for-the-badge&logo=solidity)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-2.19.4-f7dc6f?style=for-the-badge&logo=ethereum)](https://hardhat.org/)
[![React](https://img.shields.io/badge/React-18.2.0-61dafb?style=for-the-badge&logo=react)](https://react.dev/)
[![ethers.js](https://img.shields.io/badge/ethers.js-6.9.0-2535a0?style=for-the-badge)](https://ethers.org/)
[![Python](https://img.shields.io/badge/Python-3.11-3776ab?style=for-the-badge&logo=python)](https://python.org/)
[![TensorFlow](https://img.shields.io/badge/TensorFlow-2.14.0-ff6f00?style=for-the-badge&logo=tensorflow)](https://tensorflow.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

**Bachelor of Science Honours in IT and Management**  
Information Technology Service Center · Faculty of Science · University of Colombo  
*Supervisor: Dr. Prabhath Liyanage · March 2026*

**Author: Ruwan Pathiranage Sanduni Nisansala (s16162)**

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Research Contribution](#-research-contribution)
- [System Architecture](#-system-architecture)
- [Smart Contracts](#-smart-contracts)
- [AI Model (LSTM)](#-ai-model-lstm)
- [Stakeholder Dashboards](#-stakeholder-dashboards)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Ganache Setup](#-ganache-setup)
- [MetaMask Setup](#-metamask-setup)
- [Deploying Contracts](#-deploying-contracts)
- [Running the System](#-running-the-system)
- [Using the Frontend](#-using-the-frontend)
- [Demo Scenarios](#-demo-scenarios)
- [Running Tests](#-running-tests)
- [Performance Benchmarks](#-performance-benchmarks)
- [Account Mapping](#-account-mapping)
- [Contract Addresses](#-contract-addresses)
- [API Reference](#-api-reference)
- [Troubleshooting](#-troubleshooting)
- [Technology Stack](#-technology-stack)

---

## 🔬 Overview

This system implements a **permissioned blockchain** for Sri Lanka's pharmaceutical supply chain, addressing critical national issues including drug shortages, counterfeit medicines, cold-chain failures, and ineffective emergency response. The architecture integrates:

- **5 Solidity smart contracts** on a private Ethereum network (Ganache)
- **LSTM neural network** for real-time pharmaceutical risk prediction
- **AI-triggered dynamic consensus switching** between PoA and PBFT
- **8 role-based React dashboards** for all supply chain stakeholders
- **NFT-based batch tracking** from manufacturer to patient
- **Patient QR verification** without requiring a blockchain wallet

Sri Lanka's pharmaceutical distribution network serves **22 million people** through the State Pharmaceuticals Corporation (SPC) and Medical Supplies Division (MSD), regulated by the National Medicines Regulatory Authority (NMRA). This system provides the transparency, automation, and predictive capability needed for modern pharmaceutical governance.

---

## 🏆 Research Contribution

> **World-first implementation of AI-driven dynamic consensus switching in blockchain.**

The primary innovation is the `ConsensusAdapter` smart contract, which records and enforces transitions between two consensus mechanisms based on real-time LSTM risk scores:

| Condition | Consensus | Characteristics |
|-----------|-----------|-----------------|
| Risk score ≤ 800 / 1000 | **Proof of Authority (PoA)** | Fast · Instant finality · Low overhead |
| Risk score > 800 / 1000 | **Practical Byzantine Fault Tolerance (PBFT)** | Byzantine fault tolerant · 2-of-3 validator majority |

**Performance results (from Chapter 4 benchmarks):**
- Sub-100ms transaction finality for all standard operations
- **654 orders per minute** throughput
- Average gas consumption: **350,000 gas per order workflow**
- PBFT full cycle (3 validators): **~325ms**
- 138 unit + integration tests · **100% pass rate**
- LSTM R² score: **0.924**

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER LAYER (Stakeholders)                     │
│  NMRA · SPC · MSD · Manufacturer · Pharmacy · Hospital · Patient    │
└────────────────────────────┬────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                     FRONTEND LAYER (React 18 + Vite)                 │
│         8 Role-Based Dashboards · MetaMask Integration               │
│         ethers.js v6 · http://localhost:3000                         │
└──────────┬─────────────────────────────────────┬────────────────────┘
           │                                     │
┌──────────▼──────────┐             ┌────────────▼──────────────────┐
│   AI ORACLE LAYER   │             │      BLOCKCHAIN LAYER          │
│   Python LSTM Model │──HTTP POST──▶  Ganache Private Network        │
│   oracle_server.js  │◀────────────│  Chain ID 1337 · Port 7545     │
│   Port 3001         │  Web3 calls │                                 │
└─────────────────────┘             │  ┌─────────────────────────┐   │
                                    │  │  RoleAccessControl       │   │
                                    │  │  TraceabilityContract    │   │
                                    │  │  OrderingContract        │   │
                                    │  │  PredictiveAIOracle      │   │
                                    │  │  ConsensusAdapter        │   │
                                    │  └─────────────────────────┘   │
                                    └───────────────────────────────┘
```

**Data Flow for an Order:**
```
Pharmacy places order
    → OrderingContract (status: AI_REVIEW)
    → Oracle server detects OrderPlaced event
    → LSTM model evaluates medicine risk
    → setRiskScore() called on OrderingContract

Risk ≤ 800 → status: PENDING → SPC/MSD approves (PoA)
Risk > 800 → status: EMERGENCY → ConsensusAdapter.switchToPBFT()
           → 3 validators castVote() → NMRA approveEmergencyOrder()
           → ConsensusAdapter.restorePoA()
```

---

## 📄 Smart Contracts

All contracts compiled with Solidity **0.8.28**, optimizer enabled (200 runs), `viaIR: true`.

### 1. `RoleAccessControl.sol` (270 lines)

The authentication and authorization foundation for the entire system. All other contracts call this for permission checks.

**Roles (stored as `bytes32` keccak256 hashes):**

| Role | Constant | Authority |
|------|----------|-----------|
| NMRA | `ROLE_NMRA` | Top regulator — grants/revokes all roles |
| SPC | `ROLE_SPC` | Government importer — PoA Validator #2 |
| MSD | `ROLE_MSD` | Government distributor — PoA Validator #3 |
| MANUFACTURER | `ROLE_MANUFACTURER` | Creates NFT medicine batches |
| IMPORTER | `ROLE_IMPORTER` | Licensed private importer |
| WHOLESALER | `ROLE_WHOLESALER` | Distributes to private pharmacies |
| PHARMACY | `ROLE_PHARMACY` | Retail pharmacy — places orders to SPC |
| HOSPITAL | `ROLE_HOSPITAL` | Hospital pharmacy — places orders to MSD |
| TRANSPORTER | `ROLE_TRANSPORTER` | Cold-chain logistics provider |
| PATIENT | `ROLE_PATIENT` | Read-only QR verification light client |

**Key functions:**

```solidity
grantRole(address, bytes32 role, string orgName, uint256 expiry) // NMRA only
revokeRole(address)                                               // NMRA only
issueLicense(address, string licenseNumber, uint256 validDays)   // NMRA only
getMember(address) returns (bytes32, string, bool, address, uint256, uint256)
isActiveRole(address, bytes32 role) returns (bool)
```

**Deployment gas:** 1,623,281 gas · ~127ms

---

### 2. `TraceabilityContract.sol` (342 lines)

NFT-based batch tracking using a custom ERC-721-style implementation. Every medicine batch from manufacture to patient dispensing is recorded immutably on-chain.

**Batch lifecycle states:**
```
MANUFACTURED → IN_TRANSIT → AT_WAREHOUSE → AT_PHARMACY / AT_HOSPITAL → DISPENSED
                                                         ↓
                                                      RECALLED
```

**Key functions:**

```solidity
mintBatch(BatchParams calldata p) returns (uint256 tokenId)
// BatchParams: medicineName, batchNumber, genericName, quantity,
//              expiryDate, coldChainRequired, minTemp, maxTemp,
//              qrPayload, ipfsCert

transferCustody(uint256 tokenId, address to, string location, int256 temp, string notes)
// Validates cold chain temperature before accepting transfer

verifyByQR(bytes32 qrHash) external view returns (VerifyResult)
// Patient verification — free call, no gas required
// VerifyResult: { tokenId, isAuthentic, medicineName, batchNumber, status, expiryDate }

recallBatch(uint256 tokenId, string reason)  // NMRA only
getBatch(uint256 tokenId) returns (Batch)
getCustodyHistory(uint256 tokenId) returns (CustodyRecord[])
```

> **Cold chain encoding:** Temperatures stored as `int256` scaled by 100.  
> Example: 2°C = 200, 8°C = 800, 25°C = 2500.  
> The `transferCustody` function **reverts** if `recordedTemp` is outside `[minTemp, maxTemp]`.

> **QR hash:** `keccak256(abi.encodePacked(qrPayload))` — matches `ethers.id(qrPayload)` in the frontend for seamless patient verification.

**Deployment gas:** 2,146,895 gas · ~198ms

---

### 3. `OrderingContract.sol` (309 lines)

Manages pharmaceutical procurement with AI-driven risk routing. The central innovation is the automatic routing of orders to either standard PoA or PBFT emergency consensus.

**Order status lifecycle:**
```
AI_REVIEW → PENDING (risk ≤ 800) → APPROVED → FULFILLED
          → EMERGENCY (risk > 800) → APPROVED (post-PBFT) → FULFILLED
                                   → REJECTED
          → CANCELLED (by placer)
```

**Key functions:**

```solidity
placeOrder(address supplier, string medicineName, string genericName,
           uint256 quantity, uint256 unitPriceWei, string urgencyReason)
           returns (uint256 orderId)
// Only PHARMACY or HOSPITAL role

setRiskScore(uint256 orderId, uint256 score)
// Called by AI oracle (or NMRA for demo override)
// score > 800 → EMERGENCY + totalEmergencyOrders++
// score ≤ 800 → PENDING

approveOrder(uint256 orderId)          // SPC or MSD — for PENDING orders
approveEmergencyOrder(uint256 orderId) // NMRA only — after PBFT consensus
fulfillOrder(uint256 orderId)          // SPC or MSD — after APPROVED
rejectOrder(uint256 orderId, string reason)
cancelOrder(uint256 orderId)           // placer only — PENDING, AI_REVIEW, or EMERGENCY

getOrdersByPlacer(address) returns (uint256[])
getOrdersForSupplier(address) returns (uint256[])
```

**Emergency threshold:** `EMERGENCY_THRESHOLD = 800` (constant)

**Deployment gas:** 2,265,669 gas · ~215ms

---

### 4. `PredictiveAIOracle.sol` (173 lines)

On-chain storage for LSTM model predictions. Acts as the bridge between off-chain AI computation and on-chain smart contract decision-making.

**Prediction data stored per medicine:**

| Field | Range | Description |
|-------|-------|-------------|
| `stockDepletionRisk` | 0–1000 | Probability of stock running out |
| `demandForecast` | units | Predicted weekly demand |
| `coldChainRisk` | 0–1000 | Temperature violation probability |
| `counterfeitRisk` | 0–1000 | Counterfeit detection risk |
| `overallRisk` | 0–1000 | Combined LSTM output — used for order routing |

**Key functions:**

```solidity
submitPrediction(string medicine, uint256 stockRisk, uint256 demandForecast,
                 uint256 coldChainRisk, uint256 counterfeitRisk, uint256 overallRisk)
// Only oracle operator

getPrediction(string medicine) returns (Prediction)
getRiskScore(string medicine) returns (uint256)
getTrackedMedicines() returns (string[])
isStale(string medicine, uint256 maxAgeSeconds) returns (bool)
```

**Deployment gas:** 920,109 gas · ~89ms

---

### 5. `ConsensusAdapter.sol` (266 lines)

The primary research contribution. Records and enforces AI-triggered transitions between PoA and PBFT consensus on-chain, creating an immutable audit trail that proves consensus integrity.

**Consensus modes:**
```
ConsensusMode.POA  (0) — normal operations
ConsensusMode.PBFT (1) — high-risk emergency operations
```

**Switch reasons:**
```
HIGH_RISK_ORDER (0)   — LSTM score > 800
EMERGENCY_RECALL (1)  — NMRA batch recall
VALIDATOR_FAULT (2)   — validator node offline
MANUAL_OVERRIDE (3)   — NMRA manual trigger
RESOLVED (4)          — returning to PoA
```

**PBFT validators:** NMRA (index 0) · SPC (index 1) · MSD (index 2)  
**Consensus threshold:** 2-of-3 votes required (Byzantine fault tolerant — tolerates 1 faulty validator)

**Key functions:**

```solidity
switchToPBFT(uint256 triggerId, uint256 riskScore, SwitchReason reason)
// NMRA only — triggers PBFT mode for a high-risk order

castVote(uint256 eventId, bool approve, bytes32 dataHash)
// Only NMRA, SPC, or MSD — casts a validator vote

restorePoA(uint256 eventId)
// NMRA only — returns to PoA after PBFT resolution

getCurrentMode() returns (ConsensusMode)
getActiveEventId() returns (uint256)
getEvent(uint256 eventId) returns (ConsensusEvent)
getVote(uint256 eventId, address validator) returns (ValidatorVote)
isInPBFT() returns (bool)
```

**Deployment gas:** 1,098,206 gas · ~103ms

---

## 🧠 AI Model (LSTM)

**File:** `ai_model/lstm_model.py` (388 lines)

### Architecture

```
Input: 12-week sequence × 6 features per time step
    ↓
LSTM Layer 1 (64 units, return_sequences=True)
    ↓
Dropout (0.2)
    ↓
LSTM Layer 2 (32 units)
    ↓
Dropout (0.2)
    ↓
Dense (16 units, ReLU)
    ↓
Output: 5 sigmoid units → [stockRisk, demandForecast, coldChainRisk, counterfeitRisk, overallRisk]
```

### Training Data

The model trains on **synthetic Sri Lankan pharmaceutical data** (8 medicines × ~500 daily data points = 4,000 time series records) with realistic patterns:

- Weekly cycles (increased pharmacy visits on weekends)
- Seasonal cycles (antibiotic demand spikes in flu season)
- Outbreak simulations (dengue, COVID-19 scenarios)
- Cold chain violation events (2–5% of shipments)
- Import delay patterns (monthly cycles)

### Tracked Medicines

| Medicine | Cold Chain | Base Stock | Base Demand |
|----------|-----------|------------|-------------|
| Paracetamol | No | 500,000 | 45,000/week |
| Amoxicillin | No | 120,000 | 12,000/week |
| Metformin | No | 80,000 | 8,500/week |
| Insulin | **Yes** (2–8°C) | 15,000 | 3,200/week |
| Amlodipine | No | 95,000 | 9,800/week |
| Atorvastatin | No | 70,000 | 7,200/week |
| Salbutamol | No | 45,000 | 4,100/week |
| Omeprazole | No | 60,000 | 6,300/week |

### Performance Metrics

| Dataset | MSE | MAE | R² |
|---------|-----|-----|----|
| Training | 0.0042 | 0.0521 | 0.9312 |
| Validation | 0.0051 | 0.0567 | 0.9187 |
| Test | 0.0048 | 0.0553 | **0.924** |

### Simulation Mode

If TensorFlow is not installed, the model runs in **simulation mode** — it generates realistic synthetic predictions using statistical methods and sends them to the oracle. All blockchain and frontend features work identically in simulation mode.

---

## 🖥 Stakeholder Dashboards

The React frontend (`frontend/src/App.jsx` — 2,240 lines) provides 8 role-based dashboards with automatic role detection from the blockchain.

| Dashboard | Role | Key Features |
|-----------|------|-------------|
| **NMRA** | Regulator | Grant/revoke roles · Issue licenses · Recall batches · Full consensus control · Emergency order approval · AI Monitor tab |
| **SPC** | Gov Distributor | Approve/fulfill pharmacy orders · PBFT Validator #2 voting |
| **MSD** | Gov Emergency | Hospital order management · Emergency PBFT voting · Fulfill approved orders |
| **Manufacturer** | Batch Creator | Mint NFT batches (with cold chain params) · Transfer custody · View batch history |
| **Importer** | Private Importer | Same as Manufacturer |
| **Wholesaler** | Distributor | Stock management · Transfer to pharmacies |
| **Pharmacy** | Retail Pharmacy | Place orders to SPC · Track order status · QR verification |
| **Hospital** | Hospital Pharmacy | Place emergency orders to MSD · Track orders · QR verification |
| **Transporter** | Cold Chain | View batches in custody · Complete deliveries with temperature recording |
| **Patient** | Light Client | QR verification (no wallet needed) · Medicine journey tracking |

**Login:** Wallet address → `RoleAccessControl.getMember()` → role detected → correct dashboard loaded automatically.

**Patient access:** Click "Verify Medicine as Patient" on login screen — uses a read-only provider connected to Ganache, no MetaMask required.

---

## 📁 Project Structure

```
Pharma-Blockchain/
│
├── contracts/                          # Solidity smart contracts
│   ├── RoleAccessControl.sol           # Authentication & authorisation (270 lines)
│   ├── TraceabilityContract.sol        # NFT batch tracking & cold chain (342 lines)
│   ├── OrderingContract.sol            # Procurement & AI risk routing (309 lines)
│   ├── PredictiveAIOracle.sol          # LSTM prediction storage (173 lines)
│   └── ConsensusAdapter.sol            # PoA ↔ PBFT switching (266 lines)
│
├── scripts/
│   ├── deploy-phase2.js                # Deploy RoleAccessControl + TC + OC + grant all roles
│   ├── deploy-phase3.js                # Deploy PredictiveAIOracle + ConsensusAdapter
│   ├── demo-scenario1.js               # Standard PoA procurement (Paracetamol)
│   ├── demo-scenario2.js               # Emergency PBFT procurement (Insulin)
│   ├── demo-phase3.js                  # Full AI + PBFT switching demo
│   └── benchmark.js                    # Performance benchmarks → benchmark-results.json
│
├── test/
│   ├── 01_RoleAccessControl.test.js    # 23 unit tests
│   ├── 02_TraceabilityContract.test.js # 36 unit tests
│   ├── 03_OrderingContract.test.js     # 34 unit tests
│   ├── 04_Phase3Contracts.test.js      # 42 unit tests
│   └── 05_Integration.test.js          # 28 end-to-end tests
│                                       # Total: 163 tests · 100% pass rate
│
├── pbft_coordinator/
│   └── oracle_server.js                # AI bridge + PBFT coordinator (310 lines)
│                                       # Listens on port 3001
│
├── ai_model/
│   ├── lstm_model.py                   # LSTM training + prediction loop (388 lines)
│   ├── requirements.txt                # Python dependencies
│   └── latest_predictions.json         # Last prediction cache
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                     # Complete React app — all 8 dashboards (2,240 lines)
│   │   ├── main.jsx                    # React entry point
│   │   └── contracts/
│   │       ├── addresses.json          # Deployed contract addresses
│   │       └── abis/                   # Contract ABIs
│   ├── package.json
│   └── vite.config.js                  # Vite dev server on port 3000
│
├── artifacts/                          # Compiled contract artifacts (auto-generated)
├── hardhat.config.js                   # Hardhat config — Solidity 0.8.28 + Ganache network
├── deployment-phase2.json              # Phase 2 deployment record
├── deployment-phase3.json              # Phase 3 deployment record (all 5 contracts)
├── ACCOUNT_MAPPING.md                  # Ganache account → role mapping
└── package.json                        # Root Node.js dependencies
```

---

## 💻 Prerequisites

Install these tools before starting:

| Tool | Version | Purpose | Download |
|------|---------|---------|----------|
| **Node.js** | v20 or higher | Hardhat, Oracle Server, Frontend | https://nodejs.org |
| **Python** | 3.11 | LSTM model | https://python.org |
| **Ganache Desktop** | Latest | Local Ethereum blockchain | https://trufflesuite.com/ganache |
| **MetaMask** | Latest | Browser wallet | Chrome Web Store |

Verify your installations:
```bash
node --version    # should print v20.x.x or higher
python --version  # should print Python 3.11.x
```

---

## 🔧 Installation

### 1. Clone the repository

```bash
git clone https://github.com/nisansalasandu/pharma-blockchain.git
cd pharma-blockchain
```

### 2. Install root (Hardhat) dependencies

```bash
npm install
```

### 3. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

### 4. Install Python dependencies

```bash
cd ai_model
pip install -r requirements.txt
cd ..
```

> **Apple M1/M2 Mac:** Replace `tensorflow==2.14.0` with:
> ```bash
> pip install tensorflow-macos tensorflow-metal numpy pandas scikit-learn requests flask
> ```

> **TensorFlow not required:** The LSTM model runs in simulation mode if TensorFlow is not available. All blockchain and frontend features work identically.

---

## 🔗 Ganache Setup

Ganache must be configured with the **exact mnemonic** that matches the project's hardcoded account addresses.

### Create the Workspace

1. Open **Ganache Desktop**
2. Click **New Workspace** → **Ethereum**
3. Configure:

**WORKSPACE tab:**
- Workspace Name: `PharmaChain Sri Lanka`

**SERVER tab:**
- Hostname: `127.0.0.1`
- Port Number: **`7545`** ← critical, must be 7545 not 8545
- Network ID: **`1337`**
- Automine: **ON**
- Block Time: 1 second

**ACCOUNTS & KEYS tab:**
- Mnemonic: `tackle citizen maze bottom ignore lumber fold sleep manage possible exist hen`
- Total Accounts to Generate: **`10`**
- Default Ether: `1000`

4. Click **Save Workspace** → **Start**

### Verify Accounts

After starting, confirm these exact addresses appear in Ganache:

| # | Role | Address |
|---|------|---------|
| 0 | NMRA | `0x5289D9eD381d2C71Aa3C3ed124683A4ea3835b45` |
| 1 | SPC | `0x3eA889EfFb3235aEF9a99681466F4dB8298dF13F` |
| 2 | MSD | `0xFaf911e1597228bD6e1448DE4B8AB294CeA11D89` |
| 3 | Manufacturer 1 | `0x819d63d9794f1cfFb7cB772aeE07bc375c4F7BED` |
| 4 | Manufacturer 2 | `0x5720cEe08EFcDf02183c88D5ca42f6a5D3E5A226` |
| 5 | Importer | `0xD81274395E4980A557e9a54c1E56d58cD5f41Bc7` |
| 6 | Wholesaler | `0x2adac08d2f037062FF5Ecc5f2eE751dcF1bEc6D3` |
| 7 | Pharmacy | `0x18d838D7C2D5b79230deAA63AC3d5d9527C9770d` |
| 8 | Hospital | `0x0761Aac5768C8df6548B3f9F3C46e3166c16163C` |
| 9 | Transporter | `0x1e4fF0820e498392EBB78f817e96D2c8b6D6F2af` |

If addresses do not match → the mnemonic was entered incorrectly. Delete the workspace and repeat.

> ⚠️ **Every time you restart Ganache with a fresh/reset workspace, all deployed contracts are wiped and you must redeploy.** If you restart Ganache with the same workspace (same transaction history), contracts persist and you do not need to redeploy.

---

## 🦊 MetaMask Setup

### Add the Ganache Network

1. Open MetaMask → click **Networks** dropdown → **Add network manually**
2. Fill in:
   - **Network name:** `Ganache Local`
   - **New RPC URL:** `http://127.0.0.1:7545`
   - **Chain ID:** `1337`
   - **Currency symbol:** `ETH`
3. Click **Save**
4. Switch to **Ganache Local** network

### Import Accounts

You need to import at least these accounts to test all roles:

In Ganache Desktop → click the **key icon 🔑** next to each account to reveal its private key.

In MetaMask → click account circle (top right) → **Import account** → paste private key → **Import**

**Recommended imports for full demo:**
- Account 0 (NMRA)
- Account 1 (SPC)
- Account 2 (MSD)
- Account 3 (Manufacturer 1)
- Account 7 (Pharmacy)
- Account 8 (Hospital)

> 💡 **Label your accounts:** In MetaMask → click the account name → edit → rename to `NMRA`, `SPC`, etc. This makes switching between roles much easier.

> **Patients** do not need a MetaMask account — use the "Verify Medicine as Patient" button on the login screen.

---

## 🚀 Deploying Contracts

> Only required after a fresh Ganache workspace or reset. If your contracts are still deployed from a previous session, skip this section.

### Step 1 — Compile

```bash
npx hardhat compile
```

Expected output:
```
Compiled 5 Solidity files successfully
```

### Step 2 — Deploy Phase 2

Deploys RoleAccessControl, TraceabilityContract, and OrderingContract.  
Also **automatically grants roles to all 10 Ganache accounts**.

```bash
npx hardhat run scripts/deploy-phase2.js --network ganache
```

Expected output (final lines):
```
✅ State Pharmaceuticals Corporation     (SPC)
✅ Medical Supplies Division             (MSD)
✅ Lanka Pharmaceuticals Ltd             (Manufacturer 1)
✅ Ceylon Pharma Industries              (Manufacturer 2)
✅ Global Meds Import Agency             (Importer)
✅ National Medical Wholesalers          (Wholesaler)
✅ CareLife Pharmacy Chain               (Pharmacy)
✅ Colombo Teaching Hospital Pharmacy    (Hospital)
✅ MediCold Transport Solutions          (Transporter)
💾 Saved to: deployment-phase2.json
```

### Step 3 — Deploy Phase 3

Deploys PredictiveAIOracle and ConsensusAdapter.

```bash
npx hardhat run scripts/deploy-phase3.js --network ganache
```

Expected output (final lines):
```
✅ PredictiveAIOracle deployed at: 0x...
✅ ConsensusAdapter deployed at: 0x...
✅ Initial consensus mode: PoA (mode = 0)
💾 Saved to: deployment-phase3.json
```

### Step 4 — Update Frontend Addresses

After each fresh deployment the contract addresses change. Update them in two places:

**`frontend/src/contracts/addresses.json`:**
```json
{
  "RoleAccessControl":    "0x...",
  "TraceabilityContract": "0x...",
  "OrderingContract":     "0x...",
  "PredictiveAIOracle":   "0x...",
  "ConsensusAdapter":     "0x...",
  "networkId": 1337,
  "rpcUrl": "http://127.0.0.1:7545"
}
```

**`frontend/src/App.jsx`** (lines 22–28):
```javascript
const ADDRESSES = {
  RoleAccessControl:    "0x...",
  TraceabilityContract: "0x...",
  OrderingContract:     "0x...",
  PredictiveAIOracle:   "0x...",
  ConsensusAdapter:     "0x...",
};
```

Copy all values from `deployment-phase3.json`.

> **If Ganache was not reset** and your workspace still has the same transaction history → addresses have not changed → skip Step 4.

---

## ▶️ Running the System

You need **4 things running simultaneously** in separate terminals.

### Terminal 1 — Ganache Desktop

Open Ganache Desktop and click your **PharmaChain Sri Lanka** workspace to start it.  
Confirm it is running on port 7545.

---

### Terminal 2 — Oracle Server

```bash
# From the project root (Pharma-Blockchain/)
node pbft_coordinator/oracle_server.js
```

Expected output:
```
============================================================
🌐 SRI LANKA PHARMACHAIN — ORACLE & PBFT COORDINATOR
============================================================
📂 Loading deployment info...
   ✅ deployment-phase3.json loaded
   Oracle  : 0xf4938804F386C0be428aAdB70f5B10da99927F56
🔗 Connecting to Ganache at http://127.0.0.1:7545 ...
   ✅ Ganache is running
   ✅ NMRA: 0x5289D9eD381d2C71Aa3C3ed124683A4ea3835b45
   ✅ SPC:  0x3eA889EfFb3235aEF9a99681466F4dB8298dF13F
   ✅ MSD:  0xFaf911e1597228bD6e1448DE4B8AB294CeA11D89
   ✅ PredictiveAIOracle responding
   ✅ ConsensusAdapter responding — mode: PoA
👂 Listening for OrderPlaced events...
   ✅ Event listener active
🚀 Oracle server running at http://localhost:3001
```

**Leave this terminal running.** The oracle automatically sets AI risk scores when orders are placed.

The oracle also exposes REST endpoints:
```
GET  http://localhost:3001/predictions       # current LSTM predictions
GET  http://localhost:3001/consensus-status  # current PoA or PBFT mode
POST http://localhost:3001/manual-evaluate   # manually evaluate an order
POST http://localhost:3001/submit-prediction # LSTM model posts here
```

---

### Terminal 3 — LSTM AI Model *(optional but recommended)*

```bash
# From ai_model/ directory
cd ai_model
python lstm_model.py
```

Expected output (with TensorFlow):
```
✅ TensorFlow 2.14.0 loaded
🧠 SRI LANKA PHARMACHAIN — LSTM RISK PREDICTION MODEL
Mode      : TensorFlow LSTM
Medicines : 8
📚 Training LSTM model on all medicines...
  🧠 Training LSTM for paracetamol...  ✅ Final loss: 0.0042
  🧠 Training LSTM for insulin...      ✅ Final loss: 0.0013
  ...
✅ All 8 models trained.
🔄 Prediction Cycle #1  [14:30:00]
  paracetamol   overall=0.312  stock=0.210  demand=45021  ✅ LOW
  insulin       overall=0.851  stock=0.720  demand=3198   🚨 HIGH (PBFT!)
📡 Sent 8 predictions to oracle server
```

Expected output (simulation mode — TensorFlow not installed):
```
⚠️  TensorFlow not found — running in SIMULATION mode
⚡ Simulation mode active. Starting prediction loop...
🔄 Prediction Cycle #1  [14:30:00]
  paracetamol   overall=0.312  stock=0.210  demand=45021  ✅ LOW
  insulin       overall=0.541  stock=0.430  demand=3198   ⚠️  MEDIUM
📡 Sent to blockchain: paracetamol risk=312/1000
📡 Sent to blockchain: insulin risk=541/1000
```

**Leave this terminal running.** The model sends new predictions every ~5 minutes.  
Predictions appear in the NMRA → 🧠 AI Monitor tab.

---

### Terminal 4 — Frontend

```bash
# From the frontend/ directory
cd frontend
npm run dev
```

Expected output:
```
  VITE v5.0.8  ready in 312 ms
  ➜  Local:   http://localhost:3000/
```

The browser opens automatically. If not, go to **http://localhost:3000** in Chrome.

---

## 🌐 Using the Frontend

### Logging In

1. Go to `http://localhost:3000`
2. Make sure MetaMask is on the **Ganache Local** network (Chain ID 1337)
3. Click **🦊 Connect MetaMask** → approve the connection
4. Your role is detected automatically from the blockchain
5. The correct dashboard opens

**To switch roles:** Click **🚪 Logout** in the sidebar → switch MetaMask account → Connect again.

**For patients (no wallet):** Click **🔍 Verify Medicine as Patient (no wallet needed)** on the login screen.

### Dashboard Navigation

Each dashboard has a sidebar with tabs specific to that role. The active consensus mode (PoA or PBFT) is always shown in the header.

---

## 🎬 Demo Scenarios

### Scenario 1 — Standard PoA Procurement (Low Risk)

```
Paracetamol order from Pharmacy to SPC → AI risk 312/1000 → PoA approval
```

| Step | Account | Action |
|------|---------|--------|
| 1 | NMRA (Acc 0) | Login → Overview → confirm 10 members registered |
| 2 | Manufacturer 1 (Acc 3) | Mint Batch → Medicine: `Panadol 500mg` · Batch: `PCM-2026-001` · Qty: 50000 · QR: `PCM-2026-001:MFG1:BATCH001` |
| 3 | Manufacturer 1 | Transfer Custody → to SPC address · Temp: 2500 (25°C) |
| 4 | Pharmacy (Acc 7) | Place Order → `Panadol 500mg` · Qty: 1000 → status: AI_REVIEW |
| 5 | *Oracle auto* | Watch Terminal 2 → risk set in seconds → status: PENDING |
| 6 | SPC (Acc 1) | Pending Orders → Approve Order #1 |
| 7 | SPC | Fulfill Orders → Fulfill Order #1 |
| 8 | Patient | Logout → "Verify Medicine as Patient" → enter `PCM-2026-001:MFG1:BATCH001` → ✅ GENUINE |

> **QR Payload is case-sensitive.** Write down exactly what you typed in Step 2.

---

### Scenario 2 — Emergency PBFT Procurement (High Risk)

```
Insulin order from Hospital to MSD → AI risk 900/1000 → PBFT consensus → Emergency approval
```

| Step | Account | Action |
|------|---------|--------|
| 1 | Manufacturer 2 (Acc 4) | Mint Batch → Medicine: `Actrapid 100IU/mL` · Cold Chain: ✅ · Min: 200 · Max: 800 |
| 2 | Manufacturer 2 | Transfer Custody → to MSD address · Temp: 400 (4°C — within 2–8°C ✅) |
| 3 | Hospital (Acc 8) | Place Order → `Insulin (Regular)` · Qty: 2000 · Urgency: `URGENT: ICU depleted` |
| 4 | NMRA (Acc 0) | Consensus Mode → Set Risk Score → Order ID: 2 · Score: 900 |
| 5 | NMRA | Switch to PBFT → Order ID: 2 · Score: 900 · Reason: HIGH_RISK_ORDER |
| 6 | NMRA | PBFT Vote → Event ID: 1 → ✅ Approve |
| 7 | SPC (Acc 1) | PBFT Vote tab → Event ID: 1 → ✅ Vote APPROVE |
| 8 | MSD (Acc 2) | Emergency Orders → Event ID: 1 → ✅ Vote APPROVE (3/3 consensus ✓) |
| 9 | NMRA | Emergency Orders → ✅ Approve Emergency on Order #2 |
| 10 | NMRA | Consensus Mode → ⚙️ Restore PoA |
| 11 | MSD | Fulfill Orders → Fulfill Order #2 |

> **Oracle conflict:** If the oracle server auto-handles PBFT before you click, stop it with Ctrl+C and redo Step 3 onward manually. Or use `demo-phase3.js` for the fully automated version.

---

### Automated Demo Scripts

These scripts run complete scenarios automatically without needing the UI:

```bash
# Scenario 1: Standard PoA procurement (Paracetamol)
npx hardhat run scripts/demo-scenario1.js --network ganache

# Scenario 2: Emergency PBFT procurement (Insulin) — real PBFT contract calls
npx hardhat run scripts/demo-scenario2.js --network ganache

# Phase 3: Full AI Oracle + PBFT switching (most comprehensive)
npx hardhat run scripts/demo-phase3.js --network ganache

# Performance benchmarks
npx hardhat run scripts/benchmark.js --network ganache
```

---

## 🧪 Running Tests

```bash
# Run all 163 unit and integration tests
npx hardhat test --network ganache

# Run a specific test file
npx hardhat test test/01_RoleAccessControl.test.js --network ganache
npx hardhat test test/02_TraceabilityContract.test.js --network ganache
npx hardhat test test/03_OrderingContract.test.js --network ganache
npx hardhat test test/04_Phase3Contracts.test.js --network ganache
npx hardhat test test/05_Integration.test.js --network ganache

# Run with gas report
REPORT_GAS=true npx hardhat test --network ganache
```

Expected output:
```
  RoleAccessControl
    ✔ should deploy with NMRA role assigned to deployer (245ms)
    ✔ should set deployer as nmraAddress
    ...

  163 passing (14s)
```

### Test Coverage

| File | Tests | Coverage |
|------|-------|----------|
| `01_RoleAccessControl.test.js` | 23 | 12/12 functions |
| `02_TraceabilityContract.test.js` | 36 | 15/15 functions |
| `03_OrderingContract.test.js` | 34 | 14/14 functions |
| `04_Phase3Contracts.test.js` | 42 | 16/16 functions |
| `05_Integration.test.js` | 28 | End-to-end flows |
| **Total** | **163** | **100% pass rate** |

---

## 📊 Performance Benchmarks

Run the benchmark script to reproduce Chapter 4 results:

```bash
npx hardhat run scripts/benchmark.js --network ganache
# Results saved to: benchmark-results.json
```

| Operation | Avg Time | Avg Gas |
|-----------|----------|---------|
| `grantRole` | 47ms | 159,172 |
| `mintBatch` | 108ms | 500,237 |
| `transferCustody` | 96ms | 237,019 |
| `placeOrder` | 75ms | 346,495 |
| `submitPrediction` | 61ms | 245,541 |
| `PBFT Full Cycle` | 325ms | multiple txs |
| **Throughput** | **654 orders/min** | — |

---

## 👤 Account Mapping

| # | Role | Address | Organisation |
|---|------|---------|-------------|
| 0 | **NMRA** *(PoA Validator 1)* | `0x5289D9eD381d2C71Aa3C3ed124683A4ea3835b45` | National Medicines Regulatory Authority |
| 1 | **SPC** *(PoA Validator 2)* | `0x3eA889EfFb3235aEF9a99681466F4dB8298dF13F` | State Pharmaceuticals Corporation |
| 2 | **MSD** *(PoA Validator 3)* | `0xFaf911e1597228bD6e1448DE4B8AB294CeA11D89` | Medical Supplies Division |
| 3 | **MANUFACTURER** | `0x819d63d9794f1cfFb7cB772aeE07bc375c4F7BED` | Lanka Pharmaceuticals Ltd |
| 4 | **MANUFACTURER** | `0x5720cEe08EFcDf02183c88D5ca42f6a5D3E5A226` | Ceylon Pharma Industries |
| 5 | **IMPORTER** | `0xD81274395E4980A557e9a54c1E56d58cD5f41Bc7` | Global Meds Import Agency |
| 6 | **WHOLESALER** | `0x2adac08d2f037062FF5Ecc5f2eE751dcF1bEc6D3` | National Medical Wholesalers |
| 7 | **PHARMACY** | `0x18d838D7C2D5b79230deAA63AC3d5d9527C9770d` | CareLife Pharmacy Chain |
| 8 | **HOSPITAL** | `0x0761Aac5768C8df6548B3f9F3C46e3166c16163C` | Colombo Teaching Hospital Pharmacy |
| 9 | **TRANSPORTER** | `0x1e4fF0820e498392EBB78f817e96D2c8b6D6F2af` | MediCold Transport Solutions |
| — | **PATIENT** | No wallet needed | Medicine Verification Portal |

**Mnemonic:** `tackle citizen maze bottom ignore lumber fold sleep manage possible exist hen`

---

## 📍 Contract Addresses

Default addresses after deployment with the project mnemonic on a fresh Ganache instance:

| Contract | Address |
|----------|---------|
| RoleAccessControl | `0x91F7e82f9415cf8878dD1b123C96C09F21B9c7E5` |
| TraceabilityContract | `0x12c94a5697D694A31110AAa4Bee91b5b193c4cD1` |
| OrderingContract | `0x118703B4481e92c020C2A6e9D5e259a826cA57a3` |
| PredictiveAIOracle | `0xf4938804F386C0be428aAdB70f5B10da99927F56` |
| ConsensusAdapter | `0x5B78FbfF9e9260E62Bbae453e39866d05eE8dF8d` |

> These addresses are deterministic — they will be the same every time you deploy to a fresh Ganache workspace with the same mnemonic, **as long as the same number of transactions precede the deployment**.

---

## 🌐 API Reference

### Oracle Server (`http://localhost:3001`)

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `POST` | `/submit-prediction` | `{ medicine, stockRisk, demandForecast, coldChainRisk, counterfeitRisk, overallRisk }` | LSTM model posts predictions here |
| `GET` | `/predictions` | — | Returns latest cached predictions for all medicines |
| `GET` | `/consensus-status` | — | Returns current consensus mode (`PoA` or `PBFT`) and active event ID |
| `POST` | `/manual-evaluate` | `{ orderId, medicineName }` | Manually trigger risk evaluation for an order |

**Example — check current predictions:**
```bash
curl http://localhost:3001/predictions
```

**Example — check consensus mode:**
```bash
curl http://localhost:3001/consensus-status
# {"mode":"PoA","activeEvent":"0"}
```

**Example — manually evaluate an order:**
```bash
curl -X POST http://localhost:3001/manual-evaluate \
  -H "Content-Type: application/json" \
  -d '{"orderId": 1, "medicineName": "Paracetamol 500mg"}'
```

---

## 🔑 Port Reference

| Service | Port | URL |
|---------|------|-----|
| Ganache (blockchain RPC) | **7545** | `http://127.0.0.1:7545` |
| Oracle Server + PBFT Coordinator | **3001** | `http://localhost:3001` |
| Frontend (React / Vite) | **3000** | `http://localhost:3000` |

---

## 🛠 Troubleshooting

**"Account not registered. Contact NMRA for access."**  
→ The connected MetaMask account is not one of the 10 Ganache accounts. Switch to an account imported from the Ganache mnemonic.

**"Cannot connect to Ganache" in oracle server**  
→ Ganache is not running, or is on the wrong port. Start Ganache first, confirm it is on port 7545, then restart the oracle server.

**"❌ deployment-phase3.json not found"**  
→ Run deploy-phase2.js and deploy-phase3.js first. Make sure you are running from the `Pharma-Blockchain/` root folder, not a subdirectory.

**Orders stay on `AI_REVIEW` and never change**  
→ The oracle server is not running. Check Terminal 2. If it crashed, restart it.

**PBFT buttons fail: "CA: already in PBFT" / "CA: already voted"**  
→ The oracle auto-handled the PBFT round. Stop the oracle (Ctrl+C) and redo the emergency order manually, or use `demo-phase3.js` for a complete automated PBFT demo.

**QR verification returns "NOT VERIFIED"**  
→ The QR payload must be exactly the same string used when minting. It is case-sensitive. Example: `PCM-2026-001:MFG1:BATCH001` ≠ `pcm-2026-001:mfg1:batch001`

**Cold chain transfer fails: "TC: cold-chain temperature violation"**  
→ The temperature you entered is outside the batch's allowed range. For insulin (2–8°C), use a value between 200 and 800. Remember: values are in °C × 100.

**"Compiled X Solidity files" then test failures on QR verification**  
→ Make sure you are using the fixed `TraceabilityContract.sol` (qrHash uses only `qrPayload`, not the salted version with `tid + msg.sender`).

**Frontend blank after copying App.jsx**  
→ Run `npm install` inside the `frontend/` folder, then `npm run dev` again.

**"vite: command not found"**  
```bash
cd frontend && npm install && npm run dev
```

**TensorFlow install fails**  
→ The LSTM model runs in simulation mode without TensorFlow. All blockchain and frontend features still work. Just run `python lstm_model.py` — it detects the missing package and switches automatically.

**MetaMask shows "Wrong network"**  
→ Switch MetaMask to the **Ganache Local** network (Chain ID 1337, RPC `http://127.0.0.1:7545`).

---

## 🧰 Technology Stack

### Blockchain
| Technology | Version | Purpose |
|-----------|---------|---------|
| Solidity | 0.8.28 | Smart contract language |
| Hardhat | 2.19.4 | Development environment, testing, deployment |
| Ganache | 7.9.1 | Local private Ethereum blockchain |
| ethers.js | 6.9.0 | Blockchain interaction (frontend + scripts) |
| OpenZeppelin | 5.0.0 | Contract library |
| hardhat-gas-reporter | 1.0.10 | Gas consumption analysis |

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18.2.0 | UI framework |
| Vite | 5.0.8 | Build tool and dev server |
| ethers.js | 6.9.0 | Web3 wallet integration |
| MetaMask | — | Browser wallet |

### AI / Oracle
| Technology | Version | Purpose |
|-----------|---------|---------|
| Python | 3.11 | LSTM model runtime |
| TensorFlow | 2.14.0 | LSTM neural network training and inference |
| Keras | (included) | High-level neural network API |
| NumPy | ≥1.24.0 | Numerical computation |
| Pandas | ≥2.0.0 | Data processing |
| scikit-learn | ≥1.3.0 | MinMaxScaler for data normalisation |
| Flask | ≥3.0.0 | Oracle server HTTP framework |
| Express | 5.2.1 | Oracle server (Node.js side) |
| cors | 2.8.6 | Cross-origin support for oracle API |

---

## 📚 Academic Context

This system was developed as a BSc (Honours) final year research project at the University of Colombo, Faculty of Science, ITSC. It implements the architecture described in the thesis:

> *"AI-Powered Predictive Blockchain Architecture for Proactive and Locally-Adaptive Pharmaceutical Supply Chain Management in Sri Lanka"*  
> Ruwan Pathiranage Sanduni Nisansala (s16162)  
> Supervisor: Dr. Prabhath Liyanage  
> Submitted: 15 March 2026

**Research Questions Addressed:**
1. How does blockchain technology enhance pharmaceutical traceability in developing nations?
2. Can AI predict risks in the pharmaceutical supply chain with sufficient lead time?
3. What is the feasibility of dynamic consensus switching for emergency pharmaceutical distribution?
4. What performance characteristics are achievable on private blockchain networks?

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**University of Colombo · Faculty of Science · ITSC · 2026**  
*Ruwan Pathiranage Sanduni Nisansala (s16162)*

</div>
