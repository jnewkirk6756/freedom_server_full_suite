/* Generic WebXR lifetime management. No rendering or application-state writes. */
(function (root) {
  'use strict';
  function create({ request, prepare, started = () => {}, stopped = () => {}, failed = () => {} }) {
    let state = 'idle', current = null, generation = 0, stopping = null, endingReason = null, requestCompletion = null;
    const status = () => ({ state, session: current, busy: state !== 'idle' || Boolean(stopping) });
    function finish(target, reason) {
      if (current !== target) return;
      current = null; state = 'idle'; endingReason = null; generation++;
      stopped(reason);
    }
    async function stop(reason = 'exit') {
      if (stopping) return stopping;
      generation++;
      if (!current) {
        // Retain the busy latch until a pending request settles. A late session
        // must be ended before another request is allowed.
        if (state === 'requesting') state = 'cancelling';
        if (state === 'cancelling' && requestCompletion) await requestCompletion;
        return current === null;
      }
      const target = current;
      state = 'ending'; endingReason = reason;
      stopping = (async () => {
        try {
          await Promise.resolve().then(() => target.end());
          finish(target, reason);
          return true;
        } catch (error) {
          if (current === target) { state = 'error'; failed(error, 'end'); }
          return current !== target;
        } finally { stopping = null; }
      })();
      return stopping;
    }
    async function start() {
      if (state !== 'idle' || stopping) return false;
      const token = ++generation;
      state = 'requesting';
      let resolveRequest;
      const completion = new Promise(resolve => { resolveRequest = resolve; });
      requestCompletion = completion;
      let target;
      try {
        target = await request();
        current = target;
        // Listen immediately, before any awaited GPU/reference-space setup.
        target.addEventListener('end', () => finish(target, endingReason || 'session-ended'), { once: true });
        if (generation !== token) { await stop('cancelled-start'); return false; }
        state = 'starting';
        const isCurrent = () => current === target && generation === token && state === 'starting';
        await prepare(target, isCurrent);
        if (!isCurrent()) return false;
        state = 'active';
        started(target);
        return true;
      } catch (error) {
        if (target && current === target) {
          failed(error, 'start');
          await stop('setup-failed');
        } else if (!target) {
          state = 'idle';
          if (generation === token) failed(error, 'request');
        }
        return false;
      } finally {
        if (requestCompletion === completion) requestCompletion = null;
        resolveRequest();
      }
    }
    return Object.freeze({ start, stop, status });
  }
  root.NocturneXRSession = Object.freeze({ create });
})(globalThis);
