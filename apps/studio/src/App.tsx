import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useEditor } from './stores/editor';
import { usePlayback } from './stores/playback';
import { useProjectModel } from './editor/useProjectModel';
import { sceneCommands } from './editor/sceneCommands';
import { TopBar } from './components/TopBar';
import { Toasts, isTypingTarget } from './components/ui';
import { LeftSidebar } from './panels/LeftSidebar';
import { Inspector } from './panels/Inspector';
import { StagePanel } from './player/StagePanel';
import { Timeline } from './timeline/Timeline';
import type { MotionProject } from '@lms/shared';

const useShortcuts = (durationInFrames: number, fps: number) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const ed = useEditor.getState();
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void ed.save();
        return;
      }
      if (isTypingTarget(e.target)) return;
      const pb = usePlayback.getState();
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) ed.redo();
        else ed.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        ed.redo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        // Also blocks the browser's "bookmark page" shortcut while editing.
        e.preventDefault();
        const sceneId = sceneCommands.selectedSceneId();
        if (sceneId) sceneCommands.duplicate(sceneId);
        return;
      }
      if (e.key === 'Delete' && !mod) {
        // Only when the scene itself is selected: Delete on a text/graphic must not
        // silently remove the whole scene around it.
        const sceneId = sceneCommands.selectedSceneId();
        if (sceneId && ed.selectedTargetId === sceneId) {
          e.preventDefault();
          sceneCommands.remove(sceneId);
        }
        return;
      }
      switch (e.key) {
        case ' ':
          e.preventDefault();
          pb.toggle();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          pb.seek(Math.max(0, pb.frame - (e.shiftKey ? fps : 1)));
          break;
        case 'ArrowRight':
          e.preventDefault();
          pb.seek(Math.min(durationInFrames - 1, pb.frame + (e.shiftKey ? fps : 1)));
          break;
        case 'Home':
          pb.seek(0);
          break;
        case 'End':
          pb.seek(durationInFrames - 1);
          break;
        case 'l':
        case 'L':
          pb.setLoop(!pb.loop);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [durationInFrames, fps]);
};

const Workspace = ({ project }: { project: MotionProject }) => {
  const model = useProjectModel(project);
  useShortcuts(model.durationInFrames, model.fps);
  return (
    <div className="app">
      <TopBar project={project} />
      <LeftSidebar project={project} model={model} />
      <StagePanel project={project} model={model} />
      <Inspector project={project} model={model} />
      <Timeline project={project} model={model} />
    </div>
  );
};

export const App = () => {
  const ready = useEditor((s) => s.ready);
  const project = useEditor((s) => s.project);
  useEffect(() => {
    void useEditor.getState().init();
    const beforeUnload = (e: BeforeUnloadEvent) => {
      const st = useEditor.getState().saveState;
      if (st === 'dirty' || st === 'saving') {
        void useEditor.getState().save();
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);

  return (
    <>
      {!ready ? (
        <div className="boot">
          <Loader2 className="spin" />
        </div>
      ) : project ? (
        <Workspace project={project} />
      ) : (
        <div className="boot">
          <div style={{ textAlign: 'center', display: 'grid', gap: 12 }}>
            <b style={{ color: 'var(--text-0)', fontSize: 15 }}>Nenhum projeto aberto</b>
            <span>O servidor local está rodando? Inicie com <span className="mono">pnpm dev</span>.</span>
            <button className="btn primary" style={{ justifySelf: 'center' }} onClick={() => void useEditor.getState().init()}>
              Tentar novamente
            </button>
          </div>
        </div>
      )}
      <Toasts />
    </>
  );
};
