import { Link, useNavigate } from 'react-router-dom';
import { ROLE_NAMES } from '../utils/roleDetector';
import ConnectWallet from './ConnectWallet';

const Navbar = ({ userRole, userName, onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    if (onLogout) onLogout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo */}
        <div className="navbar-brand">
          <Link to="/">
            <h1>🏥 PharmaChain SL</h1>
          </Link>
        </div>

        {/* User Info */}
        <div className="navbar-user">
          {userName && (
            <div className="user-info">
              <span className="user-role" style={{
                backgroundColor: getRoleColor(userRole),
                color: 'white',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '0.85rem',
                fontWeight: '600'
              }}>
                {ROLE_NAMES[userRole] || 'Unknown'}
              </span>
              <span className="user-name">{userName}</span>
            </div>
          )}
          
          <ConnectWallet />
          
          {userName && (
            <button onClick={handleLogout} className="logout-button">
              Logout
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

// Helper function for role colors
const getRoleColor = (role) => {
  const colors = {
    1: '#dc2626',  2: '#2563eb',  3: '#7c3aed',
    4: '#059669',  7: '#ea580c',  8: '#db2777',  10: '#0891b2'
  };
  return colors[role] || '#6b7280';
};

export default Navbar;
