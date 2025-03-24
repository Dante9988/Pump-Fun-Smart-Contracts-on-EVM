import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ethers } from 'ethers';
import { RootState } from '../store';
import { setWallet } from '../store/slices/walletSlice';

export const useWallet = () => {
  const dispatch = useDispatch();
  const { address, provider, signer, chainId, isConnected } = useSelector((state: RootState) => state.wallet);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setError('Please install MetaMask or another Web3 wallet');
      return false;
    }

    try {
      setIsConnecting(true);
      setError(null);

      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const network = await provider.getNetwork();

      dispatch(setWallet({
        address: accounts[0],
        provider,
        signer,
        chainId: network.chainId,
        isConnected: true
      }));

      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [dispatch]);

  const disconnectWallet = useCallback(() => {
    dispatch(setWallet({
      address: null,
      provider: null,
      signer: null,
      chainId: null,
      isConnected: false
    }));
  }, [dispatch]);

  // Listen for account changes
  React.useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', async (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const signer = provider.getSigner();
          const network = await provider.getNetwork();

          dispatch(setWallet({
            address: accounts[0],
            provider,
            signer,
            chainId: network.chainId,
            isConnected: true
          }));
        }
      });

      window.ethereum.on('chainChanged', async (chainId: string) => {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const network = await provider.getNetwork();

        dispatch(setWallet({
          address,
          provider,
          signer,
          chainId: network.chainId,
          isConnected: true
        }));
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', () => {});
        window.ethereum.removeListener('chainChanged', () => {});
      }
    };
  }, [dispatch, address, disconnectWallet]);

  return {
    address,
    provider,
    signer,
    chainId,
    isConnected,
    connectWallet,
    disconnectWallet,
    isConnecting,
    error
  };
};

export default useWallet; 