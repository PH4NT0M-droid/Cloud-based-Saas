const ApiError = require('../utils/ApiError');

const PERMISSION_KEYS = ['canManageProperties', 'canManageRooms', 'canManagePricing', 'canManageInventory'];

const defaultPermissions = () =>
  PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {});

const normalizePermissions = (permissions = {}) => ({
  ...defaultPermissions(),
  ...(permissions && typeof permissions === 'object' ? permissions : {}),
});

const getUserId = (user) => user?.id || user?.sub || null;

const hasPermission = (user, permission) => user?.role === 'ADMIN' || Boolean(user?.permissions?.[permission]);

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
  defaultPermissions,
  normalizePermissions,
  getUserId,
  getManagedPropertyIds,
  hasPermission,
  assertPermission,
  assertPropertyAccess,
  assertPropertyMutationAccess,
  assertRoomTypeAccess,
};