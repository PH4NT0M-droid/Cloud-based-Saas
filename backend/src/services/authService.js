const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { signToken } = require('../utils/jwt');
const { normalizePermissions } = require('./accessControl');

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  permissions: normalizePermissions(user.permissions),
  managedProperties: (user.managedProperties || user.propertyManagers?.map((assignment) => assignment.property) || []).map((property) => ({
    id: property.id,
    name: property.name,
    location: property.location,
  })),
  managedPropertyIds: (user.managedProperties || user.propertyManagers?.map((assignment) => assignment.property) || []).map(
    (property) => property.id,
  ),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      propertyManagers: {
        select: {
          property: {
            select: { id: true, name: true, location: true },
          },
        },
      },
    },
  });
  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    user: sanitizeUser(user),
    token,
  };
};

const ensureDefaultAdmin = async () => {
  const adminEmail = 'admin@admin.com';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (existingAdmin) {
    return existingAdmin;
  }

  const passwordHash = await bcrypt.hash('Password123', 12);

  return prisma.user.create({
    data: {
      name: 'System Administrator',
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
      permissions: normalizePermissions({
        canManageProperties: true,
        canManageRooms: true,
        canManagePricing: true,
        canManageInventory: true,
        manage_bookings: true,
      }),
    },
  });
};

module.exports = {
  login,
  ensureDefaultAdmin,
  sanitizeUser,
};
