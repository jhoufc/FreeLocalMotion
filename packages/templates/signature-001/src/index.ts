import { defineSceneModule, defineTemplateModule, type AnySceneTypeModule } from '@lms/template-sdk';
import { signatureDefinition } from './definition';
import { energySceneType, impactSceneType, signatureSceneType, transformationSceneType } from './sceneTypes';
import { SignatureComposition } from './visual/Composition';
import { EnergySceneView } from './visual/scenes/Energy';
import { ImpactSceneView } from './visual/scenes/Impact';
import { SignatureSceneView } from './visual/scenes/Signature';
import { TransformationSceneView } from './visual/scenes/Transformation';

export { signatureDefinition } from './definition';
export * from './schema';
export { SignatureComposition } from './visual/Composition';
export { kitFonts as signatureFonts } from '@lms/scene-kit';
export * from './sceneTypes';

/** The four Signature animations as global scene modules (definition + view). */
export const signatureSceneModules: readonly AnySceneTypeModule[] = [
  defineSceneModule(impactSceneType, ImpactSceneView),
  defineSceneModule(energySceneType, EnergySceneView),
  defineSceneModule(transformationSceneType, TransformationSceneView),
  defineSceneModule(signatureSceneType, SignatureSceneView),
];

/** Full template module (definition + composition) for the Studio and the Remotion root. */
export const signatureTemplate = defineTemplateModule(signatureDefinition, SignatureComposition);
