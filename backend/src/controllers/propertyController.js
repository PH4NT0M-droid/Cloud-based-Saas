const propertyService = require('../services/propertyService');

const createProperty = async (req, res, next) => {
  try {
    const property = await propertyService.createProperty(req.body, req.user);
    return res.status(201).json({
      success: true,
      data: property,
    });
  } catch (error) {
    return next(error);
  }
};

const listProperties = async (req, res, next) => {
  try {
    const properties = await propertyService.listProperties(req.user);
    return res.status(200).json({
      success: true,
      data: properties,
    });
  } catch (error) {
    return next(error);
  }
};

const getPropertyById = async (req, res, next) => {
  try {
    const property = await propertyService.getPropertyById(req.params.id, req.user);
    return res.status(200).json({
      success: true,
      data: property,
    });
  } catch (error) {
    return next(error);
  }
};

const getPropertyOverview = async (req, res, next) => {
  try {
    const property = await propertyService.getPropertyOverview(req.params.id, req.user);
    return res.status(200).json({
      success: true,
      data: property,
    });
  } catch (error) {
    return next(error);
  }
};

const updateProperty = async (req, res, next) => {
  try {
    const property = await propertyService.updateProperty(req.params.id, req.body, req.user);
    return res.status(200).json({
      success: true,
      data: property,
    });
  } catch (error) {
    return next(error);
  }
};

const deleteProperty = async (req, res, next) => {
  try {
    const result = await propertyService.deleteProperty(req.params.id, req.user);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createProperty,
  listProperties,
  getPropertyById,
  getPropertyOverview,
  updateProperty,
  deleteProperty,
};
