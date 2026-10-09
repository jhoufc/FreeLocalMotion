import type { FieldPath } from '@lms/shared';

/** A bounded numeric property the timeline may edit by dragging (seconds). */
export interface TimingHandle {
  path: FieldPath;
  min: number;
  max: number;
}

export interface TimelineSceneBlock {
  id: string;
  label: string;
  /** Position in the video (enabled scenes only). */
  index: number;
  /** Scene definition id and display name ("Impact"), for type badges. */
  typeId?: string;
  typeLabel?: string;
  from: number;
  durationInFrames: number;
  /** Editable target selected when the block is clicked. */
  targetId: string;
  /** Dragging the right edge edits this duration (in seconds) within limits. */
  duration?: TimingHandle;
}

export interface TimelineClip {
  from: number;
  durationInFrames: number;
  label?: string;
}

export interface TimelineMarker {
  frame: number;
  label: string;
  kind: 'in' | 'out' | 'beat' | 'transition';
}

export const LAYER_KINDS = ['text', 'graphic', 'background', 'overlay', 'audio'] as const;
export type TimelineLayerKind = (typeof LAYER_KINDS)[number];

export interface TimelineLayer {
  id: string;
  label: string;
  kind: TimelineLayerKind;
  sceneId: string | null;
  /** Editable target this layer represents. */
  targetId: string;
  clips: TimelineClip[];
  markers: TimelineMarker[];
  hidden: boolean;
  /** Dragging a clip edits this entrance delay (in seconds) within limits. */
  delay?: TimingHandle;
}

export interface TimelineModel {
  fps: number;
  durationInFrames: number;
  scenes: TimelineSceneBlock[];
  layers: TimelineLayer[];
}
