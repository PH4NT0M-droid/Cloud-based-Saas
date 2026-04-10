const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { assertPropertyAccess, assertPropertyMutationAccess, getUserId } = require('./accessControl');

const createProperty = async (payload, user) => {
  if (user.role !== 'ADMIN') {
    throw new ApiError(403, 'Only administrators can create properties');
  }

  return prisma.property.create({
    data: {
      name: payload.name,
      location: payload.location,
      description: payload.description,
    },
  });
};

const listProperties = async (user) => {
  const where = user.role === 'ADMIN' ? {} : { propertyManagers: { some: { userId: getUserId(user) } } };

  return prisma.property.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      propertyManagers: {
        select: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      },
      roomTypes: {
        select: {
          id: true,
          name: true,
          maxOccupancy: true,
          basePrice: true,
          extraPersonPrice: true,
          baseCapacity: true,
          maxCapacity: true,
          baseInventory: true,
          createdAt: true,
        },
      },
    },
  }).then((properties) =>
    properties.map((property) => ({
      ...property,
      managers: user.role === 'ADMIN' ? property.propertyManagers.map((assignment) => assignment.user) : [],
    })),
  );
};

const getPropertyById = async (id, user) => {
  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      propertyManagers: {
        select: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      },
      roomTypes: {
        include: {
          inventories: {
            orderBy: { date: 'asc' },
          },
          rates: {
            orderBy: { date: 'asc' },
          },
        },
      },
    },
  });

  assertPropertyAccess(property, user);

  return {
    ...property,
    managers: user.role === 'ADMIN' ? property.propertyManagers.map((assignment) => assignment.user) : [],
  };
};

const getPropertyOverview = async (id, user) => {
  const property = await getPropertyById(id, user);

  const roomTypes = property.roomTypes.map((roomType) => ({
    id: roomType.id,
    name: roomType.name,
    maxOccupancy: roomType.maxOccupancy,
    basePrice: roomType.basePrice,
    extraPersonPrice: roomType.extraPersonPrice,
    baseCapacity: roomType.baseCapacity,
    maxCapacity: roomType.maxCapacity,
    baseInventory: roomType.baseInventory,
    inventories: roomType.inventories.map((inventory) => ({
      id: inventory.id,
      date: inventory.date,
      availableRooms: inventory.availableRooms,
    })),
    rates: roomType.rates.map((rate) => ({
      id: rate.id,
      date: rate.date,
      basePrice: rate.basePrice,
      otaModifier: rate.otaModifier,
    })),
  }));

  return {
    id: property.id,
    name: property.name,
    location: property.location,
    description: property.description,
    managers: property.managers,
    roomTypes,
  };
};

const updateProperty = async (id, payload, user) => {
  const property = await prisma.property.findUnique({ where: { id } });
  if (!property) {
    throw new ApiError(404, 'Property not found');
  }

  assertPropertyMutationAccess(property, user, 'canManageProperties');

  return prisma.property.update({
    where: { id },
    data: {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.location !== undefined ? { location: payload.location } : {}),
      ...(payload.description !== undefined ? { description: payload.description } : {}),
    },
  });
};

const deleteProperty = async (id, user) => {
  const property = await prisma.property.findUnique({ where: { id } });
  if (!property) {
    throw new ApiError(404, 'Property not found');
  }

  assertPropertyMutationAccess(property, user, 'canManageProperties');

  await prisma.property.delete({ where: { id } });
  return { id };
};

module.exports = {
  createProperty,
  listProperties,
  getPropertyById,
  getPropertyOverview,
  updateProperty,
  deleteProperty,
};
