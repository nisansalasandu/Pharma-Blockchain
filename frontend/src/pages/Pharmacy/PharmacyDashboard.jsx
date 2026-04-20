import { useState, useEffect } from 'react';
import { getOrderingContract } from '../../utils/contracts';
import { getCurrentAccount } from '../../utils/web3';
import addresses from '../../contracts/addresses.json';
import LoadingSpinner from '../../components/LoadingSpinner';

const PharmacyDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOrderForm, setShowOrderForm] = useState(false);

  const [formData, setFormData] = useState({
    medicineName: '',
    quantity: '',
    notes: ''
  });

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const contract = getOrderingContract();
      const account = await getCurrentAccount();
      const total = await contract.methods.totalOrders().call();
      
      const orderList = [];
      for (let i = 1; i <= total; i++) {
        const order = await contract.methods.getOrder(i).call();
        // Only show orders placed by this pharmacy
        if (order.placer.toLowerCase() === account.toLowerCase()) {
          orderList.push({ id: i, ...order });
        }
      }
      
      setOrders(orderList);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const contract = getOrderingContract();
      const account = await getCurrentAccount();

      // Get SPC address from deployment (supplier for pharmacies)
      const spcAddress = addresses.RoleAccessControl; // Replace with actual SPC address
      
      await contract.methods.placeOrder(
        spcAddress, // Pharmacies order from SPC
        formData.medicineName,
        formData.genericName,
        Number(formData.quantity),
        0,
        formData.notes || "Standard procurement"
      ).send({ from: account });

      alert('✅ Order placed successfully! Waiting for AI risk evaluation...');
      setShowOrderForm(false);
      loadOrders();
      
      setFormData({
        medicineName: '',
        quantity: '',
        notes: ''
      });

    } catch (error) {
      console.error('Error placing order:', error);
      alert('❌ Failed to place order: ' + error.message);
    } finally {
      setLoading(false);
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
          onClick={() => setShowOrderForm(!showOrderForm)}
          className="primary-button"
        >
          {showOrderForm ? '❌ Cancel' : '➕ Place New Order'}
        </button>
      </div>

      {showOrderForm && (
        <div className="card">
          <h2>Place Order to SPC</h2>
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
              </select>
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
              <label>Notes (optional)</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Any special requirements or urgency notes..."
                rows="3"
              />
            </div>

            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? '⏳ Placing Order...' : '📦 Place Order to SPC'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <h2>My Orders ({orders.length})</h2>
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
                  <td colSpan="6" style={{textAlign: 'center'}}>
                    No orders placed yet
                  </td>
                </tr>
              ) : (
                orders.map(order => (
                  <tr key={order.id}>
                    <td>#{order.id}</td>
                    <td>{order.medicineName}</td>
                    <td>{order.quantity}</td>
                    <td>
                      <span className={`status-badge status-${order.status}`}>
                        {getOrderStatus(order.status)}
                      </span>
                    </td>
                    <td>
                      <span className={`risk-badge risk-${getRiskLevel(order.riskScore)}`}>
                        {order.riskScore} / 1000
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
