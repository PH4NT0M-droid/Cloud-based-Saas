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
    .map((row, index) => {
      const adults = Number(row.adults || 0);
      const extraBed = Number(row.extraBed || 0);
      const children = Number(row.children || 0);
      const infant = Number(row.infant || 0);
      const extraBedPrice = Number(row.extraBedPrice || row.ratePlan?.extraBedPrice || 0);
      const childPrice = Number(row.childPrice || row.ratePlan?.childPrice || 0);
      const nights = Number(row.nights || booking.nights || 0);
      const rooms = Number(row.rooms || 1);
      const adultCost = Number(row.adultCost ?? (Number(row.pricePerNight || 0) * rooms * nights));
      const extraBedCost = Number(row.extraBedCost ?? (extraBed * extraBedPrice * nights));
      const childCost = Number(row.childCost ?? (children * childPrice * nights));
      const netCost = Number(row.rowSubtotal ?? row.totalCost ?? adultCost + extraBedCost + childCost);
      const gst = Number(row.rowGST ?? 0);
      const total = Number(row.rowTotal ?? netCost + gst);

      return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(row.roomType?.name || '-')}</td>
        <td>${adults}+${extraBed}</td>
        <td>${children}+${infant}</td>
        <td>${escapeHtml(row.ratePlan?.mealPlanName || '-')}</td>
        <td>${adultCost.toFixed(2)}</td>
        <td>${extraBedCost.toFixed(2)}</td>
        <td>${childCost.toFixed(2)}</td>
        <td>${netCost.toFixed(2)}</td>
        <td>${gst.toFixed(2)}</td>
        <td>${total.toFixed(2)}</td>
      </tr>`;
    })
    .join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Booking Confirmation ${escapeHtml(booking.id)}</title>
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
      <h2 style="margin:0;">Booking Confirmation</h2>
      <div>Booking ID: ${escapeHtml(booking.id)}</div>
      <div>Booking Date: ${formatDateOnly(booking.createdAt)}</div>
      <div>Booking Source: ${escapeHtml(booking.otaSource || booking.source || 'Direct')}</div>
      <div>Source Type: ${escapeHtml(booking.sourceType || 'Manual')}</div>
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
    <div>Thank you for making a reservation with us. Please find your booking confirmation details below.</div>
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
          <th>SR No</th>
          <th>Room Category</th>
          <th>Adult+E Bed</th>
          <th>Child+Infant</th>
          <th>Meal Plan</th>
          <th>Adult Cost</th>
          <th>E Bed Cost</th>
          <th>Child Cost</th>
          <th>Net Cost</th>
          <th>GST</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>

  <div class="section summary">
    <div>Net Cost ${Number(booking.subtotal || 0).toFixed(2)} /-</div>
    <div>Total GST Amount (SGST: ${Number(booking.sgst || 0).toFixed(2)}) | (CGST: ${Number(booking.cgst || 0).toFixed(2)}) ${Number(taxSummary.totalGST ?? (Number(booking.cgst || 0) + Number(booking.sgst || 0) + Number(booking.igst || 0))).toFixed(2)} /-</div>
    <div>Payable Amount ${Number(booking.totalAmount || 0).toFixed(2)} /-</div>
    <div>Paid Amount ${Number(booking.paidAmount || 0).toFixed(2)} /-</div>
    <div>Due Amount ${Number(booking.dueAmount || 0).toFixed(2)} /-</div>
  </div>

  <div class="brand">
    <div>Cancellation Policy: As per booking policy and channel terms.</div>
    <div>Hotel: ${escapeHtml(property?.name || '-')} | GST: ${escapeHtml(property?.gstNumber || '-')}</div>
    <div>Contact: ${escapeHtml(property?.mobileNumber || property?.landlineNumber || '-')} | Check-in: 12:00 PM | Check-out: 11:00 AM</div>
    ${booking.status === 'CANCELLED' ? '<div><strong>*** THIS BOOKING IS CANCELLED ***</strong></div>' : ''}
    <div>This is computer generated and does not require a signature.</div>
  </div>
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
