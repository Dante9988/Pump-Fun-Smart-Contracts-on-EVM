import { configureStore } from '@reduxjs/toolkit';
import walletReducer from './slices/walletSlice';
import contractReducer from './slices/contractSlice';
import tokenInfoReducer from './slices/tokenInfoSlice';

export const store = configureStore({
  reducer: {
    wallet: walletReducer,
    contract: contractReducer,
    tokenInfo: tokenInfoReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 
