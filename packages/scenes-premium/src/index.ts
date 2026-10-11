import type { ComponentType } from 'react';
import { defineSceneModule, type AnySceneTypeModule, type SceneRuntime } from '@lms/template-sdk';
import { PREMIUM_SCENE_TYPES } from './definitions';
import { GlassPanelsView } from './visual/GlassPanels';
import { CinematicOutroView } from './visual/CinematicOutro';
import { EditorialSplitView } from './visual/EditorialSplit';
import { GridBreakdownView } from './visual/GridBreakdown';
import { ProductRevealView } from './visual/ProductReveal';
import { OrbitalDataView } from './visual/OrbitalData';
import { NumberImpactView } from './visual/NumberImpact';
import { KineticTypeView } from './visual/KineticType';

export * from './definitions';

/** Scene type id -> view. Adding a premium scene = definition in ./definitions + view here. */
const VIEWS: Record<string, ComponentType<{ env: SceneRuntime<never> }>> = {
  'kinetic-type': KineticTypeView as ComponentType<{ env: SceneRuntime<never> }>,
  'glass-panels': GlassPanelsView as ComponentType<{ env: SceneRuntime<never> }>,
  'number-impact': NumberImpactView as ComponentType<{ env: SceneRuntime<never> }>,
  'orbital-data': OrbitalDataView as ComponentType<{ env: SceneRuntime<never> }>,
  'product-reveal': ProductRevealView as ComponentType<{ env: SceneRuntime<never> }>,
  'grid-breakdown': GridBreakdownView as ComponentType<{ env: SceneRuntime<never> }>,
  'editorial-split': EditorialSplitView as ComponentType<{ env: SceneRuntime<never> }>,
  'cinematic-outro': CinematicOutroView as ComponentType<{ env: SceneRuntime<never> }>,
};

/** Premium scene modules (definition + view), in library order. */
export const premiumSceneModules: readonly AnySceneTypeModule[] = PREMIUM_SCENE_TYPES.map((def) => {
  const view = VIEWS[def.id];
  if (!view) throw new Error(`Premium scene "${def.id}" has no view`);
  return defineSceneModule(def, view as ComponentType<{ env: SceneRuntime }>);
});
