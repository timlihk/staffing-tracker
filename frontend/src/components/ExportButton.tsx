import React, { useState } from 'react';
import {
  Button,
  ButtonGroup,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Print as PrintIcon,
  TableView as CsvIcon,
  InsertDriveFile as ExcelIcon,
  Code as JsonIcon,
  ArrowDropDown as DropdownIcon,
} from '@mui/icons-material';

export type ExportFormat = 'csv' | 'excel' | 'json' | 'print';

interface ExportButtonProps {
  onExport: (format: ExportFormat) => void;
  disabled?: boolean;
  loading?: boolean;
  showPrint?: boolean;
  showExcel?: boolean;
  showJson?: boolean;
  tooltipText?: string;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  onExport,
  disabled = false,
  loading = false,
  showPrint = true,
  showExcel = true,
  showJson = true,
  tooltipText = 'Export data',
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleExport = (format: ExportFormat) => {
    onExport(format);
    handleClose();
  };

  return (
    <>
      <Tooltip title={tooltipText} className="no-print">
        <ButtonGroup
          variant="outlined"
          size="small"
          disabled={disabled || loading}
          className="no-print"
        >
          <Button
            onClick={() => onExport('csv')}
            startIcon={<DownloadIcon />}
          >
            Export CSV
          </Button>
          <Button
            size="small"
            onClick={handleClick}
            sx={{ px: 0.5 }}
          >
            <DropdownIcon />
          </Button>
        </ButtonGroup>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={() => handleExport('csv')}>
          <ListItemIcon>
            <CsvIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export as CSV</ListItemText>
        </MenuItem>

        {showExcel && (
          <MenuItem onClick={() => handleExport('excel')}>
            <ListItemIcon>
              <ExcelIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Export as Excel</ListItemText>
          </MenuItem>
        )}

        {showJson && (
          <MenuItem onClick={() => handleExport('json')}>
            <ListItemIcon>
              <JsonIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Export as JSON</ListItemText>
          </MenuItem>
        )}

        {showPrint && (
          <MenuItem onClick={() => handleExport('print')}>
            <ListItemIcon>
              <PrintIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Print</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
};

export default ExportButton;
