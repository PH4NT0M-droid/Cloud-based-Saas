import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import propertyService from '../../services/propertyService';
import roomService from '../../services/roomService';

export const fetchProperties = createAsyncThunk('properties/fetchAll', async (_, { rejectWithValue }) => {
  try {
    const res = await propertyService.getAll();
    return res;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch properties');
  }
});

export const createProperty = createAsyncThunk('properties/create', async (payload, { rejectWithValue }) => {
  try {
    const res = await propertyService.create(payload);
    return res;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to create property');
  }
});

export const updateProperty = createAsyncThunk('properties/update', async ({ id, payload }, { rejectWithValue }) => {
  try {
    const res = await propertyService.update(id, payload);
    return res;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to update property');
  }
});

export const deleteProperty = createAsyncThunk('properties/delete', async (id, { rejectWithValue }) => {
  try {
    await propertyService.remove(id);
    return id;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to delete property');
  }
});

export const createRoom = createAsyncThunk('properties/createRoom', async (payload, { rejectWithValue }) => {
  try {
    const res = await roomService.create(payload);
    return res;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to create room');
  }
});

const propertySlice = createSlice({
  name: 'properties',
  initialState: {
    items: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchProperties.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProperties.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchProperties.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createProperty.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      })
      .addCase(updateProperty.fulfilled, (state, action) => {
        const idx = state.items.findIndex((item) => item.id === action.payload.id);
        if (idx !== -1) {
          state.items[idx] = action.payload;
        }
      })
      .addCase(deleteProperty.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item.id !== action.payload);
      })
      .addCase(createRoom.fulfilled, (state, action) => {
        const property = state.items.find((item) => item.id === action.payload.propertyId);
        if (property) {
          property.roomTypes = [...(property.roomTypes || []), action.payload];
        }
      });
  },
});

export default propertySlice.reducer;
