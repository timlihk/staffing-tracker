import { Box, Skeleton as MuiSkeleton, Paper } from '@mui/material';

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({ rows = 5, columns = 6 }) => {
  return (
    <Box>
      {Array.from({ length: rows }).map((_, i) => (
        <Box key={i} display="flex" gap={2} py={1.5} borderBottom="1px solid rgba(15,23,42,0.08)">
          {Array.from({ length: columns }).map((_, j) => (
            <MuiSkeleton key={j} width={`${100 / columns}%`} height={40} animation="wave" />
          ))}
        </Box>
      ))}
    </Box>
  );
};

export const DashboardCardSkeleton: React.FC = () => {
  return (
    <Paper sx={{ p: 3 }}>
      <MuiSkeleton variant="text" width="55%" height={32} animation="wave" />
      <MuiSkeleton variant="text" width="35%" height={48} sx={{ mt: 1 }} animation="wave" />
      <MuiSkeleton variant="rectangular" width="100%" height={120} sx={{ mt: 2, borderRadius: 2 }} animation="wave" />
    </Paper>
  );
};

export const DashboardSkeleton: React.FC = () => {
  return (
    <Box>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' },
        gap: 3,
        mb: 4
      }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <DashboardCardSkeleton key={i} />
        ))}
      </Box>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
        gap: 3
      }}>
        {Array.from({ length: 2 }).map((_, i) => (
          <Paper sx={{ p: 3 }} key={i}>
            <MuiSkeleton variant="text" width="50%" height={32} sx={{ mb: 2 }} animation="wave" />
            <TableSkeleton rows={6} columns={3} />
          </Paper>
        ))}
      </Box>
    </Box>
  );
};

export const FormSkeleton: React.FC = () => {
  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
        gap: 2
      }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Box key={i}>
            <MuiSkeleton variant="rectangular" height={56} animation="wave" />
          </Box>
        ))}
        <Box sx={{ gridColumn: { xs: '1 / -1', md: '1 / -1' } }}>
          <MuiSkeleton variant="rectangular" height={120} animation="wave" />
        </Box>
        <Box sx={{ gridColumn: { xs: '1 / -1', md: '1 / -1' } }}>
          <Box display="flex" gap={2}>
            <MuiSkeleton variant="rectangular" width={120} height={42} animation="wave" />
            <MuiSkeleton variant="rectangular" width={100} height={42} animation="wave" />
          </Box>
        </Box>
      </Box>
    </Paper>
  );
};

export const ProjectListSkeleton: React.FC = () => {
  return (
    <Box>
      <Box display="flex" gap={2} mb={3}>
        {Array.from({ length: 3 }).map((_, i) => (
          <MuiSkeleton key={i} variant="rectangular" width={200} height={56} animation="wave" />
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
          <MuiSkeleton key={i} variant="rectangular" width={200} height={56} animation="wave" />
        ))}
      </Box>
      <TableSkeleton rows={8} columns={6} />
    </Box>
  );
};
