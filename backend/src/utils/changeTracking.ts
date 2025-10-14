import prisma from './prisma';

interface ChangeTrackingOptions {
  entityId: number;
  entityType: 'project' | 'staff';
  oldData: any;
  newData: any;
  userId?: number;
}

export const trackFieldChanges = async (options: ChangeTrackingOptions) => {
  const { entityId, entityType, oldData, newData, userId } = options;

  const fieldsToTrack = Object.keys(newData);
  const changes = [];

  for (const field of fieldsToTrack) {
    const oldValue = oldData[field];
    const newValue = newData[field];

    // Skip if values are the same
    if (oldValue === newValue) continue;

    // Skip internal fields
    if (['id', 'createdAt', 'updatedAt'].includes(field)) continue;

    // Skip relational/object fields (connect, disconnect, create, etc.)
    // These create noisy [object Object] entries in change history
    if (typeof newValue === 'object' && newValue !== null && !(newValue instanceof Date)) {
      // Check if it's a Prisma relation operation
      if ('connect' in newValue || 'disconnect' in newValue || 'create' in newValue || 'update' in newValue) {
        continue;
      }
    }

    // Convert dates to strings for comparison
    const oldStr = oldValue instanceof Date ? oldValue.toISOString() : String(oldValue ?? '');
    const newStr = newValue instanceof Date ? newValue.toISOString() : String(newValue ?? '');

    if (oldStr !== newStr) {
      changes.push({
        fieldName: field,
        oldValue: oldStr || null,
        newValue: newStr || null,
        changeType: 'update',
        changedBy: userId,
      });
    }
  }

  // Save all changes
  if (changes.length > 0) {
    if (entityType === 'project') {
      await prisma.projectChangeHistory.createMany({
        data: changes.map((change) => ({
          projectId: entityId,
          ...change,
        })),
      });
    } else if (entityType === 'staff') {
      await prisma.staffChangeHistory.createMany({
        data: changes.map((change) => ({
          staffId: entityId,
          ...change,
        })),
      });
    }
  }

  return changes.length;
};

export const trackAssignmentChange = async (
  entityId: number,
  entityType: 'project' | 'staff',
  changeType: 'assignment_added' | 'assignment_removed',
  assignmentDetails: string,
  userId?: number
) => {
  const changeData = {
    fieldName: 'assignments',
    oldValue: changeType === 'assignment_added' ? null : assignmentDetails,
    newValue: changeType === 'assignment_added' ? assignmentDetails : null,
    changeType,
    changedBy: userId,
  };

  if (entityType === 'project') {
    await prisma.projectChangeHistory.create({
      data: {
        projectId: entityId,
        ...changeData,
      },
    });
  } else if (entityType === 'staff') {
    await prisma.staffChangeHistory.create({
      data: {
        staffId: entityId,
        ...changeData,
      },
    });
  }
};
