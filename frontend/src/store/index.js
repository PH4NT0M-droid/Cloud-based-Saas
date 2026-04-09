import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import propertyReducer from './slices/propertySlice';
import inventoryReducer from './slices/inventorySlice';
import rateReducer from './slices/rateSlice';
import bookingReducer from './slices/bookingSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    properties: propertyReducer,
    inventory: inventoryReducer,
    rates: rateReducer,
    bookings: bookingReducer,
  },
});
