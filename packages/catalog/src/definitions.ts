import { createTemplateRegistry, type AnyTemplateDefinition } from '@lms/template-sdk';
import { signatureDefinition } from '@lms/template-signature-001/definition';
import { compositionDefinition } from './composition/definition';

export { sceneDefinitions } from './scenes';
export { COMPOSITION_TEMPLATE_ID, compositionDefinition, toComposition, type CompositionProject } from './composition/definition';

/**
 * Data-only registry (schemas, defaults, fields, timeline). Safe for Node: no React
 * components, no font/image imports. The server uses this one.
 *
 * To add a template: import its `/definition` entry and append it here, and append its
 * module in `./index.ts`.
 */
export const templateDefinitions = createTemplateRegistry<AnyTemplateDefinition>([
  signatureDefinition as unknown as AnyTemplateDefinition,
  compositionDefinition as unknown as AnyTemplateDefinition,
]);
export { STARTERS, buildStarter, findStarter, starterSummaries } from './starters';
export { SPEECH_ORIGIN_ID, buildSpeechProject, planSpeechProject, refillScene, sceneFromFill, speechSceneTypes, type SpeechProjectInit } from './speech';
