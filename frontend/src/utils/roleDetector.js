import { getRoleAccessControl } from './contracts';

// Role constants (match Solidity contract)
export const ROLES = {
  NONE: 0,
  NMRA: 1,
  SPC: 2,
  MSD: 3,
  MANUFACTURER: 4,
  IMPORTER: 5,
  WHOLESALER: 6,
  PHARMACY: 7,
  HOSPITAL: 8,
  TRANSPORTER: 9,
  PATIENT: 10
};

export const ROLE_NAMES = {
  0: 'None',
  1: 'NMRA',
  2: 'State Pharmaceuticals Corporation',
  3: 'Medical Supplies Division',
  4: 'Manufacturer',
  5: 'Importer',
  6: 'Wholesaler',
  7: 'Pharmacy',
  8: 'Hospital',
  9: 'Transporter',
  10: 'Patient'
};

export const ROLE_ROUTES = {
  1: '/nmra',
  2: '/spc',
  3: '/msd',
  4: '/manufacturer',
  7: '/pharmacy',
  8: '/hospital',
  10: '/patient'
};

/**
 * Detect user's role from blockchain
 */
export const detectUserRole = async (userAddress) => {
  try {
    const roleContract = getRoleAccessControl();
    const memberInfo = await roleContract.methods.getMemberInfo(userAddress).call();
    
    return {
      role: Number(memberInfo.role),
      name: memberInfo.name,
      isActive: memberInfo.isActive,
      roleName: ROLE_NAMES[Number(memberInfo.role)],
      dashboardRoute: ROLE_ROUTES[Number(memberInfo.role)] || '/unauthorized'
    };
  } catch (error) {
    console.error('Error detecting role:', error);
    return {
      role: ROLES.NONE,
      name: '',
      isActive: false,
      roleName: 'None',
      dashboardRoute: '/login'
    };
  }
};

/**
 * Check if user has specific role
 */
export const hasRole = (userRole, requiredRole) => {
  return Number(userRole) === Number(requiredRole);
};

/**
 * Check if user has any of the specified roles
 */
export const hasAnyRole = (userRole, requiredRoles) => {
  return requiredRoles.some(role => Number(userRole) === Number(role));
};

/**
 * Get role color for UI badges
 */
export const getRoleColor = (role) => {
  const colors = {
    1: '#dc2626',  // NMRA - red
    2: '#2563eb',  // SPC - blue
    3: '#7c3aed',  // MSD - purple
    4: '#059669',  // Manufacturer - green
    7: '#ea580c',  // Pharmacy - orange
    8: '#db2777',  // Hospital - pink
    10: '#0891b2' // Patient - cyan
  };
  return colors[role] || '#6b7280';
};

export default {
  ROLES,
  ROLE_NAMES,
  ROLE_ROUTES,
  detectUserRole,
  hasRole,
  hasAnyRole,
  getRoleColor
};
