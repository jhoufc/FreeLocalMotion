import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ImagePlus, Music, Plus, Trash2, Upload } from 'lucide-react';
import {
  BACKGROUND_MODES,
  LINE_BREAK_MODES,
  THEME_TOKENS,
  contrastRatio,
  getAtPath,
  isThemeToken,
  mergePalette,
  pathKey,
  resolveColor,
  type Background,
  type FieldPath,
  type MotionProject,
  type Theme,
} from '@lms/shared';
import type { FieldDescriptor, ListFieldDescriptor } from '@lms/template-sdk';
import { useEditor } from '../stores/editor';

/* ------------------------------------------------------------------ */
/* Plumbing                                                            */
/* ------------------------------------------------------------------ */

const useField = <T,>(path: FieldPath) => {
  const value = useEditor((s) => (s.project ? getAtPath(s.project, path) : undefined)) as T;
  const error = useEditor((s) => s.fieldErrors[pathKey(path)]);
  const update = useEditor((s) => s.update);
  return { value, error, set: (v: unknown, coalesce = false) => update(path, v, { coalesce }) };
};

const Label = ({ children, value }: { children: ReactNode; value?: ReactNode }) => (
  <div className="field-label">
    <span>{children}</span>
    {value !== undefined && <span className="value">{value}</span>}
  </div>
);

const FieldShell = ({ label, value, hint, error, children }: { label: ReactNode; value?: ReactNode; hint?: string; error?: string; children: ReactNode }) => (
  <div className="field">
    <Label value={value}>{label}</Label>
    {children}
    {error ? <div className="field-error">{error}</div> : hint ? <div className="field-hint">{hint}</div> : null}
  </div>
);

/** Scene palette for the scene a path belongs to (for token previews + contrast checks). */
const usePaletteFor = (path: FieldPath): { palette: Theme; project: MotionProject } => {
  const project = useEditor((s) => s.project)!;
  const sceneIdx = path[0] === 'scenes' && typeof path[1] === 'number' ? path[1] : -1;
  const scene = sceneIdx >= 0 ? project.scenes[sceneIdx] : undefined;
  return { palette: mergePalette(project.theme, scene?.palette), project };
};

/* ------------------------------------------------------------------ */
/* Primitive controls (also reused by composite fields)                */
/* ------------------------------------------------------------------ */

export const NumberControl = ({
  value,
  min,
  max,
  step,
  displayScale = 1,
  unit,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  displayScale?: number;
  unit?: string;
  onChange: (v: number, coalesce: boolean) => void;
}) => {
  const [draft, setDraft] = useState<string | null>(null);
  const fill = ((value - min) / (max - min)) * 100;
  const shown = Math.round(value * displayScale * 1000) / 1000;
  const decimals = step * displayScale < 1 ? Math.min(3, String(step * displayScale).split('.')[1]?.length ?? 2) : 0;
  const commit = (raw: string) => {
    setDraft(null);
    const n = Number(raw.replace(',', '.'));
    if (!Number.isFinite(n)) return;
    onChange(Math.min(max, Math.max(min, n / displayScale)), false);
  };
  return (
    <div className="field-row">
      <input
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ['--fill' as string]: `${fill}%` }}
        onChange={(e) => onChange(Number(e.target.value), true)}
      />
      <input
        className="input num-input"
        value={draft ?? `${shown.toFixed(decimals)}${unit && unit !== '%' && unit !== '×' ? '' : ''}`}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
          if (e.key === 'Escape') setDraft(null);
        }}
        title={unit}
      />
    </div>
  );
};

