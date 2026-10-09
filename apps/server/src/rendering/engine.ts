import type { Format, MotionProject } from '@lms/shared';

export interface RenderProgressEvent {
  stage: 'bundling' | 'composition' | 'rendering' | 'encoding';
  /** 0..1 progress of the actual frame render + encode. */
  progress: number;
  renderedFrames: number;
  encodedFrames: number;
  message?: string;
}

export interface RenderRequest {
  jobId: string;
  project: MotionProject;
  format: Format;
  /** Temporary file the engine writes to; the queue moves it into place on success. */
  outputPath: string;
  assetBaseUrl: string;
  frameRange?: [number, number];
  onProgress(event: RenderProgressEvent): void;
  /** Resolves when the user cancels the job. */
  cancelled: Promise<void>;
}

export interface RenderResult {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

/**
 * Pluggable renderer. Production uses Remotion; tests inject a fake to exercise the
 * job pipeline (queueing, progress, cancellation, file handling) quickly.
 */
export interface RenderEngine {
  render(request: RenderRequest): Promise<RenderResult>;
}

export class RenderCancelledError extends Error {
  constructor() {
    super('Render cancelled');
  }
}
