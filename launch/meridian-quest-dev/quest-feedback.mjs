/**
 * Local, procedural Quest interaction cues. No files, network, microphone, storage,
 * background soundtrack, or global page event handlers. One owner per workspace.
 * Call activate({userInitiated:true}) directly inside a real click/XR select handler.
 * Never await activation before requesting an immersive session: both need the gesture.
 */
const clamp = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
const CUES = Object.freeze({
  select: {gap:70, haptic:[.12,14], notes:[[0,780,650,.055,.18,'sine'],[.006,1560,1300,.042,.025,'sine']]},
  snap: {gap:120, haptic:[.22,24], notes:[[0,880,880,.095,.18,'sine'],[.012,1320,1320,.12,.08,'sine']]},
  complete: {gap:400, haptic:[.28,36], notes:[[0,660,660,.16,.14,'sine'],[.065,880,880,.19,.13,'sine'],[.13,1320,1320,.23,.09,'sine']]},
  error: {gap:300, haptic:[.1,24], notes:[[0,330,294,.095,.12,'triangle'],[.08,247,220,.12,.1,'sine']]},
});

export function createQuestFeedback({
  AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext,
  documentObject = globalThis.document,
  now = () => globalThis.performance?.now?.() ?? Date.now(),
  onStateChange = () => {}, volume = .35, muted = false, hapticsEnabled = false,
} = {}) {
  let context = null, master = null, activated = false, disposed = false;
  let currentVolume = clamp(volume, .35), isMuted = Boolean(muted), haptics = Boolean(hapticsEnabled);
  let activationEpoch = 0, resumePending = null, closing = null, lastCue = -Infinity, lastHaptic = -Infinity;
  const voices = new Set(), perCue = new Map();
  const supported = typeof AudioContextClass === 'function';
  const visible = () => !documentObject?.hidden;
  const getState = () => ({supported, activated, muted:isMuted, volume:currentVolume, hapticsEnabled:haptics, contextState:context?.state || (disposed?'closed':'uninitialized'), disposed});
  const notify = () => {try {onStateChange(getState());} catch { /* UI callbacks cannot break measurement input. */ }};
  const releaseVoice = voice => {
    voices.delete(voice);voice.oscillator.onended = null;
    try {voice.oscillator.disconnect();} catch {}
    try {voice.envelope.disconnect();} catch {}
  };
  const stopVoices = () => {
    for (const voice of [...voices]) {
      try {voice.oscillator.stop();} catch {}
      releaseVoice(voice);
    }
  };
  function updateGain() {
    if (!master || !context || context.state === 'closed') return;
    try {
      const value = isMuted ? 0 : currentVolume * .55;
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setTargetAtTime(value, context.currentTime, .008);
    } catch {}
  }
  function contextChanged() {
    if (context?.state !== 'running') stopVoices();
    notify();
  }
  async function activate({userInitiated = false} = {}) {
    if (!userInitiated || disposed || !visible()) return false;
    activated = true; // Haptics can work when WebAudio is unsupported.
    if (!supported) {notify();return false;}
    if (resumePending?.epoch === activationEpoch) return resumePending.promise;
    const epoch = activationEpoch;
    try {
      if (!context || context.state === 'closed') {
        context?.removeEventListener?.('statechange', contextChanged);
        try {master?.disconnect();} catch {}
        const next = new AudioContextClass({latencyHint:'interactive'});
        let gain;
        try {
          gain = next.createGain();
          gain.gain.setValueAtTime(isMuted ? 0 : currentVolume * .55, next.currentTime);
          gain.connect(next.destination);
        } catch (error) {
          try {gain?.disconnect();} catch {}
          try {Promise.resolve(next.close()).catch(() => {});} catch {}
          throw error;
        }
        context = next;master = gain;
        context.addEventListener?.('statechange', contextChanged);
      }
      // Call resume synchronously, while the initiating gesture is still active.
      const result = context.state === 'running' ? null : context.resume();
      notify();
      const operation = Promise.resolve(result).then(async () => {
        if (disposed || epoch !== activationEpoch || !visible()) {
          if (!disposed && (!activated || !visible()) && context?.state === 'running') {try {await context.suspend();} catch {}}
          return false;
        }
        notify();return context?.state === 'running';
      }, () => {notify();return false;});
      const pending = {epoch,promise:operation};resumePending = pending;
      try {return await operation;} finally {if (resumePending === pending) resumePending = null;}
    } catch {
      // A missing/blocked implementation must never block the actual AR action.
      notify();return false;
    }
  }
  function pulse(cue, inputSource, timestamp) {
    if (!haptics || !inputSource || timestamp-lastHaptic < 90) return false;
    // Only the controller supplied by the already authorized XR interaction.
    // No global gamepad enumeration, navigator.vibrate, or permission requests.
    const actuator = inputSource.gamepad?.hapticActuators?.[0];
    if (typeof actuator?.pulse !== 'function') return false;
    try {
      lastHaptic = timestamp;
      Promise.resolve(actuator.pulse(...cue.haptic)).catch(() => {});
      return true;
    } catch {return false;}
  }
  function play(type, {inputSource = null} = {}) {
    const cue = Object.hasOwn(CUES,type) ? CUES[type] : null;
    if (!cue || disposed || !activated || !visible()) return false;
    const timestamp = now();
    if (!Number.isFinite(timestamp) || timestamp-lastCue < 35 || timestamp-(perCue.get(type) ?? -Infinity) < cue.gap) return false;
    const canSound = !isMuted && currentVolume > 0 && context?.state === 'running' && master;
    const canPulse = haptics && typeof inputSource?.gamepad?.hapticActuators?.[0]?.pulse === 'function';
    if (!canSound && !canPulse) return false;
    lastCue = timestamp;perCue.set(type,timestamp);
    const pulsed = pulse(cue, inputSource, timestamp);
    if (!canSound) return pulsed;
    // Cap simultaneous voices under repeated inputs. Complete/error stay short.
    while (voices.size + cue.notes.length > 10) {
      const oldest = voices.values().next().value;
      try {oldest.oscillator.stop();} catch {}
      releaseVoice(oldest);
    }
    const created = [];
    try {
      const start = context.currentTime + .003;
      for (const [delay,frequency,endFrequency,duration,level,wave] of cue.notes) {
        const oscillator = context.createOscillator();
        const voice = {oscillator,envelope:null};created.push(voice);voices.add(voice);
        const envelope = context.createGain();voice.envelope = envelope;
        const time = start + delay;
        oscillator.type = wave;
        oscillator.frequency.setValueAtTime(frequency,time);
        oscillator.frequency.exponentialRampToValueAtTime(endFrequency,time+duration);
        envelope.gain.setValueAtTime(0,time);
        envelope.gain.linearRampToValueAtTime(level,time+.006);
        envelope.gain.exponentialRampToValueAtTime(.0001,time+duration);
        envelope.gain.linearRampToValueAtTime(0,time+duration+.008);
        oscillator.connect(envelope);envelope.connect(master);
        oscillator.onended = () => releaseVoice(voice);
        oscillator.start(time);oscillator.stop(time+duration+.012);
      }
      return true;
    } catch {
      for (const voice of created) {try {voice.oscillator.stop();} catch {}releaseVoice(voice);}
      return pulsed;
    }
  }
  async function suspend() {
    if (disposed) return;
    activationEpoch++;activated = false;stopVoices();
    try {if (context && context.state !== 'closed') await context.suspend();} catch {}
    notify();
  }
  function setMuted(value) {
    if (disposed) return;
    isMuted = Boolean(value);if (isMuted) stopVoices();updateGain();notify();
  }
  function setVolume(value) {
    if (disposed) return;
    currentVolume = clamp(value,currentVolume);if (currentVolume === 0) stopVoices();updateGain();notify();
  }
  function setHapticsEnabled(value) {if (!disposed) {haptics = Boolean(value);notify();}}
  function dispose() {
    if (closing) return closing;
    disposed = true;activated = false;activationEpoch++;stopVoices();
    documentObject?.removeEventListener?.('visibilitychange', visibilityChanged);
    context?.removeEventListener?.('statechange', contextChanged);
    try {master?.disconnect();} catch {}
    closing = (async () => {try {if (context && context.state !== 'closed') await context.close();} catch {}notify();})();
    return closing;
  }
  function visibilityChanged() {if (!visible()) void suspend();}
  documentObject?.addEventListener?.('visibilitychange', visibilityChanged);
  return {activate,play,suspend,dispose,setMuted,setVolume,setHapticsEnabled,getState};
}

