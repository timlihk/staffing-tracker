import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  Tabs,
  Tab,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Add, Refresh, Edit, Delete } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import { Page, PageHeader } from '../components/ui';
import { useUsers, useCreateUser, useUpdateUser, useResetUserPassword, useDeleteUser } from '../hooks/useUsers';
import { useStaff } from '../hooks/useStaff';
import { useAuth } from '../context/AuthContext';
import type { ManagedUser, Staff } from '../types';
import { createUserSchema, type CreateUserFormData } from '../lib/validations';
import { toast } from '../lib/toast';

const Roles: Array<{ label: string; value: 'admin' | 'editor' | 'viewer' }> = [
  { label: 'Admin', value: 'admin' },
  { label: 'Editor', value: 'editor' },
  { label: 'Viewer', value: 'viewer' },
];

const formatDateTime = (value: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleString();
};

interface PasswordDialogState {
  username: string;
  tempPassword: string;
}

interface ActivityLog {
  id: number;
  actionType: string;
  entityType: string;
  entityId: number | null;
  description: string;
  username: string;
  createdAt: string;
}

const UserManagement: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: users = [], isLoading } = useUsers();
  const { data: staff = [], isLoading: staffLoading } = useStaff();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const resetUserPassword = useResetUserPassword();
  const deleteUser = useDeleteUser();

  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [passwordDialog, setPasswordDialog] = useState<PasswordDialogState | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  // Fetch user-related activity logs
  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['activity-log', 'user'],
    queryFn: async () => {
      const response = await apiClient.get('/dashboard/activity-log', {
        params: { entityType: 'user', limit: 100 },
      });
      return response.data;
    },
    staleTime: 30000, // 30 seconds
  });

  // Admin-only access control
  if (user?.role !== 'admin') {
    return (
      <Page>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" color="error" gutterBottom>
            Access Denied
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Only administrators can access user management.
          </Typography>
          <Button variant="contained" onClick={() => navigate('/dashboard')}>
            Return to Dashboard
          </Button>
        </Paper>
      </Page>
    );
  }

  const staffOptions = useMemo(() => staff.map((member: Staff) => ({ label: member.name, value: member.id })), [staff]);

  const columns: GridColDef<ManagedUser>[] = [
    {
      field: 'username',
      headerName: 'Username',
      flex: 1,
      minWidth: 140,
      headerAlign: 'left',
      align: 'left',
    },
    {
      field: 'email',
      headerName: 'Email',
      flex: 1.2,
      minWidth: 200,
      headerAlign: 'left',
      align: 'left',
    },
    {
      field: 'role',
      headerName: 'Role',
      width: 130,
      headerAlign: 'center',
      align: 'center',
      renderCell: ({ value }) => <Chip size="small" label={value} color={value === 'admin' ? 'error' : value === 'editor' ? 'warning' : 'default'} />,
    },
    {
      field: 'mustResetPassword',
      headerName: 'Reset Required',
      width: 150,
      headerAlign: 'center',
      align: 'center',
      renderCell: ({ value }) =>
        value ? <Chip label="Pending" color="warning" size="small" /> : <Chip label="No" size="small" />,
    },
    {
      field: 'lastLogin',
      headerName: 'Last Login',
      width: 200,
      headerAlign: 'left',
      align: 'left',
      valueGetter: (_value, row) => row.lastLogin,
      renderCell: ({ value }) => <Typography variant="body2">{formatDateTime(value)}</Typography>,
    },
    {
      field: 'staff',
      headerName: 'Staff Link',
      width: 200,
      headerAlign: 'left',
      align: 'left',
      valueGetter: (_value, row) => row.staff?.name ?? '—',
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 200,
      headerAlign: 'center',
      align: 'center',
      sortable: false,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={1}>
          <IconButton size="small" onClick={() => setEditingUser(row)} title="Edit user">
            <Edit fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={async () => {
              try {
                const result = await resetUserPassword.mutateAsync(row.id);
                setPasswordDialog({ username: row.username, tempPassword: result.tempPassword });
                toast.success('Password reset', 'Provide the new password to the user.');
              } catch (error: any) {
                toast.error('Reset failed', error.response?.data?.error || 'Unable to reset password.');
              }
            }}
            title="Reset password"
          >
            <Refresh fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={async () => {
              if (window.confirm(`Are you sure you want to delete user "${row.username}"? This action cannot be undone.`)) {
                try {
                  await deleteUser.mutateAsync(row.id);
                  toast.success('User deleted', `User "${row.username}" has been successfully deleted.`);
                } catch (error: any) {
                  toast.error('Delete failed', error.response?.data?.error || 'Unable to delete user.');
                }
              }
            }}
            title="Delete user"
          >
            <Delete fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ];

  const userCountLabel = `${users.length} user${users.length === 1 ? '' : 's'}`;

  const activityLogs: ActivityLog[] = activityData?.data || [];

  const activityColumns: GridColDef<ActivityLog>[] = [
    {
      field: 'createdAt',
      headerName: 'Date & Time',
      width: 180,
      headerAlign: 'left',
      align: 'left',
      valueFormatter: (value) => new Date(value).toLocaleString(),
    },
    {
      field: 'actionType',
      headerName: 'Action',
      width: 120,
      headerAlign: 'center',
      align: 'center',
      renderCell: ({ value }) => {
        const color = value === 'create' ? 'success' : value === 'delete' ? 'error' : 'primary';
        return <Chip size="small" label={value} color={color} />;
      },
    },
    {
      field: 'username',
      headerName: 'Performed By',
      width: 150,
      headerAlign: 'left',
      align: 'left',
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 1,
      minWidth: 300,
      headerAlign: 'left',
      align: 'left',
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Admin Panel"
        subtitle={userCountLabel}
        actions={
          <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
            New User
          </Button>
        }
      />

      <Paper sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Users" />
          <Tab label="Change Log" />
        </Tabs>
      </Paper>

      {activeTab === 0 && (
        <Paper sx={{ p: 2 }}>
          {isLoading ? (
            <Box display="flex" justifyContent="center" py={6}>
              <CircularProgress />
            </Box>
          ) : (
            <DataGrid
              rows={users}
              columns={columns}
              autoHeight
              disableRowSelectionOnClick
              getRowId={(row) => row.id}
              initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
              pageSizeOptions={[25, 50, 100]}
              sx={{
                '& .MuiDataGrid-cell': {
                  display: 'flex',
                  alignItems: 'center',
                },
              }}
            />
          )}
        </Paper>
      )}

      {activeTab === 1 && (
        <Paper sx={{ p: 2 }}>
          {activityLoading ? (
            <Box display="flex" justifyContent="center" py={6}>
              <CircularProgress />
            </Box>
          ) : (
            <DataGrid
              rows={activityLogs}
              columns={activityColumns}
              autoHeight
              disableRowSelectionOnClick
              getRowId={(row) => row.id}
              initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
              pageSizeOptions={[25, 50, 100]}
              sx={{
                '& .MuiDataGrid-cell': {
                  display: 'flex',
                  alignItems: 'center',
                },
              }}
            />
          )}
        </Paper>
      )}

      <CreateOrEditUserDialog
        open={isCreateOpen}
        onClose={() => setCreateOpen(false)}
        staff={staffOptions}
        loadingStaff={staffLoading}
        onSubmit={async (values) => {
          try {
            const result = await createUser.mutateAsync(values);
            setPasswordDialog({ username: result.user.username, tempPassword: result.tempPassword });
            setCreateOpen(false);
            toast.success('User created', 'Share the temporary password securely.');
          } catch (error: any) {
            toast.error('Create user failed', error.response?.data?.error || 'Please try again.');
          }
        }}
      />

      {editingUser && (
        <CreateOrEditUserDialog
          key={editingUser.id}
          open={!!editingUser}
          onClose={() => setEditingUser(null)}
          staff={staffOptions}
          loadingStaff={staffLoading}
          initialValues={{
            username: editingUser.username,
            email: editingUser.email,
            role: editingUser.role as 'admin' | 'editor' | 'viewer',
            staffId: editingUser.staff?.id ?? null,
          }}
          disableUsernameEmail
          onSubmit={async (values) => {
            try {
              await updateUser.mutateAsync({ id: editingUser.id, data: { role: values.role, staffId: values.staffId ?? null } });
              toast.success('User updated', 'Changes saved successfully.');
              setEditingUser(null);
            } catch (error: any) {
              toast.error('Update failed', error.response?.data?.error || 'Please try again.');
            }
          }}
        />
      )}

      {passwordDialog && (
        <Dialog open onClose={() => setPasswordDialog(null)}>
          <DialogTitle>Temporary Password</DialogTitle>
          <DialogContent>
            <Typography variant="body1" sx={{ mb: 1 }}>
              Provide this password to <strong>{passwordDialog.username}</strong>. They will be asked to create a new one on login.
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {passwordDialog.tempPassword}
            </Paper>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPasswordDialog(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}
    </Page>
  );
};

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CreateUserFormData) => Promise<void>;
  staff: Array<{ label: string; value: number }>;
  loadingStaff: boolean;
  initialValues?: Partial<CreateUserFormData>;
  disableUsernameEmail?: boolean;
}

const CreateOrEditUserDialog: React.FC<CreateDialogProps> = ({
  open,
  onClose,
  onSubmit,
  staff,
  loadingStaff,
  initialValues,
  disableUsernameEmail,
}) => {
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
        <Box component="form" id="user-form" onSubmit={handleSubmit(async (values) => {
          await onSubmit(values);
          reset();
        })}>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Username"
                fullWidth
                {...register('username')}
                error={!!errors.username}
                helperText={errors.username?.message}
                disabled={disableUsernameEmail || isSubmitting}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Email"
                fullWidth
                {...register('email')}
                error={!!errors.email}
                helperText={errors.email?.message}
                disabled={disableUsernameEmail || isSubmitting}
              />
            </Grid>
            <Grid item xs={12} md={6}>
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
            <Grid item xs={12} md={6}>
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
};

export default UserManagement;
