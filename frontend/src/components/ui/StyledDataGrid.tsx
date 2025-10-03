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
          background: theme.palette.primary.dark,
          color: theme.palette.common.white,
          borderBottom: `1px solid ${theme.palette.divider}`,
          fontWeight: 700,
        },
        [`& .${gridClasses.columnHeaderTitle}`]: {
          color: theme.palette.common.white,
          fontWeight: 700,
        },
        [`& .${gridClasses.iconButtonContainer}`]: {
          color: theme.palette.common.white,
        },
        [`& .${gridClasses.menuIcon}`]: {
          color: theme.palette.common.white,
        },
        [`& .${gridClasses.sortIcon}`]: {
          color: theme.palette.common.white,
        },
        [`& .${gridClasses.row}.even`]: {
          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(148,163,184,0.04)' : theme.palette.grey[100],
        },
        [`& .${gridClasses.row}`]: {
          '&:hover': { backgroundColor: theme.palette.grey[200] },
        },
      })}
      getRowClassName={(p) => (p.indexRelativeToCurrentPage % 2 === 0 ? 'even' : 'odd')}
      {...props}
    />
  );
}
