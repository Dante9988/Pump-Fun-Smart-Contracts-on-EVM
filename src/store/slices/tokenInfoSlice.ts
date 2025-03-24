import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  price: string;
  priceUSD: string;
  marketCap: string;
  bondingProgress: number;
}

export interface TokenInfoState {
  tokens: { [address: string]: TokenInfo };
  loading: boolean;
  error: string | null;
}

const initialState: TokenInfoState = {
  tokens: {},
  loading: false,
  error: null,
};

const tokenInfoSlice = createSlice({
  name: 'tokenInfo',
  initialState,
  reducers: {
    setTokenInfo: (state, action: PayloadAction<{ address: string; info: TokenInfo }>) => {
      state.tokens[action.payload.address] = action.payload.info;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    updateAllTokens: (state, action: PayloadAction<{ [address: string]: TokenInfo }>) => {
      state.tokens = action.payload;
    },
  },
});

export const { setTokenInfo, setLoading, setError, updateAllTokens } = tokenInfoSlice.actions;
export default tokenInfoSlice.reducer; 
