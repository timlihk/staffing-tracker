import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  TextField,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createUserSchema, type CreateUserFormData } from '../../lib/validations';

const Roles: Array<{ label: string; value: 'admin' | 'finance' | 'editor' | 'viewer' }> = [
  { label: 'Admin', value: 'admin' },
  { label: 'Finance', value: 'finance' },
  { label: 'Editor', value: 'editor' },
  { label: 'Viewer', value: 'viewer' },
];

export interface CreateOrEditUserDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CreateUserFormData) => Promise<void>;
  staff: Array<{ label: string; value: number }>;
  loadingStaff: boolean;
  initialValues?: Partial<CreateUserFormData>;
  disableUsernameEmail?: boolean;
}

/**
 * Dialog for creating or editing user accounts
 */
export function CreateOrEditUserDialog({
  open,
  onClose,
  onSubmit,
  staff,
  loadingStaff,
  initialValues,
  disableUsernameEmail,
}: CreateOrEditUserDialogProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: initialValues?.username || '',
      email: initialValues?.email || '',
      role: initialValues?.role || 'viewer',
      staffId: initialValues?.staffId ?? null,
    },
  });

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      reset();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>{disableUsernameEmail ? 'Edit User' : 'Create User'}</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Box
          component="form"
          id="user-form"
          onSubmit={handleSubmit(async (values) => {
            await onSubmit(values);
            reset();
          })}
        >
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Username"
                fullWidth
                {...register('username')}
                error={!!errors.username}
                helperText={errors.username?.message}
                disabled={disableUsernameEmail || isSubmitting}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Email"
                fullWidth
                {...register('email')}
                error={!!errors.email}
                helperText={errors.email?.message}
                disabled={disableUsernameEmail || isSubmitting}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <TextField
                    select
                    label="Role"
                    fullWidth
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={!!errors.role}
                    helperText={errors.role?.message}
                    disabled={isSubmitting}
                  >
                    {Roles.map((role) => (
                      <MenuItem key={role.value} value={role.value}>
                        {role.label}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Controller
                name="staffId"
                control={control}
                render={({ field }) => (
                  <TextField
                    select
                    label="Linked Staff"
                    fullWidth
                    value={field.value ?? ''}
                    onChange={(event) => {
                      const nextValue = event.target.value === '' ? null : Number(event.target.value);
                      field.onChange(nextValue);
                    }}
                    onBlur={field.onBlur}
                    disabled={loadingStaff || isSubmitting}
                    SelectProps={{
                      displayEmpty: true,
                      renderValue: (selected) => {
                        if (!selected) return 'None';
                        const option = staff.find((opt) => opt.value === selected);
                        return option ? option.label : 'Unknown';
                      },
                    }}
                    helperText="Optional: associate this user with a staff member"
                  >
                    <MenuItem value="">None</MenuItem>
                    {staff.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" form="user-form" variant="contained" disabled={isSubmitting}>
          {isSubmitting ? <CircularProgress size={22} /> : disableUsernameEmail ? 'Save Changes' : 'Create User'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
