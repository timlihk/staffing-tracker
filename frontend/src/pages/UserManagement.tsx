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
  Switch,
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
import { useEmailSettings, useUpdateEmailSettings } from '../hooks/useEmailSettings';
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
  const { data: users = [], isLoading, refetch: refetchUsers } = useUsers();
  const { data: staff = [], isLoading: staffLoading } = useStaff();
  const { data: emailSettings, isLoading: emailSettingsLoading } = useEmailSettings();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const resetUserPassword = useResetUserPassword();
  const deleteUser = useDeleteUser();
  const updateEmailSettings = useUpdateEmailSettings();

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
      console.log('[UserManagement] Auto-refreshing user data for online status...');
      refetchUsers();
    }, 5 * 60 * 1000); // 5 minutes in milliseconds

    // Cleanup: stop auto-refresh when component unmounts (user navigates away)
    return () => {
      console.log('[UserManagement] Stopping auto-refresh (page closed/navigated away)');
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

  // Helper function to check if user is online (logged in within last 5 minutes)
  const isUserOnline = (lastLogin: string | null) => {
    if (!lastLogin) return false;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return new Date(lastLogin) > fiveMinutesAgo;
  };

  const columns: GridColDef<ManagedUser>[] = [
    {
      field: 'username',
      headerName: 'Username',
      flex: 1,
      headerAlign: 'left',
      align: 'left',
      renderCell: ({ row }) => {
        const online = isUserOnline(row.lastLogin);

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
                href={`/staff/${row.staff.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/staff/${row.staff.id}`, { state: { from: '/admin' } });
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
      field: 'online',
      headerName: 'Status',
      flex: 0.5,
      headerAlign: 'center',
      align: 'center',
      valueGetter: (_value, row) => isUserOnline(row.lastLogin),
      renderCell: ({ row }) => {
        const online = isUserOnline(row.lastLogin);
        return online ? (
          <Chip size="small" label="Online" color="success" />
        ) : (
          <Chip size="small" label="Offline" variant="outlined" />
        );
      },
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
      field: 'mustResetPassword',
      headerName: 'Reset Required',
      flex: 0.7,
      headerAlign: 'center',
      align: 'center',
      renderCell: ({ value }) =>
        value ? <Chip label="Pending" color="warning" size="small" /> : <Chip label="No" size="small" />,
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
      renderCell: ({ value }) => <Typography variant="body2">{formatDateTime(value)}</Typography>,
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

  const onlineUsers = useMemo(() => users.filter(user => isUserOnline(user.lastLogin)), [users]);
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
      valueFormatter: (value) => new Date(value).toLocaleString(),
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
      valueFormatter: (value) => new Date(value).toLocaleString(),
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
          {emailSettingsLoading ? (
            <Box display="flex" justifyContent="center" py={6}>
              <CircularProgress />
            </Box>
          ) : (
            <Stack spacing={3}>
              <Box>
                <Typography variant="h6" gutterBottom>
                  Email Notification Settings
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Configure which staff positions receive email updates when projects are modified.
                </Typography>
              </Box>

              <Stack spacing={2}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Stack>
                    <Typography variant="subtitle1" fontWeight={600}>
                      Enable Email Notifications
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Master toggle for all project update email notifications
                    </Typography>
                  </Stack>
                  <TextField
                    select
                    size="small"
                    value={emailSettings?.emailNotificationsEnabled ? 'enabled' : 'disabled'}
                    onChange={async (e) => {
                      try {
                        await updateEmailSettings.mutateAsync({
                          emailNotificationsEnabled: e.target.value === 'enabled',
                        });
                        toast.success('Settings updated', 'Email notification settings have been saved.');
                      } catch (error: any) {
                        toast.error('Update failed', error.response?.data?.error || 'Failed to update settings.');
                      }
                    }}
                    sx={{ width: 140 }}
                  >
                    <MenuItem value="enabled">Enabled</MenuItem>
                    <MenuItem value="disabled">Disabled</MenuItem>
                  </TextField>
                </Box>

                <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Position-Based Notifications
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Select which staff positions should receive email updates for project changes
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={4}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Partner</Typography>
                        <Switch
                          checked={emailSettings?.notifyPartner ?? false}
                          onChange={async (e) => {
                            try {
                              await updateEmailSettings.mutateAsync({
                                notifyPartner: e.target.checked,
                              });
                              toast.success('Settings updated', 'Partner notification preference saved.');
                            } catch (error: any) {
                              toast.error('Update failed', error.response?.data?.error || 'Failed to update settings.');
                            }
                          }}
                          disabled={!emailSettings?.emailNotificationsEnabled}
                        />
                      </Box>
                    </Grid>

                    <Grid item xs={12} sm={6} md={4}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Associate</Typography>
                        <Switch
                          checked={emailSettings?.notifyAssociate ?? false}
                          onChange={async (e) => {
                            try {
                              await updateEmailSettings.mutateAsync({
                                notifyAssociate: e.target.checked,
                              });
                              toast.success('Settings updated', 'Associate notification preference saved.');
                            } catch (error: any) {
                              toast.error('Update failed', error.response?.data?.error || 'Failed to update settings.');
                            }
                          }}
                          disabled={!emailSettings?.emailNotificationsEnabled}
                        />
                      </Box>
                    </Grid>

                    <Grid item xs={12} sm={6} md={4}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Junior FLIC</Typography>
                        <Switch
                          checked={emailSettings?.notifyJuniorFlic ?? false}
                          onChange={async (e) => {
                            try {
                              await updateEmailSettings.mutateAsync({
                                notifyJuniorFlic: e.target.checked,
                              });
                              toast.success('Settings updated', 'Junior FLIC notification preference saved.');
                            } catch (error: any) {
                              toast.error('Update failed', error.response?.data?.error || 'Failed to update settings.');
                            }
                          }}
                          disabled={!emailSettings?.emailNotificationsEnabled}
                        />
                      </Box>
                    </Grid>

                    <Grid item xs={12} sm={6} md={4}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Senior FLIC</Typography>
                        <Switch
                          checked={emailSettings?.notifySeniorFlic ?? false}
                          onChange={async (e) => {
                            try {
                              await updateEmailSettings.mutateAsync({
                                notifySeniorFlic: e.target.checked,
                              });
                              toast.success('Settings updated', 'Senior FLIC notification preference saved.');
                            } catch (error: any) {
                              toast.error('Update failed', error.response?.data?.error || 'Failed to update settings.');
                            }
                          }}
                          disabled={!emailSettings?.emailNotificationsEnabled}
                        />
                      </Box>
                    </Grid>

                    <Grid item xs={12} sm={6} md={4}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Intern</Typography>
                        <Switch
                          checked={emailSettings?.notifyIntern ?? false}
                          onChange={async (e) => {
                            try {
                              await updateEmailSettings.mutateAsync({
                                notifyIntern: e.target.checked,
                              });
                              toast.success('Settings updated', 'Intern notification preference saved.');
                            } catch (error: any) {
                              toast.error('Update failed', error.response?.data?.error || 'Failed to update settings.');
                            }
                          }}
                          disabled={!emailSettings?.emailNotificationsEnabled}
                        />
                      </Box>
                    </Grid>

                    <Grid item xs={12} sm={6} md={4}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="body2">B&C Working Attorney</Typography>
                        <Switch
                          checked={emailSettings?.notifyBCWorkingAttorney ?? false}
                          onChange={async (e) => {
                            try {
                              await updateEmailSettings.mutateAsync({
                                notifyBCWorkingAttorney: e.target.checked,
                              });
                              toast.success('Settings updated', 'B&C Working Attorney notification preference saved.');
                            } catch (error: any) {
                              toast.error('Update failed', error.response?.data?.error || 'Failed to update settings.');
                            }
                          }}
                          disabled={!emailSettings?.emailNotificationsEnabled}
                        />
                      </Box>
                    </Grid>
                  </Grid>
                </Box>

                <Box sx={{ p: 2, bgcolor: 'info.50', borderRadius: 1, borderLeft: 4, borderColor: 'info.main' }}>
                  <Typography variant="body2" color="info.dark">
                    <strong>Note:</strong> When a project is updated, only staff members assigned to that project with positions that have notifications enabled will receive email updates.
                  </Typography>
                </Box>
              </Stack>
            </Stack>
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
