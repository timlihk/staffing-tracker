import React from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import apiClient from '../api/client';
import { resetPasswordSchema, type ResetPasswordFormData } from '../lib/validations';
import { toast } from '../lib/toast';

interface ResetState {
  username?: string;
  resetToken?: string;
}

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as ResetState | undefined) ?? {};
  const [searchParams] = useSearchParams();
  const token = state.resetToken || searchParams.get('token') || '';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    try {
      await apiClient.post('/auth/reset-password', {
        token,
        newPassword: data.newPassword,
      });
      toast.success('Password updated', 'You can now sign in with your new password.');
      reset();
      navigate('/login');
    } catch (error: unknown) {
      const description = isAxiosError<{ error?: string }>(error)
        ? error.response?.data?.error || 'Please try again or request a new reset link.'
        : 'Please try again or request a new reset link.';
      toast.error('Password reset failed', description);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography component="h1" variant="h5" align="center" fontWeight={700} gutterBottom>
            Set a New Password
          </Typography>
          <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
            {state.username ? `User: ${state.username}` : 'Enter your new password below.'}
          </Typography>

          {!token && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              Missing password reset token. Please use the link provided by your administrator.
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit(onSubmit)}>
            <TextField
              margin="normal"
              fullWidth
              label="New Password"
              type="password"
              autoComplete="new-password"
              {...register('newPassword')}
              error={!!errors.newPassword}
              helperText={errors.newPassword?.message}
              disabled={isSubmitting || !token}
            />
            <TextField
              margin="normal"
              fullWidth
              label="Confirm Password"
              type="password"
              autoComplete="new-password"
              {...register('confirmPassword')}
              error={!!errors.confirmPassword}
              helperText={errors.confirmPassword?.message}
              disabled={isSubmitting || !token}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3 }}
              disabled={isSubmitting || !token}
            >
              {isSubmitting ? <CircularProgress size={24} /> : 'Update Password'}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default ResetPassword;
