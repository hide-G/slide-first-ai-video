/**
 * PCM duration calculation and WAV header generation.
 *
 * Used to compute exact audio durations from Polly's raw PCM output
 * and to wrap PCM data with a standard WAV header for MediaConvert input.
 */

/**
 * Calculate the duration of raw PCM audio data in seconds.
 *
 * Formula: pcmByteLength / (bitsPerSample/8 * channels * sampleRate)
 *
 * @param pcmByteLength - Total size of raw PCM data in bytes
 * @param sampleRate - Sample rate in Hz (e.g. 24000 for Polly)
 * @param bitsPerSample - Bits per sample (e.g. 16)
 * @param channels - Number of audio channels (e.g. 1 for mono)
 * @returns Duration in seconds
 */
export function calculatePcmDurationSec(
  pcmByteLength: number,
  sampleRate: number,
  bitsPerSample: number,
  channels: number,
): number {
  const bytesPerSample = bitsPerSample / 8;
  const bytesPerSecond = bytesPerSample * channels * sampleRate;
  return pcmByteLength / bytesPerSecond;
}

/**
 * Create a standard 44-byte RIFF/WAVE header for PCM audio data.
 *
 * Produces a valid WAV file header that can be prepended to raw PCM data.
 * Uses PCM format (audioFormat = 1), no compression.
 *
 * @param pcmByteLength - Total size of raw PCM data in bytes
 * @param sampleRate - Sample rate in Hz (e.g. 24000)
 * @param bitsPerSample - Bits per sample (e.g. 16)
 * @param channels - Number of audio channels (e.g. 1 for mono)
 * @returns 44-byte Buffer containing the WAV header
 */
export function createWavHeader(
  pcmByteLength: number,
  sampleRate: number,
  bitsPerSample: number,
  channels: number,
): Buffer {
  const header = Buffer.alloc(44);
  const bytesPerSample = bitsPerSample / 8;
  const byteRate = sampleRate * channels * bytesPerSample;
  const blockAlign = channels * bytesPerSample;

  // RIFF chunk descriptor
  header.write("RIFF", 0);                          // ChunkID
  header.writeUInt32LE(36 + pcmByteLength, 4);      // ChunkSize (file size - 8)
  header.write("WAVE", 8);                          // Format

  // fmt sub-chunk
  header.write("fmt ", 12);                         // Subchunk1ID
  header.writeUInt32LE(16, 16);                     // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20);                      // AudioFormat (1 = PCM)
  header.writeUInt16LE(channels, 22);               // NumChannels
  header.writeUInt32LE(sampleRate, 24);             // SampleRate
  header.writeUInt32LE(byteRate, 28);               // ByteRate
  header.writeUInt16LE(blockAlign, 32);             // BlockAlign
  header.writeUInt16LE(bitsPerSample, 34);          // BitsPerSample

  // data sub-chunk
  header.write("data", 36);                         // Subchunk2ID
  header.writeUInt32LE(pcmByteLength, 40);          // Subchunk2Size

  return header;
}
