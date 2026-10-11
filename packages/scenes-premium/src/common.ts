import { familySceneType } from '@lms/scene-kit/fields';
import { PREMIUM_FAMILY } from './family';

export { animationSchema, at, baseInstance, graphic, layout, text, type ChoreoMeta } from '@lms/scene-kit/fields';

export const PREMIUM_VERSION = '1.0.0';

/** Scene-type builder of the Studio Premium family. */
export const premiumSceneType = familySceneType(PREMIUM_FAMILY, PREMIUM_VERSION);
