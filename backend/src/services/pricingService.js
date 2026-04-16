const rateService = require('./rateService');

const updatePricing = (payload, user) => rateService.updatePricing(payload, user);
const bulkUpdatePricing = (payload, user) => rateService.bulkUpdatePricing(payload, user);
const getPricingGrid = (query, user) => rateService.getPricingGrid(query, user);
const getPriceForBookingDate = (payload) => rateService.getPriceForBookingDate(payload);

const normalizeToUtcDate = (input) => {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const enumerateDatesExclusive = (startDateInput, endDateInput) => {
  const startDate = normalizeToUtcDate(startDateInput);
  const endDate = normalizeToUtcDate(endDateInput);

  if (endDate <= startDate) {
    return [];
  }

  const dates = [];
  const cursor = new Date(startDate);
  while (cursor < endDate) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
};

const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const normalizeState = (value) => String(value || '').trim().toUpperCase();

const toTwoDecimals = (value) => Number(Number(value || 0).toFixed(2));

const getPrice = async ({ tx, roomTypeId, ratePlanId, checkIn, checkOut }) => {
  const nights = enumerateDatesExclusive(checkIn, checkOut);
  if (nights.length === 0) {
    return 0;
  }

  let total = 0;
  for (const date of nights) {
    const nightlyPrice = await getPriceForBookingDate({
      tx,
      roomTypeId,
      ratePlanId,
      date,
    });
    total += Number(nightlyPrice || 0);
  }

  return round2(total / nights.length);
};

const getGstRateFromNightlyPrice = (pricePerNight) => {
  const nightly = Number(pricePerNight || 0);
  if (nightly < 1000) {
    return 0;
  }
  if (nightly <= 7500) {
    return 5;
  }
  return 18;
};

const getGstRateFromRows = (rows = []) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return 0;
  }

  return rows.reduce((maxRate, row) => {
    const rowRate = getGstRateFromNightlyPrice(row.pricePerNight);
    return Math.max(maxRate, rowRate);
  }, 0);
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const buildRowTaxSummary = (row, includeGstInvoice = true, priceMultiplier = 1) => {
  const rooms = Number(row.rooms || 0);
  const nights = Number(row.nights || 0);
  const pricePerNight = Number(row.pricePerNight || 0);
  const normalizedMultiplier = Number(priceMultiplier || 0) > 0 ? Number(priceMultiplier) : 0;
  const rowSubtotalRaw = row.totalCost !== undefined && row.totalCost !== null
    ? Number(row.totalCost || 0)
    : pricePerNight * rooms * nights;
  const adjustedPricePerNight = pricePerNight * normalizedMultiplier;
  const rowSubtotal = rowSubtotalRaw * normalizedMultiplier;
  const gstRate = includeGstInvoice ? getGstRateFromNightlyPrice(adjustedPricePerNight) : 0;
  const rowGST = includeGstInvoice ? rowSubtotal * (gstRate / 100) : 0;

  return {
    ...row,
    rooms,
    nights,
    pricePerNight: toTwoDecimals(adjustedPricePerNight),
    rowSubtotal: toTwoDecimals(rowSubtotal),
    gstRate,
    rowGST,
    rowTotal: rowSubtotal + rowGST,
  };
};

const calculateTotals = ({
  rows = [],
  propertyState,
  guestState,
  paidAmount = 0,
  gstRate: gstRateInput = null,
  includeGstInvoice = true,
  discountPercent = 0,
  discountAmount: discountAmountInput = null,
}) => {
  const baseRows = rows.map((row) => buildRowTaxSummary(row, includeGstInvoice, 1));
  const rawSubtotal = toTwoDecimals(baseRows.reduce((sum, row) => sum + Number(row.rowSubtotal || 0), 0));
  const normalizedDiscountPercent = clamp(Number(discountPercent || 0), 0, 100);
  const requestedDiscountAmount =
    discountAmountInput === null || discountAmountInput === undefined ? null : Number(discountAmountInput || 0);
  const discountAmount = toTwoDecimals(
    clamp(
      requestedDiscountAmount === null ? (rawSubtotal * normalizedDiscountPercent) / 100 : requestedDiscountAmount,
      0,
      rawSubtotal,
    ),
  );
  const subtotalAfterDiscount = toTwoDecimals(Math.max(0, rawSubtotal - discountAmount));
  const discountMultiplier = rawSubtotal > 0 ? subtotalAfterDiscount / rawSubtotal : 1;

  const taxRows = rows.map((row) => buildRowTaxSummary(row, includeGstInvoice, discountMultiplier));
  const subtotal = toTwoDecimals(taxRows.reduce((sum, row) => sum + Number(row.rowSubtotal || 0), 0));
  const totalGSTRaw = toTwoDecimals(taxRows.reduce((sum, row) => sum + Number(row.rowGST || 0), 0));
  const isIntraState = includeGstInvoice && normalizeState(propertyState) && normalizeState(propertyState) === normalizeState(guestState);

  const cgst = isIntraState ? toTwoDecimals(totalGSTRaw / 2) : 0;
  const sgst = isIntraState ? toTwoDecimals(totalGSTRaw / 2) : 0;
  const igst = isIntraState ? 0 : toTwoDecimals(totalGSTRaw);
  const totalGST = toTwoDecimals(cgst + sgst + igst);
  const effectiveGstRate = subtotal > 0 ? toTwoDecimals((totalGST / subtotal) * 100) : 0;

  const exactTotal = subtotal + totalGST;
  const totalAmount = Math.round(exactTotal);
  const roundOff = toTwoDecimals(totalAmount - exactTotal);
  const paid = toTwoDecimals(paidAmount);
  const dueAmount = toTwoDecimals(totalAmount - paid);

  return {
    subtotal,
    rawSubtotal,
    discountPercent: normalizedDiscountPercent,
    discountAmount,
    totalGST,
    gstRate: gstRateInput === null || gstRateInput === undefined ? effectiveGstRate : Number(gstRateInput || 0),
    cgst,
    sgst,
    igst,
    roundOff,
    totalAmount,
    paidAmount: paid,
    dueAmount,
    rows: taxRows,
  };
};

module.exports = {
  updatePricing,
  bulkUpdatePricing,
  getPricingGrid,
  getPriceForBookingDate,
  getPrice,
  getGstRateFromRows,
  calculateTotals,
  normalizeToUtcDate,
  enumerateDatesExclusive,
};
