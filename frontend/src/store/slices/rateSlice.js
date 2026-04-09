import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import rateService from '../../services/rateService';

export const fetchRates = createAsyncThunk('rates/fetch', async (params, { rejectWithValue }) => {
  try {
    const res = await rateService.getRates(params);
    return res;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch rates');
  }
});

export const bulkUpdateRates = createAsyncThunk('rates/bulkUpdate', async (payload, { rejectWithValue }) => {
  try {
    const res = await rateService.bulkUpdate(payload);
    return res;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to update rates');
  }
});

const rateSlice = createSlice({
  name: 'rates',
  initialState: {
    data: null,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRates.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRates.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchRates.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default rateSlice.reducer;
