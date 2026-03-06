import React, { useEffect, useState } from "react";
import Web3 from "web3";
import SupplyChain from "./SupplyChain.json";
import { QRCodeCanvas } from "qrcode.react";
import { QrReader } from "react-qr-reader";

/* ===================== MAIN APP ===================== */

function App() {

  /* ---------- State Variables ---------- */

  const [account, setAccount] = useState("");
  const [role, setRole] = useState("");
  const [contract, setContract] = useState(null);
  const [networkId, setNetworkId] = useState(null);
  const [loading, setLoading] = useState(true)

  const [batchId, setBatchId] = useState("");
  const [batchName, setBatchName] = useState("");
  const [batch, setBatch] = useState(null);
  

  const [showScanner, setShowScanner] = useState(false);

  const stageNames = [
    "Manufactured",
    "InTransit",
    "AtDistributor",
    "AtPharmacy",
    "Sold"
  ];

  /* ---------- Load Blockchain ---------- */

  useEffect(() => {
    loadBlockchain();
  }, []);

  const loadBlockchain = async () => {
    try {
      if (typeof window.ethereum === 'undefined') {
        alert("Please install MetaMask!");
        setLoading(false);
        return;
      }
  
      const web3 = new Web3(window.ethereum);

      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });

      const accounts = await web3.eth.getAccounts();
      setAccount(accounts[0]);

      // ✅ FIXED: Properly get network ID
      const currentnetworkId = await web3.eth.net.getId();
      setNetworkId(currentNetworkId);
      console.log("🔗 Network ID:", currentNetworkId);

      // ✅ CRITICAL CHECK: Verify contract exists for this network
      
      const deployedNetwork = SupplyChain.networks[CurrentNetworkId];
      console.log("📋 Deployed Network:", deployedNetwork);

      if (!deployedNetwork) {
        alert(`❌ Contract not deployed on Network ID ${currentNetworkId}\n\nGanache Network ID should be 5777\n1. Start Ganache\n2. Run: truffle migrate --reset --network development\n3. Copy build/contracts/SupplyChain.json to frontend/src/`);
        setLoading(false);
        return;
      }


      // ✅ FIXED: Create contract instance
      const instance = new web3.eth.Contract(
        SupplyChain.abi,
        deployed.address
      );

      setContract(instance);

      // Detect role
      const manufacturer = await instance.methods.manufacturer().call();
      const distributor = await instance.methods.distributor().call();
      const pharmacy = await instance.methods.pharmacy().call();
      const regulator = await instance.methods.regulator().call();

      const accountLower = accounts[0].toLowerCase();
      if (accounts[0].toLowerCase() === manufacturer.toLowerCase()) setRole("Manufacturer");
      else if (accounts[0].toLowerCase() === distributor.toLowerCase()) setRole("Distributor");
      else if (accounts[0].toLowerCase() === pharmacy.toLowerCase()) setRole("Pharmacy");
      else if (accounts[0].toLowerCase() === regulator.toLowerCase()) setRole("Regulator");
      else setRole("Unknown");

      setLoading(false);
    } catch (error) {
      console.error("Blockchain load error:", error);
      alert("Error connecting to blockchain: " + error.message);
      setLoading(false);
    }
  };


  /* ---------- Register Batch ---------- */

  const registerBatch = async () => {
    if (!contract || !batchId || !batchName) {
      alert("Please fill Batch ID and Name");
      return;
    }
    try {
      await contract.methods.registerBatch(batchId, batchName).send({ from: account });
      alert("✅ Batch registered!");
      setBatchId("");
      setBatchName("");
    } catch (error) {
      alert("❌ Error: " + error.message);
    }
  };

  /* ---------- Update Stage ---------- */

  

  /* ---------- Verify Batch ---------- */

  const getBatch = async () => {
    if (!contract || !batchId) {
      alert("Please enter Batch ID");
      return;
    }
    try {
      const data = await contract.methods.getBatch(batchId).call();
      setBatch(data);
      
      
    } catch (error) {
      alert("⚠️ Batch not found: " + error.message);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 50, textAlign: 'center' }}>
        <h2>🔄 Loading Pharma Supply Chain DApp...</h2>
        <p>Please connect MetaMask and ensure Ganache is running</p>
      </div>
    );
  }

  /* ===================== UI ===================== */

  return (
    <div style={{ padding: 30, maxWidth: 800, margin: '0 auto' }}>
      <h2>🚀 Pharmaceutical Supply Chain – Blockchain System</h2>
      <p><strong>Account:</strong> {account.slice(0,6)}...{account.slice(-4)}</p>
      <p><strong>Role:</strong> <span style={{color: role === "Unknown" ? 'red' : 'green'}}>{role}</span></p>
      <p><strong>Network ID:</strong> {networkId}</p>
      {!contract && <p style={{color: 'red', fontSize: '18px'}}>❌ Contract not connected. Check Ganache!</p>}

      {/* Manufacturer */}
      {role === "Manufacturer" && (
        <>
          <h3>🏭 Register New Batch</h3>
          <input 
            placeholder="Batch ID" 
            value={batchId} 
            onChange={e => setBatchId(e.target.value)}
            style={{padding: '10px', marginRight: 10, width: 120}}
          />
          <input 
            placeholder="Drug Name" 
            value={batchName} 
            onChange={e => setBatchName(e.target.value)}
            style={{padding: '10px', marginRight: 10, width: 200}}
          />
          <button onClick={registerBatch} style={{padding: '10px 20px', background: '#28a745', color: 'white', border: 'none'}}>
            Register Batch
          </button>

          {batchId && (
            <>
              <h4>📱 QR Code</h4>
              <QRCodeCanvas value={batchId} size={150} />
            </>
          )}
        </>
      )}

      {/* Distributor Panel */}
{role === "Distributor" && (
  <div style={{background: '#d1ecf1', padding: 20, margin: 10, borderRadius: 8}}>
    <h3>🚚 Distributor: Update Stage</h3>
    <input placeholder="Batch ID" />
    <select>
      <option>AtDistributor</option>
    </select>
    <button>Update</button>
  </div>
)}

{/* Pharmacy Panel */}
{role === "Pharmacy" && (
  <div style={{background: '#d4edda', padding: 20, margin: 10, borderRadius: 8}}>
    <h3>🏥 Pharmacy: Receive/Sell</h3>
    <input placeholder="Batch ID" />
    <select>
      <option>AtPharmacy</option>
      <option>Sold</option>
    </select>
    <button>Update</button>
  </div>
)}



      {/* QR Verification */}
      <h3>🔍 Verify Drug Authenticity</h3>
      <button onClick={() => setShowScanner(!showScanner)} style={{marginRight: 10, padding: '8px 16px'}}>
        {showScanner ? 'Stop Scan' : 'Scan QR'}
      </button>
      <button onClick={getBatch} style={{padding: '8px 16px'}}>
        Verify Batch ID: {batchId || 'Enter ID'}
      </button>

      {showScanner && (
        <div style={{marginTop: 20}}>
          <QrReader
            onResult={(result, error) => {
              if (!!result) {
                setBatchId(result?.text);
                setShowScanner(false);
              }
              
            }}
            style={{ width: '100%' }}
          />
        </div>
      )}


      {/* Batch Result */}
      {batch && (
        <div style={{marginTop: 30, padding: 20, border: '2px solid #007bff', borderRadius: 8}}>
          <h3>✅ Batch Verified</h3>
          <p><strong>Name:</strong> {batch[0]}</p>
          <p><strong>Stage:</strong> {stageNames[batch[2]]}</p>
          <p><strong>Owner:</strong> {batch[1].slice(0,6)}...{batch[1].slice(-4)}</p>
          <p style={{color: batch[3] ? 'red' : 'green'}}>
            <strong>Status:</strong> {batch[3] ? "❌ FROZEN/RECALLED" : "✅ AUTHENTIC"}
          </p>
        </div>
      )}
    </div>
  );
}
    

export default App;
