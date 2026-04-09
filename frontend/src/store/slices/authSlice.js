import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import authService from '../../services/authService';

const hasStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
const token = hasStorage ? window.localStorage.getItem('token') : null;
const user = hasStorage ? JSON.parse(window.localStorage.getItem('user') || 'null') : null;

export const login = createAsyncThunk('auth/login', async (payload, { rejectWithValue }) => {
  try {
    const response = await authService.login(payload);
    return response;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Login failed');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    token,
    user,
    loading: false,
    error: null,
  },
  reducers: {
    logout: (state) => {
      state.token = null;
      state.user = null;
      if (hasStorage) {
        window.localStorage.removeItem('token');
        window.localStorage.removeItem('user');
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
        if (hasStorage) {
          window.localStorage.setItem('token', action.payload.token);
          window.localStorage.setItem('user', JSON.stringify(action.payload.user));
        }
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;
