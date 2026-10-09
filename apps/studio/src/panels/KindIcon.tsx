import { Clapperboard, Layers, Music, Settings2, Shapes, Square, Type } from 'lucide-react';
import type { TargetKind, TimelineLayerKind } from '@lms/template-sdk';

export const KindIcon = ({ kind, size = 13 }: { kind: TargetKind | TimelineLayerKind; size?: number }) => {
  switch (kind) {
    case 'text':
      return <Type size={size} />;
    case 'graphic':
      return <Shapes size={size} />;
    case 'overlay':
      return <Layers size={size} />;
    case 'scene':
      return <Clapperboard size={size} />;
    case 'background':
      return <Square size={size} />;
    case 'audio':
      return <Music size={size} />;
    case 'project':
    default:
      return <Settings2 size={size} />;
  }
};
