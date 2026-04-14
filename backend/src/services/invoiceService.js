const ApiError = require('../utils/ApiError');

const formatCurrency = (value) => `INR ${Number(value || 0).toFixed(2)}`;

const formatDateOnly = (value) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    timeZone: 'UTC',
  });
};

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderInvoiceHtml = ({ booking, property, bookingRooms, taxSummary = {} }) => {
  const taxRows = Array.isArray(taxSummary.rows) && taxSummary.rows.length > 0 ? taxSummary.rows : [];
  const rows = (taxRows.length > 0 ? taxRows : (bookingRooms || []))
    .map(
      (row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(row.roomType?.name || '-')}</td>
        <td>${escapeHtml(row.ratePlan?.mealPlanName || '-')}</td>
        <td>${row.rooms}</td>
        <td>${formatCurrency(row.pricePerNight)}</td>
        <td>${formatCurrency(row.rowSubtotal ?? row.totalCost)}</td>
        <td>${Number(row.gstRate || 0)}%</td>
        <td>${formatCurrency(row.rowGST ?? 0)}</td>
        <td>${formatCurrency(row.rowTotal ?? row.totalCost)}</td>
      </tr>`,
    )
    .join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${escapeHtml(booking.id)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #1e293b; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 12px; }
    .section { margin-top: 16px; }
    .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left; }
    th { background: #f8fafc; }
    .summary { width: 360px; margin-left: auto; }
    .summary td:first-child { width: 55%; }
    .brand { margin-top: 20px; font-size: 12px; color: #334155; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h2 style="margin:0;">Tax Invoice</h2>
      <div>Booking ID: ${escapeHtml(booking.id)}</div>
      <div>Booking Date: ${formatDateOnly(booking.createdAt)}</div>
      <div>Source: Direct</div>
      <div>Source Type: Manual</div>
    </div>
    <div>
      <h3 style="margin:0;">${escapeHtml(property?.name || 'Property')}</h3>
      <div>${escapeHtml(property?.fullAddress || property?.location || '-')}</div>
      <div>${escapeHtml(property?.city || '')} ${escapeHtml(property?.state || '')}</div>
      <div>GSTIN: ${escapeHtml(property?.gstNumber || '-')}</div>
      <div>Contact: ${escapeHtml(property?.mobileNumber || property?.landlineNumber || '-')}</div>
    </div>
  </div>

  <div class="section card">
    <strong>Dear ${escapeHtml(booking.guestName)}</strong>
    <div>Thank you for choosing us. Please find your booking invoice below.</div>
  </div>

  <div class="section" style="display:flex; gap:12px;">
    <div class="card" style="flex:1;">
      <strong>Guest Details</strong>
      <div>Name: ${escapeHtml(booking.guestName)}</div>
      <div>Mobile: ${escapeHtml(booking.guestMobile || '-')}</div>
      <div>Email: ${escapeHtml(booking.guestEmail || '-')}</div>
      <div>GST Number: ${escapeHtml(booking.gstNumber || '-')}</div>
      <div>Address: ${escapeHtml(booking.guestAddress || '-')}</div>
      <div>State: ${escapeHtml(booking.guestState || '-')}</div>
    </div>
    <div class="card" style="flex:1;">
      <strong>Booking Details</strong>
      <div>Check In Date: ${formatDateOnly(booking.checkIn)}</div>
      <div>Check Out Date: ${formatDateOnly(booking.checkOut)}</div>
      <div>Nights: ${booking.nights}</div>
      <div>Total Rooms: ${booking.totalRooms}</div>
      <div>Payment Ref: ${escapeHtml(booking.paymentReference || '-')}</div>
      <div>Special Note: ${escapeHtml(booking.specialNote || '-')}</div>
    </div>
  </div>

  <div class="section">
    <strong>Booking Summary</strong>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Room Type</th>
          <th>Meal Plan</th>
          <th>Rooms</th>
          <th>Price/Night</th>
          <th>Subtotal</th>
          <th>GST %</th>
          <th>GST Amt</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>

  <div class="section summary">
    <table>
      <tbody>
        <tr><td>Net Cost</td><td>${formatCurrency(booking.subtotal)}</td></tr>
        <tr><td>Total GST</td><td>${formatCurrency(taxSummary.totalGST)}</td></tr>
        <tr><td>CGST</td><td>${formatCurrency(booking.cgst)}</td></tr>
        <tr><td>SGST</td><td>${formatCurrency(booking.sgst)}</td></tr>
        <tr><td>IGST</td><td>${formatCurrency(booking.igst)}</td></tr>
        <tr><td>Round Off</td><td>${formatCurrency(booking.roundOff)}</td></tr>
        <tr><td><strong>Payable</strong></td><td><strong>${formatCurrency(booking.totalAmount)}</strong></td></tr>
        <tr><td>Paid</td><td>${formatCurrency(booking.paidAmount)}</td></tr>
        <tr><td>Due</td><td>${formatCurrency(booking.dueAmount)}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="brand">Reservation Powered By RestoraX Solutions</div>
</body>
</html>`;
};

const generateInvoicePDF = async ({ booking, property, bookingRooms, taxSummary = {} }) => {
  let puppeteer;
  try {
    // Lazy load to keep app startup lightweight.
    puppeteer = require('puppeteer');
  } catch (error) {
    throw new ApiError(500, 'Invoice service dependency missing. Install puppeteer in backend.');
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    const html = renderInvoiceHtml({ booking, property, bookingRooms, taxSummary });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '14mm',
        right: '10mm',
        bottom: '14mm',
        left: '10mm',
      },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
};

module.exports = {
  renderInvoiceHtml,
  generateInvoicePDF,
};
