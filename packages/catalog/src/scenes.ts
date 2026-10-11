import { createSceneRegistry, type AnySceneTypeDefinition } from '@lms/template-sdk';
import { SIGNATURE_SCENE_TYPES } from '@lms/template-signature-001/definition';
import { PREMIUM_SCENE_TYPES } from '@lms/scenes-premium/definitions';
import { MOTION_SCENE_TYPES } from '@lms/scenes-motion/definitions';

/**
 * Global scene library (data only, safe for Node). Every scene type is resolved by its
 * global id; families keep their origin (Signature / 001, Studio Premium…).
 *
 * To add a scene type: export its definition from its package and append it here, and
 * append its module in ./sceneModules.ts.
 */
export const sceneDefinitions = createSceneRegistry<AnySceneTypeDefinition>([...SIGNATURE_SCENE_TYPES, ...PREMIUM_SCENE_TYPES, ...MOTION_SCENE_TYPES]);
