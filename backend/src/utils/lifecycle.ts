import { LIFECYCLE_STAGE_ORDER, type LifecycleStage } from '../constants';

/**
 * Returns intermediate lifecycle stages that were skipped in a forward transition.
 * Excludes the `from` stage and excludes the `to` stage (those are handled separately).
 * Returns empty array for backward transitions, unknown stages, or null inputs.
 */
export function getIntermediateStages(
  fromStage: string | null | undefined,
  toStage: string | null | undefined
): string[] {
  if (!fromStage || !toStage) return [];

  const fromIndex = LIFECYCLE_STAGE_ORDER.indexOf(fromStage as LifecycleStage);
  const toIndex = LIFECYCLE_STAGE_ORDER.indexOf(toStage as LifecycleStage);

  if (fromIndex === -1 || toIndex === -1 || toIndex <= fromIndex) return [];

  return LIFECYCLE_STAGE_ORDER.slice(fromIndex + 1, toIndex) as unknown as string[];
}

/**
 * Returns true if the transition moves to an earlier lifecycle stage.
 */
export function isBackwardTransition(
  fromStage: string | null | undefined,
  toStage: string | null | undefined
): boolean {
  if (!fromStage || !toStage) return false;

  const fromIndex = LIFECYCLE_STAGE_ORDER.indexOf(fromStage as LifecycleStage);
  const toIndex = LIFECYCLE_STAGE_ORDER.indexOf(toStage as LifecycleStage);

  if (fromIndex === -1 || toIndex === -1) return false;

  return toIndex < fromIndex;
}
