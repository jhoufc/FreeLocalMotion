import { Html5Audio, interpolate, useVideoConfig } from 'remotion';
import { Grain, round } from '@lms/motion-core';
import { resolveColor, withAlpha, type AudioSettings, type GraphicElement, type Theme } from '@lms/shared';
import { useAssets } from '@lms/template-sdk';

/** Project soundtrack with frame-exact fades (volume is a function of the frame). */
export const Soundtrack = ({ audio, durationInFrames }: { audio: AudioSettings; durationInFrames: number }) => {
  const assets = useAssets();
  const { fps } = useVideoConfig();
  const src = assets.url(audio.assetId);
  if (!src) return null;
  const { volume, fadeIn, fadeOut } = audio;
  const fi = Math.max(1, Math.round(fadeIn * fps));
  const fo = Math.max(1, Math.round(fadeOut * fps));
  return (
    <Html5Audio
      src={src}
      volume={(f) =>
        volume *
        Math.min(
          interpolate(f, [0, fi], [fadeIn > 0 ? 0 : 1, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          interpolate(f, [durationInFrames - fo, durationInFrames], [1, fadeOut > 0 ? 0 : 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        )
      }
    />
  );
};

/** Film finish over every scene: vignette + animated grain (seeded, deterministic). */
export const FinishOverlays = ({ grain, vignette, theme, t, seed = 'lms-grain' }: { grain: GraphicElement; vignette: GraphicElement; theme: Theme; t: number; seed?: string }) => (
  <>
    {vignette.visible ? (
      <div
        data-lms-target="global.vignette"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: `radial-gradient(ellipse ${round(120 - vignette.intensity * 25, 2)}% ${round(110 - vignette.intensity * 25, 2)}% at 50% 50%, transparent 45%, ${withAlpha(
            resolveColor(vignette.color, theme),
            vignette.opacity,
          )} 100%)`,
        }}
      />
    ) : null}
    {grain.visible ? <Grain t={t} opacity={0.075 * grain.intensity * grain.opacity} seed={seed} /> : null}
  </>
);
