import { useState, useEffect } from 'react';
import { getOrderingContract } from '../../utils/contracts';
import { getCurrentAccount } from '../../utils/web3';
import LoadingSpinner from '../../components/LoadingSpinner';

// ── Actual SPC account address from your deployment ──────────────────────────
// Account 1 in Ganache = SPC — State Pharmaceuticals Corporation
const SPC_ADDRESS = '0x3eA889EfFb3235aEF9a99681466F4dB8298dF13F';

const PharmacyDashboard = () => {
  const [orders,          setOrders]          = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [submitting,      setSubmitting]       = useState(false);
  const [showOrderForm,   setShowOrderForm]    = useState(false);
  const [txMessage,       setTxMessage]        = useState('');

  const [formData, setFormData] = useState({
    medicineName: '',
    genericName:  '',
    quantity:     '',
    notes:        ''
  });

  useEffect(() => {
    loadOrders();
  }, []);

  // ── Load orders placed by this pharmacy ─────────────────────────────────
  const loadOrders = async () => {
    try {
      const contract = getOrderingContract();
      const account  = await getCurrentAccount();

      // Use getOrdersByPlacer for efficiency — no need to scan all orders
      const orderIds = await contract.methods.getOrdersByPlacer(account).call();

      const orderList = await Promise.all(
        orderIds.map(async (id) => {
          const order = await contract.methods.getOrder(id).call();
          return { id: Number(id), ...order };
        })
      );

      setOrders(orderList);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // ── Place order ──────────────────────────────────────────────────────────
  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setTxMessage('');

    try {
      const contract = getOrderingContract();
      const account  = await getCurrentAccount();

      if (!formData.medicineName || !formData.quantity) {
        setTxMessage('❌ Please fill all required fields.');
        return;
      }

      setTxMessage('⏳ Sending transaction...');

      // placeOrder(address _supplier, string _medicineName, string _genericName,
      //            uint256 _quantity, uint256 _unitPriceWei, string _urgencyReason)
      await contract.methods.placeOrder(
        SPC_ADDRESS,                                    // supplier = SPC
        formData.medicineName,
        formData.genericName  || formData.medicineName, // fallback if blank
        Number(formData.quantity),
        0,                                              // unitPriceWei = 0 (free demo)
        formData.notes || 'Standard procurement'
      ).send({ from: account });

      setTxMessage('✅ Order placed! Waiting for AI risk evaluation...');
      setShowOrderForm(false);
      setFormData({ medicineName: '', genericName: '', quantity: '', notes: '' });
      loadOrders();

    } catch (error) {
      console.error('Error placing order:', error);
      const reason = error?.data?.message || error?.message || 'Unknown error';
      setTxMessage('❌ Failed: ' + reason);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && orders.length === 0) {
    return <LoadingSpinner message="Loading orders..." />;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>💊 Pharmacy Dashboard</h1>
        <button
          onClick={() => { setShowOrderForm(!showOrderForm); setTxMessage(''); }}
          className="primary-button"
        >
          {showOrderForm ? '❌ Cancel' : '➕ Place New Order'}
        </button>
      </div>

      {/* ── Order Form ── */}
      {showOrderForm && (
        <div className="card">
          <h2>Place Order to SPC</h2>
          <p style={{ fontSize: '13px', color: '#636e72' }}>
            Supplier: <strong>State Pharmaceuticals Corporation</strong><br />
            <code style={{ fontSize: '11px' }}>{SPC_ADDRESS}</code>
          </p>

          <form onSubmit={handlePlaceOrder} className="form">

            <div className="form-group">
              <label>Medicine Name *</label>
              <select
                name="medicineName"
                value={formData.medicineName}
                onChange={handleInputChange}
                required
              >
                <option value="">Select Medicine</option>
                <option value="Paracetamol 500mg">Paracetamol 500mg</option>
                <option value="Amoxicillin 250mg">Amoxicillin 250mg</option>
                <option value="Metformin 500mg">Metformin 500mg</option>
                <option value="Amlodipine 5mg">Amlodipine 5mg</option>
                <option value="Omeprazole 20mg">Omeprazole 20mg</option>
                <option value="Insulin (Regular)">Insulin (Regular)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Generic Name</label>
              <input
                type="text"
                name="genericName"
                value={formData.genericName}
                onChange={handleInputChange}
                placeholder="e.g., Acetaminophen (leave blank to auto-fill)"
              />
            </div>

            <div className="form-group">
              <label>Quantity (units) *</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleInputChange}
                placeholder="e.g., 1000"
                min="1"
                required
              />
            </div>

            <div className="form-group">
              <label>Urgency / Notes (optional)</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Any special requirements or urgency notes..."
                rows="3"
              />
            </div>

            <button type="submit" className="submit-button" disabled={submitting}>
              {submitting ? '⏳ Placing Order...' : '📦 Place Order to SPC'}
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

      {/* ── Orders Table ── */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>My Orders ({orders.length})</h2>
          <button className="primary-button" onClick={loadOrders} style={{ fontSize: '12px', padding: '6px 14px' }}>
            🔄 Refresh
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Medicine</th>
                <th>Quantity</th>
                <th>Status</th>
                <th>Risk Score</th>
                <th>Consensus Path</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: '#b2bec3' }}>
                    No orders placed yet
                  </td>
                </tr>
              ) : (
                orders.map(order => (
                  <tr key={order.id}>
                    <td>#{order.id}</td>
                    <td>{order.medicineName}</td>
                    <td>{order.quantity?.toString()}</td>
                    <td>
                      <span className={`status-badge status-${order.status}`}>
                        {getOrderStatus(Number(order.status))}
                      </span>
                    </td>
                    <td>
                      <span className={`risk-badge risk-${getRiskLevel(Number(order.riskScore))}`}>
                        {order.riskScore?.toString()} / 1000
                      </span>
                    </td>
                    <td>
                      {Number(order.riskScore) > 800 ? (
                        <span className="consensus-badge pbft">⚡ PBFT</span>
                      ) : (
                        <span className="consensus-badge poa">⚙️ PoA</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Info Box ── */}
      <div className="info-box">
        <h3>ℹ️ Order Process</h3>
        <ol>
          <li>Place order → Status: <strong>AI_REVIEW</strong></li>
          <li>AI evaluates risk → Status: <strong>PENDING</strong> (low risk) or <strong>EMERGENCY</strong> (high risk)</li>
          <li>SPC approves → Status: <strong>APPROVED</strong></li>
          <li>SPC fulfills → Status: <strong>FULFILLED</strong></li>
        </ol>
        <p><strong>Note:</strong> Orders with risk score &gt; 800 trigger PBFT consensus (3 validators vote).</p>
      </div>
    </div>
  );
};

const getOrderStatus = (status) => {
  const statuses = {
    0: 'Pending',
    1: 'AI Review',
    2: 'Approved',
    3: 'Emergency',
    4: 'Fulfilled',
    5: 'Rejected',
    6: 'Cancelled'
  };
  return statuses[status] || 'Unknown';
};

const getRiskLevel = (score) => {
  if (score > 800) return 'high';
  if (score > 400) return 'medium';
  return 'low';
};

export default PharmacyDashboard;