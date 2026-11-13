import { useCallback } from 'react';
import type { PlannedBlock } from '../domain/types';
import type { EditCtx } from '../engines/planEdit';
import { useStore } from '../store';
import { useDerived } from '../store/derived';

/**
 * Edits today's session: the first edit turns the generated plan into a saved draft for today
 * (so it survives regenerations), later edits update it.
 */
export function usePlanEditor() {
  const { plan, planName, ex, deload, today } = useDerived();
  const sessions = useStore((s) => s.sessions);
  const restSec = useStore((s) => s.settings.restSec);
  const draft = useStore((s) => s.planDraft);
  const setPlanDraft = useStore((s) => s.setPlanDraft);
  const ctx: EditCtx = { ex, history: sessions, deload, restSec };

  const apply = useCallback(
    (fn: (blocks: PlannedBlock[]) => PlannedBlock[]) => {
      const keep = draft?.date === today ? draft : undefined;
      setPlanDraft({ date: today, blocks: fn(plan), name: keep?.name, routineId: keep?.routineId });
    },
    [draft, today, plan, setPlanDraft],
  );

  return { blocks: plan, planName, ctx, apply, edited: !!planName, reset: () => setPlanDraft(undefined) };
}
