import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ethers } from 'ethers';

export interface ContractState {
  pumpFunEVMContract: string | null;
  multiAMMContract: string | null;
  tokens: {
    [address: string]: {
      name: string;
      symbol: string;
      logoUrl: string;
      price: string;
      marketCap: string;
      volume24h: string;
      priceChange24h: string;
    };
  };
  loading: boolean;
  error: string | null;
}

const initialState: ContractState = {
  pumpFunEVMContract: null,
  multiAMMContract: null,
  tokens: {},
  loading: false,
  error: null,
};

const contractSlice = createSlice({
  name: 'contract',
  initialState,
  reducers: {
    setContracts: (state, action: PayloadAction<{
      pumpFunEVMContract?: ethers.Contract;
      multiAMMContract?: ethers.Contract;
    }>) => {
      if (action.payload.pumpFunEVMContract) {
        state.pumpFunEVMContract = action.payload.pumpFunEVMContract.address;
      }
      if (action.payload.multiAMMContract) {
        state.multiAMMContract = action.payload.multiAMMContract.address;
      }
    },
    addToken: (state, action: PayloadAction<{
      address: string;
      tokenData: {
        name: string;
        symbol: string;
        logoUrl: string;
        price: string;
        marketCap: string;
        volume24h: string;
        priceChange24h: string;
      };
    }>) => {
      state.tokens[action.payload.address] = action.payload.tokenData;
    },
    updateTokenPrice: (state, action: PayloadAction<{
      address: string;
      price: string;
      marketCap: string;
    }>) => {
      if (state.tokens[action.payload.address]) {
        state.tokens[action.payload.address].price = action.payload.price;
        state.tokens[action.payload.address].marketCap = action.payload.marketCap;
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setContracts,
  addToken,
  updateTokenPrice,
  setLoading,
  setError,
} = contractSlice.actions;

export default contractSlice.reducer; 
