import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, makeCancelSignal, renderMedia, selectComposition } from '@remotion/renderer';
import type { AnyTemplateDefinition, TemplateRegistry } from '@lms/template-sdk';
import { RenderCancelledError, type RenderEngine, type RenderRequest, type RenderResult } from './engine';

/** Newest mtime under a directory tree (ignoring node_modules), used to invalidate the bundle. */
const fingerprint = async (dirs: readonly string[]): Promise<number> => {
  let newest = 0;
  const walk = async (dir: string) => {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else {
        const st = await fs.stat(full);
        if (st.mtimeMs > newest) newest = st.mtimeMs;
      }
    }
  };
  for (const d of dirs) await walk(d);
  return newest;
};

/**
 * Renders with Remotion's official APIs: bundle the same React entry the Studio uses,
 * resolve the composition with the project snapshot as input props, then renderMedia
 * to H.264/MP4 (AAC audio when the project has a soundtrack).
 */
export class RemotionEngine implements RenderEngine {
  private bundlePromise: Promise<string> | null = null;
  private bundledAt = 0;

  constructor(
    private readonly opts: {
      entry: string;
      watchDirs: string[];
      templates: TemplateRegistry<AnyTemplateDefinition>;
      log?: (msg: string) => void;
    },
  ) {}

  private async getBundle(onProgress: (p: number) => void): Promise<string> {
    const fp = await fingerprint(this.opts.watchDirs);
    if (!this.bundlePromise || fp > this.bundledAt) {
      this.bundledAt = fp;
      this.opts.log?.('Bundling Remotion entry…');
      this.bundlePromise = bundle({ entryPoint: this.opts.entry, onProgress, enableCaching: true }).catch((err: unknown) => {
        this.bundlePromise = null;
        throw err;
      });
    }
    return this.bundlePromise;
  }

  async warmUp(): Promise<void> {
    await ensureBrowser();
    await this.getBundle(() => undefined);
  }

  async render(req: RenderRequest): Promise<RenderResult> {
    const template = this.opts.templates.get(req.project.templateId);
    const project = { ...req.project, format: req.format };
    const expected = template.getMetadata(project);

    let cancelledFlag = false;
    const { cancelSignal, cancel } = makeCancelSignal();
    void req.cancelled.then(() => {
      cancelledFlag = true;
      cancel();
    });
    const assertActive = () => {
      if (cancelledFlag) throw new RenderCancelledError();
    };

    await ensureBrowser();
    assertActive();
    req.onProgress({ stage: 'bundling', progress: 0, renderedFrames: 0, encodedFrames: 0 });
    const serveUrl = await this.getBundle((p) =>
      req.onProgress({ stage: 'bundling', progress: 0, renderedFrames: 0, encodedFrames: 0, message: `Bundling ${Math.round(p)}%` }),
    );
    assertActive();

    req.onProgress({ stage: 'composition', progress: 0, renderedFrames: 0, encodedFrames: 0 });
    const inputProps = { project, assetBaseUrl: req.assetBaseUrl };
    const composition = await selectComposition({ serveUrl, id: template.id, inputProps });
    if (composition.width !== expected.width || composition.height !== expected.height || composition.durationInFrames !== expected.durationInFrames) {
      throw new Error(
        `Composition metadata mismatch: got ${composition.width}x${composition.height}/${composition.durationInFrames}f, expected ${expected.width}x${expected.height}/${expected.durationInFrames}f`,
      );
    }
    assertActive();

    const total = req.frameRange ? req.frameRange[1] - req.frameRange[0] + 1 : composition.durationInFrames;
    try {
      await renderMedia({
        serveUrl,
        composition,
        inputProps,
        codec: 'h264',
        audioCodec: 'aac',
        crf: 16,
        pixelFormat: 'yuv420p',
        // Limited-range BT.709 with proper tags: what players and social platforms expect.
        colorSpace: 'bt709',
        imageFormat: 'jpeg',
        jpegQuality: 95,
        x264Preset: 'medium',
        concurrency: Math.max(1, Math.min(8, Math.floor(os.cpus().length / 2))),
        outputLocation: req.outputPath,
        overwrite: true,
        cancelSignal,
        ...(req.frameRange ? { frameRange: req.frameRange } : {}),
        onProgress: ({ progress, renderedFrames, encodedFrames }) => {
          req.onProgress({
            stage: renderedFrames < total ? 'rendering' : 'encoding',
            progress,
            renderedFrames,
            encodedFrames,
          });
        },
      });
    } catch (err) {
      if (cancelledFlag) throw new RenderCancelledError();
      throw err;
    }
    return { width: composition.width, height: composition.height, fps: composition.fps, durationInFrames: total };
  }
}
