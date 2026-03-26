import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { initWeb3, getCurrentAccount } from '../utils/web3';
import { detectUserRole, ROLE_NAMES, ROLE_ROUTES } from '../utils/roleDetector';
import ConnectWallet from '../components/ConnectWallet';
import LoadingSpinner from '../components/LoadingSpinner';

const Login = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [account, setAccount] = useState(null);
  const navigate = useNavigate();

  const handleWalletConnect = async (connectedAccount) => {
    setAccount(connectedAccount);
  };

  const handleLogin = async () => {
    if (!account) {
      setError('Please connect your MetaMask wallet first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Detect user role from blockchain
      const roleInfo = await detectUserRole(account);

      if (!roleInfo.isActive) {
        setError('Your account is not registered or has been deactivated. Please contact NMRA.');
        setLoading(false);
        return;
      }

      if (roleInfo.role === 0) {
        setError('No role assigned to this account. Please contact NMRA for registration.');
        setLoading(false);
        return;
      }

      // Call parent's login handler
      if (onLogin) {
        onLogin({
          account,
          role: roleInfo.role,
          name: roleInfo.name,
          roleName: roleInfo.roleName
        });
      }

      // Navigate to appropriate dashboard
      navigate(roleInfo.dashboardRoute);

    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to verify account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Verifying your credentials..." />;
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>🏥 Sri Lankan Pharmaceutical Blockchain</h1>
          <p>Secure, Transparent, AI-Powered Supply Chain</p>
        </div>

        <div className="login-card">
          <h2>Connect Your Wallet</h2>
          <p className="login-subtitle">
            Connect your MetaMask wallet to access the system
          </p>

          <div className="login-steps">
            <div className="step">
              <span className="step-number">1</span>
              <span>Connect MetaMask</span>
            </div>
            <div className="step">
              <span className="step-number">2</span>
              <span>Verify Role</span>
            </div>
            <div className="step">
              <span className="step-number">3</span>
              <span>Access Dashboard</span>
            </div>
          </div>

          <div className="connect-section">
            <ConnectWallet onConnect={handleWalletConnect} />
          </div>

          {account && (
            <div className="account-info">
              <p>✅ Wallet Connected</p>
              <p className="account-address">{account}</p>
            </div>
          )}

          <button 
            onClick={handleLogin} 
            disabled={!account || loading}
            className="login-button"
          >
            {loading ? 'Verifying...' : 'Login to Dashboard'}
          </button>

          {error && (
            <div className="error-box">
              <p>❌ {error}</p>
            </div>
          )}
        </div>

        <div className="login-info">
          <h3>Supported Roles</h3>
          <div className="roles-grid">
            {[1, 2, 3, 4, 7, 8, 10].map(roleId => (
              <div key={roleId} className="role-badge">
                {ROLE_NAMES[roleId]}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
