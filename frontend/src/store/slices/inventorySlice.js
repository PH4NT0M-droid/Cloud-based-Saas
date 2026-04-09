import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import inventoryService from '../../services/inventoryService';

export const fetchInventoryCalendar = createAsyncThunk('inventory/calendar', async (params, { rejectWithValue }) => {
  try {
    const res = await inventoryService.getCalendar(params);
    return res;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch inventory');
  }
});

export const bulkUpdateInventory = createAsyncThunk('inventory/bulkUpdate', async (payload, { rejectWithValue }) => {
  try {
    const res = await inventoryService.bulkUpdate(payload);
    return res;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to update inventory');
  }
});

const inventorySlice = createSlice({
  name: 'inventory',
  initialState: {
    calendar: null,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchInventoryCalendar.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchInventoryCalendar.fulfilled, (state, action) => {
        state.loading = false;
        state.calendar = action.payload;
      })
      .addCase(fetchInventoryCalendar.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default inventorySlice.reducer;
