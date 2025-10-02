import React from 'react';
import { Box, Skeleton as MuiSkeleton, Paper, Grid } from '@mui/material';

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({ rows = 5, columns = 6 }) => {
  return (
    <Box>
      {Array.from({ length: rows }).map((_, i) => (
        <Box key={i} display="flex" gap={2} py={1.5} borderBottom="1px solid rgba(0,0,0,0.1)">
          {Array.from({ length: columns }).map((_, j) => (
            <MuiSkeleton key={j} width={`${100 / columns}%`} height={40} />
          ))}
        </Box>
      ))}
    </Box>
  );
};

export const DashboardCardSkeleton: React.FC = () => {
  return (
    <Paper sx={{ p: 3 }}>
      <MuiSkeleton variant="text" width="60%" height={32} />
      <MuiSkeleton variant="text" width="40%" height={48} sx={{ mt: 1 }} />
      <MuiSkeleton variant="text" width="80%" height={24} sx={{ mt: 2 }} />
    </Paper>
  );
};

export const DashboardSkeleton: React.FC = () => {
  return (
    <Box>
      <Grid container spacing={3} mb={4}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Grid item xs={12} md={3} key={i}>
            <DashboardCardSkeleton />
          </Grid>
        ))}
      </Grid>
      <Grid container spacing={3}>
        {Array.from({ length: 2 }).map((_, i) => (
          <Grid item xs={12} md={6} key={i}>
            <Paper sx={{ p: 3 }}>
              <MuiSkeleton variant="text" width="50%" height={32} sx={{ mb: 2 }} />
              <TableSkeleton rows={6} columns={3} />
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export const FormSkeleton: React.FC = () => {
  return (
    <Paper sx={{ p: 3 }}>
      <Grid container spacing={2}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Grid item xs={12} md={6} key={i}>
            <MuiSkeleton variant="rectangular" height={56} />
          </Grid>
        ))}
        <Grid item xs={12}>
          <MuiSkeleton variant="rectangular" height={120} />
        </Grid>
        <Grid item xs={12}>
          <Box display="flex" gap={2}>
            <MuiSkeleton variant="rectangular" width={120} height={42} />
            <MuiSkeleton variant="rectangular" width={100} height={42} />
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};

export const ProjectListSkeleton: React.FC = () => {
  return (
    <Box>
      <Box display="flex" gap={2} mb={3}>
        {Array.from({ length: 3 }).map((_, i) => (
          <MuiSkeleton key={i} variant="rectangular" width={200} height={56} />
        ))}
      </Box>
      <TableSkeleton rows={10} columns={8} />
    </Box>
  );
};

export const StaffListSkeleton: React.FC = () => {
  return (
    <Box>
      <Box display="flex" gap={2} mb={3}>
        {Array.from({ length: 2 }).map((_, i) => (
          <MuiSkeleton key={i} variant="rectangular" width={200} height={56} />
        ))}
      </Box>
      <TableSkeleton rows={8} columns={6} />
    </Box>
  );
};
