import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { KineticText, layoutText, useFontsEpoch, type FontSpec, type TextLayout, type TextUnit } from '@lms/motion-core';
import type { Alignment, Format, TextElement } from '@lms/shared';

export interface TextBox {
  family: string;
  /** Preferred size in px before the user's sizeScale. */
  size: number;
  maxWidth: number;
  maxHeight?: number;
  lineHeight: number;
  minSize?: number;
}

export interface ResolvedText {
  el: TextElement;
  font: FontSpec;
  layout: TextLayout;
}

/**
 * Lays out a text element for the current format: applies line-break mode, size scale and
 * auto-fit, re-measuring once real fonts are loaded.
 */
export const useTextLayout = (el: TextElement, box: TextBox, format: Format): ResolvedText => {
  const epoch = useFontsEpoch();
  return useMemo(() => {
    const font: FontSpec = { family: box.family, weight: el.weight, italic: el.italic, stretch: el.stretch };
    const layout = layoutText({
      content: el.content,
      mode: el.breaks[format],
      font,
      uppercase: el.uppercase,
      trackingEm: el.tracking,
      size: box.size * el.sizeScale,
      maxWidth: box.maxWidth,
      ...(box.maxHeight !== undefined ? { maxHeight: box.maxHeight } : {}),
      lineHeight: box.lineHeight,
      minSize: box.minSize ?? 10,
    });
    return { el, font, layout };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epoch, el, box.family, box.size, box.maxWidth, box.maxHeight, box.lineHeight, box.minSize, format]);
};

export const TextBlock = ({
  text,
  color,
  align,
  split,
  renderUnit,
  renderLine,
  style,
  targetId,
}: {
  text: ResolvedText;
  color: string;
  align: Alignment;
  split: 'words' | 'chars' | 'lines';
  renderUnit: (unit: TextUnit, content: ReactNode) => ReactNode;
  renderLine?: (lineIndex: number, content: ReactNode) => ReactNode;
  style?: CSSProperties;
  targetId: string;
}) => {
  if (!text.el.visible || text.layout.lines.length === 0) return null;
  return (
    <KineticText
      targetId={targetId}
      lines={text.layout.lines}
      split={split}
      font={text.font}
      fontSize={text.layout.fontSize}
      lineHeight={text.layout.lineHeight}
      trackingEm={text.el.tracking}
      color={color}
      align={align}
      renderUnit={renderUnit}
      {...(renderLine ? { renderLine } : {})}
      {...(style ? { style } : {})}
    />
  );
};

export const alignItems = (a: Alignment): CSSProperties['alignItems'] => (a === 'start' ? 'flex-start' : a === 'end' ? 'flex-end' : 'center');
