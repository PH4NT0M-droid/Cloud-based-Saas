const { verifyToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');
const prisma = require('../config/prisma');
const { normalizePermissions, canManageBookings, canEditProperty } = require('../services/accessControl');

const sanitizeAuthenticatedUser = (user) => {
  const mappedProperties = (user.propertyManagers || []).map((assignment) => assignment.property);
  const managedProperties = mappedProperties.length > 0 ? mappedProperties : user.managedProperties || [];
  const propertyPermissions = (user.managerPropertyPermissions || []).reduce((acc, row) => {
    if (!row?.propertyId) {
      return acc;
    }

    acc[row.propertyId] = Array.isArray(row.permissions) ? row.permissions.filter((permission) => typeof permission === 'string') : [];
    return acc;
  }, {});

  return {
    id: user.id,
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: normalizePermissions(user.permissions),
    propertyPermissions,
    managedProperties,
    managedPropertyIds: managedProperties.map((property) => property.id),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Missing or invalid authorization token'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        propertyManagers: {
          select: {
            propertyId: true,
            property: {
              select: { id: true, name: true, location: true },
            },
          },
        },
        managerPropertyPermissions: {
          select: {
            propertyId: true,
            permissions: true,
          },
        },
      },
    });

    if (!user) {
      return next(new ApiError(401, 'Invalid or expired token'));
    }

    req.user = sanitizeAuthenticatedUser(user);
    return next();
  } catch (error) {
    return next(new ApiError(401, 'Invalid or expired token'));
  }
};

const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new ApiError(403, 'You are not authorized to access this resource'));
  }

  return next();
};

const authorizeManageBookings = (req, res, next) => {
  if (!canManageBookings(req.user)) {
    return next(new ApiError(403, 'You are not authorized to manage bookings'));
  }

  return next();
};

const authorizePropertyEdit = (req, res, next) => {
  const targetPropertyId = req.params?.id || null;
  if (!canEditProperty(req.user, targetPropertyId)) {
    return next(new ApiError(403, 'Unauthorized'));
  }

  return next();
};

module.exports = {
  authenticate,
  authorizeRoles,
  authorizeManageBookings,
  authorizePropertyEdit,
};
