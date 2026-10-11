import { asAnySceneType, type AnySceneTypeDefinition } from '@lms/template-sdk';
import { glassPanelsType } from './scenes/glassPanels';
import { kineticTypeType } from './scenes/kineticType';

import { numberImpactType } from './scenes/numberImpact';

import { orbitalDataType } from './scenes/orbitalData';

import { productRevealType } from './scenes/productReveal';

import { gridBreakdownType } from './scenes/gridBreakdown';

import { editorialSplitType } from './scenes/editorialSplit';

import { cinematicOutroType } from './scenes/cinematicOutro';

export { PREMIUM_FAMILY } from './family';
export { numberImpactType, glassPanelsType, kineticTypeType };

/** Data side of the premium scene pack (Node-safe: no React, no fonts), in library order. */
export const PREMIUM_SCENE_TYPES: readonly AnySceneTypeDefinition[] = [asAnySceneType(kineticTypeType), asAnySceneType(glassPanelsType), asAnySceneType(numberImpactType), asAnySceneType(orbitalDataType), asAnySceneType(productRevealType), asAnySceneType(gridBreakdownType), asAnySceneType(editorialSplitType), asAnySceneType(cinematicOutroType)];
