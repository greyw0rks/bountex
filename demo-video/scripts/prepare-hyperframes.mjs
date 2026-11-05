import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const project = path.join(root, 'hyperframes');
const scenes = JSON.parse(await readFile(path.join(root, 'scenes.json'), 'utf8'));
const timing = JSON.parse(await readFile(path.join(root, 'assets/audio/manifest.json'), 'utf8'));
const captures = JSON.parse(
  await readFile(path.join(root, 'assets/capture-manifest.json'), 'utf8'),
);
assert.equal(captures.scenes.length, scenes.length);
assert.ok(captures.scenes.every((scene) => scene.noNimTransferred && scene.pageErrors === 0));
for (const directory of [
  'compositions',
  'assets/clips',
  'assets/audio',
  'assets/fonts',
  'assets/brand',
])
  await mkdir(path.join(project, directory), { recursive: true });
await mkdir(path.join(root, 'output'), { recursive: true });
const app = path.dirname(root);
await copyFile(
  path.join(app, 'public/brand/bountex-icon.png'),
  path.join(project, 'assets/brand/icon.png'),
);
await copyFile(
  path.join(
    app,
    'node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2',
  ),
  path.join(project, 'assets/fonts/display.woff2'),
);
await copyFile(
  path.join(app, 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'),
  path.join(project, 'assets/fonts/body.woff2'),
);
const title = {
  opening: 'Small tasks. Useful work. NIM rewards.',
  explore: 'Find something worth doing.',
  create: 'Post a clear mission.',
  claim: 'Read it. Claim it. Get to work.',
  submit: 'Show what you completed.',
  review: 'Review the work. Keep it moving.',
  receipt: 'A sample receipt. Clearly labeled.',
  closing: 'Good work pays.',
};
const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const timestamp = (seconds, separator = ',') => {
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}${separator}${String(ms % 1000).padStart(3, '0')}`;
};
const subtitles = [],
  audioParts = [],
  hosts = [],
  manifest = [];
let cursor = 0;
for (const [index, scene] of scenes.entries()) {
  const duration = timing.scenes.find((s) => s.id === scene.id).duration;
  const alignment = JSON.parse(
    await readFile(path.join(root, `assets/audio/${scene.id}.mp3.alignment.json`), 'utf8'),
  ).normalized_alignment;
  assert.ok(alignment?.characters?.length);
  let chars = alignment.characters;
  let end = duration;
  // Retain the factual opening sentence of the saved closing narration. The builder
  // has since confirmed native login, so the old "next acceptance checks" is removed.
  if (scene.id === 'closing') {
    const sentenceEnd = chars.indexOf('.');
    end = alignment.character_end_times_seconds[sentenceEnd] + 0.08;
    chars = chars.slice(0, sentenceEnd + 1);
  }
  const audioFile = path.join(project, `assets/audio/${scene.id}.wav`);
  execFileSync('ffmpeg', [
    '-y',
    '-v',
    'error',
    '-i',
    path.join(root, `assets/audio/${scene.id}.mp3`),
    '-af',
    `atrim=end=${end},adelay=300|300,apad`,
    '-t',
    String(duration),
    '-ar',
    '48000',
    '-ac',
    '2',
    audioFile,
  ]);
  audioParts.push(audioFile);
  execFileSync('ffmpeg', [
    '-y',
    '-v',
    'error',
    '-i',
    path.join(root, `assets/clips/${scene.id}.mp4`),
    '-vf',
    'tpad=stop_mode=clone:stop_duration=0.2',
    '-t',
    String(duration),
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    path.join(project, `assets/clips/${scene.id}.mp4`),
  ]);
  let start = 0;
  while (start < chars.length) {
    let finish = start,
      spaces = 0;
    while (finish < chars.length && finish - start < 80) {
      if (chars[finish] === ' ') spaces++;
      finish++;
      if (spaces >= 9 || (finish - start > 30 && /[.!?]/.test(chars[finish - 1]))) break;
    }
    const text = chars.slice(start, finish).join('').trim();
    if (text)
      subtitles.push({
        from: cursor + 0.3 + alignment.character_start_times_seconds[start],
        to: cursor + 0.3 + alignment.character_end_times_seconds[finish - 1],
        text,
      });
    start = finish;
  }
  const subtitle = scene.id === 'closing' ? 'bountex.vercel.app' : scene.subtitle;
  const note =
    scene.id === 'closing'
      ? 'Signed login confirmed by builder · Live reward transfer still to be tested'
      : 'Recorded preview workflow · Sample tasks and receipt · No NIM transferred';
  const vars = JSON.stringify([
    { id: 'title', type: 'string', label: 'Title', default: title[scene.id] },
    { id: 'subtitle', type: 'string', label: 'Subtitle', default: subtitle },
  ]);
  await writeFile(
    path.join(project, `compositions/${scene.id}.html`),
    `<template>
<style>
@font-face{font-family:'Bountex Display';src:url('assets/fonts/display.woff2') format('woff2');font-weight:300 700}
@font-face{font-family:'Bountex Body';src:url('assets/fonts/body.woff2') format('woff2');font-weight:100 900}
#root{position:absolute;inset:0;background:#090d18;color:#f1f4ff;font-family:'Bountex Body',sans-serif}
.brand{position:absolute;left:140px;top:78px;display:flex;align-items:center;gap:16px;font:700 38px 'Bountex Display',sans-serif}
.brand img{width:52px;height:52px}.chapter{position:absolute;left:140px;top:225px;font-size:28px;color:#c8ff4d}
.copy{position:absolute;left:140px;top:296px;width:410px}
h1{font:700 65px/1.05 'Bountex Display',sans-serif;letter-spacing:-2px;margin:0 0 32px}
.sub{font-size:28px;line-height:1.45;color:#b8c3e1;margin:0}
.screen{position:absolute;left:620px;top:172px;width:1164px;height:727.5px;border:1px solid #303a57;border-radius:24px;overflow:hidden;background:#151c2e}
.screen video{width:100%;height:100%;object-fit:contain;display:block}
.status{position:absolute;left:140px;top:958px;font-size:28px;line-height:1.4;color:#b8c3e1;margin:0;width:1640px}
.meter{position:absolute;left:620px;top:924px;width:1164px;height:4px;background:#283248;border-radius:4px;overflow:hidden}
.fill{height:100%;width:100%;background:#6375ff;transform-origin:left center}
</style>
<div id="root" data-composition-id="${scene.id}" data-width="1920" data-height="1080" data-duration="${duration}" data-composition-variables='${vars}'>
<div class="brand"><img src="assets/brand/icon.png" alt=""/>Bountex</div>
<div class="chapter">${escapeHtml(scene.name)}</div>
<div class="copy"><h1 id="${scene.id}-title" data-var-text="title">${escapeHtml(title[scene.id])}</h1><p class="sub" data-var-text="subtitle">${escapeHtml(subtitle)}</p></div>
<div class="screen"><video id="${scene.id}-video" class="clip" src="assets/clips/${scene.id}.mp4" data-start="0" data-duration="${duration}" data-track-index="2" muted playsinline></video></div>
<div class="meter" data-layout-ignore><div id="${scene.id}-meter" class="fill"></div></div>
<p class="status">${escapeHtml(note)}</p>
</div>
<script>
const tl=gsap.timeline({paused:true});
tl.fromTo('#${scene.id}-meter',{scaleX:0},{scaleX:1,duration:${duration},ease:'none'},0);
window.__timelines['${scene.id}']=tl;
</script>
</template>
`,
  );
  hosts.push(
    `<div id="${scene.id}" class="clip" data-composition-id="${scene.id}" data-composition-src="compositions/${scene.id}.html" data-start="${cursor}" data-duration="${duration}" data-width="1920" data-height="1080" data-track-index="1" data-track-kind="graphics"></div>`,
  );
  manifest.push({
    id: scene.id,
    start: cursor,
    duration,
    recordKind: captures.scenes[index].recordKind,
  });
  cursor += duration;
}
const concat = path.join(project, 'assets/audio/concat.txt');
await writeFile(concat, audioParts.map((file) => `file '${file}'`).join('\n'));
execFileSync('ffmpeg', [
  '-y',
  '-v',
  'error',
  '-f',
  'concat',
  '-safe',
  '0',
  '-i',
  concat,
  '-c',
  'copy',
  path.join(project, 'assets/audio/narration.wav'),
]);
await writeFile(
  path.join(project, 'index.html'),
  `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=1920, height=1080"/><title>Bountex walkthrough</title><script src="assets/gsap.min.js"></script><style>*{box-sizing:border-box}html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#090d18}#root{position:relative;width:100%;height:100%}</style></head>
<body><div id="root" data-composition-id="main" data-start="0" data-duration="${cursor}" data-width="1920" data-height="1080" data-fps="30">
${hosts.join('\n')}
<audio id="narration" class="clip" src="assets/audio/narration.wav" data-start="0" data-duration="${cursor}" data-track-index="10" data-volume="1"></audio>
</div><script>window.__timelines['main']=gsap.timeline({paused:true});</script></body></html>`,
);
await writeFile(
  path.join(root, 'output/bountex-walkthrough.srt'),
  subtitles
    .map((cue, i) => `${i + 1}\n${timestamp(cue.from)} --> ${timestamp(cue.to)}\n${cue.text}\n`)
    .join('\n'),
);
await writeFile(
  path.join(root, 'output/bountex-walkthrough.vtt'),
  'WEBVTT\n\n' +
    subtitles
      .map((cue) => `${timestamp(cue.from, '.')} --> ${timestamp(cue.to, '.')}\n${cue.text}\n`)
      .join('\n'),
);
await writeFile(
  path.join(project, 'SPEC.md'),
  '# Bountex recorded walkthrough\n\n1920 × 1080, 30 fps. Eight recorded product screens retain the existing narration and timing. Navy #090D18, blue #6375FF, lime #C8FF4D. Display: Space Grotesk, body: Inter. One chapter title and one screen per shot. Recorded UI provides motion; the progress line indicates chapter time. All sample receipts remain labeled. No wallet or reward transfer is simulated as real. The closing narration is trimmed to its factual mainnet sentence after the builder confirmed login.\n\nNo new photographic media, colour treatments, music or generated graphics were added to the existing recording.\n',
);
await writeFile(
  path.join(root, 'output/render-manifest.json'),
  JSON.stringify(
    {
      duration: cursor,
      fps: 30,
      width: 1920,
      height: 1080,
      nativeLogin: 'Builder confirmed on 2026-11-05',
      livePayout: 'Not yet confirmed',
      scenes: manifest,
      subtitleCues: subtitles.length,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `Prepared ${scenes.length} recorded scenes, ${cursor.toFixed(2)} seconds, ${subtitles.length} subtitle cues.`,
);
