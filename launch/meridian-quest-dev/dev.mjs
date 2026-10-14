import {createQuestWorkspace, capabilities} from './quest-workspace.mjs';
import {createQuestCameraController, questCameraFailureMessage} from './quest-camera.mjs';
import {createQuestFeedback} from './quest-feedback.mjs';

/** Local memory only: no application state, account APIs, persistent storage or uploads. */
export function mountQuestDev({doc = document, win = window, createWorkspace = createQuestWorkspace, createCamera = createQuestCameraController, createFeedback = createQuestFeedback, checkCapabilities = capabilities, ImageClass = Image, urls = URL} = {}) {
  const el = id => doc.getElementById(id);
  let workspace = null, camera = null, feedback = null, active = false, pending = false, disposed = false;
  let support = {ar: false, vr: false}, photoURL = null, snapshotURL = null, photoEpoch = 0;
  const status = text => { el('status').textContent = text; };
  function refresh() {
    el('enter-ar').disabled = !workspace || !support.ar || active || pending || disposed;
    el('enter-vr').disabled = !workspace || !support.vr || active || pending || disposed;
    el('exit-xr').disabled = !active;
    el('snapshot').disabled = !workspace || pending || disposed;
    el('camera-start').disabled = !camera || active || pending || disposed || camera.getState() === 'requesting';
  }
  function syncFeedback(state) {
    el('sound').textContent = state.muted ? 'Sound off' : 'Sound on';
    el('sound').setAttribute('aria-pressed', String(state.muted));
    el('volume').value = String(state.volume * 100);
    el('haptics').checked = state.hapticsEnabled;
  }
  function clearPhoto() {
    photoEpoch++;
    workspace?.setReferenceImage(null);
    el('photo-preview').removeAttribute('src'); el('photo-preview').hidden = true;
    if (photoURL) urls.revokeObjectURL(photoURL); photoURL = null;
    el('clear-photo').disabled = true; el('photo').value = '';
    el('photo-status').textContent = 'No photo loaded. Your reference is cleared from this page.';
  }
  async function usePhoto(file) {
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw Error('Choose a JPG, PNG or WebP image.');
    if (!(file.size > 0 && file.size <= 15 * 1024 * 1024)) throw Error('Choose an image smaller than 15 MB.');
    const epoch = ++photoEpoch, url = urls.createObjectURL(file), image = new ImageClass();
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('The image took too long to open. Choose another file.')), 12000);
        image.onload = () => { clearTimeout(timer); resolve(); };
        image.onerror = () => { clearTimeout(timer); reject(Error('This image could not be opened.')); };
        image.src = url;
      });
      if (disposed || epoch !== photoEpoch) return false;
      if (!(image.naturalWidth > 0 && image.naturalHeight > 0) || image.naturalWidth * image.naturalHeight > 24000000) throw Error('Choose an image up to 24 megapixels.');
      workspace?.setReferenceImage(image);
      el('photo-preview').src = url; el('photo-preview').hidden = false;
      if (photoURL) urls.revokeObjectURL(photoURL); photoURL = url;
      el('clear-photo').disabled = false;
      el('photo-status').textContent = 'Photo loaded in memory only. Reload or Clear photo to remove it.';
      return true;
    } finally { image.onload = null; image.onerror = null; if (photoURL !== url) urls.revokeObjectURL(url); }
  }
  function clearSnapshot() {
    if (snapshotURL) urls.revokeObjectURL(snapshotURL); snapshotURL = null;
    el('download').hidden = true; el('download').removeAttribute('href');
  }
  try {
    feedback = createFeedback({volume: .35, muted: false, hapticsEnabled: false, documentObject: doc, onStateChange: syncFeedback});
    if (feedback) syncFeedback(feedback.getState());
    workspace = createWorkspace({canvas: el('workspace'), feedback, room: null, onStatus: status,
      onSessionChange: value => { active = value; if (!value) { camera?.stop('XR ended'); void feedback?.suspend(); } refresh(); },
      onSnapshot: blob => {
        if (disposed) return;
        clearSnapshot(); snapshotURL = urls.createObjectURL(blob); el('download').href = snapshotURL; el('download').hidden = false;
        status('Virtual snapshot ready. Exit XR and choose Download. It includes your reference photo, never passthrough imagery.');
      }
    });
  } catch (error) { status(error.message || 'WebGL is unavailable. Try an updated browser with graphics support.'); }
  try {
    camera = createCamera({video: el('camera-preview'), document: doc, window: win, onStateChange: state => {
      const preview = ['preview', 'capturing'].includes(state.state);
      el('camera-preview').hidden = !preview;
      el('camera-capture').disabled = state.state !== 'preview';
      el('camera-stop').disabled = state.state === 'idle';
      el('camera-status').textContent = state.message || ({idle: 'Camera is off.', requesting: 'Waiting for your camera permission…', preview: 'Live preview stays on this device. Choose Use this frame to add it.', capturing: 'Capturing a local frame…'}[state.state] || 'Camera is unavailable.');
      refresh();
    }});
  } catch { el('camera-status').textContent = 'Camera is unavailable. Choose a local photo instead.'; }
  async function enter(mode) {
    if (!workspace || active || pending || disposed) return;
    pending = true; refresh(); camera?.stop('Entering XR'); void feedback?.activate({userInitiated: true});
    try { await workspace.enter(mode); } catch (error) { status(error.message || 'Could not enter XR.'); }
    finally { pending = false; refresh(); }
  }
  el('enter-ar').onclick = () => void enter('immersive-ar');
  el('enter-vr').onclick = () => void enter('immersive-vr');
  el('exit-xr').onclick = () => { camera?.stop('Exiting XR'); void workspace?.end(); };
  el('snapshot').onclick = () => workspace?.requestSnapshot();
  el('photo').onchange = event => { const file = event.target.files?.[0]; if (file) void usePhoto(file).catch(error => { el('photo-status').textContent = error.message; }); event.target.value = ''; };
  el('clear-photo').onclick = clearPhoto;
  el('camera-start').onclick = () => {
    if (!camera || active || pending || disposed) return;
    void camera.start({userInitiated: true}).catch(error => { el('camera-status').textContent = questCameraFailureMessage(error); });
  };
  el('camera-capture').onclick = async () => {
    if (!camera || camera.getState() !== 'preview') return;
    el('camera-capture').disabled = true;
    try { const blob = await camera.capture(); await usePhoto(blob); camera.stop('Frame chosen'); }
    catch (error) { el('camera-status').textContent = error.message || 'Frame could not be used.'; }
    finally { el('camera-capture').disabled = camera.getState() !== 'preview'; }
  };
  el('camera-stop').onclick = () => camera?.stop('Stopped by you');
  for (const id of ['sound', 'volume', 'haptics', 'test-sound']) el(id).disabled = !feedback;
  el('sound').onclick = () => { feedback?.setMuted(!feedback.getState().muted); void feedback?.activate({userInitiated: true}); };
  el('volume').oninput = event => { feedback?.setVolume(Number(event.target.value) / 100); void feedback?.activate({userInitiated: true}); };
  el('haptics').onchange = event => { feedback?.setHapticsEnabled(Boolean(event.target.checked)); void feedback?.activate({userInitiated: true}); };
  el('test-sound').onclick = async () => { await feedback?.activate({userInitiated: true}); feedback?.play('complete'); };
  const ready = Promise.resolve().then(() => checkCapabilities()).then(value => {
    if (disposed) return; support = value;
    el('support').textContent = value.ar || value.vr ? 'Browser support: ' + [value.ar ? 'AR available' : 'AR unavailable', value.vr ? 'VR available' : 'VR unavailable'].join(' · ') + '. Entering XR requires your click and browser approval.' : value.reason || 'No immersive headset detected. Local photo preview and sound still work.';
    if (workspace) status(value.ar || value.vr ? 'Ready. Choose AR to measure or VR to view your local reference.' : 'Desktop preview ready. Open this link in Meta Quest Browser for AR measuring.');
    refresh();
  }).catch(() => { el('support').textContent = 'Could not check XR support. Try an updated Meta Quest Browser.'; refresh(); });
  const timer = setInterval(() => {
    const state = workspace?.getMeasurement();
    el('reading').textContent = state?.metres != null ? 'Approximate: ' + state.imperial + ' / ' + state.metric + '. Verify with a tape or laser.' : active ? 'Use Measure on the floating AR panel to place A and B.' : 'Measurements appear inside AR and clear when XR ends.';
  }, 500);
  const pagehide = () => { photoEpoch++; camera?.stop('Page closed'); void workspace?.end(); void feedback?.suspend(); clearPhoto(); clearSnapshot(); };
  win.addEventListener('pagehide', pagehide);
  refresh();
  return {ready, usePhoto, clearPhoto, async dispose() {
    if (disposed) return; disposed = true; clearInterval(timer); win.removeEventListener('pagehide', pagehide);
    clearPhoto(); clearSnapshot(); camera?.dispose(); await workspace?.dispose(); await feedback?.dispose(); refresh();
  }};
}

if (typeof document !== 'undefined') mountQuestDev();
