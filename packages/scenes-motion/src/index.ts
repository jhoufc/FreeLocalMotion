import type { ComponentType } from 'react';
import { defineSceneModule, type AnySceneTypeModule, type SceneRuntime } from '@lms/template-sdk';
import { MOTION_SCENE_TYPES } from './definitions';
import { BouncingBallView } from './visual/BouncingBall';
import { BrandRevealView, InfographicView } from './visual/DataBrand';
import { ProductCalloutsView, ProductHeroView, ProductImpactView } from './visual/Products';
import { AppScreensView } from './visual/AppScreens';
import { UiHighlightView } from './visual/UiHighlight';
import { FloatingPhoneView } from './visual/FloatingPhone';
import { IrisRevealView } from './visual/IrisReveal';
import { MorphLineView } from './visual/MorphLine';
import { SemanticWordsView } from './visual/SemanticWords';

export * from './definitions';

type AnyView = ComponentType<{ env: SceneRuntime<never> }>;

/** Scene type id -> view. Adding a scene = definition in ./definitions + view here. */
const VIEWS: Record<string, AnyView> = {
  'bouncing-ball': BouncingBallView as AnyView,
  'semantic-words': SemanticWordsView as AnyView,
  'morph-line': MorphLineView as AnyView,
  'iris-reveal': IrisRevealView as AnyView,
  'floating-phone': FloatingPhoneView as AnyView,
  'ui-highlight': UiHighlightView as AnyView,
  'app-screens': AppScreensView as AnyView,
  'product-hero': ProductHeroView as AnyView,
  'product-callouts': ProductCalloutsView as AnyView,
  'product-impact': ProductImpactView as AnyView,
  infographic: InfographicView as AnyView,
  'brand-reveal': BrandRevealView as AnyView,
};

/** Studio Motion scene modules (definition + view), in library order. */
export const motionSceneModules: readonly AnySceneTypeModule[] = MOTION_SCENE_TYPES.map((def) => {
  const view = VIEWS[def.id];
  if (!view) throw new Error(`Studio Motion scene "${def.id}" has no view`);
  return defineSceneModule(def, view as ComponentType<{ env: SceneRuntime }>);
});
