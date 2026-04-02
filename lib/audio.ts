
/**
 * UI Sound Utility using a Singleton Web Audio API Context
 * Optimized for mobile "User Gesture" requirements.
 */

let audioCtx: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioCtx) {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  return audioCtx;
};

/**
 * Browsers block audio until a user gesture occurs.
 * This is now called silently on primary interactions to keep the context warm.
 */
export const resumeAudioContext = async () => {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  } catch (e) {
    // Silent catch for audio context issues
  }
};

// Fix for multiple files: Update playSound type definition and implementation to include 'click'
export const playSound = async (type: 'success' | 'warning' | 'click') => {
  try {
    const ctx = getAudioContext();

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const now = ctx.currentTime + 0.01;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // Professional defaults
    osc.type = 'triangle';
    filter.type = 'lowpass';
    filter.frequency.value = 1200;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    // Default silent
    gain.gain.setValueAtTime(0, now);

    if (type === 'click') {
      osc.frequency.setValueAtTime(420, now);

      gain.gain.linearRampToValueAtTime(0.04, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

      osc.start(now);
      osc.stop(now + 0.07);
    }

    if (type === 'success') {
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.08);

      gain.gain.linearRampToValueAtTime(0.06, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      osc.start(now);
      osc.stop(now + 0.2);
    }

    if (type === 'warning') {
      osc.frequency.setValueAtTime(260, now);

      filter.frequency.setValueAtTime(800, now);

      gain.gain.linearRampToValueAtTime(0.07, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (e) {
    console.warn('Audio feedback failed:', e);
  }
};

