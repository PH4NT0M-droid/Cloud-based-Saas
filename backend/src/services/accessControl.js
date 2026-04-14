const ApiError = require('../utils/ApiError');

const PERMISSION_KEYS = ['canManageProperties', 'canManageRooms', 'canManagePricing', 'canManageInventory', 'manage_bookings'];
const PROPERTY_EDIT_PERMISSIONS = ['canManageProperties', 'EDIT_PROPERTY', 'edit_property'];

const defaultPermissions = () =>
  PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {});

const normalizePermissions = (permissions = {}) => {
  const raw = permissions && typeof permissions === 'object' ? permissions : {};
  return {
    ...defaultPermissions(),
    ...raw,
    ...(raw.canManageBookings !== undefined && raw.manage_bookings === undefined
      ? { manage_bookings: Boolean(raw.canManageBookings) }
      : {}),
  };
};

const getUserId = (user) => user?.id || user?.sub || null;

const hasPermission = (user, permission) => {
  if (user?.role === 'ADMIN') {
    return true;
  }

  const permissions = user?.permissions;
  if (Array.isArray(permissions)) {
    return permissions.includes(permission);
  }

  if (permissions && typeof permissions === 'object') {
    return Boolean(permissions[permission]);
  }

  return false;
};

const canEditProperty = (user) => PROPERTY_EDIT_PERMISSIONS.some((permission) => hasPermission(user, permission));

const canManageBookings = (user) => user?.role === 'ADMIN' || Boolean(normalizePermissions(user?.permissions).manage_bookings);

const assertPermission = (user, permission, message = 'You are not authorized to perform this action') => {
  if (!hasPermission(user, permission)) {
    throw new ApiError(403, message);
  }
};

const getManagedPropertyIds = (user) => {
  if (Array.isArray(user?.managedPropertyIds)) {
    return user.managedPropertyIds;
  }

  if (Array.isArray(user?.managedProperties)) {
    return user.managedProperties.map((property) => property.id);
  }

  return [];
};

const isPropertyAssignedToUser = (property, user) => {
  const propertyId = property?.id;
  if (!propertyId) {
    return false;
  }

  return getManagedPropertyIds(user).includes(propertyId);
};

const assertPropertyAccess = (property, user, message = 'You are not authorized to access this property') => {
  if (!property) {
    throw new ApiError(404, 'Property not found');
  }

  if (user?.role === 'ADMIN' || isPropertyAssignedToUser(property, user)) {
    return property;
  }

  throw new ApiError(403, message);
};

const assertPropertyMutationAccess = (property, user, permissionKey) => {
  assertPropertyAccess(property, user);
  assertPermission(user, permissionKey);
};

const assertRoomTypeAccess = (roomType, user, permissionKey) => {
  if (!roomType) {
    throw new ApiError(404, 'Room type not found');
  }

  assertPropertyAccess(roomType.property, user, 'You are not authorized to access this room type');

  if (permissionKey) {
    assertPermission(user, permissionKey);
  }
};

module.exports = {
  PERMISSION_KEYS,
  PROPERTY_EDIT_PERMISSIONS,
  defaultPermissions,
  normalizePermissions,
  getUserId,
  getManagedPropertyIds,
  hasPermission,
  canEditProperty,
  canManageBookings,
  assertPermission,
  assertPropertyAccess,
  assertPropertyMutationAccess,
  assertRoomTypeAccess,
};