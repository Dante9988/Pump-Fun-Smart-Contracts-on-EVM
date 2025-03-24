import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ethers } from 'ethers';

export interface WalletState {
  address: string | null;
  provider: ethers.providers.Web3Provider | null;
  signer: ethers.Signer | null;
  chainId: number | null;
  isConnected: boolean;
}

const initialState: WalletState = {
  address: null,
  provider: null,
  signer: null,
  chainId: null,
  isConnected: false,
};

const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    setWallet: (state, action: PayloadAction<WalletState>) => {
      state.address = action.payload.address;
      state.provider = action.payload.provider;
      state.signer = action.payload.signer;
      state.chainId = action.payload.chainId;
      state.isConnected = action.payload.isConnected;
    },
  },
});

export const { setWallet } = walletSlice.actions;

export default walletSlice.reducer; 
