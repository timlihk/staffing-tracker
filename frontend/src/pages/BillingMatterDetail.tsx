/**
 * Billing Matter Detail Page
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardHeader,
  CardContent,
  Typography,
  Grid,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Alert,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Link as LinkIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { GridColDef } from '@mui/x-data-grid';
import { useBillingProject, useUpdateFinancials } from '../hooks/useBilling';
import { useAuth } from '../context/AuthContext';
import { Page, StyledDataGrid } from '../components/ui';
import { Link as RouterLink } from 'react-router-dom';

const formatMoney = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '0.00';
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatDateTime = (dateString: string | null): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};


export default function BillingMatterDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const projectId = parseInt(id || '0');

  const { data, isLoading } = useBillingProject(projectId);
  const updateFinancialsMutation = useUpdateFinancials();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    ubt_usd: 0,
    ubt_cny: 0,
    billing_credit_usd: 0,
    billing_credit_cny: 0,
  });

  const project = data?.project;
  const cmNumbers = data?.cmNumbers || [];

  const handleEditMilestone = (milestoneId: number) => {
    // TODO: Implement milestone edit functionality
    console.log('Edit milestone:', milestoneId);
  };

  const handleDeleteMilestone = (milestoneId: number) => {
    // TODO: Implement milestone delete functionality
    if (window.confirm('Are you sure you want to delete this milestone?')) {
      console.log('Delete milestone:', milestoneId);
    }
  };

  const handleAddMilestone = () => {
    // TODO: Implement add milestone functionality
    console.log('Add milestone');
  };

  const handleEditMatterInfo = () => {
    // TODO: Implement matter info edit functionality
    console.log('Edit matter info');
  };

  const handleOpenEditDialog = () => {
    setFormData({
      ubt_usd: project?.ubt_usd || 0,
      ubt_cny: project?.ubt_cny || 0,
      billing_credit_usd: project?.billing_credit_usd || 0,
      billing_credit_cny: project?.billing_credit_cny || 0,
    });
    setEditDialogOpen(true);
  };

  const handleSaveFinancials = async () => {
    await updateFinancialsMutation.mutateAsync({
      projectId,
      data: formData,
    });
    setEditDialogOpen(false);
  };

  // Milestones columns
  const milestoneColumns: GridColDef[] = [
    {
      field: 'ordinal',
      headerName: '#',
      width: 60,
      renderCell: (params) => (
        <Typography variant="body2" fontWeight="medium">
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'raw_fragment',
      headerName: 'Description',
      flex: 1,
      minWidth: 250,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
          {params.value || params.row.description || '-'}
        </Typography>
      ),
    },
    {
      field: 'amount_value',
      headerName: 'Amount',
      width: 150,
      renderCell: (params) => {
        if (!params.value) return null;
        return (
          <Typography variant="body2" fontWeight="medium">
            {params.row.amount_currency} {formatMoney(params.value)}
            {params.row.is_percent && params.row.percent_value &&
              ` (${params.row.percent_value}%)`
            }
          </Typography>
        );
      },
    },
    {
      field: 'completed',
      headerName: 'Achieved',
      width: 100,
      renderCell: (params) => (
        <Chip
          label={params.value ? '✓' : '-'}
          color={params.value ? 'success' : 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'invoice_sent_date',
      headerName: 'Billed',
      width: 110,
      renderCell: (params) => params.value ? formatDate(params.value) : '-',
    },
    {
      field: 'payment_received_date',
      headerName: 'Collected',
      width: 110,
      renderCell: (params) => params.value ? formatDate(params.value) : '-',
    },
    {
      field: 'notes',
      headerName: 'Notes',
      flex: 1,
      minWidth: 150,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
          {params.value || '-'}
        </Typography>
      ),
    },
    ...(isAdmin ? [{
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      renderCell: (params: any) => (
        <Box onClick={(e) => e.stopPropagation()}>
          <IconButton
            size="small"
            color="primary"
            onClick={() => handleEditMilestone(params.row.milestone_id)}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => handleDeleteMilestone(params.row.milestone_id)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    }] : []),
  ];

  if (isLoading) {
    return (
      <Page title="Loading...">
        <Typography>Loading billing matter...</Typography>
      </Page>
    );
  }

  if (!project) {
    return (
      <Page title="Not Found">
        <Alert severity="error">Billing matter not found</Alert>
      </Page>
    );
  }

  return (
    <Page title={project.project_name}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/billing')}
          sx={{ mb: 2 }}
        >
          Back to Billing Matters
        </Button>

        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h4" gutterBottom>
              {project.project_name}
            </Typography>
            {project.client_name && (
              <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                {project.client_name}
              </Typography>
            )}
          </Box>

          {project.staffing_project_id && (
            <Chip
              icon={<LinkIcon />}
              label={`Linked: ${project.staffing_project_name}`}
              color="success"
              component={RouterLink}
              to={`/projects/${project.staffing_project_id}`}
              clickable
            />
          )}
        </Box>
      </Box>

      {/* C/M Number Cards */}
      <Box sx={{ mt: 1 }}>
        {cmNumbers.length > 0 ? (
          cmNumbers.map((cm: any, cmIndex: number) => (
            <Card key={cm.cm_id} sx={{ mb: 2 }}>
              <CardHeader
                title={
                  <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                    <Typography variant="h6">
                      C/M No: {cm.cm_no}
                    </Typography>
                    {cm.is_primary && (
                      <Chip label="Primary" color="primary" size="small" />
                    )}
                    {cm.status && (
                      <Chip
                        label={cm.status}
                        size="small"
                        color={cm.status === 'active' ? 'success' : 'default'}
                      />
                    )}
                    {cm.open_date && (
                      <Typography variant="body2" color="text.secondary">
                        <strong>Opened:</strong> {formatDate(cm.open_date)}
                      </Typography>
                    )}
                    {cm.closed_date && (
                      <Typography variant="body2" color="text.secondary">
                        <strong>Closed:</strong> {formatDate(cm.closed_date)}
                      </Typography>
                    )}
                  </Box>
                }
                sx={{ backgroundColor: 'grey.50' }}
              />
              <CardContent>
                {/* Matter Information & Financial Summary for this C/M */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  {/* Matter Information */}
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                      <CardHeader
                        title="Matter Information"
                        titleTypographyProps={{ variant: 'subtitle1' }}
                        action={
                          isAdmin && (
                            <IconButton size="small" color="primary" onClick={handleEditMatterInfo}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          )
                        }
                      />
                      <CardContent>
                        <Table size="small">
                          <TableBody>
                            <TableRow>
                              <TableCell><strong>Attorney in Charge</strong></TableCell>
                              <TableCell>{project.attorney_in_charge || '-'}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell><strong>B&C Attorney</strong></TableCell>
                              <TableCell>
                                {project.bc_attorney_name || '-'}
                                {project.is_auto_mapped && (
                                  <Chip label="Auto" size="small" sx={{ ml: 1 }} />
                                )}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Financial Summary */}
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                      <CardHeader
                        title="Financial Summary"
                        titleTypographyProps={{ variant: 'subtitle1' }}
                        action={
                          isAdmin && cm.engagements?.[0] && (
                            <Button
                              startIcon={<EditIcon />}
                              onClick={handleOpenEditDialog}
                              size="small"
                            >
                              Update
                            </Button>
                          )
                        }
                      />
                      <CardContent>
                        {cm.engagements && cm.engagements.length > 0 ? (
                          <Grid container spacing={2}>
                            {/* USD Section */}
                            <Grid item xs={12} md={6}>
                              <Typography variant="caption" color="primary" gutterBottom display="block">
                                USD
                              </Typography>
                              <Table size="small">
                                <TableBody>
                                  <TableRow>
                                    <TableCell>Agreed Fee</TableCell>
                                    <TableCell align="right">
                                      <Typography variant="body2" fontWeight="medium">
                                        ${formatMoney(cm.engagements[0].agreed_fee_usd)}
                                      </Typography>
                                    </TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell>Billed</TableCell>
                                    <TableCell align="right">${formatMoney(cm.engagements[0].billing_usd)}</TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell>Collected</TableCell>
                                    <TableCell align="right">${formatMoney(cm.engagements[0].collection_usd)}</TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell>Credit</TableCell>
                                    <TableCell align="right">
                                      <Chip
                                        label={`$${formatMoney(cm.engagements[0].billing_credit_usd)}`}
                                        size="small"
                                        color={cm.engagements[0].billing_credit_usd > 0 ? 'success' : 'default'}
                                      />
                                    </TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell>UBT</TableCell>
                                    <TableCell align="right">
                                      <Chip
                                        label={`$${formatMoney(cm.engagements[0].ubt_usd)}`}
                                        size="small"
                                        color={cm.engagements[0].ubt_usd > 0 ? 'warning' : 'default'}
                                      />
                                    </TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </Grid>

                            {/* CNY Section */}
                            <Grid item xs={12} md={6}>
                              <Typography variant="caption" color="secondary" gutterBottom display="block">
                                CNY (人民币)
                              </Typography>
                              <Table size="small">
                                <TableBody>
                                  <TableRow>
                                    <TableCell>Agreed Fee</TableCell>
                                    <TableCell align="right">
                                      <Typography variant="body2" fontWeight="medium">
                                        ¥{formatMoney(cm.engagements[0].agreed_fee_cny)}
                                      </Typography>
                                    </TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell>Billed</TableCell>
                                    <TableCell align="right">¥{formatMoney(cm.engagements[0].billing_cny)}</TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell>Collected</TableCell>
                                    <TableCell align="right">¥{formatMoney(cm.engagements[0].collection_cny)}</TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell>Credit</TableCell>
                                    <TableCell align="right">
                                      <Chip
                                        label={`¥${formatMoney(cm.engagements[0].billing_credit_cny)}`}
                                        size="small"
                                        color={cm.engagements[0].billing_credit_cny > 0 ? 'success' : 'default'}
                                      />
                                    </TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell>UBT</TableCell>
                                    <TableCell align="right">
                                      <Chip
                                        label={`¥${formatMoney(cm.engagements[0].ubt_cny)}`}
                                        size="small"
                                        color={cm.engagements[0].ubt_cny > 0 ? 'warning' : 'default'}
                                      />
                                    </TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </Grid>
                          </Grid>
                        ) : (
                          <Typography variant="body2" color="text.secondary">No financial data</Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* Engagements */}
                {cm.engagements && cm.engagements.length > 0 ? (
                  cm.engagements.map((engagement: any, engIndex: number) => (
                    <Box key={engagement.engagement_id} sx={{ mb: engIndex < cm.engagements.length - 1 ? 4 : 0 }}>
                      {/* Engagement Header */}
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                          {engagement.name || engagement.engagement_code || engagement.engagement_title || `Engagement #${engIndex + 1}`}
                        </Typography>
                        <Grid container spacing={2}>
                          {engagement.start_date && (
                            <Grid item>
                              <Typography variant="body2" color="text.secondary">
                                <strong>Start:</strong> {formatDate(engagement.start_date)}
                              </Typography>
                            </Grid>
                          )}
                          {engagement.end_date && (
                            <Grid item>
                              <Typography variant="body2" color="text.secondary">
                                <strong>End:</strong> {formatDate(engagement.end_date)}
                              </Typography>
                            </Grid>
                          )}
                        </Grid>
                      </Box>

                      {/* Fee Arrangement */}
                      {engagement.feeArrangement && engagement.feeArrangement.raw_text && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Fee Arrangement
                          </Typography>
                          {engagement.feeArrangement.lsd_date && (
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Long Stop Date: {formatDate(engagement.feeArrangement.lsd_date)}
                            </Typography>
                          )}
                          <Box
                            sx={{
                              p: 2,
                              backgroundColor: 'grey.50',
                              borderRadius: 1,
                              whiteSpace: 'pre-wrap',
                              fontFamily: 'monospace',
                              fontSize: '0.875rem',
                            }}
                          >
                            {engagement.feeArrangement.raw_text}
                          </Box>
                        </Box>
                      )}

                      {/* Milestones */}
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          milestones
                        </Typography>
                        {engagement.milestones && engagement.milestones.length > 0 ? (
                          <Box
                            sx={{
                              '& .MuiDataGrid-columnHeaders': {
                                backgroundColor: 'background.paper',
                                color: 'text.primary',
                              },
                              '& .MuiDataGrid-columnHeaderTitle': {
                                fontWeight: 'bold',
                                color: 'text.primary',
                              },
                            }}
                          >
                            <StyledDataGrid
                              rows={engagement.milestones}
                              columns={milestoneColumns}
                              getRowId={(row) => row.milestone_id}
                              autoHeight
                              hideFooter
                              disableRowSelectionOnClick
                            />
                          </Box>
                        ) : (
                          <Typography color="text.secondary" variant="body2">
                            No milestones for this engagement
                          </Typography>
                        )}
                      </Box>

                      {engIndex < cm.engagements.length - 1 && <Divider sx={{ mt: 3 }} />}
                    </Box>
                  ))
                ) : (
                  <Typography color="text.secondary">No engagements found for this C/M number</Typography>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent>
              <Typography color="text.secondary">No C/M numbers found for this project</Typography>
            </CardContent>
          </Card>
        )}
      </Box>

      {/* Edit Financials Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Update Financial Data</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Update UBT and Billing Credits from finance system data
          </Typography>

          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              USD
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="UBT (USD)"
                  type="number"
                  value={formData.ubt_usd}
                  onChange={(e) =>
                    setFormData({ ...formData, ubt_usd: parseFloat(e.target.value) || 0 })
                  }
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Billing Credit (USD)"
                  type="number"
                  value={formData.billing_credit_usd}
                  onChange={(e) =>
                    setFormData({ ...formData, billing_credit_usd: parseFloat(e.target.value) || 0 })
                  }
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
              </Grid>
            </Grid>
          </Box>

          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" color="secondary" gutterBottom>
              CNY
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="UBT (CNY)"
                  type="number"
                  value={formData.ubt_cny}
                  onChange={(e) =>
                    setFormData({ ...formData, ubt_cny: parseFloat(e.target.value) || 0 })
                  }
                  InputProps={{
                    startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Billing Credit (CNY)"
                  type="number"
                  value={formData.billing_credit_cny}
                  onChange={(e) =>
                    setFormData({ ...formData, billing_credit_cny: parseFloat(e.target.value) || 0 })
                  }
                  InputProps={{
                    startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                  }}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSaveFinancials}
            variant="contained"
            disabled={updateFinancialsMutation.isPending}
          >
            {updateFinancialsMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
  );
}
