import Web3 from 'web3';
import addresses from '../contracts/addresses.json';

let web3Instance = null;
let accountsCache = null;

/**
 * Initialize Web3 with MetaMask
 */
export const initWeb3 = async () => {
  if (typeof window.ethereum !== 'undefined') {
    try {
      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      web3Instance = new Web3(window.ethereum);
      
      // Check if connected to correct network
      const chainId = await web3Instance.eth.getChainId();
      if (Number(chainId) !== addresses.networkId) {
        throw new Error(`Please connect to network ${addresses.networkId} (Ganache)`);
      }
      
      return web3Instance;
    } catch (error) {
      console.error('Failed to initialize Web3:', error);
      throw error;
    }
  } else {
    throw new Error('MetaMask not detected. Please install MetaMask extension.');
  }
};

/**
 * Get Web3 instance (singleton pattern)
 */
export const getWeb3 = () => {
  if (!web3Instance) {
    throw new Error('Web3 not initialized. Call initWeb3() first.');
  }
  return web3Instance;
};

/**
 * Get current connected account
 */
export const getCurrentAccount = async () => {
  const web3 = getWeb3();
  const accounts = await web3.eth.getAccounts();
  
  if (accounts.length === 0) {
    throw new Error('No account connected');
  }
  
  accountsCache = accounts[0];
  return accounts[0];
};

/**
 * Listen for account changes
 */
export const onAccountChanged = (callback) => {
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
      accountsCache = accounts[0] || null;
      callback(accounts[0] || null);
    });
  }
};

/**
 * Listen for network changes
 */
export const onChainChanged = (callback) => {
  if (window.ethereum) {
    window.ethereum.on('chainChanged', (chainId) => {
      callback(chainId);
      // Reload page on network change (recommended by MetaMask)
      window.location.reload();
    });
  }
};

/**
 * Format address for display (0x1234...5678)
 */
export const formatAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * Convert Wei to Ether
 */
export const weiToEth = (wei) => {
  const web3 = getWeb3();
  return web3.utils.fromWei(wei, 'ether');
};

/**
 * Convert Ether to Wei
 */
export const ethToWei = (eth) => {
  const web3 = getWeb3();
  return web3.utils.toWei(eth, 'ether');
};

export default {
  initWeb3,
  getWeb3,
  getCurrentAccount,
  onAccountChanged,
  onChainChanged,
  formatAddress,
  weiToEth,
  ethToWei
};
