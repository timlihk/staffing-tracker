import prisma from '../utils/prisma';

async function main() {
  const duplicateNames = ['San', 'Samantha'];

  const staff = await prisma.staff.findMany({
    where: { name: { in: duplicateNames } },
    include: {
      assignments: true,
      users: true,
    },
    orderBy: { id: 'asc' },
  });

  if (staff.length === 0) {
    console.log('No staff found matching San/Samantha.');
    return;
  }

  if (staff.length === 1) {
    const [record] = staff;
    await prisma.staff.update({
      where: { id: record.id },
      data: { name: 'Sam' },
    });
    console.log(`Renamed staff ${record.id} to Sam (no duplicates found).`);
    return;
  }

  const primary = staff.find((entry) => entry.name === 'Samantha') ?? staff[0];
  const duplicates = staff.filter((entry) => entry.id !== primary.id);

  const fallbackEmail = primary.email ?? duplicates.find((entry) => entry.email)?.email ?? null;
  const mergedNotes = [
    primary.notes?.trim(),
    ...duplicates
      .map((entry) => entry.notes?.trim())
      .filter((value): value is string => Boolean(value)),
  ].filter(Boolean);

  await prisma.$transaction(async (tx) => {
    for (const duplicate of duplicates) {
      await tx.projectAssignment.updateMany({
        where: { staffId: duplicate.id },
        data: { staffId: primary.id },
      });

      await tx.user.updateMany({
        where: { staffId: duplicate.id },
        data: { staffId: primary.id },
      });
    }

    const updateData: Record<string, unknown> = {
      name: 'Sam',
      updatedAt: new Date(),
    };

    if (!primary.email && fallbackEmail) {
      updateData.email = fallbackEmail;
    }

    if (mergedNotes.length > 0) {
      const uniqueNotes = Array.from(new Set(mergedNotes));
      updateData.notes = uniqueNotes.join('\n\n');
    }

    await tx.staff.update({
      where: { id: primary.id },
      data: updateData,
    });

    for (const duplicate of duplicates) {
      await tx.staff.delete({ where: { id: duplicate.id } });
    }
  });

  console.log(
    `Merged ${duplicates.length} duplicate record(s) into staff ${primary.id} and renamed to Sam.`
  );
}

main()
  .catch((error) => {
    console.error('Failed to merge San/Samantha into Sam:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
