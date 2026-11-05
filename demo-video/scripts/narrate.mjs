import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const voiceId = '7EzWGsX10sAS4c9m9cPf';
const voiceName = 'Jack John - Conversational and Upbeat';
const model = 'eleven_multilingual_v2';
let key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  const content = await readFile(process.env.ELEVENLABS_KEY_FILE || '/home/greyw0rks/keys.txt', 'utf8');
  const candidates = [...new Set([...content.matchAll(/\bsk_[A-Za-z0-9_-]+/g)].map(m => m[0]))];
  if (candidates.length === 1) key = candidates[0];
}
if (!key) throw new Error('ElevenLabs credential is missing or ambiguous. Keep it outside the project.');
const headers = { 'xi-api-key': key, 'content-type': 'application/json' };
const voiceResponse = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, { headers, signal: AbortSignal.timeout(30_000) });
if (!voiceResponse.ok) throw new Error(`Voice access failed: HTTP ${voiceResponse.status}. Credentials suppressed.`);
const voice = await voiceResponse.json();
console.log(`Narration voice: ${voiceName}; API alias: ${voice.name}.`);
const scenes = JSON.parse(await readFile(path.join(root, 'scenes.json'), 'utf8'));
const output = path.join(root, 'assets/audio');
await mkdir(output, { recursive: true });
const manifest = { provider: 'ElevenLabs', voiceId, voiceName, apiAlias: voice.name, model, createdAt: new Date().toISOString(), scenes: [] };
for (const scene of scenes) {
  const hash = createHash('sha256').update(JSON.stringify({ text: scene.narration, voiceId, model })).digest('hex');
  const file = path.join(output, `${scene.id}.mp3`);
  let cached = false;
  try { cached = JSON.parse(await readFile(file + '.json', 'utf8')).hash === hash; await readFile(file); } catch {}
  if (!cached) {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
      method: 'POST', headers, signal: AbortSignal.timeout(55_000),
      body: JSON.stringify({ text: scene.narration, model_id: model, voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true } }),
    });
    if (!response.ok) throw new Error(`Narration failed for ${scene.id}: HTTP ${response.status}. Credentials suppressed.`);
    const result = await response.json();
    if (!result.audio_base64) throw new Error('No audio was returned.');
    await writeFile(file, Buffer.from(result.audio_base64, 'base64'));
    await writeFile(file + '.json', JSON.stringify({ hash, text: scene.narration, voiceId, model }, null, 2) + '\n');
    await writeFile(file + '.alignment.json', JSON.stringify({ alignment: result.alignment, normalized_alignment: result.normalized_alignment }, null, 2) + '\n');
  }
  const seconds = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8' }).trim());
  const duration = Math.ceil((seconds + 1.3) * 30) / 30;
  manifest.scenes.push({ id: scene.id, audio: `${scene.id}.mp3`, seconds, duration, narration: scene.narration });
  console.log(`${scene.id}: ${seconds.toFixed(2)} seconds${cached ? ' (cached)' : ''}`);
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
}
console.log('Narration assets ready.');
