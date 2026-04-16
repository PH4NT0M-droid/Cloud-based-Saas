const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { assertPropertyAccess, getUserId, canEditProperty } = require('./accessControl');
const { uploadPropertyImage } = require('./s3Service');

const toOptionalString = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
};

const pickDefined = (...values) => values.find((value) => value !== undefined);

const toRequiredString = (value, fallback = '') => {
  if (value === undefined || value === null) {
    return fallback;
  }

  return String(value).trim();
};

const buildPropertyData = (payload, file, existing = null) => {
  const resolvedFullAddress = pickDefined(payload.fullAddress, payload.address, payload.location);
  const resolvedLocation = pickDefined(payload.location, payload.fullAddress, payload.address);
  const resolvedPinCode = pickDefined(payload.pinCode, payload.pincode, payload.postalCode);
  const resolvedCity = pickDefined(payload.city);
  const resolvedState = pickDefined(payload.state);
  const resolvedMobile = pickDefined(payload.mobileNumber, payload.mobile);
  const resolvedLandline = pickDefined(payload.landlineNumber, payload.landline);
  const resolvedEmail = pickDefined(payload.email);
  const resolvedWebsite = pickDefined(payload.website);
  const resolvedGst = pickDefined(payload.gstNumber, payload.gst, payload.gstNo);
  const resolvedLongDescription = pickDefined(payload.longDescription, payload.detailedDescription);
  const resolvedLogo = pickDefined(payload.propertyLogo, payload.logo);

  const fullAddress = toRequiredString(resolvedFullAddress, existing?.fullAddress ?? '');
  const legacyLocation = toRequiredString(resolvedLocation, existing?.location ?? fullAddress);

  return {
    ...(payload.name !== undefined ? { name: String(payload.name).trim() } : {}),
    ...(payload.description !== undefined ? { description: String(payload.description).trim() } : {}),
    ...(resolvedLocation !== undefined || resolvedFullAddress !== undefined ? { location: legacyLocation } : {}),
    ...(resolvedFullAddress !== undefined || resolvedLocation !== undefined ? { fullAddress } : {}),
    ...(resolvedPinCode !== undefined ? { pinCode: toRequiredString(resolvedPinCode) } : {}),
    ...(resolvedCity !== undefined ? { city: toRequiredString(resolvedCity) } : {}),
    ...(resolvedState !== undefined ? { state: toRequiredString(resolvedState) } : {}),
    ...(resolvedMobile !== undefined ? { mobileNumber: toOptionalString(resolvedMobile) } : {}),
    ...(resolvedLandline !== undefined ? { landlineNumber: toOptionalString(resolvedLandline) } : {}),
    ...(resolvedEmail !== undefined ? { email: toOptionalString(resolvedEmail) } : {}),
    ...(resolvedWebsite !== undefined ? { website: toOptionalString(resolvedWebsite) } : {}),
    ...(resolvedGst !== undefined ? { gstNumber: toOptionalString(resolvedGst)?.toUpperCase() || null } : {}),
    ...(resolvedLongDescription !== undefined ? { longDescription: toOptionalString(resolvedLongDescription) } : {}),
    ...(resolvedLogo !== undefined ? { propertyLogo: toOptionalString(resolvedLogo) } : {}),
    ...(file ? { _uploadedFile: file } : {}),
  };
};

const resolvePropertyLogo = async (propertyId, data) => {
  if (!data._uploadedFile) {
    const { _uploadedFile, ...withoutFile } = data;
    return withoutFile;
  }

  const upload = await uploadPropertyImage({
    propertyId,
    fileName: data._uploadedFile.originalname,
  });

  const { _uploadedFile, ...withoutFile } = data;
  return {
    ...withoutFile,
    propertyLogo: upload.url,
  };
};

const createProperty = async (payload, user, file) => {
  if (!canEditProperty(user)) {
    throw new ApiError(403, 'Unauthorized');
  }

  const createData = buildPropertyData(payload, file);
  const { _uploadedFile, ...createWithoutFile } = createData;
  const created = await prisma.property.create({ data: createWithoutFile });

  if (!_uploadedFile) {
    return created;
  }

  const upload = await uploadPropertyImage({
    propertyId: created.id,
    fileName: _uploadedFile.originalname,
  });

  return prisma.property.update({
    where: { id: created.id },
    data: { propertyLogo: upload.url },
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
          extraPersonPrice: true,
          baseCapacity: true,
          maxCapacity: true,
          baseInventory: true,
          createdAt: true,
          ratePlans: {
            orderBy: [{ isDefault: 'desc' }, { mealPlanName: 'asc' }],
          },
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
          roomPricings: {
            orderBy: { date: 'asc' },
            include: {
              ratePlan: true,
            },
          },
          ratePlans: {
            orderBy: [{ isDefault: 'desc' }, { mealPlanName: 'asc' }],
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
    extraPersonPrice: roomType.extraPersonPrice,
    baseCapacity: roomType.baseCapacity,
    maxCapacity: roomType.maxCapacity,
    baseInventory: roomType.baseInventory,
    roomInventory: roomType.baseInventory,
    inventories: roomType.inventories.map((inventory) => ({
      id: inventory.id,
      date: inventory.date,
      availableRooms: inventory.availableRooms,
    })),
    roomPricings: roomType.roomPricings.map((row) => ({
      id: row.id,
      date: row.date,
      roomTypeId: row.roomTypeId,
      ratePlanId: row.ratePlanId,
      mealPlanName: row.ratePlan?.mealPlanName,
      price: row.price,
    })),
    ratePlans: roomType.ratePlans.map((ratePlan) => ({
      id: ratePlan.id,
      mealPlanName: ratePlan.mealPlanName,
      extraBedPrice: ratePlan.extraBedPrice,
      basePrice: ratePlan.basePrice,
      childPrice: ratePlan.childPrice,
      isDefault: ratePlan.isDefault,
    })),
  }));

  return {
    id: property.id,
    name: property.name,
    location: property.location,
    fullAddress: property.fullAddress,
    pinCode: property.pinCode,
    city: property.city,
    state: property.state,
    mobileNumber: property.mobileNumber,
    landlineNumber: property.landlineNumber,
    email: property.email,
    website: property.website,
    gstNumber: property.gstNumber,
    propertyLogo: property.propertyLogo,
    description: property.description,
    longDescription: property.longDescription,
    managers: property.managers,
    roomTypes,
  };
};

const updateProperty = async (id, payload, user, file) => {
  const property = await prisma.property.findUnique({ where: { id } });
  if (!property) {
    throw new ApiError(404, 'Property not found');
  }

  assertPropertyAccess(property, user);
  if (!canEditProperty(user, property.id)) {
    throw new ApiError(403, 'Unauthorized');
  }

  const updateData = buildPropertyData(payload, file, property);
  const resolvedData = await resolvePropertyLogo(id, updateData);

  return prisma.property.update({
    where: { id },
    data: resolvedData,
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
