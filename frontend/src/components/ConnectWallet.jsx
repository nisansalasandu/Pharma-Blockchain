import { useState, useEffect } from 'react';
import { initWeb3, getCurrentAccount, onAccountChanged, formatAddress } from '../utils/web3';

const ConnectWallet = ({ onConnect }) => {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if already connected
    checkConnection();
    
    // Listen for account changes
    onAccountChanged((newAccount) => {
      setAccount(newAccount);
      if (onConnect) onConnect(newAccount);
    });
  }, []);

  const checkConnection = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        const web3 = await initWeb3();
        const currentAccount = await getCurrentAccount();
        setAccount(currentAccount);
        if (onConnect) onConnect(currentAccount);
      }
    } catch (err) {
      // Silent fail on initial check
      console.log('Not connected yet');
    }
  };

  const connectWallet = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await initWeb3();
      const currentAccount = await getCurrentAccount();
      setAccount(currentAccount);
      if (onConnect) onConnect(currentAccount);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (account) {
    return (
      <div className="wallet-connected">
        <div className="wallet-address">
          <span className="wallet-icon">🔗</span>
          <span className="address">{formatAddress(account)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-connect">
      <button 
        onClick={connectWallet} 
        disabled={loading}
        className="connect-button"
      >
        {loading ? '⏳ Connecting...' : '🦊 Connect MetaMask'}
      </button>
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default ConnectWallet;
