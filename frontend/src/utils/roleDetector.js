import { getRoleAccessControl } from './contracts';

// Numeric role IDs — used for routing and UI logic
export const ROLES = {
  NONE:         0,
  NMRA:         1,
  SPC:          2,
  MSD:          3,
  MANUFACTURER: 4,
  IMPORTER:     5,
  WHOLESALER:   6,
  PHARMACY:     7,
  HOSPITAL:     8,
  TRANSPORTER:  9,
  PATIENT:      10
};

export const ROLE_NAMES = {
  0:  'None',
  1:  'NMRA',
  2:  'State Pharmaceuticals Corporation',
  3:  'Medical Supplies Division',
  4:  'Manufacturer',
  5:  'Importer',
  6:  'Wholesaler',
  7:  'Pharmacy',
  8:  'Hospital',
  9:  'Transporter',
  10: 'Patient'
};

// Maps the string returned by roleName() → numeric ID
const ROLE_STRING_TO_ID = {
  'NMRA':         1,
  'SPC':          2,
  'MSD':          3,
  'MANUFACTURER': 4,
  'IMPORTER':     5,
  'WHOLESALER':   6,
  'PHARMACY':     7,
  'HOSPITAL':     8,
  'TRANSPORTER':  9,
  'PATIENT':      10
};

export const ROLE_ROUTES = {
  1:  '/nmra',
  2:  '/spc',
  3:  '/msd',
  4:  '/manufacturer',
  7:  '/pharmacy',
  8:  '/hospital',
  10: '/patient'
};

/**
 * Detect user's role from blockchain.
 *
 * The contract stores roles as bytes32 keccak256 hashes, NOT integers.
 * We call getMember() to get the bytes32 value, then roleName() to
 * convert it to a human-readable string ("NMRA", "SPC", etc.),
 * then map that string to our numeric ID for routing.
 */
export const detectUserRole = async (userAddress) => {
  try {
    const roleContract = getRoleAccessControl();

    // getMember returns: (bytes32 role, string orgName, bool isActive,
    //                     address grantedBy, uint256 grantedAt, uint256 licenseExpiry)
    const memberInfo = await roleContract.methods.getMember(userAddress).call();

    const roleBytes = memberInfo.role;      // bytes32 hex string
    const orgName   = memberInfo.orgName;   // organisation name string
    const isActive  = memberInfo.isActive;  // bool

    // Convert bytes32 → readable string using the contract's roleName() helper
    const roleString = await roleContract.methods.roleName(roleBytes).call();
    // Returns "NMRA", "SPC", "MANUFACTURER", etc., or "UNKNOWN"

    const roleId = ROLE_STRING_TO_ID[roleString] || 0;

    return {
      role:           roleId,
      roleBytes:      roleBytes,
      name:           orgName,
      isActive:       isActive,
      roleName:       roleString,
      dashboardRoute: ROLE_ROUTES[roleId] || '/unauthorized'
    };

  } catch (error) {
    console.error('Error detecting role:', error);
    return {
      role:           ROLES.NONE,
      roleBytes:      null,
      name:           '',
      isActive:       false,
      roleName:       'None',
      dashboardRoute: '/login'
    };
  }
};

/**
 * Check if user has a specific role (by numeric ID)
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
 * Get role badge colour for UI
 */
export const getRoleColor = (role) => {
  const colors = {
    1:  '#dc2626',  // NMRA        - red
    2:  '#2563eb',  // SPC         - blue
    3:  '#7c3aed',  // MSD         - purple
    4:  '#059669',  // Manufacturer- green
    5:  '#0891b2',  // Importer    - cyan
    6:  '#d97706',  // Wholesaler  - amber
    7:  '#ea580c',  // Pharmacy    - orange
    8:  '#db2777',  // Hospital    - pink
    9:  '#65a30d',  // Transporter - lime
    10: '#0891b2'   // Patient     - cyan
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