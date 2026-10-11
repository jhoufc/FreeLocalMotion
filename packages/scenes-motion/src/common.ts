import { familySceneType } from '@lms/scene-kit/fields';
import type { SceneFamily } from '@lms/template-sdk';

export { animationSchema, at, baseInstance, graphic, layout, text, type ChoreoMeta } from '@lms/scene-kit/fields';

export const MOTION_FAMILY: SceneFamily = { id: 'studio-motion', name: 'Studio Motion' };
export const MOTION_VERSION = '1.0.0';

/** Scene-type builder of the Studio Motion family. */
export const motionSceneType = familySceneType(MOTION_FAMILY, MOTION_VERSION);
