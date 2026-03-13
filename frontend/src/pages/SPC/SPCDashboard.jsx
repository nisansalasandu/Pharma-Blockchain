import { useState, useEffect } from 'react';
import { getOrderingContract } from '../../utils/contracts';
import { getCurrentAccount } from '../../utils/web3';
import LoadingSpinner from '../../components/LoadingSpinner';

const SPCDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const contract = getOrderingContract();
      const total = await contract.methods.totalOrders().call();
      
      const orderList = [];
      for (let i = 1; i <= total; i++) {
        const order = await contract.methods.getOrder(i).call();
        orderList.push({ id: i, ...order });
      }
      
      setOrders(orderList);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (orderId) => {
    setLoading(true);
    try {
      const contract = getOrderingContract();
      const account = await getCurrentAccount();
      
      await contract.methods.approveOrder(orderId).send({ from: account });
      alert('✅ Order approved successfully!');
      loadOrders();
    } catch (error) {
      alert('❌ Failed to approve: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFulfill = async (orderId) => {
    setLoading(true);
    try {
      const contract = getOrderingContract();
      const account = await getCurrentAccount();
      
      await contract.methods.fulfillOrder(orderId).send({ from: account });
      alert('✅ Order fulfilled successfully!');
      loadOrders();
    } catch (error) {
      alert('❌ Failed to fulfill: ' + error.message);
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
        <h1>🏢 SPC Dashboard</h1>
      </div>

      <div className="card">
        <h2>Pending Orders ({orders.filter(o => o.status === '1').length})</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Medicine</th>
                <th>Quantity</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.filter(o => ['1', '3'].includes(String(o.status))).map(order => (
                <tr key={order.id}>
                  <td>#{order.id}</td>
                  <td>{order.medicineName}</td>
                  <td>{order.quantity}</td>
                  <td>{getStatusName(order.status)}</td>
                  <td>
                    {order.status === '1' && (
                      <button onClick={() => handleApprove(order.id)} className="action-button">
                        ✅ Approve
                      </button>
                    )}
                    {order.status === '3' && (
                      <button onClick={() => handleFulfill(order.id)} className="action-button">
                        📦 Fulfill
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const getStatusName = (status) => {
  const statuses = { 0: 'AI Review', 1: 'Pending', 2: 'Emergency', 3: 'Approved', 4: 'Fulfilled' };
  return statuses[status] || 'Unknown';
};

export default SPCDashboard;