import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  TextField,
  Avatar,
  IconButton,
  Divider,
  CircularProgress,
  Grid,
  Alert,
  Snackbar,
} from '@mui/material';
import useContracts from '../hooks/useContracts';
import useWallet from '../hooks/useWallet';
import { ethers } from 'ethers';
import { config } from '../config';

interface TokenInfo {
  symbol: string;
  name: string;
  price: string;
  marketCap: string;
  bondingProgress: number;
}

const BONDING_CURVE_THRESHOLD = ethers.utils.parseUnits('85000', 8); // 85k USD with 8 decimals

const Trade = () => {
  const { address } = useParams<{ address: string }>();
  const { getTokenPrice, buyToken } = useContracts();
  const { isConnected, address: walletAddress } = useWallet();
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const calculateBondingProgress = (marketCapUSD: ethers.BigNumber): number => {
    if (marketCapUSD.isZero()) return 0;
    if (marketCapUSD.gte(BONDING_CURVE_THRESHOLD)) return 100;
    return Math.floor(marketCapUSD.mul(100).div(BONDING_CURVE_THRESHOLD).toNumber());
  };

  const fetchTokenInfo = async () => {
    try {
      if (!address) return;
      
      const contract = new ethers.Contract(
        address,
        [
          'function symbol() view returns (string)',
          'function name() view returns (string)',
          'function totalSupply() view returns (uint256)',
        ],
        new ethers.providers.Web3Provider(window.ethereum)
      );

      const [symbol, name, totalSupply, price] = await Promise.all([
        contract.symbol(),
        contract.name(),
        contract.totalSupply(),
        getTokenPrice(address)
      ]);

      // Calculate market cap in USD (assuming price is in WCTC)
      const priceInWCTC = ethers.utils.parseEther(price.toString());
      const marketCapInWCTC = priceInWCTC.mul(totalSupply).div(ethers.utils.parseEther('1'));
      const marketCapUSD = marketCapInWCTC.mul(ethers.utils.parseUnits('2000', 8)).div(ethers.utils.parseUnits('1', 8)); // Assuming 1 CTC = $2000

      const bondingProgress = calculateBondingProgress(marketCapUSD);

      setTokenInfo({
        symbol,
        name,
        price,
        marketCap: ethers.utils.formatUnits(marketCapUSD, 8),
        bondingProgress,
      });
    } catch (error) {
      console.error('Error fetching token info:', error);
      setError('Failed to fetch token information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      fetchTokenInfo();
      const interval = setInterval(fetchTokenInfo, 10000); // Update every 10 seconds
      return () => clearInterval(interval);
    }
  }, [address, isConnected, getTokenPrice]);

  const handleBuy = async () => {
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (!address || !amount) {
      setError('Please enter an amount');
      return;
    }

    try {
      setTransactionLoading(true);
      setError(null);
      const { success, txHash } = await buyToken(address, amount);
      
      if (success) {
        setAmount('');
        setTxHash(txHash);
        // Refresh token info after successful purchase
        await fetchTokenInfo();
      } else {
        setError('Failed to buy token');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setTransactionLoading(false);
    }
  };

  const handleSell = async () => {
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (!address || !amount) {
      setError('Please enter an amount');
      return;
    }

    try {
      setTransactionLoading(true);
      setError(null);

      // Get the token contract
      const tokenContract = new ethers.Contract(
        address,
        ['function approve(address spender, uint256 amount) returns (bool)'],
        new ethers.providers.Web3Provider(window.ethereum).getSigner()
      );

      // Get the PumpFunEvm contract
      const chainConfig = config['102031'];
      const pumpFunEvmContract = new ethers.Contract(
        chainConfig.pumpFunEVM.address,
        ['function sellToken(address tokenAddress, uint256 amount) external returns (uint256)'],
        new ethers.providers.Web3Provider(window.ethereum).getSigner()
      );

      // Approve PumpFunEvm to spend tokens
      const approveTx = await tokenContract.approve(
        chainConfig.pumpFunEVM.address,
        ethers.utils.parseEther(amount),
        {
          gasLimit: 100000
        }
      );
      await approveTx.wait();

      // Perform the sell
      const tx = await pumpFunEvmContract.sellToken(
        address,
        ethers.utils.parseEther(amount),
        {
          gasLimit: 300000,
          maxFeePerGas: ethers.utils.parseUnits('10', 'gwei'),
          maxPriorityFeePerGas: ethers.utils.parseUnits('2', 'gwei')
        }
      );
      const receipt = await tx.wait();
      
      setAmount('');
      setTxHash(tx.hash);
      // Refresh token info after successful sale
      await fetchTokenInfo();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setTransactionLoading(false);
    }
  };

  const handleCloseSnackbar = () => {
    setTxHash(null);
  };

  const handleViewTransaction = () => {
    if (txHash) {
      window.open(`https://creditcoin-testnet.blockscout.com/tx/${txHash}`, '_blank');
    }
  };

  const handleSetAmount = (value: string) => {
    setAmount(value);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!tokenInfo) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <Typography variant="h6">Token not found</Typography>
      </Box>
    );
  }

  const nativeSymbol = 'WCTC'; // Changed from WETH to WCTC

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Grid container spacing={3}>
            {/* Left side - Chart and token info */}
            <Grid item xs={12} md={8}>
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Avatar sx={{ width: 40, height: 40 }}>
                    {tokenInfo.symbol[0]}
                  </Avatar>
                  <Box>
                    <Typography variant="h5">{tokenInfo.symbol}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {tokenInfo.name}
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="h4" sx={{ mb: 1 }}>
                  ${parseFloat(tokenInfo.price).toFixed(8)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Market Cap: ${parseFloat(tokenInfo.marketCap).toLocaleString()}
                </Typography>
              </Box>
              
              {/* Chart placeholder */}
              <Paper 
                sx={{ 
                  height: 400, 
                  bgcolor: 'background.default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Typography variant="body1" color="text.secondary">
                  Chart coming soon
                </Typography>
              </Paper>
            </Grid>

            {/* Right side - Trading interface */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, bgcolor: 'background.default' }}>
                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}
                
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Button 
                      variant="contained" 
                      color="primary"
                      fullWidth 
                      sx={{ mr: 1 }}
                      onClick={handleBuy}
                      disabled={transactionLoading || !isConnected}
                    >
                      {transactionLoading ? <CircularProgress size={24} /> : 'Buy'}
                    </Button>
                    <Button 
                      variant="outlined"
                      fullWidth
                      sx={{ ml: 1 }}
                      onClick={handleSell}
                      disabled={transactionLoading || !isConnected}
                    >
                      {transactionLoading ? <CircularProgress size={24} /> : 'Sell'}
                    </Button>
                  </Box>
                  
                  <TextField
                    fullWidth
                    type="number"
                    label="Amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={transactionLoading}
                    sx={{ mb: 2 }}
                  />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Button size="small" onClick={() => handleSetAmount('0.1')}>0.1 {nativeSymbol}</Button>
                    <Button size="small" onClick={() => handleSetAmount('0.5')}>0.5 {nativeSymbol}</Button>
                    <Button size="small" onClick={() => handleSetAmount('1')}>1 {nativeSymbol}</Button>
                    <Button size="small">Max</Button>
                  </Box>

                  {!isConnected && (
                    <Button
                      variant="contained"
                      color="primary"
                      fullWidth
                      sx={{ mt: 2 }}
                    >
                      Connect Wallet to Trade
                    </Button>
                  )}
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Progress bars */}
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Bonding curve progress</Typography>
                    <Typography variant="body2">{tokenInfo.bondingProgress}%</Typography>
                  </Box>
                  <Box
                    sx={{
                      width: '100%',
                      height: 8,
                      bgcolor: 'background.paper',
                      borderRadius: 1,
                      mb: 2,
                    }}
                  >
                    <Box
                      sx={{
                        width: `${tokenInfo.bondingProgress}%`,
                        height: '100%',
                        bgcolor: 'primary.main',
                        borderRadius: 1,
                      }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">King of the hill progress</Typography>
                    <Typography variant="body2">100%</Typography>
                  </Box>
                  <Box
                    sx={{
                      width: '100%',
                      height: 8,
                      bgcolor: 'background.paper',
                      borderRadius: 1,
                    }}
                  >
                    <Box
                      sx={{
                        width: '100%',
                        height: '100%',
                        bgcolor: 'warning.main',
                        borderRadius: 1,
                      }}
                    />
                  </Box>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Paper>
      </Box>

      <Snackbar
        open={!!txHash}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        message="Transaction submitted"
        action={
          <Button color="primary" size="small" onClick={handleViewTransaction}>
            View on BlockScout
          </Button>
        }
      />
    </Container>
  );
};

export default Trade; 