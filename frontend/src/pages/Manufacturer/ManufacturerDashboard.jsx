import { useState, useEffect } from 'react';
import { getTraceabilityContract } from '../../utils/contracts';
import { getCurrentAccount } from '../../utils/web3';
import LoadingSpinner from '../../components/LoadingSpinner';

const ManufacturerDashboard = () => {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMintForm, setShowMintForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    medicineName: '',
    batchNumber: '',
    genericName: '',
    quantity: '',
    expiryDate: '',
    coldChainRequired: false,
    minTemp: '0',
    maxTemp: '3500',
    qrPayload: '',
    ipfsCert: ''
  });

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    try {
      const contract = getTraceabilityContract();
      const total = await contract.methods.totalBatches().call();
      
      const batchList = [];
      for (let i = 1; i <= total; i++) {
        const batch = await contract.methods.getBatchInfo(i).call();
        batchList.push({ id: i, ...batch });
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

  const handleMintBatch = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const contract = getTraceabilityContract();
      const account = await getCurrentAccount();

      // Convert date to Unix timestamp
      const expiryTimestamp = Math.floor(new Date(formData.expiryDate).getTime() / 1000);

      const batchData = {
        medicineName: formData.medicineName,
        batchNumber: formData.batchNumber,
        genericName: formData.genericName,
        quantity: formData.quantity,
        expiryDate: expiryTimestamp,
        coldChainRequired: formData.coldChainRequired,
        minTemp: formData.minTemp,
        maxTemp: formData.maxTemp,
        qrPayload: formData.qrPayload || `QR-${formData.batchNumber}`,
        ipfsCert: formData.ipfsCert || `ipfs://QmExample${Date.now()}`
      };

      await contract.methods.mintBatch(batchData).send({ from: account });

      alert('✅ Batch minted successfully!');
      setShowMintForm(false);
      loadBatches();
      
      // Reset form
      setFormData({
        medicineName: '',
        batchNumber: '',
        genericName: '',
        quantity: '',
        expiryDate: '',
        coldChainRequired: false,
        minTemp: '0',
        maxTemp: '3500',
        qrPayload: '',
        ipfsCert: ''
      });

    } catch (error) {
      console.error('Error minting batch:', error);
      alert('❌ Failed to mint batch: ' + error.message);
    } finally {
      setLoading(false);
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
          onClick={() => setShowMintForm(!showMintForm)}
          className="primary-button"
        >
          {showMintForm ? '❌ Cancel' : '➕ Mint New Batch'}
        </button>
      </div>

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
                  placeholder="e.g., Acetaminophen"
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

              <div className="form-group">
                <label className="checkbox-label">
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
                  <label>Min Temperature (°C × 100)</label>
                  <input
                    type="number"
                    name="minTemp"
                    value={formData.minTemp}
                    onChange={handleInputChange}
                    placeholder="e.g., 200 for 2°C"
                  />
                  <small>Enter 200 for 2°C, 800 for 8°C</small>
                </div>

                <div className="form-group">
                  <label>Max Temperature (°C × 100)</label>
                  <input
                    type="number"
                    name="maxTemp"
                    value={formData.maxTemp}
                    onChange={handleInputChange}
                    placeholder="e.g., 800 for 8°C"
                  />
                </div>
              </div>
            )}

            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? '⏳ Minting...' : '🏭 Mint Batch'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <h2>My Manufactured Batches ({batches.length})</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Batch ID</th>
                <th>Medicine Name</th>
                <th>Batch Number</th>
                <th>Current Holder</th>
                <th>Status</th>
                <th>Recalled</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{textAlign: 'center'}}>
                    No batches minted yet
                  </td>
                </tr>
              ) : (
                batches.map(batch => (
                  <tr key={batch.id}>
                    <td>#{batch.id}</td>
                    <td>{batch.medicineName}</td>
                    <td>{batch.batchNumber}</td>
                    <td className="address-cell">{batch.currentHolder}</td>
                    <td>
                      <span className={`status-badge status-${batch.status}`}>
                        {getStatusName(batch.status)}
                      </span>
                    </td>
                    <td>
                      {batch.isRecalled ? (
                        <span className="recalled-badge">⚠️ RECALLED</span>
                      ) : (
                        <span className="active-badge">✅ Active</span>
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

const getStatusName = (status) => {
  const statuses = {
    0: 'Manufactured',
    1: 'In Transit',
    2: 'At Warehouse',
    3: 'At Pharmacy',
    4: 'At Hospital',
    5: 'Dispensed'
  };
  return statuses[status] || 'Unknown';
};

export default ManufacturerDashboard;
