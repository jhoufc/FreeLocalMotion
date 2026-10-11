/**
 * Verifies rendered MP4s with ffprobe/ffmpeg:
 *  - container/codec/pixel format/dimensions/fps/frame count/duration
 *  - representative frames of every scene are not blank (luma statistics)
 *  - sampled frames differ from each other (no frozen video)
 *  - writes a contact sheet per video next to it (<name>.sheet.jpg)
 *
 *   pnpm verify:videos                       # newest portrait + landscape in exports/samples
 *   pnpm verify:videos path/to/a.mp4 b.mp4   # explicit files
 *
 * When `<file>.project.json` exists (written by `pnpm render:composition`), the video is
 * checked against that exact project — scene order, repetitions, durations — instead of
 * the template defaults.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORMAT_SPECS, type Format, type MotionProject } from '@lms/shared';
import { templateDefinitions } from '@lms/catalog/definitions';
import { computeSceneRanges, heroFrameOf, sceneTypeOf } from '@lms/template-sdk';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const samplesDir = path.join(root, 'exports/samples');

const pickNewest = (format: Format): string | null => {
  if (!fs.existsSync(samplesDir)) return null;
  const files = fs
    .readdirSync(samplesDir)
    .filter((f) => f.endsWith('.mp4') && f.includes(`-${format}-`))
    .map((f) => path.join(samplesDir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files[0] ?? null;
};

const files = process.argv.slice(2).length ? process.argv.slice(2) : (['portrait', 'landscape'] as const).map(pickNewest).filter((f): f is string => !!f);
if (files.length === 0) {
  console.error('No videos found. Run `pnpm render:samples` first.');
  process.exit(1);
}

interface Probe {
  streams: { codec_type: string; codec_name: string; profile?: string; width?: number; height?: number; pix_fmt?: string; r_frame_rate?: string; nb_frames?: string; color_range?: string; color_space?: string }[];
  format: { format_name: string; duration: string; size: string; bit_rate: string };
}

let failures = 0;
const check = (ok: boolean, label: string, detail: string) => {
  console.log(`  ${ok ? '✔' : '✘'} ${label.padEnd(26)} ${detail}`);
  if (!ok) failures++;
};

for (const file of files) {
  console.log(`\n${path.relative(root, file)}`);
  const format: Format = /portrait/.test(file) ? 'portrait' : 'landscape';
  const spec = FORMAT_SPECS[format];
  const sidecar = `${file}.project.json`;
  const fromSidecar = fs.existsSync(sidecar);
  const template = fromSidecar
    ? templateDefinitions.get((JSON.parse(fs.readFileSync(sidecar, 'utf8')) as MotionProject).templateId)
    : templateDefinitions.list()[0]!;
  const defaults: MotionProject = fromSidecar
    ? (JSON.parse(fs.readFileSync(sidecar, 'utf8')) as MotionProject)
    : template.createDefaults({ id: 'verify', name: 'verify', format, now: '' });
  const meta = template.getMetadata(defaults);
  console.log(`    reference: ${fromSidecar ? `project sidecar (${defaults.scenes.filter((s) => s.enabled).length} enabled scenes)` : 'template defaults'}`);

  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file], { encoding: 'utf8' })) as Probe;
  const v = probe.streams.find((s) => s.codec_type === 'video');
  const [num, den] = (v?.r_frame_rate ?? '0/1').split('/').map(Number);
  const fps = (num ?? 0) / (den ?? 1);
  const duration = Number(probe.format.duration);
  const frames = Number(v?.nb_frames ?? 0);
  check(probe.format.format_name.includes('mp4'), 'container', probe.format.format_name);
  check(v?.codec_name === 'h264', 'video codec', `${v?.codec_name} (${v?.profile})`);
  check(v?.pix_fmt === 'yuv420p', 'pixel format', `${v?.pix_fmt} range=${v?.color_range} space=${v?.color_space}`);
  check(v?.width === spec.width && v?.height === spec.height, 'dimensions', `${v?.width}x${v?.height} (expected ${spec.width}x${spec.height})`);
  check(Math.abs(fps - meta.fps) < 0.01, 'frame rate', `${fps} fps`);
  const partial = frames < meta.durationInFrames;
  check(frames === meta.durationInFrames || partial, 'frame count', `${frames}${partial ? ' (partial render)' : ''} (expected ${meta.durationInFrames})`);
  if (!partial) check(Math.abs(duration - meta.durationInFrames / meta.fps) < 0.05, 'duration', `${duration.toFixed(3)}s`);
  console.log(`    size ${(Number(probe.format.size) / 1e6).toFixed(1)} MB · ${(Number(probe.format.bit_rate) / 1e6).toFixed(1)} Mb/s`);
  if (partial) continue;

  // Representative frames: the settled moment of each scene plus each transition midpoint.
  const ranges = computeSceneRanges(defaults.scenes, meta.fps);
  const sceneLabel = (i: number) => `${defaults.scenes[i]!.name} [${defaults.scenes[i]!.type}]`;
  // Templates with designed transitions (Signature / 001) must show the bright wipe right
  // after each cut. Free compositions cut directly and scenes may open from darkness, so
  // their start/end frames are sampled for the contact sheet and reported, not judged.
  const free = template.mode === 'free';
  const picks: { frame: number; label: string; judged: boolean }[] = [
    ...ranges.map((r) => {
      const scene = defaults.scenes[r.index]!;
      return { frame: r.from + heroFrameOf(sceneTypeOf(template, scene.type), scene.duration, meta.fps, scene), label: `${sceneLabel(r.index)} (settled)`, judged: true };
    }),
    ...(free
      ? ranges.flatMap((r) => [
          { frame: r.from + 4, label: `${sceneLabel(r.index)} (start)`, judged: false },
          { frame: r.from + r.durationInFrames - 6, label: `${sceneLabel(r.index)} (end)`, judged: false },
        ])
      : ranges.slice(1).map((r) => ({ frame: r.from + 4, label: `${sceneLabel(r.index)} (transition in)`, judged: true }))),
  ].sort((a, b) => a.frame - b.frame);
  const select = picks.map((p) => `eq(n\\,${p.frame})`).join('+');
  const stats = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-vf', `select='${select}',signalstats,metadata=print:file=-`, '-vsync', '0', '-f', 'null', '-'],
    { encoding: 'utf8' },
  );
  const yavg = [...stats.matchAll(/lavfi\.signalstats\.YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
  const ymax = [...stats.matchAll(/lavfi\.signalstats\.YMAX=([\d.]+)/g)].map((m) => Number(m[1]));
  picks.forEach((p, i) => {
    const detail = `${p.label}: Ymax ${ymax[i]} Yavg ${yavg[i]?.toFixed(1)}`;
    if (p.judged) check((ymax[i] ?? 0) > 140 && (yavg[i] ?? 0) > 12, `frame ${p.frame}`, detail);
    else console.log(`  · ${`frame ${p.frame}`.padEnd(26)} ${detail}`);
  });
  const distinct = new Set(yavg.map((y) => y.toFixed(2))).size;
  check(distinct >= Math.min(yavg.length, 5), 'frames differ', `${distinct}/${yavg.length} distinct luma averages`);

  const sheet = file.replace(/\.mp4$/, '.sheet.jpg');
  const cols = free ? 6 : format === 'portrait' ? 7 : 4;
  const w = free ? (format === 'portrait' ? 180 : 320) : format === 'portrait' ? 270 : 480;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-vf', `select='${select}',scale=${w}:-2,tile=${cols}x${Math.ceil(picks.length / cols)}:padding=6:color=0x202020`, '-vsync', '0', '-frames:v', '1', sheet]);
  console.log(`    contact sheet: ${path.relative(root, sheet)}`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
