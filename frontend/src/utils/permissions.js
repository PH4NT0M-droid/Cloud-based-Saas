const PROPERTY_PERMISSION_ALIASES = {
  canManageProperties: ['canManageProperties', 'MANAGE_PROPERTY', 'manage_property', 'EDIT_PROPERTY', 'edit_property'],
  canManageRooms: ['canManageRooms', 'MANAGE_ROOMS', 'manage_rooms'],
  canManagePricing: ['canManagePricing', 'MANAGE_PRICING', 'manage_pricing'],
  canManageInventory: ['canManageInventory', 'MANAGE_INVENTORY', 'manage_inventory'],
  manage_bookings: ['manage_bookings', 'MANAGE_BOOKINGS', 'manageBookings'],
};

const getAliases = (permission) => PROPERTY_PERMISSION_ALIASES[permission] || [permission];

const hasGlobalPermission = (user, permission) => {
  const aliases = getAliases(permission);
  return aliases.some((alias) => Boolean(user?.permissions?.[alias]));
};

const hasScopedPermission = (user, permission) => {
  const aliases = getAliases(permission);
  const propertyPermissions = user?.propertyPermissions;

  if (!propertyPermissions || typeof propertyPermissions !== 'object' || Array.isArray(propertyPermissions)) {
    return false;
  }

  return Object.values(propertyPermissions).some(
    (permissions) => Array.isArray(permissions) && aliases.some((alias) => permissions.includes(alias)),
  );
};

export const hasPermission = (user, permission) => {
  if (user?.role === 'ADMIN') {
    return true;
  }

  return hasGlobalPermission(user, permission) || hasScopedPermission(user, permission);
};

export const canManageBookings = (user) => hasPermission(user, 'manage_bookings');
