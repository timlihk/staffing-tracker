import React, { useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Typography,
  Tabs,
  Tab,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Add, Refresh, Edit, Delete } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import { Page, PageHeader } from '../components/ui';
import { CreateOrEditUserDialog, EmailSettingsPanel, BillingSettingsPanel } from '../components/admin';
import { useUsers, useCreateUser, useUpdateUser, useResetUserPassword, useDeleteUser } from '../hooks/useUsers';
import { useStaff } from '../hooks/useStaff';
import { useAuth } from '../hooks/useAuth';
import { useEmailSettings, useUpdateEmailSettings } from '../hooks/useEmailSettings';
import { useBillingSettings, useUpdateBillingSettings } from '../hooks/useBilling';
import type { ManagedUser, Staff } from '../types';
import { toast } from '../lib/toast';
import { DateHelpers } from '../lib/date';



const extractUserError = (error: unknown, fallback: string): string => {
  if (isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? fallback;
  }
  return fallback;
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
  const { data: users = [], isLoading, refetch: refetchUsers } = useUsers();
  const { data: staff = [], isLoading: staffLoading } = useStaff();
  const { data: emailSettings, isLoading: emailSettingsLoading } = useEmailSettings();
  const { data: billingSettings, isLoading: billingSettingsLoading } = useBillingSettings();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const resetUserPassword = useResetUserPassword();
  const deleteUser = useDeleteUser();
  const updateEmailSettings = useUpdateEmailSettings();
  const updateBillingSettings = useUpdateBillingSettings();

  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [passwordDialog, setPasswordDialog] = useState<PasswordDialogState | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [gridKey, setGridKey] = useState(0);

  // Force DataGrid to remount on window resize to recalculate column widths
  React.useEffect(() => {
    const handleResize = () => {
      setGridKey(prev => prev + 1);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-refresh user list every 5 minutes to update online status
  // Only runs when this component is mounted (page is being viewed)
  React.useEffect(() => {
    const interval = setInterval(() => {
      refetchUsers();
    }, 5 * 60 * 1000); // 5 minutes in milliseconds

    // Cleanup: stop auto-refresh when component unmounts (user navigates away)
    return () => {
      clearInterval(interval);
    };
  }, [refetchUsers]);

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

  // Fetch all activity logs (includes create, delete, update, assign for all entity types)
  const { data: allActivityData, isLoading: allActivityLoading } = useQuery({
    queryKey: ['activity-log', 'all'],
    queryFn: async () => {
      const response = await apiClient.get('/dashboard/activity-log', {
        params: { limit: 100 },
      });
      return response.data;
    },
    staleTime: 30000, // 30 seconds
  });

  const staffOptions = useMemo(() => staff.map((member: Staff) => ({ label: member.name, value: member.id })), [staff]);

  // Helper function to check if user is online (active within last 5 minutes)
  const isUserOnline = (lastActivity: string | null) => {
    if (!lastActivity) return false;
    return new Date(lastActivity) > DateHelpers.fiveMinutesAgo();
  };

  const columns: GridColDef<ManagedUser>[] = [
    {
      field: 'username',
      headerName: 'Username',
      flex: 1,
      headerAlign: 'left',
      align: 'left',
      renderCell: ({ row }) => {
        const online = isUserOnline(row.lastActivity);

        if (row.staff?.id) {
          return (
            <Stack direction="row" spacing={1} alignItems="center">
              {online && (
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'success.main',
                    animation: 'pulse 2s infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.5 },
                    },
                  }}
                />
              )}
              <Typography
                component="a"
                variant="body2"
                href={`/staff/${row.staff?.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  if (row.staff?.id) navigate(`/staff/${row.staff.id}`, { state: { from: '/admin' } });
                }}
                sx={{
                  color: 'primary.main',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  textTransform: 'none',
                  '&:hover': {
                    textDecoration: 'underline',
                  },
                }}
              >
                {row.username}
              </Typography>
            </Stack>
          );
        }
        return (
          <Stack direction="row" spacing={1} alignItems="center">
            {online && (
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: 'success.main',
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.5 },
                  },
                }}
              />
            )}
            <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'none' }}>
              {row.username}
            </Typography>
          </Stack>
        );
      },
    },
    {
      field: 'email',
      headerName: 'Email',
      flex: 1.2,
      headerAlign: 'left',
      align: 'left',
      renderCell: ({ value }) => value,
    },
    {
      field: 'role',
      headerName: 'Role',
      flex: 0.6,
      headerAlign: 'center',
      align: 'center',
      renderCell: ({ value }) => <Chip size="small" label={value} color={value === 'admin' ? 'error' : value === 'editor' ? 'warning' : 'default'} />,
    },
    {
      field: 'recentActionCount',
      headerName: 'Actions (7d)',
      flex: 0.6,
      headerAlign: 'center',
      align: 'center',
      renderCell: ({ value }) => (
        <Typography variant="body2" fontWeight={600} color={value > 0 ? 'success.main' : 'text.secondary'}>
          {value}
        </Typography>
      ),
    },
    {
      field: 'lastLogin',
      headerName: 'Last Login',
      flex: 1,
      headerAlign: 'left',
      align: 'left',
      valueGetter: (_value, row) => row.lastLogin,
      renderCell: ({ value }) => <Typography variant="body2">{DateHelpers.formatDateTime(value)}</Typography>,
    },
    {
      field: 'staff',
      headerName: 'Staff Link',
      flex: 1,
      headerAlign: 'left',
      align: 'left',
      valueGetter: (_value, row) => row.staff?.name ?? '—',
    },
    {
      field: 'actions',
      headerName: 'Actions',
      flex: 0.8,
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
              } catch (error: unknown) {
                toast.error('Reset failed', extractUserError(error, 'Unable to reset password.'));
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
                } catch (error: unknown) {
                  toast.error('Delete failed', extractUserError(error, 'Unable to delete user.'));
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

  const onlineUsers = useMemo(() => users.filter(user => isUserOnline(user.lastActivity)), [users]);
  const isAdmin = user?.role === 'admin';
  const userCountLabel = `${users.length} user${users.length === 1 ? '' : 's'}`;
  const onlineCountLabel = `${onlineUsers.length} online`;

  const activityLogs: ActivityLog[] = activityData?.data || [];
  const allActivityLogs: ActivityLog[] = allActivityData?.data || [];

  const activityColumns: GridColDef<ActivityLog>[] = [
    {
      field: 'createdAt',
      headerName: 'Date & Time',
      flex: 0.8,
      headerAlign: 'left',
      align: 'left',
      valueFormatter: (value) => DateHelpers.formatDateTime(value),
    },
    {
      field: 'actionType',
      headerName: 'Action',
      flex: 0.5,
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
      flex: 0.7,
      headerAlign: 'left',
      align: 'left',
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 1.5,
      headerAlign: 'left',
      align: 'left',
    },
  ];

  const allActivityColumns: GridColDef<ActivityLog>[] = [
    {
      field: 'createdAt',
      headerName: 'Date & Time',
      flex: 0.8,
      headerAlign: 'left',
      align: 'left',
      valueFormatter: (value) => DateHelpers.formatDateTime(value),
    },
    {
      field: 'actionType',
      headerName: 'Action',
      flex: 0.5,
      headerAlign: 'center',
      align: 'center',
      renderCell: ({ value }) => {
        const color = value === 'create' ? 'success' : value === 'delete' ? 'error' : value === 'assign' ? 'info' : 'primary';
        return <Chip size="small" label={value} color={color} />;
      },
    },
    {
      field: 'entityType',
      headerName: 'Type',
      flex: 0.5,
      headerAlign: 'center',
      align: 'center',
      renderCell: ({ value }) => {
        const color = value === 'staff' ? 'success' : value === 'project' ? 'warning' : 'default';
        return <Chip size="small" label={value} color={color} variant="outlined" />;
      },
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 1.5,
      headerAlign: 'left',
      align: 'left',
    },
    {
      field: 'username',
      headerName: 'Performed By',
      flex: 0.7,
      headerAlign: 'left',
      align: 'left',
    },
  ];

  if (!isAdmin) {
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

  return (
    <Page>
      <PageHeader
        title="Admin Panel"
        actions={
          <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
            New User
          </Button>
        }
      />

      <Paper sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Users" />
          <Tab label="User Change Log" />
          <Tab label="Activity Log" />
          <Tab label="Email Settings" />
          <Tab label="Billing Settings" />
        </Tabs>
      </Paper>

      {activeTab === 0 && (
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {userCountLabel}
            </Typography>
            <Typography variant="body2" color="text.secondary">•</Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: 'success.main',
                }}
              />
              <Typography variant="body2" color="success.main" fontWeight={600}>
                {onlineCountLabel}
              </Typography>
            </Stack>
          </Stack>
          {isLoading ? (
            <Box display="flex" justifyContent="center" py={6}>
              <CircularProgress />
            </Box>
          ) : (
            <DataGrid
              key={`users-grid-${gridKey}`}
              rows={users}
              columns={columns}
              autoHeight
              disableRowSelectionOnClick
              disableColumnResize
              disableColumnMenu
              getRowId={(row) => row.id}
              initialState={{
                pagination: { paginationModel: { pageSize: 25 } },
                columns: {
                  columnVisibilityModel: {},
                }
              }}
              pageSizeOptions={[25, 50, 100]}
              sx={{
                '& .MuiDataGrid-cell': {
                  display: 'flex',
                  alignItems: 'center',
                  textTransform: 'none !important',
                },
                '& .MuiDataGrid-columnHeader': {
                  minWidth: '0 !important',
                },
                '& .MuiDataGrid-cell, & .MuiDataGrid-columnHeader': {
                  maxWidth: 'none !important',
                },
                '& .MuiDataGrid-cell *': {
                  textTransform: 'none !important',
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
              key={`activity-grid-${gridKey}`}
              rows={activityLogs}
              columns={activityColumns}
              autoHeight
              disableRowSelectionOnClick
              disableColumnResize
              disableColumnMenu
              getRowId={(row) => row.id}
              initialState={{
                pagination: { paginationModel: { pageSize: 25 } },
                columns: {
                  columnVisibilityModel: {},
                }
              }}
              pageSizeOptions={[25, 50, 100]}
              sx={{
                '& .MuiDataGrid-cell': {
                  display: 'flex',
                  alignItems: 'center',
                  textTransform: 'none !important',
                },
                '& .MuiDataGrid-columnHeader': {
                  minWidth: '0 !important',
                },
                '& .MuiDataGrid-cell, & .MuiDataGrid-columnHeader': {
                  maxWidth: 'none !important',
                },
                '& .MuiDataGrid-cell *': {
                  textTransform: 'none !important',
                },
              }}
            />
          )}
        </Paper>
      )}

      {activeTab === 2 && (
        <Paper sx={{ p: 2 }}>
          {allActivityLoading ? (
            <Box display="flex" justifyContent="center" py={6}>
              <CircularProgress />
            </Box>
          ) : (
            <DataGrid
              key={`all-activity-grid-${gridKey}`}
              rows={allActivityLogs}
              columns={allActivityColumns}
              autoHeight
              disableRowSelectionOnClick
              disableColumnResize
              disableColumnMenu
              getRowId={(row) => row.id}
              initialState={{
                pagination: { paginationModel: { pageSize: 25 } },
                columns: {
                  columnVisibilityModel: {},
                }
              }}
              pageSizeOptions={[25, 50, 100]}
              sx={{
                '& .MuiDataGrid-cell': {
                  display: 'flex',
                  alignItems: 'center',
                  textTransform: 'none !important',
                },
                '& .MuiDataGrid-columnHeader': {
                  minWidth: '0 !important',
                },
                '& .MuiDataGrid-cell, & .MuiDataGrid-columnHeader': {
                  maxWidth: 'none !important',
                },
                '& .MuiDataGrid-cell *': {
                  textTransform: 'none !important',
                },
              }}
            />
          )}
        </Paper>
      )}

      {activeTab === 3 && (
        <Paper sx={{ p: 3 }}>
          <EmailSettingsPanel
            emailSettings={emailSettings}
            loading={emailSettingsLoading}
            onUpdate={updateEmailSettings.mutateAsync}
            extractError={extractUserError}
          />
        </Paper>
      )}

      {activeTab === 4 && (
        <Paper sx={{ p: 3 }}>
          <BillingSettingsPanel
            billingSettings={billingSettings}
            loading={billingSettingsLoading}
            onUpdate={updateBillingSettings.mutateAsync}
            extractError={extractUserError}
          />
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
          } catch (error: unknown) {
            toast.error('Create user failed', extractUserError(error, 'Please try again.'));
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
            } catch (error: unknown) {
              toast.error('Update failed', extractUserError(error, 'Please try again.'));
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

// CreateOrEditUserDialog has been extracted to components/admin/CreateOrEditUserDialog.tsx
// EmailSettingsPanel has been extracted to components/admin/EmailSettingsPanel.tsx
// BillingSettingsPanel has been extracted to components/admin/BillingSettingsPanel.tsx

export default UserManagement;
