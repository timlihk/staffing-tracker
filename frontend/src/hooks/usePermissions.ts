import { useAuth } from '../context/AuthContext';

export const usePermissions = () => {
  const { user } = useAuth();

  const isAdmin = user?.role === 'admin';
  const isEditor = user?.role === 'editor';
  const isViewer = user?.role === 'viewer';

  return {
    // Admin can do everything
    canCreateProject: isAdmin || isEditor,
    canEditProject: isAdmin || isEditor,
    canDeleteProject: isAdmin,

    canCreateStaff: isAdmin || isEditor,
    canEditStaff: isAdmin || isEditor,
    canDeleteStaff: isAdmin,

    canCreateAssignment: isAdmin || isEditor,
    canEditAssignment: isAdmin || isEditor,
    canDeleteAssignment: isAdmin || isEditor,

    canManageUsers: isAdmin,

    isAdmin,
    isEditor,
    isViewer,
  };
};
