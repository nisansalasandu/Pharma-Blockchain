import { getWeb3 } from './web3';
import addresses from '../contracts/addresses.json';

// Import ABIs
import RoleAccessControlABI from '../contracts/abis/RoleAccessControl.json';
import TraceabilityContractABI from '../contracts/abis/TraceabilityContract.json';
import OrderingContractABI from '../contracts/abis/OrderingContract.json';

let contractInstances = {};

/**
 * Get RoleAccessControl contract instance
 */
export const getRoleAccessControl = () => {
  if (!contractInstances.roleAccessControl) {
    const web3 = getWeb3();
    contractInstances.roleAccessControl = new web3.eth.Contract(
      RoleAccessControlABI,
      addresses.RoleAccessControl
    );
  }
  return contractInstances.roleAccessControl;
};

/**
 * Get TraceabilityContract instance
 */
export const getTraceabilityContract = () => {
  if (!contractInstances.traceability) {
    const web3 = getWeb3();
    contractInstances.traceability = new web3.eth.Contract(
      TraceabilityContractABI,
      addresses.TraceabilityContract
    );
  }
  return contractInstances.traceability;
};

/**
 * Get OrderingContract instance
 */
export const getOrderingContract = () => {
  if (!contractInstances.ordering) {
    const web3 = getWeb3();
    contractInstances.ordering = new web3.eth.Contract(
      OrderingContractABI,
      addresses.OrderingContract
    );
  }
  return contractInstances.ordering;
};

/**
 * Get all contract instances
 */
export const getAllContracts = () => {
  return {
    roleAccessControl: getRoleAccessControl(),
    traceability: getTraceabilityContract(),
    ordering: getOrderingContract()
  };
};

/**
 * Clear contract cache (useful for testing)
 */
export const clearContractCache = () => {
  contractInstances = {};
};

export default {
  getRoleAccessControl,
  getTraceabilityContract,
  getOrderingContract,
  getAllContracts,
  clearContractCache
};