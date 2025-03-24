import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Button,
  Link,
  Chip,
} from '@mui/material';
import useWallet from '../hooks/useWallet';
import { shortenAddress } from '../utils/format';

const Navbar = () => {
  const { address, isConnected, connectWallet, disconnectWallet } = useWallet();

  return (
    <AppBar position="static" sx={{ bgcolor: 'background.paper' }}>
      <Toolbar>
        <Typography
          variant="h6"
          component={RouterLink}
          to="/"
          sx={{
            flexGrow: 1,
            textDecoration: 'none',
            color: 'text.primary',
            fontWeight: 'bold',
          }}
        >
          LiquidLauncher
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Link
            component={RouterLink}
            to="/"
            sx={{ textDecoration: 'none', color: 'text.primary' }}
          >
            <Button color="inherit">Home</Button>
          </Link>
          <Link
            component={RouterLink}
            to="/create"
            sx={{ textDecoration: 'none', color: 'text.primary' }}
          >
            <Button color="inherit">Create Token</Button>
          </Link>

          {isConnected ? (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Chip
                label={shortenAddress(address || '')}
                color="primary"
                variant="outlined"
                onClick={disconnectWallet}
              />
            </Box>
          ) : (
            <Button
              variant="contained"
              color="primary"
              onClick={connectWallet}
            >
              Connect Wallet
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar; 