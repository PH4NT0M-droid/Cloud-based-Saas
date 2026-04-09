import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import bookingService from '../../services/bookingService';

export const fetchBookings = createAsyncThunk('bookings/fetch', async (params, { rejectWithValue }) => {
  try {
    const res = await bookingService.getAll(params);
    return res;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch bookings');
  }
});

export const updateBookingStatus = createAsyncThunk(
  'bookings/updateStatus',
  async ({ id, status }, { rejectWithValue }) => {
    try {
      const res = await bookingService.updateStatus(id, status);
      return res;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update booking');
    }
  },
);

export const syncBookings = createAsyncThunk('bookings/sync', async (payload, { rejectWithValue }) => {
  try {
    const res = await bookingService.sync(payload);
    return res;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to sync bookings');
  }
});

const bookingSlice = createSlice({
  name: 'bookings',
  initialState: {
    items: [],
    syncSummary: null,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchBookings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBookings.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchBookings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updateBookingStatus.fulfilled, (state, action) => {
        const idx = state.items.findIndex((item) => item.id === action.payload.id);
        if (idx !== -1) {
          state.items[idx] = action.payload;
        }
      })
      .addCase(syncBookings.fulfilled, (state, action) => {
        state.syncSummary = action.payload;
      });
  },
});

export default bookingSlice.reducer;
