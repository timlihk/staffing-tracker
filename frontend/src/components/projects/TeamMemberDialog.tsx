import { useEffect } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import type { ProjectAssignment, Staff } from '../../types';

export interface TeamMemberFormValues {
  staffId: number | '';
  jurisdiction: string;
  notes: string;
}

export interface TeamMemberDialogProps {
  open: boolean;
  onClose: () => void;
  initialData: ProjectAssignment | null;
  staffOptions: Array<{ id: number; name: string; role: string; department?: string | null }>;
  staffList: Staff[];
  staffLoading: boolean;
  onSave: (values: TeamMemberFormValues) => Promise<void>;
  isSaving: boolean;
}

/**
 * Dialog for adding or editing team member assignments to a project
 */
export function TeamMemberDialog({
  open,
  onClose,
  initialData,
  staffOptions,
  staffList,
  staffLoading,
  onSave,
  isSaving,
}: TeamMemberDialogProps) {
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<TeamMemberFormValues>({
    defaultValues: {
      staffId: '',
      jurisdiction: '',
      notes: '',
    },
  });

  const selectedStaffId = watch('staffId');
  const selectedStaff = staffList.find((s) => s.id === Number(selectedStaffId));

  useEffect(() => {
    if (initialData) {
      reset({
        staffId: initialData.staffId,
        jurisdiction: initialData.jurisdiction || '',
        notes: initialData.notes || '',
      });
    } else {
      reset({
        staffId: '',
        jurisdiction: '',
        notes: '',
      });
    }
  }, [initialData, reset, open]);

  useEffect(() => {
    if (selectedStaff && !initialData) {
      reset((prev) => ({
        ...prev,
        jurisdiction: selectedStaff.department || '',
      }));
    }
  }, [selectedStaff, initialData, reset]);

  const submit = handleSubmit(async (values) => {
    await onSave(values);
  });

  const disableSave = isSaving || staffLoading;

  return (
    <Dialog open={open} onClose={disableSave ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{initialData ? 'Edit Team Member' : 'Add Team Member'}</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={2} mt={1}>
          <Controller
            name="staffId"
            control={control}
            rules={{ required: 'Staff member is required' }}
            render={({ field }) => (
              <TextField
                {...field}
                select
                fullWidth
                label="Staff"
                error={!!errors.staffId}
                helperText={errors.staffId?.message}
                disabled={!!initialData || staffLoading}
              >
                <MenuItem value="">{staffLoading ? 'Loading…' : 'Select staff'}</MenuItem>
                {staffOptions.map((option) => (
                  <MenuItem key={option.id} value={option.id}>
                    {option.name} {option.role ? `• ${option.role}` : ''}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />

          {selectedStaff && !initialData && (
            <Box
              sx={{
                p: 2,
                bgcolor: 'primary.50',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'primary.200',
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Position: {selectedStaff.position}
              </Typography>
            </Box>
          )}

          <Controller
            name="jurisdiction"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="Jurisdiction"
                placeholder="Auto-filled from staff department"
                helperText="Auto-populated from staff department, you can override if needed"
                error={!!errors.jurisdiction}
              />
            )}
          />

          <Controller
            name="notes"
            control={control}
            render={({ field }) => <TextField {...field} fullWidth multiline minRows={3} label="Notes" />}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={disableSave}>
          Cancel
        </Button>
        <Button
          onClick={submit}
          variant="contained"
          disabled={disableSave}
          startIcon={isSaving ? <CircularProgress size={20} /> : undefined}
        >
          {initialData ? 'Save changes' : 'Add member'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
