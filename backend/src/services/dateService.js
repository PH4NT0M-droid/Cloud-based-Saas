const ApiError = require('../utils/ApiError');

const normalizeToUtcDate = (input) => {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, 'Invalid date');
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const enumerateDatesInclusive = (startDateInput, endDateInput) => {
  const startDate = normalizeToUtcDate(startDateInput);
  const endDate = normalizeToUtcDate(endDateInput);

  if (endDate < startDate) {
    throw new ApiError(400, 'endDate must be on or after startDate');
  }

  const dates = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
};

module.exports = {
  normalizeToUtcDate,
  enumerateDatesInclusive,
};
