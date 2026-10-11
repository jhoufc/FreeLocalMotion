import type { ComponentType } from 'react';
import type { z } from 'zod';
import { FORMAT_SPECS, type Format, type MotionProject, type SupportedFps } from '@lms/shared';
import type { EditableTarget } from './fields';
import type { TimelineModel } from './timeline';
import { projectDurationInFrames, type SceneDefinition } from './scenes';

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
  /**
   * `template` (default): a designed storyboard the user customizes.
   * `free`: the free-composition engine — starts empty, accepts every registered scene type.
   */
  readonly mode?: 'template' | 'free';
  /** The scene list may be empty (free compositions). Rendering still requires ≥ 1 enabled scene. */
  readonly allowEmpty?: boolean;
  /** Full schema for this template's projects (envelope + template specifics). */
  readonly schema: z.ZodType<P>;

  /**
   * The reusable animations this template offers. Projects hold an ordered list of
   * instances (`scenes[i].type` -> a definition here); instances never share state.
   */
  readonly sceneTypes: readonly SceneDefinition[];

  createDefaults(init: ProjectInit): P;
  /** A fresh instance of a scene type with its default values (not yet in the project). */
  createScene(type: string, init: { id: string; name: string }): P['scenes'][number];
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
  const typeIds = new Set<string>();
  for (const t of definition.sceneTypes) {
    if (typeIds.has(t.id)) throw new Error(`Template "${definition.id}" declares scene type "${t.id}" twice`);
    typeIds.add(t.id);
    const d = t.duration;
    if (!(d.min <= d.default && d.default <= d.max)) throw new Error(`Scene type "${t.id}": default duration outside its limits`);
    if (d.strategy === 'fixed' && d.min !== d.max) throw new Error(`Scene type "${t.id}": fixed duration needs min === max`);
  }
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

/** Scene definition for an instance, or throws (instances are validated against the template's types). */
export const sceneTypeOf = (template: Pick<AnyTemplateDefinition, 'sceneTypes' | 'id'>, type: string): SceneDefinition => {
  const def = template.sceneTypes.find((t) => t.id === type);
  if (!def) throw new Error(`Template "${template.id}" has no scene type "${type}"`);
  return def;
};

/** Default metadata: format dimensions + sum of the enabled scenes' durations. */
export const sequentialMetadata = (project: MotionProject, format: Format = project.format): CompositionMetadata => {
  const spec = FORMAT_SPECS[format];
  return {
    width: spec.width,
    height: spec.height,
    fps: project.fps,
    durationInFrames: projectDurationInFrames(project.scenes, project.fps),
  };
};
