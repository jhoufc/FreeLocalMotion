import type { ReactNode } from 'react';
import { round } from '@lms/motion-core';
import { withAlpha } from '@lms/shared';

export const DEVICE_MODELS = {
  graphite: { frame: ['#3B3D44', '#121317', '#2A2C33'], edge: 'rgba(255,255,255,0.18)' },
  silver: { frame: ['#E9EBF0', '#9EA3AD', '#D6D9E0'], edge: 'rgba(255,255,255,0.6)' },
  midnight: { frame: ['#1E2440', '#0A0D1C', '#252C52'], edge: 'rgba(160,180,255,0.25)' },
  gold: { frame: ['#F2D9AE', '#A4855A', '#E7C894'], edge: 'rgba(255,240,210,0.55)' },
} as const;
export type DeviceModel = keyof typeof DEVICE_MODELS;

/**
 * Premium phone built with CSS (no 3D model needed): metal frame with a lit edge, bezel,
 * dynamic island, glass glare and side buttons. Works inside CSS 3D transforms.
 */
export const Phone = ({ w, model, screen, glare = 0.5, glareX = 0.3 }: { w: number; model: DeviceModel; screen: ReactNode; glare?: number; glareX?: number }) => {
  const h = w * 2.06;
  const m = DEVICE_MODELS[model];
  const r = w * 0.17;
  const bezel = w * 0.035;
  return (
    <div style={{ position: 'relative', width: w, height: h }}>
      {/* side buttons */}
      <div style={{ position: 'absolute', left: -w * 0.012, top: h * 0.2, width: w * 0.016, height: h * 0.07, borderRadius: 4, background: m.frame[1] }} />
      <div style={{ position: 'absolute', left: -w * 0.012, top: h * 0.3, width: w * 0.016, height: h * 0.11, borderRadius: 4, background: m.frame[1] }} />
      <div style={{ position: 'absolute', right: -w * 0.012, top: h * 0.26, width: w * 0.016, height: h * 0.15, borderRadius: 4, background: m.frame[1] }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: r,
          background: `linear-gradient(135deg, ${m.frame[0]}, ${m.frame[1]} 45%, ${m.frame[2]})`,
          boxShadow: `inset 0 0 0 ${round(w * 0.006, 2)}px ${m.edge}, 0 ${round(w * 0.12, 2)}px ${round(w * 0.3, 2)}px rgba(0,0,0,0.5)`,
          padding: bezel,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: r - bezel, overflow: 'hidden', background: '#000' }}>
          <div style={{ position: 'absolute', inset: 0 }}>{screen}</div>
          <div style={{ position: 'absolute', left: '50%', top: w * 0.035, width: w * 0.3, height: w * 0.085, marginLeft: -w * 0.15, borderRadius: 99, background: '#000' }} />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(115deg, transparent ${round(glareX * 100 - 18, 2)}%, ${withAlpha('#FFFFFF', 0.22 * glare)} ${round(glareX * 100, 2)}%, transparent ${round(glareX * 100 + 14, 2)}%)`,
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
};
