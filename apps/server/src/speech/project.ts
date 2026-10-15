import fs from 'node:fs/promises';
import path from 'node:path';
import { createId, type Format, type MotionProject, type SpeechSource } from '@lms/shared';
import { evaluatePlan, planSpeech, type SpeechRecord } from '@lms/speech';
import { buildSpeechProject, findStarter, speechSceneTypes } from '@lms/catalog/definitions';
import type { ProjectStore } from '../projects/store';
import { SPEECH_AUDIO, type SpeechService } from './service';

export type SpeechSidecar = SpeechRecord;

const forceOf = (src: SpeechSource) => Object.fromEntries(Object.entries(src.force ?? {}).map(([k, v]) => [Number(k), v]));

/** Plan only (preview in the creation dialog). */
export const previewSpeechPlan = async (speech: SpeechService, src: SpeechSource) => {
  const { transcript, upload } = await speech.resolve(src);
  const types = speechSceneTypes();
  const plan = planSpeech(transcript, types, { force: forceOf(src) });
  return { plan, score: evaluatePlan(plan, types), duration: plan.duration, timed: transcript.timed, hasAudio: Boolean(upload) };
};

/**
 * A free composition planned from speech: scenes chosen and filled by the planner, the
 * speaker's audio as the soundtrack, and the plan saved next to the project.
 */
export const createSpeechProject = async (deps: { store: ProjectStore; speech: SpeechService }, body: { speech: SpeechSource; name?: string; format?: Format }): Promise<MotionProject> => {
  const { transcript, upload } = await deps.speech.resolve(body.speech);
  const types = speechSceneTypes();
  const plan = planSpeech(transcript, types, { force: forceOf(body.speech) });
  const now = new Date().toISOString();
  const theme = body.speech.themeId ? findStarter(body.speech.themeId)?.theme : undefined;
  let audio = null;
  if (upload) {
    const stat = await fs.stat(deps.speech.audioPath(upload.id));
    const assetId = createId('a-');
    audio = { assetId, asset: { id: assetId, kind: 'audio' as const, fileName: SPEECH_AUDIO, originalName: upload.originalName.replace(/\.[a-z0-9]+$/i, '.m4a'), mimeType: 'audio/mp4', size: stat.size, createdAt: now } };
  }
  const name = body.name ?? `Fala — ${plan.ideas[0]?.title ?? 'nova composição'}`.slice(0, 80);
  const { project, plan: built } = buildSpeechProject(plan, { id: createId('p-'), name, format: body.format ?? 'portrait', now, ...(theme ? { theme } : {}), audio });
  const created = await deps.store.createFromDocument(project as unknown as MotionProject, upload ? path.dirname(deps.speech.audioPath(upload.id)) : null);
  const sidecar: SpeechSidecar = {
    version: 1,
    plan: built,
    score: evaluatePlan(built, types),
    transcript: { words: transcript.words, duration: transcript.duration, language: transcript.language, timed: transcript.timed, source: transcript.source },
    uploadId: upload?.id ?? null,
  };
  await deps.store.writeSpeech(created.id, sidecar);
  return created;
};
