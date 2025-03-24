import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Container,
  Typography,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  CircularProgress,
  Avatar,
} from '@mui/material';
import useContracts from '../hooks/useContracts';
import useWallet from '../hooks/useWallet';
import { ethers } from 'ethers';
import { config } from '../config';
import { setLoading, setError, updateAllTokens } from '../store/slices/tokenInfoSlice';
import { RootState } from '../store';

const BONDING_CURVE_THRESHOLD = ethers.utils.parseUnits('85000', 8); // 85k USD with 8 decimals

const Home = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { getCreatedTokens, getTokenPrice } = useContracts();
  const { isConnected, chainId } = useWallet();
  const [searchTerm, setSearchTerm] = useState('');
  
  const { tokens, loading } = useSelector((state: RootState) => state.tokenInfo);

  const calculateBondingProgress = (marketCapUSD: ethers.BigNumber): number => {
    if (marketCapUSD.isZero()) return 0;
    if (marketCapUSD.gte(BONDING_CURVE_THRESHOLD)) return 100;
    return Math.floor(marketCapUSD.mul(100).div(BONDING_CURVE_THRESHOLD).toNumber());
  };

  const fetchTokens = useCallback(async () => {
    try {
      if (!chainId) return;
      dispatch(setLoading(true));

      const chainConfig = config[chainId.toString() as keyof typeof config];
      if (!chainConfig) {
        throw new Error('Chain config not found');
      }

      const tokenAddresses = await getCreatedTokens();
      console.log('Created tokens:', tokenAddresses);

      const pumpFunEVMContract = new ethers.Contract(
        chainConfig.pumpFunEVM.address,
        ['function getMarketCapInUSD(address) view returns (uint256)'],
        new ethers.providers.Web3Provider(window.ethereum)
      );
      
      const tokenDetailsPromises = tokenAddresses.map(async (address: string) => {
        const contract = new ethers.Contract(
          address,
          [
            'function symbol() view returns (string)',
            'function name() view returns (string)',
            'function totalSupply() view returns (uint256)'
          ],
          new ethers.providers.Web3Provider(window.ethereum)
        );
        
        const [symbol, name, priceInWCTC, marketCapInUSD] = await Promise.all([
          contract.symbol(),
          contract.name(),
          getTokenPrice(address),
          pumpFunEVMContract.getMarketCapInUSD(address)
        ]);

        // Convert price from WCTC to USD (1 WCTC = $2000)
        const WCTC_PRICE_USD = 2000;
        const priceInUSD = parseFloat(priceInWCTC) * WCTC_PRICE_USD;

        console.log('Raw market cap:', marketCapInUSD.toString());
        
        // Market cap comes in with 8 decimals from the contract
        const marketCapUSDFormatted = parseFloat(ethers.utils.formatUnits(marketCapInUSD, 8));

        console.log('Token Info:', {
          symbol,
          priceInWCTC,
          priceInUSD,
          marketCapInUSD: marketCapInUSD.toString(),
          marketCapUSDFormatted
        });

        const bondingProgress = calculateBondingProgress(marketCapInUSD);

        return [address, {
          address,
          symbol,
          name,
          price: parseFloat(priceInWCTC).toFixed(8),
          priceUSD: priceInUSD.toFixed(4),
          marketCap: marketCapUSDFormatted.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }),
          bondingProgress
        }];
      });

      const tokenDetails = await Promise.all(tokenDetailsPromises);
      const tokenMap = Object.fromEntries(tokenDetails);
      dispatch(updateAllTokens(tokenMap));
    } catch (error) {
      console.error('Error fetching tokens:', error);
      dispatch(setError('Failed to fetch tokens'));
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch, chainId, getCreatedTokens, getTokenPrice]);

  useEffect(() => {
    // Initial fetch
    if (isConnected) {
      fetchTokens();
    }

    // Set up interval for updates
    const interval = setInterval(() => {
      if (isConnected) {
        fetchTokens();
      }
    }, 10000); // Update every 10 seconds

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [isConnected, fetchTokens]);

  const filteredTokens = Object.values(tokens).filter(token =>
    token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Discover Tokens
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search by symbol or address"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {isConnected && (
            <Button
              variant="contained"
              color="primary"
              onClick={() => navigate('/create')}
            >
              Create Token
            </Button>
          )}
        </Box>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Token</TableCell>
                <TableCell align="right">Price (WCTC)</TableCell>
                <TableCell align="right">Market Cap (USD)</TableCell>
                <TableCell align="right">Bonding Progress</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : filteredTokens.length > 0 ? (
                filteredTokens.map((token) => (
                  <TableRow key={token.address}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ width: 32, height: 32 }}>
                          {token.symbol[0]}
                        </Avatar>
                        <Box>
                          <Typography variant="body1">{token.symbol}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {token.name}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      {token.price}
                    </TableCell>
                    <TableCell align="right">
                      {token.marketCap === "0.00" ? (
                        <Typography color="warning.main" variant="body2">
                          Zero Price Mode (Need 5 WCTC liquidity)
                        </Typography>
                      ) : (
                        `$${token.marketCap}`
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {token.bondingProgress}%
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => navigate(`/token/${token.address}`)}
                      >
                        Trade
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body1" color="text.secondary">
                      No tokens found
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Container>
  );
};

export default Home; 
