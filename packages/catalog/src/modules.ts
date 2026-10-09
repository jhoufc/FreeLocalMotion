import { createTemplateRegistry, type AnyTemplateModule } from '@lms/template-sdk';
import { signatureTemplate } from '@lms/template-signature-001';

/**
 * Full registry (definitions + compositions) for the Studio and the Remotion root.
 * To add a template, append its module here (and its definition in ./definitions.ts).
 */
export const templateModules = createTemplateRegistry<AnyTemplateModule>([signatureTemplate]);