/** Canvas palette matches the Quest-only DOM controls; static states never animate. */
export function questButtonPalette({hovered=false,pressed=false,selected=false,disabled=false,tone='default'}={}) {
  if (disabled) return {fill:'#172733',stroke:'#3f5966',text:'#96abb5',detail:'#829aa6',accent:'#607d89'};
  if (pressed) return {fill:'#123d48',stroke:'#c5fff3',text:'#ffffff',detail:'#c5f5ef',accent:'#a6fff0'};
  if (tone==='danger') return {fill:hovered?'#573345':'#352939',stroke:hovered?'#ffc3ce':'#976370',text:'#ffe5eb',detail:'#dec0ca',accent:'#ffb0c0'};
  if (selected) return {fill:hovered?'#225766':'#19464f',stroke:'#7aead7',text:'#ecfff9',detail:'#bce9df',accent:'#86f5d4'};
  return {fill:hovered?'#274c5e':'#1b3443',stroke:hovered?'#b6e9f2':'#547586',text:'#effaff',detail:'#b6ced9',accent:'#78cfe2'};
}

/** Optional canvas helper. Pointer hit tests belong to the workspace's scene logic. */
export function drawQuestButton(ctx,{x,y,width,height,label,detail='',hovered=false,pressed=false,selected=false,disabled=false,tone='default'}={}) {
  const colors=questButtonPalette({hovered,pressed,selected,disabled,tone});
  ctx.save();ctx.beginPath();
  if(typeof ctx.roundRect==='function')ctx.roundRect(x,y,width,height,Math.min(16,height/4));else ctx.rect(x,y,width,height);
  ctx.fillStyle=colors.fill;ctx.fill();ctx.strokeStyle=colors.stroke;ctx.lineWidth=pressed?3:1.5;ctx.stroke();
  ctx.save();ctx.clip();
  ctx.fillStyle=colors.accent;ctx.fillRect(x+18,y+18,3,Math.max(12,height-36));
  ctx.textBaseline='middle';ctx.textAlign='left';ctx.fillStyle=colors.text;
  ctx.font='600 25px system-ui';ctx.fillText(label,x+34,y+height*(detail?.37:.5),width-49);
  if(detail){ctx.fillStyle=colors.detail;ctx.font='18px system-ui';ctx.fillText(detail,x+34,y+height*.7,width-49);}
  ctx.restore();ctx.restore();return colors;
}
