import { useEffect, useRef } from 'react';
import { useUi } from '../navigation';
import { useStore } from '../store';
import { dailyToActivity, deleteSession, getDaily, getLive, getSets, linkReady, putSession, sessionPayload } from './relay';

const POLL_MS = 3000;

const describe = (e: unknown) => (e instanceof Error ? (e.name === 'AbortError' ? 'Tiempo de espera agotado' : e.message) : String(e));

/**
 * Keeps the real watch in step with the phone while the link is enabled:
 *  - pushes the active session (queue, rest rules, sets already logged) whenever it changes,
 *  - clears it on the relay when the session ends,
 *  - polls the sets recorded on the watch (and their HRR-60 updates) into the store,
 *  - polls the live heart rate / mode for the phone's live card.
 */
export function useWatchSync() {
  const link = useStore((s) => s.settings.watch);
  const session = useStore((s) => s.activeSession);
  const exercises = useStore((s) => s.exercises);
  const restSec = useStore((s) => s.settings.restSec);
  const hrThreshold = useStore((s) => s.settings.hrThreshold);
  const setWatch = useUi((s) => s.setWatch);
  const seq = useRef(0);
  const pushedId = useRef<string | null>(null);

  const ready = linkReady(link);
  const doneKey = session?.sets.map((l) => l.qi).join(',') ?? '';

  // Push the session whenever it starts or its logged sets change; delete it when it ends.
  useEffect(() => {
    if (!ready) {
      setWatch({ watchStatus: 'off', watchLive: null });
      return;
    }
    const ex = Object.fromEntries(exercises.map((e) => [e.id, e]));
    if (session) {
      if (pushedId.current !== session.id) seq.current = 0;
      putSession(link, sessionPayload(session, ex, { restSec, hrThreshold }))
        .then(() => {
          pushedId.current = session.id;
          setWatch({ watchStatus: 'ok', watchError: null });
        })
        .catch((e) => setWatch({ watchStatus: 'error', watchError: describe(e) }));
    } else if (pushedId.current) {
      deleteSession(link).then(() => (pushedId.current = null)).catch(() => {});
      setWatch({ watchLive: null });
    }
    // The payload only depends on these fields; `link` identity changes are covered by its parts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, link.serverUrl, link.code, session?.id, doneKey, restSec, hrThreshold]);

  // Daily wearable metrics (steps, sleep, resting HR) sent by the watch: on launch and every minute.
  useEffect(() => {
    if (!ready) return;
    let stop = false;
    const pull = async () => {
      try {
        const { days } = await getDaily(link);
        if (stop) return;
        const { setActivity } = useStore.getState();
        for (const [date, d] of Object.entries(days)) {
          const a = dailyToActivity(date, d);
          if (a) setActivity(a);
        }
      } catch {
        // Offline: the next pull catches up.
      }
    };
    pull();
    const id = setInterval(pull, 60000);
    return () => {
      stop = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, link.serverUrl, link.code]);

  // Poll the watch's sets and live state during a session.
  useEffect(() => {
    if (!ready || !session) return;
    let stop = false;
    const poll = async () => {
      try {
        const r = await getSets(link, seq.current);
        const state = useStore.getState();
        const active = state.activeSession;
        // The relay lost or never got this session (URL changed, server restarted): push it again.
        if (active && r.sessionId !== active.id) {
          const ex = Object.fromEntries(state.exercises.map((e) => [e.id, e]));
          await putSession(link, sessionPayload(active, ex, state.settings));
          pushedId.current = active.id;
          seq.current = 0;
        } else if (active) {
          for (const { seq: _ignored, ...log } of r.sets) useStore.getState().upsertSet(log); // eslint-disable-line @typescript-eslint/no-unused-vars
          seq.current = r.seq;
        }
        const { live } = await getLive(link);
        if (!stop) setWatch({ watchStatus: 'ok', watchError: null, watchLive: live && Date.now() - live.at < 20000 ? live : null });
      } catch (e) {
        if (!stop) setWatch({ watchStatus: 'error', watchError: describe(e) });
      }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      stop = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, link.serverUrl, link.code, session?.id]);
}
