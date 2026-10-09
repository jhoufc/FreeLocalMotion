import { defineTemplateModule } from '@lms/template-sdk';
import { signatureDefinition } from './definition';
import { SignatureComposition } from './visual/Composition';

export { signatureDefinition } from './definition';
export * from './schema';
export { SignatureComposition } from './visual/Composition';
export { signatureFonts } from './visual/fonts';

/** Full template module (definition + composition) for the Studio and the Remotion root. */
export const signatureTemplate = defineTemplateModule(signatureDefinition, SignatureComposition);
