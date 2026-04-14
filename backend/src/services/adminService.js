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
  managerPropertyPermissions: {
    select: {
      propertyId: true,
      permissions: true,
    },
  },
};

const withManagedProperties = (user) => ({
  ...user,
  managedProperties: (user.propertyManagers || []).map((assignment) => assignment.property),
  propertyPermissions: (user.managerPropertyPermissions || []).reduce((acc, row) => {
    if (!row?.propertyId) {
      return acc;
    }

    acc[row.propertyId] = Array.isArray(row.permissions)
      ? row.permissions.filter((permission) => typeof permission === 'string')
      : [];
    return acc;
  }, {}),
});

const normalizePropertyIds = (propertyIds = []) => [...new Set(propertyIds.filter(Boolean))];

const normalizePropertyPermissions = (propertyPermissions = {}) => {
  if (!propertyPermissions || typeof propertyPermissions !== 'object' || Array.isArray(propertyPermissions)) {
    return {};
  }

  return Object.entries(propertyPermissions).reduce((acc, [propertyId, permissions]) => {
    if (!propertyId || !Array.isArray(permissions)) {
      return acc;
    }

    acc[propertyId] = [
      ...new Set(
        permissions
          .filter((permission) => typeof permission === 'string' && permission.trim().length > 0)
          .map((permission) => {
            if (permission === 'VIEW_BOOKINGS') {
              return 'MANAGE_BOOKINGS';
            }

            if (permission === 'EDIT_PROPERTY') {
              return 'MANAGE_PROPERTY';
            }

            return permission;
          }),
      ),
    ];
    return acc;
  }, {});
};

const assertPropertyIdsExist = async (propertyIds = []) => {
  const uniquePropertyIds = normalizePropertyIds(propertyIds);

  if (uniquePropertyIds.length === 0) {
    return uniquePropertyIds;
  }

  const existingProperties = await prisma.property.findMany({
    where: { id: { in: uniquePropertyIds } },
    select: { id: true },
  });

  if (existingProperties.length !== uniquePropertyIds.length) {
    const existingIds = new Set(existingProperties.map((property) => property.id));
    const missingIds = uniquePropertyIds.filter((propertyId) => !existingIds.has(propertyId));
    throw new ApiError(400, `Invalid property ids: ${missingIds.join(', ')}`);
  }

  return uniquePropertyIds;
};

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

  const uniquePropertyIds = normalizePropertyIds(propertyIds);

  if (uniquePropertyIds.length === 0) {
    return;
  }

  await tx.propertyManager.createMany({
    data: uniquePropertyIds.map((propertyId) => ({ userId, propertyId })),
    skipDuplicates: true,
  });
};

const setManagerPropertyPermissions = async (tx, userId, propertyPermissions = {}) => {
  const normalized = normalizePropertyPermissions(propertyPermissions);
  const scopedPropertyIds = Object.keys(normalized);

  if (scopedPropertyIds.length === 0) {
    return;
  }

  for (const propertyId of scopedPropertyIds) {
    await tx.managerPropertyPermission.upsert({
      where: { managerId_propertyId: { managerId: userId, propertyId } },
      create: {
        managerId: userId,
        propertyId,
        permissions: normalized[propertyId],
      },
      update: {
        permissions: normalized[propertyId],
      },
    });
  }
};

const createManager = async ({ name, email, password, permissions, propertyIds = [], propertyPermissions = {} }) => {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new ApiError(409, 'Email already in use');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const normalizedPermissions = normalizePermissions(permissions);
  const normalizedPropertyPermissions = normalizePropertyPermissions(propertyPermissions);
  const normalizedPropertyIds = await assertPropertyIdsExist([...propertyIds, ...Object.keys(normalizedPropertyPermissions)]);

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
    await setManagerPropertyAssignments(tx, manager.id, normalizedPropertyIds);
    await setManagerPropertyPermissions(tx, manager.id, normalizedPropertyPermissions);
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
  const normalizedPropertyPermissions =
    payload.propertyPermissions && typeof payload.propertyPermissions === 'object'
      ? normalizePropertyPermissions(payload.propertyPermissions)
      : null;
  const normalizedPropertyIds =
    Array.isArray(payload.propertyIds) || normalizedPropertyPermissions
      ? await assertPropertyIdsExist([...(Array.isArray(payload.propertyIds) ? payload.propertyIds : []), ...Object.keys(normalizedPropertyPermissions || {})])
      : null;

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
    if (normalizedPropertyIds) {
      await setManagerPropertyAssignments(tx, id, normalizedPropertyIds);

      await tx.managerPropertyPermission.deleteMany({
        where: {
          managerId: id,
          propertyId: { notIn: normalizedPropertyIds },
        },
      });
    }

    if (normalizedPropertyPermissions) {
      await setManagerPropertyPermissions(tx, id, normalizedPropertyPermissions);
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
    await tx.managerPropertyPermission.deleteMany({ where: { managerId: id } });

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

  await prisma.managerPropertyPermission.deleteMany({
    where: { managerId: userId, propertyId },
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