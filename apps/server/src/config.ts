import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, '../../..');

export interface ServerConfig {
  host: string;
  port: number;
  projectsDir: string;
  /** User templates (saved compositions, their revisions, assets and thumbnails). */
  templatesDir: string;
  exportsDir: string;
  /** Remotion entry point (registerRoot). */
  remotionEntry: string;
  /** Directories whose changes invalidate the cached Remotion bundle. */
  watchDirs: string[];
  /** Built studio (served in `pnpm start` mode when present). */
  studioDist: string;
  maxUploadBytes: number;
  /** Speech uploads and local transcription (faster-whisper). */
  speech: { dir: string; python: string; model: string; language: string; ffmpeg: string; ffprobe: string; script: string };
}

export const loadConfig = (overrides: Partial<ServerConfig> = {}): ServerConfig => ({
  host: process.env.LMS_HOST ?? '127.0.0.1',
  port: Number(process.env.LMS_PORT ?? 4317),
  projectsDir: path.resolve(process.env.LMS_PROJECTS_DIR ?? path.join(REPO_ROOT, 'projects')),
  templatesDir: path.resolve(process.env.LMS_TEMPLATES_DIR ?? path.join(REPO_ROOT, 'templates')),
  exportsDir: path.resolve(process.env.LMS_EXPORTS_DIR ?? path.join(REPO_ROOT, 'exports')),
  remotionEntry: path.join(REPO_ROOT, 'packages/catalog/src/remotion/index.ts'),
  watchDirs: [path.join(REPO_ROOT, 'packages')],
  studioDist: path.join(REPO_ROOT, 'apps/studio/dist'),
  maxUploadBytes: 60 * 1024 * 1024,
  speech: {
    dir: path.resolve(process.env.LMS_SPEECH_DIR ?? path.join(REPO_ROOT, 'speech')),
    python: process.env.LMS_PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3'),
    model: process.env.LMS_WHISPER_MODEL ?? 'small',
    language: process.env.LMS_SPEECH_LANGUAGE ?? 'pt',
    ffmpeg: process.env.LMS_FFMPEG ?? 'ffmpeg',
    ffprobe: process.env.LMS_FFPROBE ?? 'ffprobe',
    script: path.join(REPO_ROOT, 'apps/server/python/transcribe.py'),
  },
  ...overrides,
});
