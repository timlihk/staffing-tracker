import React from 'react';
import { Box, IconButton, Typography, CircularProgress, Tooltip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import type { LifecycleStep } from '../../types/projectBilling';

interface LifecycleStepperProps {
  completed: boolean;
  completionDate: string | null;
  invoiceSentDate: string | null;
  paymentReceivedDate: string | null;
  disabled: boolean;
  savingStep: LifecycleStep | null;
  onToggle: (step: LifecycleStep) => void;
}

interface StepConfig {
  key: LifecycleStep;
  label: string;
  done: boolean;
  date: string | null;
}

const formatStepDate = (date: string | null): string => {
  if (!date) return '';
  try {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return date;
  }
};

const LifecycleStepper: React.FC<LifecycleStepperProps> = ({
  completed,
  completionDate,
  invoiceSentDate,
  paymentReceivedDate,
  disabled,
  savingStep,
  onToggle,
}) => {
  const steps: StepConfig[] = [
    { key: 'completed', label: 'Fulfilled', done: completed, date: completionDate },
    { key: 'invoiceSentDate', label: 'Invoiced', done: !!invoiceSentDate, date: invoiceSentDate },
    { key: 'paymentReceivedDate', label: 'Collected', done: !!paymentReceivedDate, date: paymentReceivedDate },
  ];

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0, py: 1 }}>
      {steps.map((step, index) => {
        const isSaving = savingStep === step.key;

        return (
          <React.Fragment key={step.key}>
            {index > 0 && (
              <Box
                sx={{
                  flex: '0 0 24px',
                  height: '2px',
                  bgcolor: steps[index - 1].done ? 'success.main' : 'divider',
                  mx: 0.5,
                }}
              />
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 }}>
              <Typography
                variant="caption"
                sx={{
                  mb: 0.25,
                  fontWeight: step.done ? 600 : 400,
                  color: step.done ? 'success.main' : 'text.secondary',
                  fontSize: '0.7rem',
                }}
              >
                {step.label}
              </Typography>
              <Tooltip title={disabled ? '' : step.done ? `Clear ${step.label.toLowerCase()}` : `Mark as ${step.label.toLowerCase()}`}>
                <span>
                  <IconButton
                    size="small"
                    disabled={disabled || isSaving}
                    onClick={() => onToggle(step.key)}
                    sx={{ p: 0.25 }}
                  >
                    {isSaving ? (
                      <CircularProgress size={20} />
                    ) : step.done ? (
                      <CheckCircleIcon sx={{ fontSize: 22, color: 'success.main' }} />
                    ) : (
                      <RadioButtonUncheckedIcon sx={{ fontSize: 22, color: 'text.disabled' }} />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
              <Typography
                variant="caption"
                sx={{ mt: 0.25, color: 'text.secondary', fontSize: '0.65rem', minHeight: 14 }}
              >
                {step.done ? formatStepDate(step.date) : ''}
              </Typography>
            </Box>
          </React.Fragment>
        );
      })}
    </Box>
  );
};

export default LifecycleStepper;
