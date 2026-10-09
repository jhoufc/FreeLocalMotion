import type { ComponentType } from 'react';
import type { z } from 'zod';
import { FORMAT_SPECS, type Format, type MotionProject, type SupportedFps } from '@lms/shared';
import type { EditableTarget } from './fields';
import { computeSceneRanges, totalFrames, type TimelineModel } from './timeline';

export interface CompositionMetadata {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

export interface ProjectInit {
  id: string;
  name: string;
  format: Format;
  fps?: SupportedFps;
  now: string;
}

/** Props every template composition receives. Identical in the Player and in the renderer. */
export interface TemplateComponentProps<P extends MotionProject = MotionProject> {
  project: P;
}

/**
 * The data side of a template: everything except React components and binary assets.
 * Safe to import from Node (the server validates and creates projects with it).
 *
 * Methods are declared with method syntax on purpose: it keeps definitions for
 * concrete project types assignable to the registry's `AnyTemplateDefinition`.
 */
export interface TemplateDefinition<P extends MotionProject = MotionProject> {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly formats: readonly Format[];
  /** Full schema for this template's projects (envelope + template specifics). */
  readonly schema: z.ZodType<P>;

  createDefaults(init: ProjectInit): P;
  /** Upgrade a raw project saved with an older template version. Optional. */
  migrate?(raw: Record<string, unknown>, fromVersion: string): Record<string, unknown>;
  getMetadata(project: P): CompositionMetadata;
  getEditableTargets(project: P): EditableTarget[];
  getTimeline(project: P): TimelineModel;
}

/** A definition plus the React composition: what the Studio and Remotion root consume. */
export interface TemplateModule<P extends MotionProject = MotionProject> extends TemplateDefinition<P> {
  readonly Component: ComponentType<TemplateComponentProps<P>>;
}

export type AnyTemplateDefinition = TemplateDefinition<MotionProject>;
export type AnyTemplateModule = TemplateModule<MotionProject>;

/** Identity helper that gives inference + a single place to add definition-time checks. */
export const defineTemplate = <P extends MotionProject>(definition: TemplateDefinition<P>): TemplateDefinition<P> => {
  if (!/^[a-z0-9-]+$/.test(definition.id)) throw new Error(`Invalid template id "${definition.id}"`);
  if (definition.formats.length === 0) throw new Error(`Template "${definition.id}" must support at least one format`);
  return definition;
};

/**
 * Pairs a definition with its composition. The registry only ever hands a template a
 * project that was parsed by that template's own schema, which is what makes the
 * widening below sound.
 */
export const defineTemplateModule = <P extends MotionProject>(
  definition: TemplateDefinition<P>,
  Component: ComponentType<TemplateComponentProps<P>>,
): AnyTemplateModule =>
  ({
    ...definition,
    Component: Component as unknown as ComponentType<TemplateComponentProps<MotionProject>>,
  }) as unknown as AnyTemplateModule;

/** Default metadata: format dimensions + sum of sequential scene durations. */
export const sequentialMetadata = (project: MotionProject, format: Format = project.format): CompositionMetadata => {
  const spec = FORMAT_SPECS[format];
  return {
    width: spec.width,
    height: spec.height,
    fps: project.fps,
    durationInFrames: Math.max(1, totalFrames(computeSceneRanges(project.scenes, project.fps))),
  };
};
