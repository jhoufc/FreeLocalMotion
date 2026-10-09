import type { CSSProperties, ReactNode } from 'react';
import type { Alignment } from '@lms/shared';
import { STRETCH_PERCENT, type FontSpec } from '../text/measure';

export interface TextUnit {
  text: string;
  /** Index among all units of the block. */
  index: number;
  count: number;
  lineIndex: number;
  lineCount: number;
  indexInLine: number;
  countInLine: number;
  /** For char units: index of the word they belong to (global). */
  wordIndex: number;
}

export interface KineticTextProps {
  lines: readonly string[];
  split: 'words' | 'chars' | 'lines';
  font: FontSpec;
  fontSize: number;
  lineHeight: number;
  trackingEm: number;
  color: string;
  align?: Alignment;
  /** Renders one unit. Return the unit wrapped in whatever motion it needs. */
  renderUnit: (unit: TextUnit, content: ReactNode) => ReactNode;
  /** Optional per-line wrapper (line-level masks, offsets). */
  renderLine?: (lineIndex: number, content: ReactNode) => ReactNode;
  style?: CSSProperties;
  targetId?: string;
}

const alignToCss = (a: Alignment): CSSProperties['textAlign'] => (a === 'start' ? 'left' : a === 'end' ? 'right' : 'center');

/**
 * Typographic choreography primitive. It only splits and lays out text; *how* each unit
 * moves is provided by the caller, keeping the motion vocabulary in the template.
 */
export const KineticText = ({
  lines,
  split,
  font,
  fontSize,
  lineHeight,
  trackingEm,
  color,
  align = 'center',
  renderUnit,
  renderLine,
  style,
  targetId,
}: KineticTextProps) => {
  type Prepared = { units: { text: string; wordIndex: number; isSpace: boolean }[] };
  let wordCounter = 0;
  const prepared: Prepared[] = lines.map((line) => {
    if (split === 'lines') return { units: [{ text: line, wordIndex: wordCounter++, isSpace: false }] };
    const words = line.split(' ');
    const units: Prepared['units'] = [];
    words.forEach((word, wi) => {
      const wordIndex = wordCounter++;
      if (split === 'words') units.push({ text: word, wordIndex, isSpace: false });
      else for (const ch of Array.from(word)) units.push({ text: ch, wordIndex, isSpace: false });
      if (wi < words.length - 1) units.push({ text: ' ', wordIndex, isSpace: true });
    });
    return { units };
  });
  const count = prepared.reduce((acc, l) => acc + l.units.filter((u) => !u.isSpace).length, 0);
  let index = 0;

  return (
    <div
      data-lms-target={targetId}
      style={{
        fontFamily: `"${font.family}"`,
        fontWeight: font.weight,
        fontStyle: font.italic ? 'italic' : 'normal',
        fontStretch: STRETCH_PERCENT[font.stretch ?? 'normal'],
        fontSize,
        lineHeight,
        letterSpacing: `${trackingEm}em`,
        color,
        textAlign: alignToCss(align),
        whiteSpace: 'pre',
        fontKerning: 'normal',
        fontFeatureSettings: '"kern" 1, "liga" 1',
        ...style,
      }}
    >
      {prepared.map((line, lineIndex) => {
        const visible = line.units.filter((u) => !u.isSpace);
        let indexInLine = 0;
        const content = line.units.map((u, i) => {
          if (u.isSpace) return <span key={i}> </span>;
          const unit: TextUnit = {
            text: u.text,
            index: index++,
            count,
            lineIndex,
            lineCount: prepared.length,
            indexInLine: indexInLine++,
            countInLine: visible.length,
            wordIndex: u.wordIndex,
          };
          return <span key={i}>{renderUnit(unit, u.text)}</span>;
        });
        const lineNode = <div style={{ display: 'block' }}>{content}</div>;
        return <div key={lineIndex}>{renderLine ? renderLine(lineIndex, lineNode) : lineNode}</div>;
      })}
    </div>
  );
};
