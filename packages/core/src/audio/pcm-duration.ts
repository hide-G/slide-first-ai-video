/**
 * PCM audio duration measurement.
 *
 * Polly outputs raw PCM audio (16-bit signed integers, mono).
 * Duration formula: durationMs = (fileSize / bytesPerSample) / sampleRate * 1000
 *
 * Default configuration:
 * - Sample rate: 24000 Hz
 * - Bit depth: 16 bits = 2 bytes per sample
 * - 24000 samples/sec * 2 bytes/sample = 48000 bytes/sec
 */

export interface PcmConfig {
  /** Sample rate in Hz (default: 24000) */
  sampleRate?: number;
  /** Bytes per sample (default: 2 for 16-bit) */
  bytesPerSample?: number;
}

const DEFAULT_SAMPLE_RATE = 24000;
const DEFAULT_BYTES_PER_SAMPLE = 2;

/**
 * Calculate audio duration in milliseconds from PCM file size.
 *
 * Formula: durationMs = (fileSize / bytesPerSample) / sampleRate * 1000
 *
 * Example: 288000 bytes at 24000 Hz, 16-bit:
 *   (288000 / 2) / 24000 * 1000 = 6000 ms
 */
export function calculatePcmDurationMs(
  fileSize: number,
  config?: PcmConfig,
): number {
  const sampleRate = config?.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const bytesPerSample = config?.bytesPerSample ?? DEFAULT_BYTES_PER_SAMPLE;

  if (fileSize < 0) {
    throw new Error("File size cannot be negative");
  }
  if (fileSize === 0) {
    return 0;
  }

  const totalSamples = fileSize / bytesPerSample;
  const durationMs = (totalSamples / sampleRate) * 1000;

  return durationMs;
}
