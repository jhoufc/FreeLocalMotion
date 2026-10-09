import { createTemplateRegistry, type AnyTemplateDefinition } from '@lms/template-sdk';
import { signatureDefinition } from '@lms/template-signature-001/definition';

/**
 * Data-only registry (schemas, defaults, fields, timeline). Safe for Node: no React
 * components, no font/image imports. The server uses this one.
 *
 * To add a template: import its `/definition` entry and append it here, and append its
 * module in `./index.ts`.
 */
export const templateDefinitions = createTemplateRegistry<AnyTemplateDefinition>([
  signatureDefinition as unknown as AnyTemplateDefinition,
]);
