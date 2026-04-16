import { useEffect, useMemo, useState } from 'react';
import bookingService from '../services/bookingService';
import propertyService from '../services/propertyService';
import roomService from '../services/roomService';
import rateService from '../services/rateService';
import promotionService from '../services/promotionService';
import { formatCurrency } from '../utils/format';
import ErrorBanner from '../components/ErrorBanner';
import useAuth from '../hooks/useAuth';
import Modal from '../components/Modal';
import TextInput from '../components/forms/TextInput';
import { useToast } from '../components/ToastProvider';
import { canManageBookings as canManageBookingsPermission } from '../utils/permissions';

const ROOM_TABLE_COLUMNS = ['Room Type', 'Meal Plan', 'Rooms', 'Adults', 'Extra Beds', 'Price / Night', 'Total'];

const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const formatCurrency2 = (value) => `₹${Number(value || 0).toFixed(2)}`;

const normalizeState = (value) => String(value || '').trim().toUpperCase();

const formatDateOnly = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().split('T')[0];
};

const toDateInputValue = (value) => formatDateOnly(value);

const nightsBetween = (checkInValue, checkOutValue) => {
  if (!checkInValue || !checkOutValue) {
    return 0;
  }

  const checkInDate = new Date(checkInValue);
  const checkOutDate = new Date(checkOutValue);
  if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime())) {
    return 0;
  }

  const start = Date.UTC(checkInDate.getUTCFullYear(), checkInDate.getUTCMonth(), checkInDate.getUTCDate());
  const end = Date.UTC(checkOutDate.getUTCFullYear(), checkOutDate.getUTCMonth(), checkOutDate.getUTCDate());

  return Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
};

const getDateKeysForStay = (checkInValue, checkOutValue) => {
  const nights = nightsBetween(checkInValue, checkOutValue);
  if (nights <= 0) {
    return [];
  }

  const checkInDate = new Date(checkInValue);
  const cursor = new Date(Date.UTC(checkInDate.getUTCFullYear(), checkInDate.getUTCMonth(), checkInDate.getUTCDate()));

  const keys = [];
  for (let i = 0; i < nights; i += 1) {
    const utcDate = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate()));
    keys.push(utcDate.toISOString().split('T')[0]);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return keys;
};

const createEmptyRow = () => ({
  roomTypeId: '',
  ratePlanId: '',
  rooms: 1,
  adults: 1,
  extraBed: 0,
  pricePerNight: 0,
  manualPrice: false,
  totalCost: 0,
});

const getGstRateFromRowPrice = (pricePerNight) => {
  const value = Number(pricePerNight || 0);
  if (value < 1000) {
    return 0;
  }
  if (value <= 7500) {
    return 5;
  }
  return 18;
};

