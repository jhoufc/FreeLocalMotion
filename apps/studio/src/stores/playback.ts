import { create } from 'zustand';
import type { PlayerRef } from '@remotion/player';

/**
 * Playback state lives in its own store so the 30/60 Hz frame updates only re-render the
 * transport and timeline, never the inspector or sidebar.
 */
interface PlaybackState {
  player: PlayerRef | null;
  frame: number;
  playing: boolean;
  loop: boolean;
  buffering: boolean;
  zoom: 'fit' | number;
  showSafeArea: boolean;
  setPlayer(p: PlayerRef | null): void;
  setFrame(f: number): void;
  setPlaying(p: boolean): void;
  setBuffering(b: boolean): void;
  setLoop(l: boolean): void;
  setZoom(z: 'fit' | number): void;
  toggleSafeArea(): void;
  seek(frame: number): void;
  toggle(): void;
  replay(): void;
}

export const usePlayback = create<PlaybackState>((set, get) => ({
  player: null,
  frame: 0,
  playing: false,
  loop: true,
  buffering: false,
  zoom: 'fit',
  showSafeArea: false,
  setPlayer: (player) => set({ player }),
  setFrame: (frame) => {
    if (frame !== get().frame) set({ frame });
  },
  setPlaying: (playing) => set({ playing }),
  setBuffering: (buffering) => set({ buffering }),
  setLoop: (loop) => set({ loop }),
  setZoom: (zoom) => set({ zoom }),
  toggleSafeArea: () => set({ showSafeArea: !get().showSafeArea }),
  seek: (frame) => {
    const f = Math.max(0, Math.round(frame));
    get().player?.seekTo(f);
    set({ frame: f });
  },
  toggle: () => get().player?.toggle(),
  replay: () => {
    const p = get().player;
    if (!p) return;
    p.seekTo(0);
    p.play();
  },
}));
