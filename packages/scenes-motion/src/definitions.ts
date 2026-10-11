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
export { MOTION_FAMILY } from './common';
export { semanticWordsType, bouncingBallType };

/** Data side of the Studio Motion pack (Node-safe: no React, no fonts), in library order. */
export const MOTION_SCENE_TYPES: readonly AnySceneTypeDefinition[] = [asAnySceneType(bouncingBallType), asAnySceneType(semanticWordsType), asAnySceneType(morphLineType), asAnySceneType(irisRevealType), asAnySceneType(floatingPhoneType), asAnySceneType(uiHighlightType), asAnySceneType(appScreensType), asAnySceneType(productHeroType), asAnySceneType(productCalloutsType), asAnySceneType(productImpactType), asAnySceneType(infographicType), asAnySceneType(brandRevealType)];
