import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  MenuItem,
  InputAdornment,
  Alert,
  FormControl,
  InputLabel,
  Select,
  Chip,
  Box,
  IconButton,
  Typography,
  Divider,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import type { BillingProjectSummaryResponse } from '../../api/billing';

export interface BillingInfoEditDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: BillingInfoFormData) => Promise<void>;
  project: BillingProjectSummaryResponse['project'];
  loading?: boolean;
}

export interface BillingInfoFormData {
  project_name?: string;
  client_name?: string;
  bc_attorney_staff_ids?: number[];
  agreed_fee_usd?: number | null;
  agreed_fee_cny?: number | null;
  billing_usd?: number | null;
  billing_cny?: number | null;
  collection_usd?: number | null;
  collection_cny?: number | null;
  ubt_usd?: number | null;
  ubt_cny?: number | null;
  billing_credit_usd?: number | null;
  billing_credit_cny?: number | null;
  bonus_usd?: number | null;
}

interface StaffMember {
  id: number;
  name: string;
  position: string;
}

export function BillingInfoEditDialog({
  open,
  onClose,
  onSave,
  project,
  loading = false,
}: BillingInfoEditDialogProps) {
  // Fetch staff list for B&C attorney dropdown
  const { data: staffList = [] } = useQuery<StaffMember[]>({
    queryKey: ['staff-list'],
    queryFn: async () => {
      const response = await api.get('/staff');
      return response.data;
    },
    enabled: open,
  });

  // Fetch current B&C attorneys for this project
  const { data: currentBcAttorneys = [] } = useQuery<Array<{ staff_id: number; staff: { id: number; name: string; position: string } }>>({
    queryKey: ['billing-project-bc-attorneys', String(project.project_id)],
    queryFn: async () => {
      const response = await api.get(`/billing/projects/${project.project_id}/bc-attorneys`);
      return response.data;
    },
    enabled: open,
  });

  const [formData, setFormData] = useState<BillingInfoFormData>({
    project_name: project.project_name ?? '',
    client_name: project.client_name ?? '',
    bc_attorney_staff_ids: [],
    agreed_fee_usd: project.agreed_fee_usd ?? null,
    agreed_fee_cny: project.agreed_fee_cny ?? null,
    billing_usd: project.billing_usd ?? null,
    billing_cny: project.billing_cny ?? null,
    collection_usd: project.collection_usd ?? null,
    collection_cny: project.collection_cny ?? null,
    ubt_usd: project.ubt_usd ?? null,
    ubt_cny: project.ubt_cny ?? null,
    billing_credit_usd: project.billing_credit_usd ?? null,
    billing_credit_cny: project.billing_credit_cny ?? null,
    bonus_usd: project.bonus_usd ?? null,
  });

  const [newAttorneyId, setNewAttorneyId] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset form when project changes or dialog opens
  useEffect(() => {
    if (open) {
      const bcAttorneyIds = currentBcAttorneys.map(bca => bca.staff_id);
      setFormData({
        project_name: project.project_name ?? '',
        client_name: project.client_name ?? '',
        bc_attorney_staff_ids: bcAttorneyIds,
        agreed_fee_usd: project.agreed_fee_usd ?? null,
        agreed_fee_cny: project.agreed_fee_cny ?? null,
        billing_usd: project.billing_usd ?? null,
        billing_cny: project.billing_cny ?? null,
        collection_usd: project.collection_usd ?? null,
        collection_cny: project.collection_cny ?? null,
        ubt_usd: project.ubt_usd ?? null,
        ubt_cny: project.ubt_cny ?? null,
        billing_credit_usd: project.billing_credit_usd ?? null,
        billing_credit_cny: project.billing_credit_cny ?? null,
        bonus_usd: project.bonus_usd ?? null,
      });
      setNewAttorneyId('');
      setError(null);
    }
  }, [open, project, currentBcAttorneys]);

  const handleChange = (field: keyof BillingInfoFormData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;

    // Handle text fields
    if (field === 'project_name' || field === 'client_name') {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    } else {
      // Handle number fields
      setFormData((prev) => ({
        ...prev,
        [field]: value === '' ? null : parseFloat(value),
      }));
    }
  };

  const handleAddAttorney = () => {
    if (newAttorneyId && !formData.bc_attorney_staff_ids?.includes(newAttorneyId as number)) {
      setFormData((prev) => ({
        ...prev,
        bc_attorney_staff_ids: [...(prev.bc_attorney_staff_ids || []), newAttorneyId as number],
      }));
      setNewAttorneyId('');
    }
  };

  const handleRemoveAttorney = (staffId: number) => {
    setFormData((prev) => ({
      ...prev,
      bc_attorney_staff_ids: (prev.bc_attorney_staff_ids || []).filter(id => id !== staffId),
    }));
  };

  const getStaffName = (staffId: number) => {
    const staff = staffList.find(s => s.id === staffId);
    return staff ? `${staff.name} (${staff.position})` : 'Unknown';
  };

  const handleSubmit = async () => {
    try {
      setError(null);
      setSubmitting(true);
      await onSave(formData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update billing information');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="md" fullWidth>
      <DialogTitle>Edit Billing Project</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Typography variant="h6">Project Information</Typography>

          <TextField
            label="Project Name"
            value={formData.project_name ?? ''}
            onChange={handleChange('project_name')}
            fullWidth
            required
          />

          <TextField
            label="Client Name"
            value={formData.client_name ?? ''}
            onChange={handleChange('client_name')}
            fullWidth
          />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              B&C Attorneys
            </Typography>

            {/* List of current B&C attorneys */}
            <Stack spacing={1} sx={{ mb: 2 }}>
              {formData.bc_attorney_staff_ids && formData.bc_attorney_staff_ids.length > 0 ? (
                formData.bc_attorney_staff_ids.map((staffId) => (
                  <Box
                    key={staffId}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1,
                      bgcolor: 'action.hover',
                      borderRadius: 1,
                    }}
                  >
                    <Typography variant="body2">{getStaffName(staffId)}</Typography>
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveAttorney(staffId)}
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No B&C attorneys assigned
                </Typography>
              )}
            </Stack>

            {/* Add new attorney */}
            <Stack direction="row" spacing={1}>
              <FormControl fullWidth size="small">
                <InputLabel>Add B&C Attorney</InputLabel>
                <Select
                  value={newAttorneyId}
                  onChange={(e) => setNewAttorneyId(e.target.value as number)}
                  label="Add B&C Attorney"
                >
                  <MenuItem value="">
                    <em>Select attorney...</em>
                  </MenuItem>
                  {staffList
                    .filter(staff => !formData.bc_attorney_staff_ids?.includes(staff.id))
                    .map((staff) => (
                      <MenuItem key={staff.id} value={staff.id}>
                        {staff.name} ({staff.position})
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                onClick={handleAddAttorney}
                disabled={!newAttorneyId}
                startIcon={<AddIcon />}
              >
                Add
              </Button>
            </Stack>
          </Box>

          <Divider />
          <Typography variant="h6">Financial Information</Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Agreed Fee (USD)"
              type="number"
              value={formData.agreed_fee_usd ?? ''}
              onChange={handleChange('agreed_fee_usd')}
              fullWidth
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
              inputProps={{ step: '0.01', min: '0' }}
            />
            <TextField
              label="Agreed Fee (CNY)"
              type="number"
              value={formData.agreed_fee_cny ?? ''}
              onChange={handleChange('agreed_fee_cny')}
              fullWidth
              InputProps={{
                startAdornment: <InputAdornment position="start">¥</InputAdornment>,
              }}
              inputProps={{ step: '0.01', min: '0' }}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Billing To Date (USD)"
              type="number"
              value={formData.billing_usd ?? ''}
              onChange={handleChange('billing_usd')}
              fullWidth
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
              inputProps={{ step: '0.01', min: '0' }}
            />
            <TextField
              label="Billing To Date (CNY)"
              type="number"
              value={formData.billing_cny ?? ''}
              onChange={handleChange('billing_cny')}
              fullWidth
              InputProps={{
                startAdornment: <InputAdornment position="start">¥</InputAdornment>,
              }}
              inputProps={{ step: '0.01', min: '0' }}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Collected (USD)"
              type="number"
              value={formData.collection_usd ?? ''}
              onChange={handleChange('collection_usd')}
              fullWidth
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
              inputProps={{ step: '0.01', min: '0' }}
            />
            <TextField
              label="Collected (CNY)"
              type="number"
              value={formData.collection_cny ?? ''}
              onChange={handleChange('collection_cny')}
              fullWidth
              InputProps={{
                startAdornment: <InputAdornment position="start">¥</InputAdornment>,
              }}
              inputProps={{ step: '0.01', min: '0' }}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="UBT (USD)"
              type="number"
              value={formData.ubt_usd ?? ''}
              onChange={handleChange('ubt_usd')}
              fullWidth
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
              inputProps={{ step: '0.01', min: '0' }}
            />
            <TextField
              label="UBT (CNY)"
              type="number"
              value={formData.ubt_cny ?? ''}
              onChange={handleChange('ubt_cny')}
              fullWidth
              InputProps={{
                startAdornment: <InputAdornment position="start">¥</InputAdornment>,
              }}
              inputProps={{ step: '0.01', min: '0' }}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Billing Credits (USD)"
              type="number"
              value={formData.billing_credit_usd ?? ''}
              onChange={handleChange('billing_credit_usd')}
              fullWidth
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
              inputProps={{ step: '0.01', min: '0' }}
            />
            <TextField
              label="Billing Credits (CNY)"
              type="number"
              value={formData.billing_credit_cny ?? ''}
              onChange={handleChange('billing_credit_cny')}
              fullWidth
              InputProps={{
                startAdornment: <InputAdornment position="start">¥</InputAdornment>,
              }}
              inputProps={{ step: '0.01', min: '0' }}
            />
          </Stack>

          <TextField
            label="Bonus (USD)"
            type="number"
            value={formData.bonus_usd ?? ''}
            onChange={handleChange('bonus_usd')}
            fullWidth
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
            }}
            inputProps={{ step: '0.01', min: '0' }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={submitting || loading}>
          {submitting ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
