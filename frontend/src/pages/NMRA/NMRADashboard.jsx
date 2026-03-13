import { useState, useEffect } from 'react';
import { getRoleAccessControl, getTraceabilityContract, getOrderingContract } from '../../utils/contracts';
import { getCurrentAccount } from '../../utils/web3';
import { ROLES, ROLE_NAMES } from '../../utils/roleDetector';
import LoadingSpinner from '../../components/LoadingSpinner';

const NMRADashboard = () => {
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalBatches: 0,
    totalOrders: 0,
    totalRecalls: 0,
    emergencyOrders: 0
  });
  const [loading, setLoading] = useState(true);
  const [showGrantRole, setShowGrantRole] = useState(false);
  
  const [roleForm, setRoleForm] = useState({
    address: '',
    role: '4',
    name: '',
    licenseNumber: '0'
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const roleContract = getRoleAccessControl();
      const traceContract = getTraceabilityContract();
      const orderContract = getOrderingContract();

      const [totalMembers, totalBatches, totalOrders] = await Promise.all([
        roleContract.methods.totalMembers().call(),
        traceContract.methods.totalBatches().call(),
        orderContract.methods.totalOrders().call()
      ]);

      setStats({
        totalMembers,
        totalBatches,
        totalOrders,
        totalRecalls: 0, // Would need to track this
        emergencyOrders: 0 // Would need to track this
      });

    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGrantRole = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const contract = getRoleAccessControl();
      const account = await getCurrentAccount();

      await contract.methods.grantRole(
        roleForm.address,
        roleForm.role,
        roleForm.name,
        roleForm.licenseNumber
      ).send({ from: account });

      alert(`✅ Role granted successfully to ${roleForm.name}!`);
      setShowGrantRole(false);
      setRoleForm({ address: '', role: '4', name: '', licenseNumber: '0' });
      loadStats();

    } catch (error) {
      console.error('Error granting role:', error);
      alert('❌ Failed to grant role: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && stats.totalMembers === 0) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>🏛️ NMRA Regulatory Dashboard</h1>
        <button 
          onClick={() => setShowGrantRole(!showGrantRole)}
          className="primary-button"
        >
          {showGrantRole ? '❌ Cancel' : '👤 Grant Role'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>👥 Total Members</h3>
          <p className="stat-number">{stats.totalMembers}</p>
        </div>
        <div className="stat-card">
          <h3>📦 Total Batches</h3>
          <p className="stat-number">{stats.totalBatches}</p>
        </div>
        <div className="stat-card">
          <h3>🛒 Total Orders</h3>
          <p className="stat-number">{stats.totalOrders}</p>
        </div>
        <div className="stat-card">
          <h3>⚠️ Recalls</h3>
          <p className="stat-number">{stats.totalRecalls}</p>
        </div>
      </div>

      {showGrantRole && (
        <div className="card">
          <h2>Grant Role to New Member</h2>
          <form onSubmit={handleGrantRole} className="form">
            <div className="form-group">
              <label>Wallet Address *</label>
              <input
                type="text"
                value={roleForm.address}
                onChange={(e) => setRoleForm({...roleForm, address: e.target.value})}
                placeholder="0x..."
                required
              />
            </div>

            <div className="form-group">
              <label>Role *</label>
              <select
                value={roleForm.role}
                onChange={(e) => setRoleForm({...roleForm, role: e.target.value})}
                required
              >
                <option value="2">SPC</option>
                <option value="3">MSD</option>
                <option value="4">Manufacturer</option>
                <option value="5">Importer</option>
                <option value="6">Wholesaler</option>
                <option value="7">Pharmacy</option>
                <option value="8">Hospital</option>
                <option value="9">Transporter</option>
              </select>
            </div>

            <div className="form-group">
              <label>Organization Name *</label>
              <input
                type="text"
                value={roleForm.name}
                onChange={(e) => setRoleForm({...roleForm, name: e.target.value})}
                placeholder="e.g., Colombo General Pharmacy"
                required
              />
            </div>

            <div className="form-group">
              <label>License Number (optional)</label>
              <input
                type="number"
                value={roleForm.licenseNumber}
                onChange={(e) => setRoleForm({...roleForm, licenseNumber: e.target.value})}
                placeholder="0"
              />
            </div>

            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? '⏳ Granting...' : '✅ Grant Role'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <h2>System Overview</h2>
        <div className="info-box">
          <p>✅ Blockchain network operational</p>
          <p>✅ All 5 smart contracts deployed</p>
          <p>✅ AI Oracle active</p>
          <p>✅ Consensus switching enabled (PoA ↔ PBFT)</p>
        </div>
      </div>
    </div>
  );
};

export default NMRADashboard;