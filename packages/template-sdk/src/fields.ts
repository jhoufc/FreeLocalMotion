import type { FieldPath } from '@lms/shared';

/**
 * Field descriptors drive the generic inspector. A template declares *what* can be
 * edited (path into the project + constraints); the editor decides *how* to render it.
 * The editor never inspects the template's data shape directly.
 */
interface FieldBase {
  /** Path into the project document. */
  path: FieldPath;
  label: string;
  hint?: string;
}

export interface TextFieldDescriptor extends FieldBase {
  type: 'text';
  maxLength: number;
  multiline?: boolean;
  placeholder?: string;
}

export interface ColorFieldDescriptor extends FieldBase {
  type: 'color';
  /** Allow picking theme tokens ($accent...) besides literal hex. */
  allowTokens: boolean;
}

/** A hex color that may be `null` (= inherit). Used by palette overrides. */
export interface OptionalColorFieldDescriptor extends FieldBase {
  type: 'optional-color';
  inheritLabel: string;
}

export interface NumberFieldDescriptor extends FieldBase {
  type: 'number';
  min: number;
  max: number;
  step: number;
  unit?: string;
  /** Multiply the stored value for display (e.g. 100 for percentages). */
  displayScale?: number;
}

export interface SelectFieldDescriptor extends FieldBase {
  type: 'select';
  options: readonly { value: string | number; label: string }[];
  /** Render as segmented control instead of dropdown. */
  segmented?: boolean;
}

export interface ToggleFieldDescriptor extends FieldBase {
  type: 'toggle';
}

export interface BackgroundFieldDescriptor extends FieldBase {
  type: 'background';
  proceduralVariants: readonly { value: string; label: string }[];
  /** Offer the "inherit" mode (the composition's default background). */
  allowInherit?: boolean;
}

export interface AssetFieldDescriptor extends FieldBase {
  type: 'asset';
  accept: 'image' | 'audio';
}

/** Per-format line break modes, shown as two segmented controls. */
export interface LineBreaksFieldDescriptor extends FieldBase {
  type: 'line-breaks';
}

/**
 * Repeatable group of values with bounds (panels, orbit nodes…). `itemFields` paths are
 * relative to one item; the editor prefixes them with `[...path, index]`.
 */
export interface ListFieldDescriptor extends FieldBase {
  type: 'list';
  min: number;
  max: number;
  /** Singular label for an item ("Painel" → "Painel 1"). */
  itemLabel: string;
  itemFields: readonly ItemFieldDescriptor[];
  /** Value appended by "Adicionar". */
  newItem: unknown;
  /** Field (relative path) whose value titles each item in the list, if any. */
  titlePath?: FieldPath;
}

export type ItemFieldDescriptor =
  | TextFieldDescriptor
  | ColorFieldDescriptor
  | NumberFieldDescriptor
  | SelectFieldDescriptor
  | ToggleFieldDescriptor
  | AssetFieldDescriptor;

export type FieldDescriptor =
  | TextFieldDescriptor
  | ColorFieldDescriptor
  | OptionalColorFieldDescriptor
  | NumberFieldDescriptor
  | SelectFieldDescriptor
  | ToggleFieldDescriptor
  | BackgroundFieldDescriptor
  | AssetFieldDescriptor
  | LineBreaksFieldDescriptor
  | ListFieldDescriptor;

export type FieldType = FieldDescriptor['type'];

export const SECTION_IDS = ['content', 'typography', 'color', 'background', 'element', 'layout', 'animation', 'audio', 'theme'] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export interface FieldSection {
  id: SectionId;
  label: string;
  fields: FieldDescriptor[];
}

export const TARGET_KINDS = ['project', 'scene', 'text', 'graphic', 'overlay'] as const;
export type TargetKind = (typeof TARGET_KINDS)[number];

/**
 * Anything the user can select (in the layer list, the timeline or directly on the
 * canvas). Canvas selection works through `data-lms-target="<id>"` attributes the
 * composition renders on the matching DOM nodes.
 */
export interface EditableTarget {
  id: string;
  label: string;
  kind: TargetKind;
  /** `null` for project-wide targets (theme, overlays, audio). */
  sceneId: string | null;
  sections: FieldSection[];
  /** Path to a boolean that toggles visibility, if the target supports it. */
  visibilityPath?: FieldPath;
  description?: string;
}

/* ------------------------------------------------------------------ */
/* Field builders: keep template code declarative and typo-free.       */
/* ------------------------------------------------------------------ */

export const field = {
  text: (path: FieldPath, label: string, opts: Partial<Omit<TextFieldDescriptor, 'type' | 'path' | 'label'>> = {}): TextFieldDescriptor => ({
    type: 'text',
    path,
    label,
    maxLength: opts.maxLength ?? 80,
    ...opts,
  }),
  color: (path: FieldPath, label: string, allowTokens = true): ColorFieldDescriptor => ({ type: 'color', path, label, allowTokens }),
  optionalColor: (path: FieldPath, label: string, inheritLabel = 'Herdar do tema'): OptionalColorFieldDescriptor => ({
    type: 'optional-color',
    path,
    label,
    inheritLabel,
  }),
  number: (
    path: FieldPath,
    label: string,
    range: { min: number; max: number; step: number; unit?: string; displayScale?: number; hint?: string },
  ): NumberFieldDescriptor => ({ type: 'number', path, label, ...range }),
  select: (
    path: FieldPath,
    label: string,
    options: readonly { value: string | number; label: string }[],
    segmented = false,
  ): SelectFieldDescriptor => ({ type: 'select', path, label, options, segmented }),
  toggle: (path: FieldPath, label: string, hint?: string): ToggleFieldDescriptor => ({ type: 'toggle', path, label, ...(hint ? { hint } : {}) }),
  background: (
    path: FieldPath,
    label: string,
    proceduralVariants: BackgroundFieldDescriptor['proceduralVariants'],
    allowInherit = false,
  ): BackgroundFieldDescriptor => ({
    type: 'background',
    path,
    label,
    proceduralVariants,
    ...(allowInherit ? { allowInherit } : {}),
  }),
  list: (
    path: FieldPath,
    label: string,
    opts: { min: number; max: number; itemLabel: string; itemFields: readonly ItemFieldDescriptor[]; newItem: unknown; titlePath?: FieldPath; hint?: string },
  ): ListFieldDescriptor => ({ type: 'list', path, label, ...opts }),
  asset: (path: FieldPath, label: string, accept: 'image' | 'audio'): AssetFieldDescriptor => ({ type: 'asset', path, label, accept }),
  lineBreaks: (path: FieldPath, label = 'Quebra de linha'): LineBreaksFieldDescriptor => ({ type: 'line-breaks', path, label }),
};