const calculateSummary = ({ rows, propertyState, guestState, nights, paidAmount, includeGstInvoice, discountPercent = 0 }) => {
  const shouldApplyGst = Boolean(includeGstInvoice);
  const safeDiscountPercent = Math.max(0, Math.min(100, Number(discountPercent || 0)));
  const subtotalBeforeDiscount = round2(rows.reduce((sum, row) => sum + Number(row.totalCost || 0), 0));
  const discountAmount = round2((subtotalBeforeDiscount * safeDiscountPercent) / 100);
  const discountedSubtotal = round2(Math.max(0, subtotalBeforeDiscount - discountAmount));
  const discountMultiplier = subtotalBeforeDiscount > 0 ? discountedSubtotal / subtotalBeforeDiscount : 1;

  const taxRows = rows.map((row) => {
    const rowSubtotal = Number(row.totalCost || 0) * discountMultiplier;
    const discountedPerNight = Number((row.effectivePricePerNight ?? row.pricePerNight ?? 0)) * discountMultiplier;
    const gstRate = shouldApplyGst ? getGstRateFromRowPrice(discountedPerNight) : 0;
    const rowGST = shouldApplyGst ? rowSubtotal * (gstRate / 100) : 0;
    return {
      ...row,
      rowSubtotal,
      gstRate,
      rowGST,
      rowTotal: rowSubtotal + rowGST,
    };
  });

  const subtotal = round2(taxRows.reduce((sum, row) => sum + Number(row.rowSubtotal || 0), 0));
  const totalGSTRaw = round2(taxRows.reduce((sum, row) => sum + Number(row.rowGST || 0), 0));

  const isIntraState = shouldApplyGst && normalizeState(propertyState) && normalizeState(propertyState) === normalizeState(guestState);
  const cgst = isIntraState ? round2(totalGSTRaw / 2) : 0;
  const sgst = isIntraState ? round2(totalGSTRaw / 2) : 0;
  const igst = isIntraState ? 0 : round2(totalGSTRaw);
  const totalGST = round2(cgst + sgst + igst);
  const gstRate = subtotal > 0 ? round2((totalGST / subtotal) * 100) : 0;

  const exactTotal = subtotal + totalGST;
  const totalAmount = Math.round(exactTotal);
  const roundOff = round2(totalAmount - exactTotal);

  const paid = round2(Number(paidAmount || 0));
  const dueAmount = round2(totalAmount - paid);

  return {
    nights,
    totalRooms: rows.reduce((sum, row) => sum + Number(row.rooms || 0), 0),
    discountPercent: safeDiscountPercent,
    discountAmount,
    subtotalBeforeDiscount,
    subtotal,
    totalGST,
    gstRate,
    cgst,
    sgst,
    igst,
    roundOff,
    totalAmount,
    paidAmount: paid,
    dueAmount,
  };
};

const parseCurrencyAmount = (value) => {
  const numeric = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
};

const normalizeInvoicePreviewHtml = (html) => {
  if (!html) {
    return '';
  }

  let normalized = String(html);
  normalized = normalized.replace(/INR\s*([0-9,]+(?:\.[0-9]+)?)/g, (_, amount) => formatCurrency2(parseCurrencyAmount(amount)));

  ['CGST', 'SGST', 'IGST'].forEach((label) => {
    const rowRegex = new RegExp(`<tr><td>${label}<\\/td><td>([^<]+)<\\/td><\\/tr>`, 'i');
    const match = normalized.match(rowRegex);
    if (match && parseCurrencyAmount(match[1]) <= 0) {
      normalized = normalized.replace(match[0], '');
    }
  });

  return normalized;
};

function BookingsPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();

  const [bookings, setBookings] = useState([]);
  const [properties, setProperties] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [pricingGrid, setPricingGrid] = useState({ dates: [], rows: [] });

  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceHtml, setInvoiceHtml] = useState('');
  const [editingBookingId, setEditingBookingId] = useState(null);

  const [form, setForm] = useState({
    propertyId: '',
    guestName: '',
    guestMobile: '',
    guestEmail: '',
    gstNumber: '',
    guestAddress: '',
    guestPincode: '',
    guestState: '',
    checkIn: '',
    checkOut: '',
    paymentReference: '',
    specialNote: '',
    paidAmount: 0,
    includeGstInvoice: true,
    rooms: [createEmptyRow()],
  });

  const canManageBookings = canManageBookingsPermission(user);

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === form.propertyId) || null,
    [properties, form.propertyId],
  );

  const nights = useMemo(() => nightsBetween(form.checkIn, form.checkOut), [form.checkIn, form.checkOut]);

  const pricingMap = useMemo(() => {
    const map = {};
    for (const roomRow of pricingGrid.rows || []) {
      if (!Array.isArray(roomRow.ratePlans)) {
        continue;
      }
      for (const ratePlan of roomRow.ratePlans) {
        map[`${roomRow.roomTypeId}:${ratePlan.ratePlanId}`] = ratePlan.prices || {};
      }
    }
    return map;
  }, [pricingGrid]);

  const roomTypeById = useMemo(() => {
    const map = {};
    for (const roomType of rooms) {
      map[roomType.id] = roomType;
    }
    return map;
  }, [rooms]);

  const propertyRows = useMemo(
    () => rooms.filter((roomType) => !form.propertyId || roomType.propertyId === form.propertyId),
    [rooms, form.propertyId],
  );

  const applicablePromotion = useMemo(() => {
    if (!form.propertyId || !form.checkIn) {
      return null;
    }

    const checkInDate = new Date(form.checkIn);
    if (Number.isNaN(checkInDate.getTime())) {
      return null;
    }

    const filtered = promotions.filter((promotion) => {
      const propertyIds = Array.isArray(promotion.propertyIds) ? promotion.propertyIds : [];
      const matchesProperty = propertyIds.length === 0 || propertyIds.includes(form.propertyId);
      const startsAt = promotion.startDate ? new Date(promotion.startDate) : null;
      const endsAt = promotion.endDate ? new Date(promotion.endDate) : null;
      const inStartWindow = !startsAt || startsAt <= checkInDate;
      const inEndWindow = !endsAt || endsAt >= checkInDate;
      return matchesProperty && inStartWindow && inEndWindow;
    });

    if (!filtered.length) {
      return null;
    }

    return filtered.reduce((best, current) =>
      Number(current.discountPercent || 0) > Number(best.discountPercent || 0) ? current : best,
    filtered[0]);
  }, [promotions, form.propertyId, form.checkIn]);

  const pricedRows = useMemo(() => {
    const dateKeys = getDateKeysForStay(form.checkIn, form.checkOut);
    return form.rooms.map((row) => {
      const roomType = roomTypeById[row.roomTypeId];
      const ratePlan = (roomType?.ratePlans || []).find((item) => item.id === row.ratePlanId)
        || (roomType?.ratePlans || []).find((item) => item.isDefault)
        || (roomType?.ratePlans || [])[0]
        || null;
      const effectiveRatePlanId = row.ratePlanId || ratePlan?.id || '';

      let computedNightly = Number(row.pricePerNight || 0);
      if (!row.manualPrice && row.roomTypeId && effectiveRatePlanId && dateKeys.length > 0) {
        const dailyPrices = pricingMap[`${row.roomTypeId}:${effectiveRatePlanId}`] || {};
        const collected = dateKeys.map((key) => Number(dailyPrices[key] || 0));
        const sum = collected.reduce((acc, item) => acc + item, 0);
        computedNightly = collected.length > 0 ? round2(sum / collected.length) : computedNightly;
      }

      const roomsCount = Number(row.rooms || 0);
      const extraBedCount = Number(row.extraBed || 0);
      const extraBedPrice = Number(ratePlan?.extraBedPrice || 0);
      const childrenCount = Number(row.children || 0);
      const childPrice = Number(ratePlan?.childPrice || 0);
      const roomNightlySubtotal = computedNightly * roomsCount;
      const extraBedNightlySubtotal = extraBedPrice * extraBedCount;
      const childNightlySubtotal = childPrice * childrenCount;
      const totalCost = round2((roomNightlySubtotal + extraBedNightlySubtotal + childNightlySubtotal) * nights);

      return {
        ...row,
        roomType,
        ratePlan,
        ratePlanId: effectiveRatePlanId,
        pricePerNight: computedNightly,
        effectivePricePerNight: round2(computedNightly + extraBedNightlySubtotal),
        extraBedPrice,
        childPrice,
        totalCost,
      };
    });
  }, [form.rooms, form.checkIn, form.checkOut, nights, pricingMap, roomTypeById]);

  const summary = useMemo(
    () =>
      calculateSummary({
        rows: pricedRows,
        propertyState: selectedProperty?.state,
        guestState: form.guestState,
        nights,
        paidAmount: form.paidAmount,
        includeGstInvoice: form.includeGstInvoice,
        discountPercent: applicablePromotion?.discountPercent || 0,
      }),
    [pricedRows, selectedProperty, form.guestState, form.paidAmount, form.includeGstInvoice, nights, applicablePromotion],
  );

  const loadBookings = async () => {
    const loaded = await bookingService.getAll({});
    setBookings(loaded);
  };

  const loadProperties = async () => {
    const loaded = await propertyService.getAll();
    setProperties(loaded);
  };

  useEffect(() => {
    if (!canManageBookings) {
      setBookings([]);
      setError('You are not authorized to manage bookings');
      return;
    }

    let isActive = true;

    const load = async () => {
      try {
        const [bookingsResult, propertiesResult, promotionsResult] = await Promise.all([
          bookingService.getAll({}),
          propertyService.getAll(),
          promotionService.getAll().catch(() => []),
        ]);

        if (!isActive) {
          return;
        }

        setBookings(bookingsResult);
        setProperties(propertiesResult);
        setPromotions(Array.isArray(promotionsResult) ? promotionsResult : []);
      } catch (loadError) {
        if (!isActive) {
          return;
        }
        setError(loadError.response?.data?.message || 'Failed to load bookings');
      }
    };

    load();

    return () => {
      isActive = false;
    };
  }, [canManageBookings]);

  useEffect(() => {
    if (!form.propertyId) {
      setRooms([]);
      setPricingGrid({ dates: [], rows: [] });
      return;
    }

    const run = async () => {
      try {
        const loadedRooms = await roomService.getByProperty(form.propertyId);
        setRooms(loadedRooms);

        const checkInDate = formatDateOnly(form.checkIn);
        const checkOutDate = formatDateOnly(form.checkOut);
        if (!checkInDate || !checkOutDate || nights <= 0) {
          setPricingGrid({ dates: [], rows: [] });
          return;
        }

        const pricing = await rateService.getPricingGrid({
          propertyId: form.propertyId,
          startDate: checkInDate,
          endDate: checkOutDate,
        });
        setPricingGrid(pricing || { dates: [], rows: [] });
      } catch (loadError) {
        setError(loadError.response?.data?.message || 'Failed to load room pricing');
      }
    };

    run();
  }, [form.propertyId, form.checkIn, form.checkOut, nights]);

  useEffect(() => {
    const pincode = String(form.guestPincode || '').trim();
    if (pincode.length !== 6) {
      return;
    }

    const controller = new AbortController();
    fetch(`https://api.postalpincode.in/pincode/${pincode}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        const postOffice = data?.[0]?.PostOffice?.[0];
        if (!postOffice) {
          return;
        }
        setForm((current) => ({
          ...current,
          guestState: current.guestState || postOffice.State || '',
        }));
      })
      .catch(() => {});

    return () => controller.abort();
  }, [form.guestPincode]);

  const resetForm = () => {
    setEditingBookingId(null);
    setForm({
      propertyId: '',
      guestName: '',
      guestMobile: '',
      guestEmail: '',
      gstNumber: '',
      guestAddress: '',
      guestPincode: '',
      guestState: '',
      checkIn: '',
      checkOut: '',
      paymentReference: '',
      specialNote: '',
      paidAmount: 0,
      includeGstInvoice: true,
      rooms: [createEmptyRow()],
    });
  };

  const addRow = () => {
    setForm((current) => ({
      ...current,
      rooms: [...current.rooms, createEmptyRow()],
    }));
  };

  const removeRow = (index) => {
    setForm((current) => {
      const nextRows = current.rooms.filter((_, rowIndex) => rowIndex !== index);
      return {
        ...current,
        rooms: nextRows.length > 0 ? nextRows : [createEmptyRow()],
      };
    });
  };

  const updateRow = (index, patch) => {
    setForm((current) => ({
      ...current,
      rooms: current.rooms.map((row, rowIndex) => {
        if (rowIndex !== index) {
          return row;
        }
        return {
          ...row,
          ...patch,
        };
      }),
    }));
  };

  const openCreateBooking = () => {
    resetForm();
    setBookingModalOpen(true);
  };

  const openEditBooking = async (bookingId) => {
    try {
      setBusy(true);
      const booking = await bookingService.getById(bookingId);
      const rows = Array.isArray(booking.bookingRooms) && booking.bookingRooms.length > 0
        ? booking.bookingRooms
        : [
            {
              roomTypeId: booking.roomTypeId,
              ratePlanId: booking.ratePlanId,
              rooms: 1,
              adults: booking.guestsCount || 1,
              extraBed: 0,
              pricePerNight: booking.nights > 0 ? round2((booking.subtotal || booking.totalAmount || 0) / booking.nights) : 0,
            },
          ];

      setEditingBookingId(bookingId);
      setForm({
        propertyId: booking.propertyId || booking.roomType?.propertyId || '',
        guestName: booking.guestName || '',
        guestMobile: booking.guestMobile || '',
        guestEmail: booking.guestEmail || '',
        gstNumber: booking.gstNumber || '',
        guestAddress: booking.guestAddress || '',
        guestPincode: booking.guestPincode || '',
        guestState: booking.guestState || '',
        checkIn: toDateInputValue(booking.checkIn),
        checkOut: toDateInputValue(booking.checkOut),
        paymentReference: booking.paymentReference || '',
        specialNote: booking.specialNote || '',
        paidAmount: Number(booking.paidAmount || 0),
        includeGstInvoice: booking.includeGstInvoice !== undefined
          ? Boolean(booking.includeGstInvoice)
          : Number(booking.totalGST || booking.cgst || booking.sgst || booking.igst || 0) > 0,
        rooms: rows.map((row) => ({
          roomTypeId: row.roomTypeId,
          ratePlanId: row.ratePlanId || '',
          rooms: Number(row.rooms || 1),
          adults: Number(row.adults || 0),
          extraBed: Number(row.extraBed || 0),
          pricePerNight: Number(row.pricePerNight || 0),
          manualPrice: true,
          totalCost: Number(row.totalCost || 0),
        })),
      });
      setBookingModalOpen(true);
    } catch (loadError) {
      pushToast({ type: 'error', title: 'Load failed', message: loadError.response?.data?.message || loadError.message });
    } finally {
      setBusy(false);
    }
  };

  const submitBooking = async (event) => {
    event.preventDefault();

    if (!form.propertyId) {
      pushToast({ type: 'error', title: 'Validation failed', message: 'Property is required.' });
      return;
    }

    if (!form.guestName || !form.guestMobile) {
      pushToast({ type: 'error', title: 'Validation failed', message: 'Guest name and mobile are required.' });
      return;
    }

    if (nights <= 0) {
      pushToast({ type: 'error', title: 'Validation failed', message: 'Check-out must be after check-in.' });
      return;
    }

    if (pricedRows.some((row) => !row.roomTypeId)) {
      pushToast({ type: 'error', title: 'Validation failed', message: 'Each room row needs a room type.' });
      return;
    }

    if (pricedRows.some((row) => Number(row.pricePerNight || 0) < 0)) {
      pushToast({ type: 'error', title: 'Validation failed', message: 'Price per night must be non-negative.' });
      return;
    }

    if (summary.paidAmount > summary.totalAmount) {
      pushToast({ type: 'error', title: 'Validation failed', message: 'Paid amount cannot exceed total.' });
      return;
    }

    const payload = {
      propertyId: form.propertyId,
      guestName: form.guestName,
      guestMobile: form.guestMobile,
      guestEmail: form.guestEmail || undefined,
      gstNumber: form.gstNumber || undefined,
      guestAddress: form.guestAddress || undefined,
      guestPincode: form.guestPincode || undefined,
      guestState: form.guestState || undefined,
      checkInDate: form.checkIn,
      checkOutDate: form.checkOut,
      paymentReference: form.paymentReference || undefined,
      specialNote: form.specialNote || undefined,
      includeGstInvoice: Boolean(form.includeGstInvoice),
      promotionDiscountPercent: applicablePromotion?.discountPercent || 0,
      paidAmount: summary.paidAmount,
      rooms: pricedRows.map((row) => ({
        roomTypeId: row.roomTypeId,
        ratePlanId: row.ratePlanId,
        rooms: Number(row.rooms),
        adults: Number(row.adults),
        extraBed: Number(row.extraBed),
        pricePerNight: Number(row.pricePerNight),
      })),
      summary,
    };

    try {
      setBusy(true);
      if (editingBookingId) {
        await bookingService.update(editingBookingId, payload);
      } else {
        await bookingService.create(payload);
      }
      await loadBookings();
      setBookingModalOpen(false);
      resetForm();
      pushToast({
        type: 'success',
        title: editingBookingId ? 'Booking updated' : 'Booking created',
        message: 'Booking has been saved with recalculated totals and invoice-ready data.',
      });
    } catch (saveError) {
      pushToast({ type: 'error', title: 'Save failed', message: saveError.response?.data?.message || saveError.message });
    } finally {
      setBusy(false);
    }
  };

  const cancelBooking = async (bookingId) => {
    try {
      setBusy(true);
      await bookingService.cancel(bookingId);
      await loadBookings();
      pushToast({ type: 'success', title: 'Booking cancelled', message: 'Booking cancelled and inventory restored.' });
    } catch (cancelError) {
      pushToast({ type: 'error', title: 'Cancel failed', message: cancelError.response?.data?.message || cancelError.message });
    } finally {
      setBusy(false);
    }
  };

  const deleteBooking = async (bookingId) => {
    try {
      setBusy(true);
      await bookingService.remove(bookingId);
      await loadBookings();
      pushToast({ type: 'success', title: 'Booking deleted', message: 'Booking was permanently deleted.' });
    } catch (deleteError) {
      pushToast({ type: 'error', title: 'Delete failed', message: deleteError.response?.data?.message || deleteError.message });
    } finally {
      setBusy(false);
    }
  };

  const previewInvoice = async (bookingId) => {
    try {
      setBusy(true);
      const response = await bookingService.previewInvoice(bookingId);
      setInvoiceHtml(normalizeInvoicePreviewHtml(response.html || ''));
      setInvoiceModalOpen(true);
    } catch (previewError) {
      pushToast({ type: 'error', title: 'Preview failed', message: previewError.response?.data?.message || previewError.message });
    } finally {
      setBusy(false);
    }
  };

  const downloadInvoice = async (bookingId) => {
    try {
      setBusy(true);
      const blob = await bookingService.downloadInvoice(bookingId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${bookingId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      pushToast({ type: 'error', title: 'Download failed', message: downloadError.response?.data?.message || downloadError.message });
    } finally {
      setBusy(false);
    }
  };

  const visibleBookings = useMemo(
    () =>
      bookings.filter((booking) => {
        const haystack = [
          booking.otaSource,
          booking.guestName,
          booking.roomType?.name,
          booking.property?.name,
          booking.roomType?.property?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query.toLowerCase());
      }),
    [bookings, query],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-700">Bookings</p>
        <h2 className="mt-2 text-3xl font-black text-slate-900">Manual Booking Ledger</h2>
        <p className="mt-2 text-sm text-slate-500">Tally-style booking, GST breakdown, and invoice generation with one flow.</p>
      </div>

      <ErrorBanner message={error} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search bookings"
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-400"
        />
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Logged in as {user?.role || 'USER'}
        </div>
        {canManageBookings ? (
          <button
            type="button"
            onClick={openCreateBooking}
            className="rounded-2xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Create Booking
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-xl">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Property</th>
              <th className="px-4 py-3 text-left font-semibold">Guest</th>
              <th className="px-4 py-3 text-left font-semibold">Check In</th>
              <th className="px-4 py-3 text-left font-semibold">Check Out</th>
              <th className="px-4 py-3 text-left font-semibold">Total</th>
              <th className="px-4 py-3 text-left font-semibold">Paid</th>
              <th className="px-4 py-3 text-left font-semibold">Due</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleBookings.map((booking) => (
              <tr key={booking.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-semibold text-slate-900">{booking.property?.name || booking.roomType?.property?.name || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{booking.guestName}</td>
                <td className="px-4 py-3 text-slate-600">{formatDateOnly(booking.checkIn)}</td>
                <td className="px-4 py-3 text-slate-600">{formatDateOnly(booking.checkOut)}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">{formatCurrency(booking.totalAmount ?? booking.totalPrice ?? 0)}</td>
                <td className="px-4 py-3 text-slate-600">{formatCurrency(booking.paidAmount || 0)}</td>
                <td className="px-4 py-3 text-slate-600">{formatCurrency(booking.dueAmount || 0)}</td>
                <td className="px-4 py-3 text-slate-600">{booking.status}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => previewInvoice(booking.id)}
                      className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      Preview Invoice
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadInvoice(booking.id)}
                      className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                    >
                      Download Invoice
                    </button>
                    {canManageBookings && booking.status !== 'CANCELLED' ? (
                      <button
                        type="button"
                        onClick={() => openEditBooking(booking.id)}
                        className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700"
                      >
                        Edit
                      </button>
                    ) : null}
                    {canManageBookings ? (
                      <button
                        type="button"
                        disabled={busy || booking.status === 'CANCELLED'}
                        onClick={() => cancelBooking(booking.id)}
                        className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    ) : null}
                    {canManageBookings ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => deleteBooking(booking.id)}
                        className="rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Delete Booking
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={bookingModalOpen} title={editingBookingId ? 'Edit Booking' : 'Create Booking'} onClose={() => setBookingModalOpen(false)} panelClassName="max-w-7xl">
        <form className="space-y-5" onSubmit={submitBooking}>
          <section className="rounded-2xl border border-slate-200 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-800">Section 1: Property</p>
            <label className="space-y-1 text-sm">
              <span className="font-semibold text-slate-700">Property</span>
              <select
                required
                value={form.propertyId}
                onChange={(event) => {
                  const propertyId = event.target.value;
                  setForm((current) => ({
                    ...current,
                    propertyId,
                    rooms: current.rooms.map((row) => ({ ...row, roomTypeId: '', ratePlanId: '' })),
                  }));
                }}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              >
                <option value="">Select property</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-800">Section 2: Guest Details</p>
            <div className="grid gap-3 md:grid-cols-3">
              <TextInput label="Guest Name" value={form.guestName} onChange={(event) => setForm((current) => ({ ...current, guestName: event.target.value }))} required />
              <TextInput label="Mobile" value={form.guestMobile} onChange={(event) => setForm((current) => ({ ...current, guestMobile: event.target.value }))} required />
              <TextInput label="Email" type="email" value={form.guestEmail} onChange={(event) => setForm((current) => ({ ...current, guestEmail: event.target.value }))} />
              <TextInput label="GST Number" value={form.gstNumber} onChange={(event) => setForm((current) => ({ ...current, gstNumber: event.target.value }))} />
              <TextInput label="Pincode" value={form.guestPincode} onChange={(event) => setForm((current) => ({ ...current, guestPincode: event.target.value }))} />
              <TextInput label="Guest State" value={form.guestState} onChange={(event) => setForm((current) => ({ ...current, guestState: event.target.value }))} />
            </div>
            <TextInput label="Address" value={form.guestAddress} onChange={(event) => setForm((current) => ({ ...current, guestAddress: event.target.value }))} />
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-800">Section 3: Booking Details</p>
            <div className="grid gap-3 md:grid-cols-3">
              <TextInput label="Check-in Date" type="date" value={form.checkIn} onChange={(event) => setForm((current) => ({ ...current, checkIn: event.target.value }))} required />
              <TextInput label="Check-out Date" type="date" value={form.checkOut} onChange={(event) => setForm((current) => ({ ...current, checkOut: event.target.value }))} required />
              <TextInput label="Nights" value={String(nights)} readOnly />
              <TextInput label="Payment Reference" value={form.paymentReference} onChange={(event) => setForm((current) => ({ ...current, paymentReference: event.target.value }))} />
              <TextInput label="Special Note" value={form.specialNote} onChange={(event) => setForm((current) => ({ ...current, specialNote: event.target.value }))} />
              <TextInput label="Paid Amount" type="number" min="0" step="0.01" value={String(form.paidAmount)} onChange={(event) => setForm((current) => ({ ...current, paidAmount: Number(event.target.value || 0) }))} />
            </div>
            <label className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(form.includeGstInvoice)}
                onChange={(event) => setForm((current) => ({ ...current, includeGstInvoice: event.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-200"
              />
              Include GST Invoice
            </label>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Section 4: Room Table</p>
              <button type="button" onClick={addRow} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">+ Add Row</button>
            </div>

            <div className="overflow-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {ROOM_TABLE_COLUMNS.map((column) => (
                      <th key={column} className="px-3 py-2 text-left text-xs font-semibold text-slate-600">{column}</th>
                    ))}
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pricedRows.map((row, index) => {
                    const availableRatePlans = row.roomType?.ratePlans || [];

                    return (
                      <tr key={`row-${index}`} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <select
                            value={row.roomTypeId}
                            onChange={(event) => updateRow(index, { roomTypeId: event.target.value, ratePlanId: '', manualPrice: false, pricePerNight: 0 })}
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5"
                            required
                          >
                            <option value="">Select room</option>
                            {propertyRows.map((roomType) => (
                              <option key={roomType.id} value={roomType.id}>{roomType.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={row.ratePlanId}
                            onChange={(event) => updateRow(index, { ratePlanId: event.target.value, manualPrice: false })}
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5"
                            required
                            disabled={!row.roomTypeId}
                          >
                            <option value="">Select plan</option>
                            {availableRatePlans.map((ratePlan) => (
                              <option key={ratePlan.id} value={ratePlan.id}>{ratePlan.mealPlanName}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="1" value={row.rooms} onChange={(event) => updateRow(index, { rooms: Number(event.target.value || 1) })} className="w-24 rounded-lg border border-slate-200 px-2 py-1.5" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="0" value={row.adults} onChange={(event) => updateRow(index, { adults: Number(event.target.value || 0) })} className="w-24 rounded-lg border border-slate-200 px-2 py-1.5" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="0" value={row.extraBed} onChange={(event) => updateRow(index, { extraBed: Number(event.target.value || 0) })} className="w-24 rounded-lg border border-slate-200 px-2 py-1.5" />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.pricePerNight}
                            onChange={(event) => updateRow(index, { pricePerNight: Number(event.target.value || 0), manualPrice: true })}
                            className="w-32 rounded-lg border border-slate-200 px-2 py-1.5"
                          />
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-800">{formatCurrency(row.totalCost)}</td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => removeRow(index)} className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">Remove</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-800">Pricing Breakdown</p>
            <div className="grid gap-2 md:grid-cols-4">
              <p>Subtotal: <strong>{formatCurrency2(summary.subtotal)}</strong></p>
              <p>GST Rate: <strong>{summary.gstRate}%</strong></p>
              <p>Total Amount: <strong>{formatCurrency2(summary.totalAmount)}</strong></p>
              <p>Due Amount: <strong>{formatCurrency2(summary.dueAmount)}</strong></p>
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-4">
              <p>Round Off: <strong>{formatCurrency2(summary.roundOff)}</strong></p>
              {summary.discountAmount > 0 ? <p>Promotion Applied: <strong>-{formatCurrency2(summary.discountAmount)}</strong></p> : null}
              {summary.cgst > 0 ? <p>CGST: <strong>{formatCurrency2(summary.cgst)}</strong></p> : null}
              {summary.sgst > 0 ? <p>SGST: <strong>{formatCurrency2(summary.sgst)}</strong></p> : null}
              {summary.igst > 0 ? <p>IGST: <strong>{formatCurrency2(summary.igst)}</strong></p> : null}
            </div>
          </section>

          <button type="submit" disabled={busy} className="w-full rounded-2xl bg-brand-700 py-3 font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60">
            {editingBookingId ? 'Update Booking' : 'Create Booking'}
          </button>
        </form>
      </Modal>

      <Modal open={invoiceModalOpen} title="Invoice Preview" onClose={() => setInvoiceModalOpen(false)} panelClassName="max-w-6xl">
        <iframe title="Invoice Preview" srcDoc={invoiceHtml} className="h-[75vh] w-full rounded-xl border border-slate-200" />
      </Modal>
    </div>
  );
}

export default BookingsPage;
