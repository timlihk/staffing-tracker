import { useAuth } from './useAuth';

export const usePermissions = () => {
  const { user } = useAuth();

  const isAdmin = user?.role === 'admin';
  const isFinance = user?.role === 'finance';
  const isEditor = user?.role === 'editor';
  const isViewer = user?.role === 'viewer';
  const isBcAttorney = user?.staff?.position === 'B&C Working Attorney';
  const isAuthenticated = !!user;

  return {
    // Admin and Finance can do everything project-related
    canCreateProject: isAdmin || isFinance || isEditor,
    canEditProject: isAdmin || isFinance || isEditor,
    canDeleteProject: isAdmin || isFinance,

    // All authenticated users can manage staff
    canCreateStaff: isAuthenticated,
    canEditStaff: isAuthenticated,
    canDeleteStaff: isAuthenticated,

    canCreateAssignment: isAdmin || isFinance || isEditor,
    canEditAssignment: isAdmin || isFinance || isEditor,
    canDeleteAssignment: isAdmin || isFinance || isEditor,
    canEditBillingMilestones: isAdmin || isFinance || isBcAttorney,

    canManageUsers: isAdmin,

    isAdmin,
    isFinance,
    isEditor,
    isViewer,
    isBcAttorney,
  };
};