export const ColorControl = ({
  value,
  palette,
  allowTokens,
  onChange,
}: {
  value: string;
  palette: Theme;
  allowTokens: boolean;
  onChange: (v: string, coalesce: boolean) => void;
}) => {
  const resolved = resolveColor(value, palette);
  const [hex, setHex] = useState(resolved.toUpperCase());
  useEffect(() => setHex(resolved.toUpperCase()), [resolved]);
  return (
    <div style={{ display: 'grid', gap: 7 }}>
      {allowTokens && (
        <div className="swatches">
          {THEME_TOKENS.map((tok) => (
            <button
              key={tok}
              className={`swatch ${value === `$${tok}` ? 'on' : ''}`}
              style={{ background: palette[tok] }}
              title={`Tema: ${tok}`}
              onClick={() => onChange(`$${tok}`, false)}
            />
          ))}
        </div>
      )}
      <div className="color-input">
        <label className="color-chip" style={{ background: resolved }} title="Escolher cor">
          <input type="color" value={resolved.slice(0, 7)} onChange={(e) => onChange(e.target.value.toUpperCase(), true)} />
        </label>
        <input
          className="input mono"
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          onBlur={() => /^#[0-9a-fA-F]{6}$/.test(hex) && onChange(hex.toUpperCase(), false)}
          onKeyDown={(e) => e.key === 'Enter' && /^#[0-9a-fA-F]{6}$/.test(hex) && onChange(hex.toUpperCase(), false)}
        />
        {allowTokens && isThemeToken(value) && <span className="tag">{value.slice(1)}</span>}
      </div>
    </div>
  );
};

const Segmented = <V extends string | number>({ value, options, onChange }: { value: V; options: readonly { value: V; label: string }[]; onChange: (v: V) => void }) => (
  <div className="segmented">
    {options.map((o) => (
      <button key={String(o.value)} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
        {o.label}
      </button>
    ))}
  </div>
);

const Switch = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
  <button className={`switch ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />
);

/* ------------------------------------------------------------------ */
/* Asset picker (images for backgrounds, audio for soundtrack)         */
/* ------------------------------------------------------------------ */

const AssetPicker = ({ accept, value, onChange }: { accept: 'image' | 'audio'; value: string | null; onChange: (id: string | null) => void }) => {
  const project = useEditor((s) => s.project)!;
  const upload = useEditor((s) => s.uploadAsset);
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const assets = project.assets.filter((a) => a.kind === accept);
  const current = assets.find((a) => a.id === value);
  const handle = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    const id = await upload(file);
    setBusy(false);
    if (id) onChange(id);
  };
  const url = (fileName: string) => `/api/projects/${project.id}/assets/${fileName}`;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {current ? (
        <div className="asset-preview">
          {accept === 'image' ? <img src={url(current.fileName)} alt="" /> : <Music size={18} style={{ color: 'var(--track-audio)' }} />}
          <div className="grow" title={current.originalName}>
            {current.originalName}
            <div className="muted" style={{ fontSize: 10.5 }}>
              {(current.size / 1024 / 1024).toFixed(2)} MB
            </div>
          </div>
          <button className="icon-btn sm" title="Remover" onClick={() => onChange(null)}>
            <Trash2 size={13} />
          </button>
        </div>
      ) : null}
      {accept === 'audio' && current ? <audio src={url(current.fileName)} controls style={{ width: '100%', height: 30 }} /> : null}
      <div
        className={`dropzone ${over ? 'over' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void handle(e.dataTransfer.files[0]);
        }}
      >
        {accept === 'image' ? <ImagePlus size={18} /> : <Upload size={18} />}
        <span>{busy ? 'Enviando…' : accept === 'image' ? 'Solte uma imagem ou clique (PNG, JPG, WEBP)' : 'Solte um áudio ou clique (MP3, WAV, M4A)'}</span>
        <input
          ref={inputRef}
          type="file"
          hidden
          accept={accept === 'image' ? 'image/png,image/jpeg,image/webp,image/gif' : 'audio/*'}
          onChange={(e) => {
            void handle(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {assets.length > 1 || (assets.length === 1 && !current) ? (
        <select className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">— Biblioteca do projeto —</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.originalName}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Background editor                                                   */
/* ------------------------------------------------------------------ */

const MODE_LABEL: Record<(typeof BACKGROUND_MODES)[number], string> = { procedural: 'Procedural', solid: 'Sólida', gradient: 'Gradiente', image: 'Imagem', inherit: 'Herdar' };

const BackgroundEditor = ({ path, variants, allowInherit }: { path: FieldPath; variants: readonly { value: string; label: string }[]; allowInherit: boolean }) => {
  const { value: bg } = useField<Background>(path);
  const update = useEditor((s) => s.update);
  const { palette } = usePaletteFor(path);
  const set = (sub: (string | number)[], v: unknown, coalesce = false) => update([...path, ...sub], v, { coalesce });
  if (!bg) return null;
  const stops = [...bg.gradient.stops].map((s, i) => ({ ...s, i })).sort((a, b) => a.position - b.position);
  const gradientCss = `linear-gradient(90deg, ${stops.map((s) => `${resolveColor(s.color, palette)} ${s.position * 100}%`).join(', ')})`;

  return (
    <div style={{ display: 'grid', gap: 11 }}>
      <Segmented
        value={bg.mode}
        options={BACKGROUND_MODES.filter((m) => m !== 'inherit' || allowInherit || bg.mode === 'inherit').map((m) => ({ value: m, label: MODE_LABEL[m] }))}
        onChange={(m) => set(['mode'], m)}
      />
      {bg.mode === 'inherit' && <div className="field-hint">Usa o background padrão da composição (em “Composição e estilo”). As configurações abaixo ficam guardadas.</div>}
      {bg.mode === 'procedural' && (
        <>
          <FieldShell label="Variação">
            <select className="select" value={bg.procedural.variant} onChange={(e) => set(['procedural', 'variant'], e.target.value)}>
              {variants.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </FieldShell>
          <FieldShell label="Cor base">
            <ColorControl value={bg.procedural.base} palette={palette} allowTokens onChange={(v, c) => set(['procedural', 'base'], v, c)} />
          </FieldShell>
          <FieldShell label="Intensidade" value={`${Math.round(bg.procedural.intensity * 100)}%`}>
            <NumberControl value={bg.procedural.intensity} min={0} max={2} step={0.01} displayScale={100} onChange={(v, c) => set(['procedural', 'intensity'], v, c)} />
          </FieldShell>
        </>
      )}
      {bg.mode === 'solid' && (
        <FieldShell label="Cor">
          <ColorControl value={bg.solid.color} palette={palette} allowTokens onChange={(v, c) => set(['solid', 'color'], v, c)} />
        </FieldShell>
      )}
      {bg.mode === 'gradient' && (
        <>
          <div className="gradient-preview" style={{ background: gradientCss }} />
          <Segmented
            value={bg.gradient.kind}
            options={[
              { value: 'linear', label: 'Linear' },
              { value: 'radial', label: 'Radial' },
            ]}
            onChange={(v) => set(['gradient', 'kind'], v)}
          />
          {bg.gradient.kind === 'linear' && (
            <FieldShell label="Ângulo" value={`${Math.round(bg.gradient.angle)}°`}>
              <NumberControl value={bg.gradient.angle} min={0} max={360} step={1} onChange={(v, c) => set(['gradient', 'angle'], v, c)} />
            </FieldShell>
          )}
          <FieldShell label="Movimento (°/s)" value={bg.gradient.drift.toFixed(0)} hint="Rotação lenta que dá direção ao gradiente.">
            <NumberControl value={bg.gradient.drift} min={0} max={60} step={1} onChange={(v, c) => set(['gradient', 'drift'], v, c)} />
          </FieldShell>
          <Label>Paradas de cor</Label>
          {bg.gradient.stops.map((stop, i) => (
            <div key={i} className="stop-row">
              <ColorControl value={stop.color} palette={palette} allowTokens={false} onChange={(v, c) => set(['gradient', 'stops', i, 'color'], v, c)} />
              <input
                className="input num-input"
                style={{ width: '100%' }}
                type="number"
                min={0}
                max={100}
                value={Math.round(stop.position * 100)}
                onChange={(e) => set(['gradient', 'stops', i, 'position'], Math.min(1, Math.max(0, Number(e.target.value) / 100)), true)}
              />
              <button
                className="icon-btn sm"
                disabled={bg.gradient.stops.length <= 2}
                title="Remover parada"
                onClick={() => set(['gradient', 'stops'], bg.gradient.stops.filter((_, j) => j !== i))}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button
            className="btn sm"
            disabled={bg.gradient.stops.length >= 5}
            onClick={() => set(['gradient', 'stops'], [...bg.gradient.stops, { color: '$accent', position: 1 }])}
          >
            <Plus size={13} /> Adicionar cor
          </button>
        </>
      )}
      {bg.mode === 'image' && (
        <>
          <AssetPicker accept="image" value={bg.image.assetId} onChange={(id) => set(['image', 'assetId'], id)} />
          <Segmented
            value={bg.image.fit}
            options={[
              { value: 'cover', label: 'Preencher' },
              { value: 'contain', label: 'Conter' },
            ]}
            onChange={(v) => set(['image', 'fit'], v)}
          />
          <FieldShell label="Escala" value={`${Math.round(bg.image.scale * 100)}%`}>
            <NumberControl value={bg.image.scale} min={0.5} max={3} step={0.01} displayScale={100} onChange={(v, c) => set(['image', 'scale'], v, c)} />
          </FieldShell>
          <FieldShell label="Posição X" value={bg.image.x.toFixed(2)}>
            <NumberControl value={bg.image.x} min={-1} max={1} step={0.01} onChange={(v, c) => set(['image', 'x'], v, c)} />
          </FieldShell>
          <FieldShell label="Posição Y" value={bg.image.y.toFixed(2)}>
            <NumberControl value={bg.image.y} min={-1} max={1} step={0.01} onChange={(v, c) => set(['image', 'y'], v, c)} />
          </FieldShell>
          <FieldShell label="Push-in na cena" value={`${Math.round(bg.image.motion * 100)}%`}>
            <NumberControl value={bg.image.motion} min={0} max={0.3} step={0.005} displayScale={100} onChange={(v, c) => set(['image', 'motion'], v, c)} />
          </FieldShell>
          <FieldShell label="Desfoque" value={`${bg.image.blur.toFixed(0)}px`}>
            <NumberControl value={bg.image.blur} min={0} max={40} step={1} onChange={(v, c) => set(['image', 'blur'], v, c)} />
          </FieldShell>
          <FieldShell label="Opacidade" value={`${Math.round(bg.image.opacity * 100)}%`}>
            <NumberControl value={bg.image.opacity} min={0} max={1} step={0.01} displayScale={100} onChange={(v, c) => set(['image', 'opacity'], v, c)} />
          </FieldShell>
          <FieldShell label="Cor de sobreposição">
            <ColorControl value={bg.image.overlayColor} palette={palette} allowTokens={false} onChange={(v, c) => set(['image', 'overlayColor'], v, c)} />
          </FieldShell>
          <FieldShell label="Sobreposição" value={`${Math.round(bg.image.overlayOpacity * 100)}%`}>
            <NumberControl value={bg.image.overlayOpacity} min={0} max={1} step={0.01} displayScale={100} onChange={(v, c) => set(['image', 'overlayOpacity'], v, c)} />
          </FieldShell>
        </>
      )}
      {bg.mode !== 'procedural' && bg.mode !== 'inherit' && (
        <div className="toggle-row">
          <span>Textura do template (grade)</span>
          <Switch on={bg.texture} label="Textura" onChange={(v) => set(['texture'], v)} />
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Repeatable groups (panels, nodes…)                                  */
/* ------------------------------------------------------------------ */

const ListEditor = ({ field, items }: { field: ListFieldDescriptor; items: unknown[] }) => {
  const update = useEditor((s) => s.update);
  const error = useEditor((s) => s.fieldErrors[pathKey(field.path)]);
  const setItems = (next: unknown[]) => update(field.path, next);
  const move = (i: number, d: number) => {
    const next = [...items];
    const [it] = next.splice(i, 1);
    next.splice(i + d, 0, it);
    setItems(next);
  };
  return (
    <div className="field list-field">
      <Label value={`${items.length}/${field.max}`}>{field.label}</Label>
      {items.map((item, i) => {
        const title = field.titlePath ? getAtPath(item, field.titlePath) : null;
        return (
          <div key={i} className="list-item">
            <div className="list-item-head">
              <b>
                {field.itemLabel} {i + 1}
                {typeof title === 'string' && title ? <span className="muted"> · {title}</span> : null}
              </b>
              <button className="icon-btn sm" title="Mover para cima" disabled={i === 0} onClick={() => move(i, -1)}>
                <ChevronUp size={13} />
              </button>
              <button className="icon-btn sm" title="Mover para baixo" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                <ChevronDown size={13} />
              </button>
              <button className="icon-btn sm" title="Remover" disabled={items.length <= field.min} onClick={() => setItems(items.filter((_, j) => j !== i))}>
                <Trash2 size={13} />
              </button>
            </div>
            {field.itemFields.map((f) => (
              <FieldControl key={f.path.join('.')} field={{ ...f, path: [...field.path, i, ...f.path] } as FieldDescriptor} />
            ))}
          </div>
        );
      })}
      <button className="btn sm" disabled={items.length >= field.max} onClick={() => setItems([...items, structuredClone(field.newItem)])}>
        <Plus size={13} /> Adicionar {field.itemLabel.toLowerCase()}
      </button>
      {error ? <div className="field-error">{error}</div> : field.hint ? <div className="field-hint">{field.hint}</div> : null}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Field renderer                                                      */
/* ------------------------------------------------------------------ */

const BREAK_LABEL: Record<(typeof LINE_BREAK_MODES)[number], string> = { manual: 'Manual', single: '1 linha', words: 'Palavras', auto: 'Auto' };

export const FieldControl = ({ field }: { field: FieldDescriptor }) => {
  const { value, error, set } = useField<unknown>(field.path);
  const { palette, project } = usePaletteFor(field.path);

  switch (field.type) {
    case 'text': {
      const v = String(value ?? '');
      return (
        <FieldShell label={field.label} value={`${v.length}/${field.maxLength}`} {...(field.hint ? { hint: field.hint } : {})} {...(error ? { error } : {})}>
          {field.multiline ? (
            <textarea className="textarea" rows={2} maxLength={field.maxLength} value={v} onChange={(e) => set(e.target.value, true)} spellCheck={false} />
          ) : (
            <input className="input" maxLength={field.maxLength} value={v} onChange={(e) => set(e.target.value, true)} spellCheck={false} />
          )}
        </FieldShell>
      );
    }
    case 'color': {
      const v = String(value ?? '#FFFFFF');
      // Contrast warning for text colors against the scene background.
      const isTextColor = field.path.includes('texts');
      const ratio = isTextColor ? contrastRatio(resolveColor(v, palette), palette.background) : 99;
      return (
        <FieldShell label={field.label} {...(error ? { error } : {})}>
          <ColorControl value={v} palette={field.allowTokens ? palette : project.theme} allowTokens={field.allowTokens} onChange={(nv, c) => set(nv, c)} />
          {ratio < 3 && (
            <div className="contrast-warn">
              <AlertTriangle size={12} /> Contraste baixo com o fundo ({ratio.toFixed(1)}:1)
            </div>
          )}
        </FieldShell>
      );
    }
    case 'optional-color': {
      const v = value as string | null;
      const key = field.path[field.path.length - 1] as keyof Theme;
      return (
        <div className="field">
          <div className="toggle-row">
            <span>{field.label}</span>
            <div className="field-row" style={{ width: 'auto' }}>
              <span className="muted" style={{ fontSize: 11 }}>
                {v === null ? field.inheritLabel : 'Personalizada'}
              </span>
              <Switch on={v !== null} label={field.label} onChange={(on) => set(on ? project.theme[key] : null)} />
            </div>
          </div>
          {v !== null && <ColorControl value={v} palette={palette} allowTokens={false} onChange={(nv, c) => set(nv, c)} />}
        </div>
      );
    }
    case 'number': {
      const v = Number(value ?? field.min);
      const scale = field.displayScale ?? 1;
      return (
        <FieldShell
          label={field.label}
          value={`${(v * scale).toFixed(field.step * scale < 1 ? 2 : 0)}${field.unit ?? ''}`}
          {...(field.hint ? { hint: field.hint } : {})}
          {...(error ? { error } : {})}
        >
          <NumberControl value={v} min={field.min} max={field.max} step={field.step} displayScale={scale} {...(field.unit ? { unit: field.unit } : {})} onChange={(nv, c) => set(nv, c)} />
        </FieldShell>
      );
    }
    case 'select': {
      return (
        <FieldShell label={field.label} {...(error ? { error } : {})}>
          {field.segmented ? (
            <Segmented value={value as string | number} options={field.options} onChange={(nv) => set(nv)} />
          ) : (
            <select
              className="select"
              value={String(value)}
              onChange={(e) => {
                const opt = field.options.find((o) => String(o.value) === e.target.value);
                if (opt) set(opt.value);
              }}
            >
              {field.options.map((o) => (
                <option key={String(o.value)} value={String(o.value)}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </FieldShell>
      );
    }
    case 'toggle':
      return (
        <div className="field">
          <div className="toggle-row">
            <span>{field.label}</span>
            <Switch on={Boolean(value)} label={field.label} onChange={(nv) => set(nv)} />
          </div>
          {field.hint && <div className="field-hint">{field.hint}</div>}
        </div>
      );
    case 'background':
      return <BackgroundEditor path={field.path} variants={field.proceduralVariants} allowInherit={Boolean(field.allowInherit)} />;
    case 'list':
      return <ListEditor field={field} items={(value as unknown[] | undefined) ?? []} />;
    case 'asset':
      return (
        <FieldShell label={field.label} {...(error ? { error } : {})}>
          <AssetPicker accept={field.accept} value={(value as string | null) ?? null} onChange={(id) => set(id)} />
        </FieldShell>
      );
    case 'line-breaks': {
      const v = value as { portrait: string; landscape: string };
      const opts = LINE_BREAK_MODES.map((m) => ({ value: m, label: BREAK_LABEL[m] }));
      const update = useEditor.getState().update;
      return (
        <div className="field">
          <Label>{field.label}</Label>
          <div className="field-row">
            <span className="muted" style={{ width: 62, fontSize: 11 }}>
              Vertical
            </span>
            <div style={{ flex: 1 }}>
              <Segmented value={v.portrait} options={opts} onChange={(m) => update([...field.path, 'portrait'], m)} />
            </div>
          </div>
          <div className="field-row">
            <span className="muted" style={{ width: 62, fontSize: 11 }}>
              Horizontal
            </span>
            <div style={{ flex: 1 }}>
              <Segmented value={v.landscape} options={opts} onChange={(m) => update([...field.path, 'landscape'], m)} />
            </div>
          </div>
        </div>
      );
    }
  }
};
