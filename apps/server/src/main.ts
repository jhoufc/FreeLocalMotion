import { templateDefinitions } from '@lms/catalog/definitions';
import { createApp } from './api/app';
import { loadConfig } from './config';
import { ProjectStore } from './projects/store';
import { RenderQueue } from './rendering/queue';
import { RemotionEngine } from './rendering/remotion-engine';
import { TemplateLibrary } from './templates/library';
import { SpeechService } from './speech/service';

const config = loadConfig();
const store = new ProjectStore(config.projectsDir, templateDefinitions);
const engine = new RemotionEngine({
  entry: config.remotionEntry,
  watchDirs: config.watchDirs,
  templates: templateDefinitions,
  log: (m) => console.log(`[render] ${m}`),
});
const queue = new RenderQueue({
  engine,
  store,
  templates: templateDefinitions,
  exportsDir: config.exportsDir,
  assetBaseUrl: () => `http://127.0.0.1:${config.port}`,
});
await queue.load();
const library = new TemplateLibrary(config.templatesDir, {
  projects: store,
  templates: templateDefinitions,
  thumbnailer: (project, frame, outputPath) => engine.renderStill({ project, frame, outputPath, assetBaseUrl: `http://127.0.0.1:${config.port}` }),
  log: (m) => console.log(`[templates] ${m}`),
});

const speech = new SpeechService(config.speech);
const app = createApp({ store, queue, templates: templateDefinitions, library, speech, maxUploadBytes: config.maxUploadBytes, studioDist: config.studioDist });

app.listen(config.port, config.host, () => {
  console.log(`Local Motion Studio server  →  http://${config.host}:${config.port}`);
  console.log(`  projects: ${config.projectsDir}`);
  console.log(`  templates: ${config.templatesDir}`);
  console.log(`  exports:  ${config.exportsDir}`);
  // Pre-download the headless browser and warm the bundle so the first export starts fast.
  if (process.env.LMS_SKIP_WARMUP !== '1') {
    engine.warmUp().then(
      () => console.log('[render] renderer ready'),
      (err: unknown) => console.warn('[render] warm-up failed (will retry on first render):', err instanceof Error ? err.message : err),
    );
  }
});
