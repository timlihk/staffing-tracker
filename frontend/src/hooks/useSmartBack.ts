import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Custom hook for smart back navigation
 * - Checks location.state for 'from' path
 * - Uses browser history if available
 * - Falls back to provided default path
 */
export const useSmartBack = (defaultPath: string) => {
  const navigate = useNavigate();
  const location = useLocation();

  const goBack = () => {
    // Check if we have a 'from' path in location state
    const from = (location.state as { from?: string })?.from;

    if (from) {
      // Navigate to the stored 'from' path
      navigate(from);
    } else {
      // Always fall back to default path for consistent behavior
      navigate(defaultPath);
    }
  };

  return goBack;
};
