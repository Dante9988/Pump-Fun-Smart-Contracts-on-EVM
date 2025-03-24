import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  CircularProgress,
  Avatar,
  Snackbar,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LaunchIcon from '@mui/icons-material/Launch';
import useContracts from '../hooks/useContracts';
import useWallet from '../hooks/useWallet';
import { uploadToIPFS } from '../utils/ipfs';

const Create = () => {
  const navigate = useNavigate();
  const { createToken } = useContracts();
  const { isConnected } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
  });

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG or JPG)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size should be less than 5MB');
      return;
    }

    try {
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setLogoPreview(previewUrl);
    } catch (err) {
      setError('Error processing image file');
    }
  };

  const handleCloseSnackbar = () => {
    setTxHash(null);
  };

  const handleViewTransaction = () => {
    window.open(`https://creditcoin-testnet.blockscout.com/tx/${txHash}`, '_blank');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { success, txHash: hash } = await createToken(
        formData.name,
        formData.symbol,
        new File([], "placeholder.png")
      );

      if (success && hash) {
        setTxHash(hash);
        navigate('/');
      } else {
        setError('Failed to create token');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (!isConnected) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>
            Please connect your wallet to create a token
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Snackbar
        open={!!txHash}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        message="Token created successfully!"
        action={
          <React.Fragment>
            <Button
              color="secondary"
              size="small"
              onClick={handleViewTransaction}
              startIcon={<LaunchIcon />}
            >
              View Transaction
            </Button>
            <IconButton
              size="small"
              color="inherit"
              onClick={handleCloseSnackbar}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </React.Fragment>
        }
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      />
      <Box sx={{ mt: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Create New Token
        </Typography>

        <Paper sx={{ p: 3, mt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Token Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                fullWidth
              />

              <TextField
                label="Token Symbol"
                name="symbol"
                value={formData.symbol}
                onChange={handleChange}
                required
                fullWidth
              />

              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <Avatar
                  src={logoPreview || undefined}
                  sx={{ width: 100, height: 100, mb: 1 }}
                />
                <Button
                  variant="outlined"
                  component="label"
                  fullWidth
                >
                  Upload Logo (PNG/JPG)
                  <input
                    type="file"
                    hidden
                    accept="image/png,image/jpeg"
                    onChange={handleLogoChange}
                  />
                </Button>
                <Typography variant="caption" color="text.secondary">
                  Max file size: 5MB
                </Typography>
              </Box>

              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                disabled={loading}
                fullWidth
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Create Token'
                )}
              </Button>
            </Box>
          </form>
        </Paper>
      </Box>
    </Container>
  );
};

export default Create; 