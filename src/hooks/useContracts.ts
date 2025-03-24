import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ethers } from 'ethers';
import { RootState } from '../store';
import {
  setContracts,
  addToken,
  updateTokenPrice,
  setLoading,
  setError,
} from '../store/slices/contractSlice';
import { config } from '../config';
import { ChainConfig } from '../types/config';
import { uploadToIPFS } from '../utils/ipfs';

// Import your contract ABIs
import PumpFunEvm from '../abi/pumpFunEvm.json';
import MultiAMM from '../abi/multiamm.json';

export const useContracts = () => {
  const dispatch = useDispatch();
  const { provider, signer, chainId } = useSelector((state: RootState) => state.wallet);
  const { pumpFunEVMContract: pumpFunEVMAddress, multiAMMContract: multiAMMAddress, tokens } = useSelector(
    (state: RootState) => state.contract
  );

  const getChainConfig = useCallback((): ChainConfig | undefined => {
    if (!chainId) return undefined;
    return config[chainId.toString() as keyof typeof config];
  }, [chainId]);

  const getPumpFunEVMContract = useCallback(() => {
    if (!signer) return null;
    const chainConfig = getChainConfig();
    if (!chainConfig) return null;
    return new ethers.Contract(chainConfig.pumpFunEVM.address, PumpFunEvm, signer);
  }, [signer, getChainConfig]);

  const getMultiAMMContract = useCallback(() => {
    if (!signer) return null;
    const chainConfig = getChainConfig();
    if (!chainConfig) return null;
    return new ethers.Contract(chainConfig.multiAMM.address, MultiAMM, signer);
  }, [signer, getChainConfig]);

  const initializeContracts = useCallback(async () => {
    if (!provider || !signer) return false;

    try {
      const chainConfig = getChainConfig();
      if (!chainConfig) return false;

      const pumpFunEvm = new ethers.Contract(chainConfig.pumpFunEVM.address, PumpFunEvm, signer);
      const multiAmm = new ethers.Contract(chainConfig.multiAMM.address, MultiAMM, signer);

      dispatch(
        setContracts({
          pumpFunEVMContract: pumpFunEvm,
          multiAMMContract: multiAmm,
        })
      );

      return true;
    } catch (error) {
      console.error('Error initializing contracts:', error);
      return false;
    }
  }, [dispatch, provider, signer, getChainConfig]);

  const createToken = useCallback(
    async (name: string, symbol: string, _logoFile: File) => {
      const pumpFunEVMContract = getPumpFunEVMContract();
      if (!pumpFunEVMContract) return { success: false, txHash: '' };

      try {
        dispatch(setLoading(true));
        
        const tokenParams = {
          name,
          symbol,
          decimals: 18
        };

        const tx = await pumpFunEVMContract.createTokenAndPool(tokenParams);
        const receipt = await tx.wait();
        
        const event = receipt.events?.find(
          (e: any) => e.event === 'TokenCreated'
        );

        if (!event) {
          throw new Error('Token creation event not found');
        }

        const tokenAddress = event.args.tokenAddress;

        dispatch(
          addToken({
            address: tokenAddress,
            tokenData: {
              name,
              symbol,
              logoUrl: '',
              price: '0',
              marketCap: '0',
              volume24h: '0',
              priceChange24h: '0',
            },
          })
        );

        dispatch(setLoading(false));
        return { success: true, txHash: tx.hash };
      } catch (error: any) {
        console.error('Error creating token:', error);
        dispatch(setError(error.message));
        dispatch(setLoading(false));
        return { success: false, txHash: '' };
      }
    },
    [dispatch, getPumpFunEVMContract]
  );

  const getCreatedTokens = useCallback(async () => {
    const pumpFunEVMContract = getPumpFunEVMContract();
    if (!pumpFunEVMContract) return [];

    try {
      const tokens = await pumpFunEVMContract.getCreatedTokens();
      return tokens;
    } catch (error) {
      console.error('Error getting created tokens:', error);
      return [];
    }
  }, [getPumpFunEVMContract]);

  const getTokenPrice = useCallback(
    async (tokenAddress: string) => {
      const multiAmmContract = getMultiAMMContract();
      if (!multiAmmContract) return '0';

      try {
        const wctcAddress = await multiAmmContract.WETH9();
        const [priceAinB, priceBinA] = await multiAmmContract.getTokenPrice(tokenAddress, wctcAddress);
        // We want priceAinB which is tokenPrice/WCTC
        return ethers.utils.formatEther(priceAinB);
      } catch (error) {
        console.error('Error getting token price:', error);
        return '0';
      }
    },
    [signer, multiAMMAddress]
  );

  const buyToken = useCallback(
    async (tokenAddress: string, amount: string) => {
      const pumpFunEVMContract = getPumpFunEVMContract();
      if (!pumpFunEVMContract || !signer) return { success: false, txHash: '' };

      try {
        dispatch(setLoading(true));
        
        // Get the WCTC contract
        const multiAmmContract = getMultiAMMContract();
        if (!multiAmmContract) throw new Error('MultiAMM contract not initialized');
        
        const wctcAddress = await multiAmmContract.WETH9();
        const wctcContract = new ethers.Contract(
          wctcAddress,
          [
            'function approve(address spender, uint256 amount) returns (bool)',
            'function allowance(address owner, address spender) view returns (uint256)'
          ],
          signer
        );

        const amountInWei = ethers.utils.parseEther(amount);

        // Check current allowance
        const currentAllowance = await wctcContract.allowance(
          await signer.getAddress(),
          pumpFunEVMContract.address
        );

        // Only approve if necessary
        if (currentAllowance.lt(amountInWei)) {
          console.log('Approving WCTC spend...');
          const approveTx = await wctcContract.approve(
            pumpFunEVMContract.address,
            ethers.constants.MaxUint256 // Approve maximum amount to save gas on future transactions
          );
          await approveTx.wait();
          console.log('WCTC approved');
        }

        // Execute buy transaction
        console.log('Executing buy...');
        const tx = await pumpFunEVMContract.buyToken(
          tokenAddress,
          amountInWei,
          {
            gasLimit: 3000000 // Reduced from 30M to 3M
          }
        );

        console.log('Waiting for transaction...');
        const receipt = await tx.wait();
        console.log('Transaction confirmed');
        
        dispatch(setLoading(false));
        return { success: true, txHash: tx.hash };
      } catch (error: any) {
        console.error('Error buying token:', error);
        dispatch(setError(error.message));
        dispatch(setLoading(false));
        return { success: false, txHash: '' };
      }
    },
    [dispatch, signer, getMultiAMMContract, getPumpFunEVMContract]
  );

  const sellToken = useCallback(
    async (tokenAddress: string, amount: string) => {
      const pumpFunEVMContract = getPumpFunEVMContract();
      if (!pumpFunEVMContract || !signer) return { success: false, txHash: '' };

      try {
        dispatch(setLoading(true));

        // First approve the PumpFunEVM contract to spend tokens
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ['function approve(address spender, uint256 amount) returns (bool)'],
          signer
        );

        const chainConfig = getChainConfig();
        if (!chainConfig) throw new Error('Chain config not found');

        const approveTx = await tokenContract.approve(
          pumpFunEVMContract.address,
          ethers.utils.parseEther(amount),
          {
            gasLimit: 100000
          }
        );
        await approveTx.wait();

        // Execute sell transaction
        const tx = await pumpFunEVMContract.sellToken(
          tokenAddress,
          ethers.utils.parseEther(amount),
          {
            gasLimit: 300000,
            maxFeePerGas: ethers.utils.parseUnits('10', 'gwei'),
            maxPriorityFeePerGas: ethers.utils.parseUnits('2', 'gwei')
          }
        );

        const receipt = await tx.wait();
        
        dispatch(setLoading(false));
        return { success: true, txHash: tx.hash };
      } catch (error: any) {
        console.error('Error selling token:', error);
        dispatch(setError(error.message));
        dispatch(setLoading(false));
        return { success: false, txHash: '' };
      }
    },
    [dispatch, signer, getChainConfig, getPumpFunEVMContract]
  );

  return {
    tokens,
    initializeContracts,
    createToken,
    buyToken,
    sellToken,
    getTokenPrice,
    getCreatedTokens,
  };
};

export default useContracts; 