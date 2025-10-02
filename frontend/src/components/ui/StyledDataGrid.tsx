import * as React from 'react';
import { DataGrid, DataGridProps, gridClasses } from '@mui/x-data-grid';

export default function StyledDataGrid(props: DataGridProps) {
  return (
    <DataGrid
      disableRowSelectionOnClick
      density="compact"
      getRowHeight={() => 44}
      sx={(theme) => ({
        border: 'none',
        [`& .${gridClasses.columnHeaders}`]: {
          position: 'sticky',
          top: 0,
          zIndex: 1,
          background: theme.palette.mode === 'dark' ? '#0F172A' : '#F8FAFC',
          borderBottom: `1px solid ${theme.palette.divider}`,
        },
        [`& .${gridClasses.row}.even`]: {
          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(148,163,184,0.04)' : '#FBFDFF',
        },
        [`& .${gridClasses.row}`]: {
          '&:hover': { backgroundColor: theme.palette.action.hover },
        },
      })}
      getRowClassName={(p) => (p.indexRelativeToCurrentPage % 2 === 0 ? 'even' : 'odd')}
      {...props}
    />
  );
}
