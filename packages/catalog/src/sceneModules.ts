import { createSceneRegistry, type AnySceneTypeModule } from '@lms/template-sdk';
import { signatureSceneModules } from '@lms/template-signature-001';
import { premiumSceneModules } from '@lms/scenes-premium';
import { motionSceneModules } from '@lms/scenes-motion';

/** Global scene library with views, for the Studio, the free composition and the Remotion root. */
export const sceneModules = createSceneRegistry<AnySceneTypeModule>([...signatureSceneModules, ...premiumSceneModules, ...motionSceneModules]);
