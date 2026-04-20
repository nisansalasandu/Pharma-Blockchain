import { useState, useEffect } from 'react';
import { getRoleAccessControl, getTraceabilityContract, getOrderingContract } from '../../utils/contracts';
import { getCurrentAccount } from '../../utils/web3';
import { ROLES, ROLE_NAMES } from '../../utils/roleDetector';
import LoadingSpinner from '../../components/LoadingSpinner';

// Maps the dropdown value (string ID) to the contract's bytes32 constant name
const getRoleConstantName = (roleId) => {
  const map = {
    '2': 'ROLE_SPC',
    '3': 'ROLE_MSD',
    '4': 'ROLE_MANUFACTURER',
    '5': 'ROLE_IMPORTER',
    '6': 'ROLE_WHOLESALER',
    '7': 'ROLE_PHARMACY',
    '8': 'ROLE_HOSPITAL',
    '9': 'ROLE_TRANSPORTER',
    '10': 'ROLE_PATIENT',
  };
  return map[roleId] || null;
};

const NMRADashboard = () => {
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalBatches: 0,
    totalOrders: 0,
    totalRecalls: 0,
    emergencyOrders: 0
  });
  const [loading, setLoading] = useState(true);
  const [granting, setGranting] = useState(false);
  const [showGrantRole, setShowGrantRole] = useState(false);
  const [txMessage, setTxMessage] = useState('');

  const [roleForm, setRoleForm] = useState({
    address: '',
    role: '4',        // default: Manufacturer
    name: '',
    expiry: '0'       // 0 = no expiry
  });

  useEffect(() => {
    loadStats();
  }, []);

  // ── Load on-chain stats ────────────────────────────────────────────────────
  const loadStats = async () => {
    try {
      const roleContract  = getRoleAccessControl();
      const traceContract = getTraceabilityContract();
      const orderContract = getOrderingContract();

      const [totalMembers, totalBatches, totalOrders] = await Promise.all([
        roleContract.methods.totalMembers().call(),
        // Contract exposes totalBatches as a public var — auto-getter works fine
        traceContract.methods.totalBatches().call(),
        orderContract.methods.totalOrders().call()
      ]);

      setStats({
        totalMembers:   Number(totalMembers),
        totalBatches:   Number(totalBatches),
        totalOrders:    Number(totalOrders),
        totalRecalls:   0,   // extend later with recallBatch event indexing
        emergencyOrders: 0   // extend later with OrderEmergency event indexing
      });

    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Grant role ─────────────────────────────────────────────────────────────
  const handleGrantRole = async (e) => {
    e.preventDefault();
    setGranting(true);
    setTxMessage('');

    try {
      const contract = getRoleAccessControl();
      const account  = await getCurrentAccount();

      // 1. Resolve the bytes32 role constant from the contract itself
      const constantName = getRoleConstantName(roleForm.role);
      if (!constantName) {
        setTxMessage('❌ Unknown role selected.');
        return;
      }

      const roleBytes32 = await contract.methods[constantName]().call();

      // 2. Call grantRole with correct 4-arg signature:
      //    grantRole(address _account, bytes32 _role, string _orgName, uint256 _expiry)
      setTxMessage('⏳ Sending transaction...');
      await contract.methods.grantRole(
        roleForm.address,
        roleBytes32,
        roleForm.name,
        Number(roleForm.expiry) || 0
      ).send({ from: account });

      setTxMessage(`✅ Role granted successfully to ${roleForm.name}!`);
      setShowGrantRole(false);
      setRoleForm({ address: '', role: '4', name: '', expiry: '0' });
      loadStats();

    } catch (error) {
      console.error('Error granting role:', error);
      // Surface the revert reason if available
      const reason = error?.data?.message || error?.message || 'Unknown error';
      setTxMessage('❌ Failed to grant role: ' + reason);
    } finally {
      setGranting(false);
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
          onClick={() => { setShowGrantRole(!showGrantRole); setTxMessage(''); }}
          className="primary-button"
        >
          {showGrantRole ? '❌ Cancel' : '👤 Grant Role'}
        </button>
      </div>

      {/* ── Stats Cards ── */}
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

      {/* ── Grant Role Form ── */}
      {showGrantRole && (
        <div className="card">
          <h2>Grant Role to New Member</h2>

          <form onSubmit={handleGrantRole} className="form">

            {/* Wallet Address */}
            <div className="form-group">
              <label>Wallet Address *</label>
              <input
                type="text"
                value={roleForm.address}
                onChange={(e) => setRoleForm({ ...roleForm, address: e.target.value })}
                placeholder="0x..."
                required
              />
            </div>

            {/* Role Selector */}
            <div className="form-group">
              <label>Role *</label>
              <select
                value={roleForm.role}
                onChange={(e) => setRoleForm({ ...roleForm, role: e.target.value })}
                required
              >
                <option value="2">SPC — State Pharmaceuticals Corporation</option>
                <option value="3">MSD — Medical Supplies Division</option>
                <option value="4">Manufacturer</option>
                <option value="5">Importer</option>
                <option value="6">Wholesaler</option>
                <option value="7">Pharmacy</option>
                <option value="8">Hospital</option>
                <option value="9">Transporter</option>
                <option value="10">Patient</option>
              </select>
            </div>

            {/* Organisation Name */}
            <div className="form-group">
              <label>Organization Name *</label>
              <input
                type="text"
                value={roleForm.name}
                onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                placeholder="e.g., Colombo General Pharmacy"
                required
              />
            </div>

            {/* Expiry (optional — 0 means no expiry) */}
            <div className="form-group">
              <label>License Expiry (Unix timestamp, 0 = no expiry)</label>
              <input
                type="number"
                value={roleForm.expiry}
                onChange={(e) => setRoleForm({ ...roleForm, expiry: e.target.value })}
                placeholder="0"
                min="0"
              />
              <small style={{ color: '#636e72' }}>
                Leave as 0 for no expiry. Use a Unix timestamp if you want an expiry date.
              </small>
            </div>

            <button type="submit" className="submit-button" disabled={granting}>
              {granting ? '⏳ Granting...' : '✅ Grant Role'}
            </button>
          </form>

          {/* Transaction feedback */}
          {txMessage && (
            <div
              className="info-box"
              style={{
                marginTop: '12px',
                background: txMessage.startsWith('✅') ? '#e8f5e9' : txMessage.startsWith('⏳') ? '#fff3e0' : '#fdecea',
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

      {/* ── System Overview ── */}
      <div className="card">
        <h2>System Overview</h2>
        <div className="info-box">
          <p>✅ Blockchain network operational</p>
          <p>✅ All 5 smart contracts deployed</p>
          <p>✅ AI Oracle active</p>
          <p>✅ Consensus switching enabled (PoA ↔ PBFT)</p>
        </div>

        <h3 style={{ marginTop: '16px' }}>📋 Registered Accounts</h3>
        <div style={{ fontSize: '13px', color: '#636e72', lineHeight: '1.8' }}>
          <div>Account 0 → <strong>NMRA</strong> (you)</div>
          <div>Account 1 → <strong>SPC</strong> — State Pharmaceuticals Corporation</div>
          <div>Account 2 → <strong>MSD</strong> — Medical Supplies Division</div>
          <div>Account 3 → <strong>Manufacturer 1</strong> — Lanka Pharmaceuticals Ltd</div>
          <div>Account 4 → <strong>Manufacturer 2</strong> — Ceylon Pharma Industries</div>
          <div>Account 5 → <strong>Importer</strong> — Global Meds Import Agency</div>
          <div>Account 6 → <strong>Wholesaler</strong> — National Medical Wholesalers</div>
          <div>Account 7 → <strong>Pharmacy</strong> — CareLife Pharmacy Chain</div>
          <div>Account 8 → <strong>Hospital</strong> — Colombo Teaching Hospital Pharmacy</div>
          <div>Account 9 → <strong>Transporter</strong> — MediCold Transport Solutions</div>
        </div>
      </div>
    </div>
  );
};

export default NMRADashboard;