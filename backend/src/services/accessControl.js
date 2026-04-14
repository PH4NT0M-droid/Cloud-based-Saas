const ApiError = require('../utils/ApiError');

const PERMISSION_KEYS = ['canManageProperties', 'canManageRooms', 'canManagePricing', 'canManageInventory', 'manage_bookings'];
const PROPERTY_EDIT_PERMISSIONS = ['canManageProperties', 'MANAGE_PROPERTY', 'manage_property', 'EDIT_PROPERTY', 'edit_property'];
const PROPERTY_PERMISSION_ALIAS_MAP = {
  canManageProperties: ['canManageProperties', 'MANAGE_PROPERTY', 'manage_property', 'EDIT_PROPERTY', 'edit_property'],
  canManageRooms: ['canManageRooms', 'MANAGE_ROOMS', 'manage_rooms'],
  canManagePricing: ['canManagePricing', 'MANAGE_PRICING', 'manage_pricing'],
  canManageInventory: ['canManageInventory', 'MANAGE_INVENTORY', 'manage_inventory'],
  manage_bookings: ['manage_bookings', 'MANAGE_BOOKINGS', 'manageBookings'],
};

const defaultPermissions = () =>
  PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {});

const applyPermissionInheritance = (permissions) => {
  const nextPermissions = { ...permissions };

  if (nextPermissions.canManageProperties) {
    nextPermissions.canManageRooms = true;
    nextPermissions.canManagePricing = true;
    nextPermissions.canManageInventory = true;
  }

  if (nextPermissions.canManageRooms) {
    nextPermissions.canManagePricing = true;
    nextPermissions.canManageInventory = true;
  }

  return nextPermissions;
};

const normalizePermissions = (permissions = {}) => {
  const raw = permissions && typeof permissions === 'object' ? permissions : {};
  const normalized = {
    ...defaultPermissions(),
    ...raw,
    ...(raw.canManageBookings !== undefined && raw.manage_bookings === undefined
      ? { manage_bookings: Boolean(raw.canManageBookings) }
      : {}),
  };

  return applyPermissionInheritance(normalized);
};

const normalizePropertyPermissions = (value = {}) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce((acc, [propertyId, permissions]) => {
    if (!propertyId || !Array.isArray(permissions)) {
      return acc;
    }

    acc[propertyId] = [...new Set(permissions.filter((permission) => typeof permission === 'string' && permission.trim().length > 0))];
    return acc;
  }, {});
};

const getPermissionAliases = (permission) => PROPERTY_PERMISSION_ALIAS_MAP[permission] || [permission];

const getUserId = (user) => user?.id || user?.sub || null;

const hasPermission = (user, propertyIdOrPermission, maybePermission) => {
  const propertyId = maybePermission ? propertyIdOrPermission : null;
  const permission = maybePermission || propertyIdOrPermission;

  if (user?.role === 'ADMIN') {
    return true;
  }

  if (propertyId) {
    const propertyPermissions = normalizePropertyPermissions(user?.propertyPermissions);
    const scopedPermissions = propertyPermissions[propertyId] || [];
    if (scopedPermissions.length > 0) {
      const aliases = getPermissionAliases(permission);
      return aliases.some((alias) => scopedPermissions.includes(alias));
    }
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

const canEditProperty = (user, propertyId = null) =>
  PROPERTY_EDIT_PERMISSIONS.some((permission) => (propertyId ? hasPermission(user, propertyId, permission) : hasPermission(user, permission)));

const canManageBookings = (user) => {
  if (user?.role === 'ADMIN') {
    return true;
  }

  if (Boolean(normalizePermissions(user?.permissions).manage_bookings)) {
    return true;
  }

  const scopedPermissions = normalizePropertyPermissions(user?.propertyPermissions);
  const bookingAliases = getPermissionAliases('manage_bookings');

  return Object.values(scopedPermissions).some(
    (permissions) => Array.isArray(permissions) && bookingAliases.some((alias) => permissions.includes(alias)),
  );
};

const assertPermission = (user, permission, message = 'You are not authorized to perform this action', propertyId = null) => {
  const allowed = propertyId ? hasPermission(user, propertyId, permission) : hasPermission(user, permission);
  if (!allowed) {
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
  assertPermission(user, permissionKey, 'You are not authorized to perform this action', property?.id);
};

const assertRoomTypeAccess = (roomType, user, permissionKey) => {
  if (!roomType) {
    throw new ApiError(404, 'Room type not found');
  }

  assertPropertyAccess(roomType.property, user, 'You are not authorized to access this room type');

  if (permissionKey) {
    assertPermission(user, permissionKey, 'You are not authorized to perform this action', roomType.property?.id);
  }
};

module.exports = {
  PERMISSION_KEYS,
  PROPERTY_EDIT_PERMISSIONS,
  defaultPermissions,
  applyPermissionInheritance,
  normalizePermissions,
  normalizePropertyPermissions,
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