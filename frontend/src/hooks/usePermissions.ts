import { useAuth } from './useAuth';

export const usePermissions = () => {
  const { user } = useAuth();

  const isAdmin = user?.role === 'admin';
  const isEditor = user?.role === 'editor';
  const isViewer = user?.role === 'viewer';
  const isAuthenticated = !!user;

  return {
    // Admin can do everything
    canCreateProject: isAdmin || isEditor,
    canEditProject: isAdmin || isEditor,
    canDeleteProject: isAdmin,

    // All authenticated users can manage staff
    canCreateStaff: isAuthenticated,
    canEditStaff: isAuthenticated,
    canDeleteStaff: isAuthenticated,

    canCreateAssignment: isAdmin || isEditor,
    canEditAssignment: isAdmin || isEditor,
    canDeleteAssignment: isAdmin || isEditor,

    canManageUsers: isAdmin,

    isAdmin,
    isEditor,
    isViewer,
  };
};
