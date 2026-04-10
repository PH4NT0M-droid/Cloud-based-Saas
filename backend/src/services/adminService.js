const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { normalizePermissions } = require('./accessControl');
const { sanitizeUser } = require('./authService');

const managerInclude = {
  propertyManagers: {
    select: {
      property: {
        select: { id: true, name: true, location: true },
      },
      propertyId: true,
    },
  },
};

const withManagedProperties = (user) => ({
  ...user,
  managedProperties: (user.propertyManagers || []).map((assignment) => assignment.property),
});

const assertManagerExists = async (id) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new ApiError(404, 'Manager not found');
  }

  if (user.role !== 'MANAGER') {
    throw new ApiError(400, 'Only manager accounts can be managed here');
  }

  return user;
};

const listUsers = async () => {
  const users = await prisma.user.findMany({
    where: { role: 'MANAGER' },
    orderBy: { createdAt: 'desc' },
    include: managerInclude,
  });

  return users.map((user) => sanitizeUser(withManagedProperties(user)));
};

const setManagerPropertyAssignments = async (tx, userId, propertyIds) => {
  await tx.propertyManager.deleteMany({
    where: { userId },
  });

  if (!propertyIds || propertyIds.length === 0) {
    return;
  }

  await tx.propertyManager.createMany({
    data: propertyIds.map((propertyId) => ({ userId, propertyId })),
    skipDuplicates: true,
  });
};

const createManager = async ({ name, email, password, permissions, propertyIds = [] }) => {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new ApiError(409, 'Email already in use');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const normalizedPermissions = normalizePermissions(permissions);

  const manager = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: 'MANAGER',
      permissions: normalizedPermissions,
    },
  });

  await prisma.$transaction(async (tx) => {
    await setManagerPropertyAssignments(tx, manager.id, propertyIds);
  });

  const created = await prisma.user.findUnique({
    where: { id: manager.id },
    include: managerInclude,
  });

  return sanitizeUser(withManagedProperties(created));
};

const updateManager = async (id, payload) => {
  const existing = await assertManagerExists(id);
  const nextPassword = typeof payload.password === 'string' ? payload.password.trim() : '';

  if (payload.email && payload.email !== existing.email) {
    const taken = await prisma.user.findUnique({ where: { email: payload.email } });
    if (taken) {
      throw new ApiError(409, 'Email already in use');
    }
  }

  const updateData = {
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.email !== undefined ? { email: payload.email } : {}),
    ...(payload.permissions !== undefined ? { permissions: normalizePermissions(payload.permissions) } : {}),
  };

  if (nextPassword) {
    updateData.passwordHash = await bcrypt.hash(nextPassword, 12);
  }

  await prisma.$transaction(async (tx) => {
    if (Array.isArray(payload.propertyIds)) {
      await setManagerPropertyAssignments(tx, id, payload.propertyIds);
    }

    await tx.user.update({
      where: { id },
      data: updateData,
    });
  });

  const updated = await prisma.user.findUnique({
    where: { id },
    include: managerInclude,
  });

  return sanitizeUser(withManagedProperties(updated));
};

const deleteManager = async (id) => {
  await assertManagerExists(id);

  await prisma.$transaction(async (tx) => {
    await tx.propertyManager.deleteMany({ where: { userId: id } });

    await tx.user.delete({ where: { id } });
  });

  return { id };
};

const assignProperty = async (userId, propertyId) => {
  await assertManagerExists(userId);

  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) {
    throw new ApiError(404, 'Property not found');
  }

  await prisma.propertyManager.upsert({
    where: { userId_propertyId: { userId, propertyId } },
    create: { userId, propertyId },
    update: {},
  });

  return { userId, propertyId };
};

const removeProperty = async (userId, propertyId) => {
  await assertManagerExists(userId);

  await prisma.propertyManager.deleteMany({
    where: { userId, propertyId },
  });

  return { userId, propertyId };
};

module.exports = {
  listUsers,
  createManager,
  updateManager,
  deleteManager,
  assignProperty,
  removeProperty,
};