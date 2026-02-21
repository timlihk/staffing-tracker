import 'dotenv/config';
import prisma from '../src/utils/prisma';
import { CanonicalProjectEventType, ProjectEventTriggerService } from '../src/services/project-event-trigger.service';

const PAUSED_STATUSES = new Set(['Suspended', 'Slow-down', 'On Hold']);

function mapStatusToEvent(status: string): string | null {
  if (status === 'Closed') return CanonicalProjectEventType.PROJECT_CLOSED;
  if (status === 'Terminated') return CanonicalProjectEventType.PROJECT_TERMINATED;
  if (PAUSED_STATUSES.has(status)) return CanonicalProjectEventType.PROJECT_PAUSED;
  return null;
}

function mapLifecycleStageToEvent(stage: string | null): string | null {
  if (!stage) return null;
  switch (stage.toLowerCase()) {
    case 'signed':
      return CanonicalProjectEventType.EL_SIGNED;
    case 'kickoff':
      return CanonicalProjectEventType.PROJECT_KICKOFF;
    case 'confidential_filed':
      return CanonicalProjectEventType.CONFIDENTIAL_FILING_SUBMITTED;
    case 'a1_filed':
      return CanonicalProjectEventType.A1_SUBMITTED;
    case 'hearing_passed':
      return CanonicalProjectEventType.HEARING_PASSED;
    case 'listed':
      return CanonicalProjectEventType.LISTING_COMPLETED;
    case 'renewal_cycle':
      return CanonicalProjectEventType.RENEWAL_CYCLE_STARTED;
    default:
      return null;
  }
}

async function main() {
  const dryRun = process.env.DRY_RUN === 'true';
  const limit = process.env.LIMIT ? Number.parseInt(process.env.LIMIT, 10) : undefined;
  if (limit !== undefined && Number.isNaN(limit)) {
    throw new Error('LIMIT must be a valid integer');
  }

  const projects = await prisma.project.findMany({
    where: { cmNumber: { not: null } },
    orderBy: { id: 'asc' },
    ...(limit ? { take: limit } : {}),
    select: {
      id: true,
      name: true,
      status: true,
      lifecycleStage: true,
    },
  });

  let eventCount = 0;
  let triggerCount = 0;
  let skippedExisting = 0;
  const details: Array<{
    projectId: number;
    projectName: string;
    eventType: string;
    triggersCreated: number;
    skippedExisting?: boolean;
  }> = [];

  for (const project of projects) {
    const eventTypes = new Set<string>();
    const statusEvent = mapStatusToEvent(project.status);
    if (statusEvent) eventTypes.add(statusEvent);
    const lifecycleEvent = mapLifecycleStageToEvent(project.lifecycleStage);
    if (lifecycleEvent) eventTypes.add(lifecycleEvent);

    for (const eventType of eventTypes) {
      const eventKey = `backfill:${project.id}:${eventType}`;

      if (dryRun) {
        details.push({ projectId: project.id, projectName: project.name, eventType, triggersCreated: 0 });
        eventCount += 1;
        continue;
      }

      const existingEvent = await (prisma as any).project_event.findUnique({
        where: { event_key: eventKey },
        select: { id: true },
      });

      if (existingEvent) {
        skippedExisting += 1;
        details.push({
          projectId: project.id,
          projectName: project.name,
          eventType,
          triggersCreated: 0,
          skippedExisting: true,
        });
        continue;
      }

      const result = await ProjectEventTriggerService.createProjectEvent({
        projectId: project.id,
        eventType,
        source: 'backfill',
        payload: { backfill: true },
        eventKey,
        processTriggers: true,
      });

      eventCount += 1;
      triggerCount += result.triggersCreated;
      details.push({
        projectId: project.id,
        projectName: project.name,
        eventType,
        triggersCreated: result.triggersCreated,
      });
    }
  }

  console.log(JSON.stringify({
    dryRun,
    projectsScanned: projects.length,
    eventsCreated: eventCount,
    eventsSkippedExisting: skippedExisting,
    triggersCreated: triggerCount,
    sample: details.slice(0, 50),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
