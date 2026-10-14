/** Real environment-camera photos only. No XR canvas, upload, storage or AI calls. */
const cameraError = (name, message) => Object.assign(new Error(message), {name});
export function questCameraFailureMessage(error) {
  return ({
    NotAllowedError: 'Camera permission was not granted. Use the browser permission controls, then explicitly try again, or attach a photo.',
    SecurityError: 'The browser blocked camera access. Open this app over HTTPS, or attach a photo.',
    NotSupportedError: 'Real-world camera access is unavailable in this browser. Update Meta Quest Browser or attach a photo.',
    NotFoundError: 'No real-world environment camera is available. Attach a photo instead.',
    OverconstrainedError: 'This browser could not provide the real-world environment camera. Attach a photo instead.',
    NotReadableError: 'The real-world camera could not provide a photo. Close other camera use and explicitly try again, or attach a photo.',
    TimeoutError: 'The camera did not become ready in time. Camera use was stopped. Explicitly try again, or attach a photo.',
    AbortError: 'Camera capture was cancelled. No photo was saved.',
    InvalidStateError: 'Open the camera preview before taking a photo.'
  })[error?.name] || 'The real-world camera could not capture a photo. Explicitly try again, or attach a photo.';
}

export function createQuestCameraController({
  video,
  mediaDevices = globalThis.navigator?.mediaDevices,
  document: doc = globalThis.document,
  window: win = globalThis.window,
  userActivation = globalThis.navigator?.userActivation,
  secureContext = globalThis.isSecureContext,
  onStateChange = () => {},
  createCanvas = () => doc.createElement('canvas'),
  timeoutMs = 12000,
  captureTimeoutMs = 8000,
  maxDimension = 4096
} = {}) {
  if (!video) throw new TypeError('A local preview video element is required.');
  for (const value of [timeoutMs, captureTimeoutMs, maxDimension]) {
    if (!Number.isFinite(value) || value <= 0) throw new TypeError('Camera limits must be positive finite numbers.');
  }
  let state = 'idle', stream = null, generation = 0, disposed = false;
  let cancelPending = null, trackCleanups = [];
  const notify = (next, extra = {}) => {
    state = next;
    try { onStateChange({state, ...extra}); } catch { /* A view failure must not leak camera access. */ }
  };
  const stopTracks = source => { for (const track of source?.getTracks?.() || []) { try { track.stop(); } catch {} } };
  const release = () => {
    trackCleanups.splice(0).forEach(fn => fn());
    stopTracks(stream); stream = null;
    try { video.pause(); } catch {}
    video.srcObject = null;
  };
  const stop = (reason = 'cancelled') => {
    generation++;
    const cancel = cancelPending; cancelPending = null;
    cancel?.(cameraError('AbortError', 'Camera capture was cancelled.'));
    release(); notify('idle', {reason});
  };
  function bounded(work, milliseconds) {
    return new Promise((resolve, reject) => {
      let finished = false;
      const finish = (fn, value) => {
        if (finished) return;
        finished = true; clearTimeout(timer);
        if (cancelPending === cancel) cancelPending = null;
        fn(value);
      };
      const cancel = error => finish(reject, error);
      const timer = setTimeout(() => cancel(cameraError('TimeoutError', 'Camera operation timed out.')), milliseconds);
      cancelPending = cancel;
      Promise.resolve(work).then(value => finish(resolve, value), error => finish(reject, error));
    });
  }
  const assertCurrent = token => {
    if (disposed || token !== generation || doc?.visibilityState === 'hidden') throw cameraError('AbortError', 'Camera capture was cancelled.');
  };
  const fail = (error, token) => {
    if (token === generation && !disposed) {
      generation++; release();
      notify('error', {error, message: questCameraFailureMessage(error)});
    }
    throw error;
  };
  async function start({userInitiated = false} = {}) {
    if (disposed) throw cameraError('AbortError', 'Camera controller was closed.');
    if (!userInitiated || userActivation?.isActive === false) throw cameraError('NotAllowedError', 'Camera access requires an explicit user click.');
    if (state === 'requesting' || state === 'capturing') throw cameraError('InvalidStateError', 'Camera operation is already in progress.');
    if (state === 'preview') return true;
    const token = ++generation;
    let readinessTimer, cleanupReadiness = () => {};
    try {
      assertCurrent(token);
      if (secureContext === false) throw cameraError('SecurityError', 'Camera access requires HTTPS.');
      if (!mediaDevices?.getUserMedia) throw cameraError('NotSupportedError', 'Environment camera API unavailable.');
      notify('requesting');
      assertCurrent(token);
      // Invoke synchronously from the click; never retry with a front/avatar/default camera.
      const requested = mediaDevices.getUserMedia({audio: false, video: {facingMode: {exact: 'environment'}}});
      const acquisition = Promise.resolve(requested).then(result => {
        if (token !== generation || disposed) { stopTracks(result); throw cameraError('AbortError', 'Camera request was cancelled.'); }
        stream = result;
        return result;
      });
      await bounded((async () => {
        const acquired = await acquisition;
        assertCurrent(token);
        const tracks = acquired.getVideoTracks?.() || [];
        if (!tracks.length || tracks.some(track => track.readyState === 'ended') || acquired.active === false) throw cameraError('NotReadableError', 'No live camera stream.');
        if (tracks.some(track => { const facing = track.getSettings?.().facingMode; return facing && facing !== 'environment'; })) throw cameraError('OverconstrainedError', 'Environment camera unavailable.');
        for (const track of acquired.getTracks()) {
          const ended = () => stop('camera-ended');
          track.addEventListener?.('ended', ended);
          trackCleanups.push(() => track.removeEventListener?.('ended', ended));
        }
        video.muted = true; video.playsInline = true; video.autoplay = true; video.srcObject = acquired;
        await video.play();
        assertCurrent(token);
        await new Promise((resolve, reject) => {
          const check = () => {
            try {
              assertCurrent(token);
              if (tracks.some(track => track.readyState === 'ended')) throw cameraError('NotReadableError', 'Camera stream ended.');
              if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0 && tracks.every(track => !track.muted)) { cleanupReadiness(); resolve(); }
            } catch (error) { cleanupReadiness(); reject(error); }
          };
          const failed = () => { cleanupReadiness(); reject(cameraError('NotReadableError', 'Camera preview failed.')); };
          cleanupReadiness = () => { clearInterval(readinessTimer); video.removeEventListener?.('loadeddata', check); video.removeEventListener?.('error', failed); };
          video.addEventListener?.('loadeddata', check); video.addEventListener?.('error', failed);
          readinessTimer = setInterval(check, 50); check();
        });
      })(), timeoutMs);
      assertCurrent(token); notify('preview'); return true;
    } catch (error) { return fail(error, token); }
    finally { cleanupReadiness(); }
  }
  async function capture() {
    if (disposed || state !== 'preview' || !stream) throw cameraError('InvalidStateError', 'No camera preview.');
    const token = generation;
    let canvas;
    try {
      assertCurrent(token);
      if (video.readyState < 2 || !(video.videoWidth > 0 && video.videoHeight > 0) || stream.active === false || stream.getVideoTracks().some(t => t.readyState === 'ended' || t.muted)) throw cameraError('NotReadableError', 'No real camera frame.');
      notify('capturing');
      assertCurrent(token);
      canvas = createCanvas();
      const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale)); canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw cameraError('NotReadableError', 'Camera image conversion unavailable.');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await bounded(new Promise((resolve, reject) => {
        canvas.toBlob(result => result?.size > 0 && result.type === 'image/jpeg' ? resolve(result) : reject(cameraError('NotReadableError', 'Camera image conversion failed.')), 'image/jpeg', 0.92);
      }), captureTimeoutMs);
      assertCurrent(token); notify('preview'); return blob;
    } catch (error) { return fail(error, token); }
    finally { if (canvas) { canvas.width = 0; canvas.height = 0; } }
  }
  const onVisibility = () => { if (doc?.visibilityState === 'hidden') stop('background'); };
  const onPageHide = () => stop('page-exit');
  doc?.addEventListener?.('visibilitychange', onVisibility);
  win?.addEventListener?.('pagehide', onPageHide);
  return {
    start, capture, stop,
    getState: () => state,
    dispose() {
      if (disposed) return;
      disposed = true; stop('disposed');
      doc?.removeEventListener?.('visibilitychange', onVisibility);
      win?.removeEventListener?.('pagehide', onPageHide);
    }
  };
}
