import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import useWallet from '../hooks/useWallet';
import { Button } from '@mui/material';
import { shortenAddress } from '../utils/format';

const WalletConnect: React.FC = () => {
  const { address, isConnected } = useSelector((state: RootState) => state.wallet);
  const { connectWallet, disconnectWallet, isConnecting, error } = useWallet();

  const handleClick = async () => {
    if (isConnected) {
      disconnectWallet();
    } else {
      await connectWallet();
    }
  };

  return (
    <Button
      variant="contained"
      color={isConnected ? "secondary" : "primary"}
      onClick={handleClick}
      disabled={isConnecting}
    >
      {isConnecting ? 'Connecting...' : isConnected ? `Disconnect ${shortenAddress(address!)}` : 'Connect Wallet'}
    </Button>
  );
};

export default WalletConnect; 
