// Makes videos smaller before sending, like WhatsApp does: up to 720p at a
// bitrate that looks good on a phone. Uses the device's own video encoder
// (WebCodecs), so it's fast and nothing leaves the device until it's done.
// Loaded only when someone sends a video.
import {
  Input, Output, Conversion, BlobSource, BufferTarget, Mp4OutputFormat, ALL_FORMATS, canEncodeVideo, canEncodeAudio
} from './vendor/mediabunny.min.mjs';

const MAX_SIDE = 1280;       // 720p (1280×720 or 720×1280)
const VIDEO_BPS = 2_000_000; // ~15 MB a minute, sharp on a phone screen
const AUDIO_BPS = 128_000;

export function supported() {
  return typeof window.VideoEncoder === 'function' && typeof window.VideoDecoder === 'function';
}

// Returns a smaller File, or null if it's better to send the original
// (already small, can't be decoded/encoded here, or it wouldn't save much).
export async function compressVideo(file, { onProgress, onStart } = {}) {
  if (!supported()) return null;
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const video = await input.getPrimaryVideoTrack();
  if (!video) return null;
  const duration = await input.computeDuration();
  if (!duration || !isFinite(duration)) return null;
  const w = video.displayWidth; const h = video.displayHeight;
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const sourceBps = (file.size * 8) / duration;
  // Already about as small as we'd make it.
  if (scale === 1 && sourceBps < VIDEO_BPS * 1.6) return null;
  const outW = Math.max(2, Math.round((w * scale) / 2) * 2);
  const outH = Math.max(2, Math.round((h * scale) / 2) * 2);
  if (!(await canEncodeVideo('avc', { width: outW, height: outH, bitrate: VIDEO_BPS }))) return null;

  const audioTrack = await input.getPrimaryAudioTrack();
  const aacOk = await canEncodeAudio('aac', { bitrate: AUDIO_BPS }).catch(() => false);
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const conversion = await Conversion.init({
    input,
    output,
    video: { width: outW, height: outH, fit: 'contain', codec: 'avc', bitrate: VIDEO_BPS },
    // Keep AAC sound as it is; re-encode anything else to AAC where the browser can.
    audio: (track) => {
      if (track.codec === 'aac') return { codec: 'aac' };
      if (aacOk) return { codec: 'aac', bitrate: AUDIO_BPS };
      return undefined;
    }
  });
  if (!conversion.isValid) return null;
  // If the sound would be dropped, send the original instead.
  if (audioTrack && conversion.discardedTracks.some((d) => d.track === audioTrack)) return null;
  if (onStart) onStart(() => conversion.cancel());
  if (onProgress) conversion.onProgress = (p) => onProgress(Math.max(0, Math.min(1, p)));
  await conversion.execute();
  const buf = output.target.buffer;
  if (!buf || buf.byteLength > file.size * 0.8) return null;
  const name = /\.[a-z0-9]+$/i.test(file.name) ? file.name.replace(/\.[a-z0-9]+$/i, '.mp4') : `${file.name}.mp4`;
  return new File([buf], name, { type: 'video/mp4', lastModified: file.lastModified });
}
