import { useState, useEffect } from 'react';
import { getTraceabilityContract } from '../../utils/contracts';
import { getCurrentAccount } from '../../utils/web3';
import LoadingSpinner from '../../components/LoadingSpinner';

const ManufacturerDashboard = () => {
  const [batches,       setBatches]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [submitting,    setSubmitting]     = useState(false);
  const [showMintForm,  setShowMintForm]   = useState(false);
  const [txMessage,     setTxMessage]      = useState('');

  const [formData, setFormData] = useState({
    medicineName:      '',
    batchNumber:       '',
    genericName:       '',
    quantity:          '',
    expiryDate:        '',
    coldChainRequired: false,
    minTemp:           '200',   // 2°C × 100
    maxTemp:           '800',   // 8°C × 100
    qrPayload:         '',
    ipfsCert:          ''
  });

  useEffect(() => {
    loadBatches();
  }, []);

  // ── Load all batches ─────────────────────────────────────────────────────
  const loadBatches = async () => {
    try {
      const contract = getTraceabilityContract();
      const account  = await getCurrentAccount();

      // Use getHolderBatches to only fetch this manufacturer's batches
      // (falls back to scanning all if needed)
      const total = await contract.methods.totalBatches().call();

      const batchList = [];
      for (let i = 1; i <= Number(total); i++) {
        // getBatch returns the full Batch struct as a tuple
        const batch = await contract.methods.getBatch(i).call();
        // Only show batches this manufacturer minted
        if (batch.manufacturer.toLowerCase() === account.toLowerCase()) {
          batchList.push({ id: i, ...batch });
        }
      }

      setBatches(batchList);
    } catch (error) {
      console.error('Error loading batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // ── Mint batch ───────────────────────────────────────────────────────────
  const handleMintBatch = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setTxMessage('');

    try {
      const contract = getTraceabilityContract();
      const account  = await getCurrentAccount();

      // Convert date string to Unix timestamp
      const expiryTimestamp = Math.floor(new Date(formData.expiryDate).getTime() / 1000);

      if (expiryTimestamp <= Math.floor(Date.now() / 1000)) {
        setTxMessage('❌ Expiry date must be in the future.');
        return;
      }

      // mintBatch takes a BatchParams struct (tuple)
      // Fields: medicineName, batchNumber, genericName, quantity,
      //         expiryDate, coldChainRequired, minTemp, maxTemp,
      //         qrPayload, ipfsCert
      const batchParams = {
        medicineName:      formData.medicineName,
        batchNumber:       formData.batchNumber,
        genericName:       formData.genericName || formData.medicineName,
        quantity:          Number(formData.quantity),
        expiryDate:        expiryTimestamp,
        coldChainRequired: formData.coldChainRequired,
        minTemp:           formData.coldChainRequired ? Number(formData.minTemp) : 0,
        maxTemp:           formData.coldChainRequired ? Number(formData.maxTemp) : 3500,
        qrPayload:         formData.qrPayload  || `QR-${formData.batchNumber}-${Date.now()}`,
        ipfsCert:          formData.ipfsCert   || `ipfs://QmExample${Date.now()}`
      };

      setTxMessage('⏳ Minting batch on blockchain...');

      await contract.methods.mintBatch(batchParams).send({ from: account });

      setTxMessage('✅ Batch minted successfully!');
      setShowMintForm(false);
      setFormData({
        medicineName:      '',
        batchNumber:       '',
        genericName:       '',
        quantity:          '',
        expiryDate:        '',
        coldChainRequired: false,
        minTemp:           '200',
        maxTemp:           '800',
        qrPayload:         '',
        ipfsCert:          ''
      });
      loadBatches();

    } catch (error) {
      console.error('Error minting batch:', error);
      const reason = error?.data?.message || error?.message || 'Unknown error';
      setTxMessage('❌ Failed to mint: ' + reason);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && batches.length === 0) {
    return <LoadingSpinner message="Loading batches..." />;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>👨‍🏭 Manufacturer Dashboard</h1>
        <button
          onClick={() => { setShowMintForm(!showMintForm); setTxMessage(''); }}
          className="primary-button"
        >
          {showMintForm ? '❌ Cancel' : '➕ Mint New Batch'}
        </button>
      </div>

      {/* ── Mint Form ── */}
      {showMintForm && (
        <div className="card">
          <h2>Mint New Medicine Batch</h2>
          <form onSubmit={handleMintBatch} className="form">

            <div className="form-row">
              <div className="form-group">
                <label>Medicine Name *</label>
                <input
                  type="text"
                  name="medicineName"
                  value={formData.medicineName}
                  onChange={handleInputChange}
                  placeholder="e.g., Paracetamol 500mg"
                  required
                />
              </div>

              <div className="form-group">
                <label>Batch Number *</label>
                <input
                  type="text"
                  name="batchNumber"
                  value={formData.batchNumber}
                  onChange={handleInputChange}
                  placeholder="e.g., BATCH-001"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Generic Name</label>
                <input
                  type="text"
                  name="genericName"
                  value={formData.genericName}
                  onChange={handleInputChange}
                  placeholder="e.g., Acetaminophen (optional)"
                />
              </div>

              <div className="form-group">
                <label>Quantity (units) *</label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleInputChange}
                  placeholder="e.g., 10000"
                  min="1"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Expiry Date *</label>
                <input
                  type="date"
                  name="expiryDate"
                  value={formData.expiryDate}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: '24px' }}>
                <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    name="coldChainRequired"
                    checked={formData.coldChainRequired}
                    onChange={handleInputChange}
                  />
                  <span>❄️ Requires Cold Chain</span>
                </label>
              </div>
            </div>

            {formData.coldChainRequired && (
              <div className="form-row">
                <div className="form-group">
                  <label>Min Temperature (integer °C × 100)</label>
                  <input
                    type="number"
                    name="minTemp"
                    value={formData.minTemp}
                    onChange={handleInputChange}
                    placeholder="200 = 2°C"
                  />
                  <small style={{ color: '#636e72' }}>Enter 200 for 2°C, 800 for 8°C</small>
                </div>

                <div className="form-group">
                  <label>Max Temperature (integer °C × 100)</label>
                  <input
                    type="number"
                    name="maxTemp"
                    value={formData.maxTemp}
                    onChange={handleInputChange}
                    placeholder="800 = 8°C"
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label>QR Payload (optional — auto-generated if blank)</label>
              <input
                type="text"
                name="qrPayload"
                value={formData.qrPayload}
                onChange={handleInputChange}
                placeholder="e.g., PCM-2024-001-LOT"
              />
            </div>

            <div className="form-group">
              <label>IPFS Certificate Hash (optional — auto-generated if blank)</label>
              <input
                type="text"
                name="ipfsCert"
                value={formData.ipfsCert}
                onChange={handleInputChange}
                placeholder="e.g., ipfs://QmXyz..."
              />
            </div>

            <button type="submit" className="submit-button" disabled={submitting}>
              {submitting ? '⏳ Minting...' : '🏭 Mint Batch'}
            </button>
          </form>

          {txMessage && (
            <div
              className="info-box"
              style={{
                marginTop: '12px',
                background: txMessage.startsWith('✅') ? '#e8f5e9'
                          : txMessage.startsWith('⏳') ? '#fff3e0' : '#fdecea',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '14px'
              }}
            >
              {txMessage}
            </div>
          )}
        </div>
      )}

      {/* ── Batches Table ── */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>My Manufactured Batches ({batches.length})</h2>
          <button className="primary-button" onClick={loadBatches} style={{ fontSize: '12px', padding: '6px 14px' }}>
            🔄 Refresh
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Batch ID</th>
                <th>Medicine Name</th>
                <th>Batch Number</th>
                <th>Quantity</th>
                <th>Current Holder</th>
                <th>Status</th>
                <th>Recalled</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: '#b2bec3' }}>
                    No batches minted yet. Click "Mint New Batch" to get started.
                  </td>
                </tr>
              ) : (
                batches.map(batch => (
                  <tr key={batch.id}>
                    <td>#{batch.id}</td>
                    <td>{batch.medicineName}</td>
                    <td>{batch.batchNumber}</td>
                    <td>{batch.quantity?.toString()}</td>
                    <td className="address-cell" style={{ fontSize: '11px', color: '#636e72' }}>
                      {batch.currentHolder?.slice(0, 8)}...{batch.currentHolder?.slice(-6)}
                    </td>
                    <td>
                      <span className={`status-badge status-${batch.status}`}>
                        {getBatchStatus(Number(batch.status))}
                      </span>
                    </td>
                    <td>
                      {batch.isRecalled ? (
                        <span className="recalled-badge" style={{ color: '#dc2626', fontWeight: 700 }}>⚠️ RECALLED</span>
                      ) : (
                        <span className="active-badge" style={{ color: '#059669' }}>✅ Active</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const getBatchStatus = (status) => {
  const statuses = {
    0: 'Manufactured',
    1: 'In Transit',
    2: 'At Warehouse',
    3: 'At Pharmacy',
    4: 'At Hospital',
    5: 'Dispensed',
    6: 'Recalled'
  };
  return statuses[status] || 'Unknown';
};

export default ManufacturerDashboard;