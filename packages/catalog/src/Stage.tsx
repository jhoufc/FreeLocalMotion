import { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import type { MotionProject } from '@lms/shared';
import { AssetProvider, createAssetResolver } from '@lms/template-sdk';
import { templateModules } from './modules';

export interface StageProps extends Record<string, unknown> {
  project: MotionProject;
  /** Origin that serves `/api/projects/:id/assets/*`. Empty string = same origin. */
  assetBaseUrl: string;
}

/**
 * The one component both the Studio Player and the Remotion renderer mount.
 * Same code path, same data, same asset files: preview and MP4 cannot diverge.
 */
export const TemplateStage = ({ project, assetBaseUrl }: StageProps) => {
  const template = templateModules.find(project.templateId);
  const resolver = useMemo(() => createAssetResolver(project, assetBaseUrl), [project, assetBaseUrl]);
  if (!template) {
    return (
      <AbsoluteFill style={{ background: '#200', color: '#fff', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
        Unknown template “{project.templateId}”
      </AbsoluteFill>
    );
  }
  const { Component } = template;
  return (
    <AssetProvider resolver={resolver}>
      <Component project={project} />
    </AssetProvider>
  );
};
