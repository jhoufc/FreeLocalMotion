import { Composition, type CalculateMetadataFunction } from 'remotion';
import { templateModules } from '../modules';
import { TemplateStage, type StageProps } from '../Stage';

const calculateMetadata: CalculateMetadataFunction<StageProps> = ({ props }) => {
  const template = templateModules.get(props.project.templateId);
  const meta = template.getMetadata(props.project);
  return { width: meta.width, height: meta.height, fps: meta.fps, durationInFrames: meta.durationInFrames };
};

/**
 * One Remotion composition per registered template. The server passes the project
 * snapshot as input props; dimensions / fps / duration come from the template itself.
 */
export const RemotionRoot = () => (
  <>
    {templateModules.list().map((template) => {
      const project = template.createDefaults({
        id: 'preview-default',
        name: template.name,
        format: template.formats[0]!,
        now: new Date(0).toISOString(),
      });
      const meta = template.getMetadata(project);
      return (
        <Composition
          key={template.id}
          id={template.id}
          component={TemplateStage}
          defaultProps={{ project, assetBaseUrl: '' } satisfies StageProps}
          calculateMetadata={calculateMetadata}
          width={meta.width}
          height={meta.height}
          fps={meta.fps}
          durationInFrames={meta.durationInFrames}
        />
      );
    })}
  </>
);
