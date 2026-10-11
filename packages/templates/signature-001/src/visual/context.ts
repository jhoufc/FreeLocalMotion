import type { SceneRuntime } from '@lms/template-sdk';
import type { AnyScene } from '../schema';

/** Everything a scene needs to draw a frame: the SDK's scene runtime for Signature scenes. */
export type SceneEnv<S extends AnyScene = AnyScene> = SceneRuntime<S>;
