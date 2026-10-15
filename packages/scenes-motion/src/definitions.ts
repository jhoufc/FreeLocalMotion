import { asAnySceneType, type AnySceneTypeDefinition } from '@lms/template-sdk';
import { bouncingBallType } from './scenes/bouncingBall';

import { semanticWordsType } from './scenes/semanticWords';
import { morphLineType } from './scenes/morphLine';
import { irisRevealType } from './scenes/irisReveal';
import { floatingPhoneType } from './scenes/floatingPhone';
import { uiHighlightType } from './scenes/uiHighlight';
import { appScreensType } from './scenes/appScreens';
import { brandRevealType, infographicType } from './scenes/dataBrand';
import { productCalloutsType, productHeroType, productImpactType } from './scenes/products';
import { MOTION_PLANNING } from './planning';
export { MOTION_FAMILY } from './common';
export { semanticWordsType, bouncingBallType };

/** Data side of the Studio Motion pack (Node-safe: no React, no fonts), in library order. */
export const MOTION_SCENE_TYPES: readonly AnySceneTypeDefinition[] = [
  bouncingBallType,
  semanticWordsType,
  morphLineType,
  irisRevealType,
  floatingPhoneType,
  uiHighlightType,
  appScreensType,
  productHeroType,
  productCalloutsType,
  productImpactType,
  infographicType,
  brandRevealType,
].map((t) => ({ ...asAnySceneType(t as never), planning: MOTION_PLANNING[t.id] }));
export { MOTION_PLANNING };
