const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { assertPropertyAccess, assertPropertyMutationAccess } = require('./accessControl');

const createRoomType = async (payload, user) => {
  const property = await prisma.property.findUnique({ where: { id: payload.propertyId } });
  assertPropertyMutationAccess(property, user, 'canManageRooms');

  return prisma.roomType.create({
    data: {
      propertyId: payload.propertyId,
      name: payload.name,
      maxOccupancy: Number(payload.maxOccupancy),
    },
  });
};

const listRoomTypes = async (propertyId, user) => {
  if (propertyId) {
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    assertPropertyAccess(property, user);
  }

  const where =
    user.role === 'ADMIN'
      ? propertyId
        ? { propertyId }
        : {}
      : propertyId
        ? { propertyId }
        : { property: { propertyManagers: { some: { userId: user.id } } } };

  return prisma.roomType.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      property: {
        select: { id: true, name: true },
      },
    },
  });
};

const updateRoomType = async (id, payload, user) => {
  const roomType = await prisma.roomType.findUnique({
    where: { id },
    include: { property: true },
  });

  if (!roomType) {
    throw new ApiError(404, 'Room type not found');
  }

  assertPropertyMutationAccess(roomType.property, user, 'canManageRooms');

  return prisma.roomType.update({
    where: { id },
    data: {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.maxOccupancy !== undefined ? { maxOccupancy: Number(payload.maxOccupancy) } : {}),
    },
  });
};

const deleteRoomType = async (id, user) => {
  const roomType = await prisma.roomType.findUnique({
    where: { id },
    include: { property: true },
  });

  if (!roomType) {
    throw new ApiError(404, 'Room type not found');
  }

  assertPropertyMutationAccess(roomType.property, user, 'canManageRooms');

  await prisma.roomType.delete({ where: { id } });
  return { id };
};

module.exports = {
  createRoomType,
  listRoomTypes,
  updateRoomType,
  deleteRoomType,
};
