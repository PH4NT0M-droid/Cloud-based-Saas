const adminService = require('../services/adminService');

const listUsers = async (req, res, next) => {
  try {
    const users = await adminService.listUsers();
    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    return next(error);
  }
};

const createManager = async (req, res, next) => {
  try {
    const user = await adminService.createManager(req.body);
    return res.status(201).json({ success: true, data: user });
  } catch (error) {
    return next(error);
  }
};

const updateManager = async (req, res, next) => {
  try {
    const user = await adminService.updateManager(req.params.id, req.body);
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    return next(error);
  }
};

const deleteManager = async (req, res, next) => {
  try {
    const result = await adminService.deleteManager(req.params.id);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const assignProperty = async (req, res, next) => {
  try {
    const result = await adminService.assignProperty(req.body.userId, req.body.propertyId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const removeProperty = async (req, res, next) => {
  try {
    const result = await adminService.removeProperty(req.body.userId, req.body.propertyId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listUsers,
  createManager,
  updateManager,
  deleteManager,
  assignProperty,
  removeProperty,
};