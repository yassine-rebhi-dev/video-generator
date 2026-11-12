/** One spoken word with its position on the final video's clock, in seconds. */
export interface WordTiming {
  text: string;
  start: number;
  end: number;
  sceneIndex: number;
}

export interface SceneTiming {
  index: number;
  start: number;
  end: number;
  /** Length of the narration audio alone, without the trailing gap. */
  audioDuration: number;
  audioPath: string;
  clipPath: string;
}

export interface Timeline {
  width: number;
  height: number;
  fps: number;
  duration: number;
  crossfade: number;
  scenes: SceneTiming[];
  musicPath?: string;
}

export interface GenerateRequest {
  topic: string;
  style: string;
  /** Target length in seconds; the writer aims for it through a word budget. */
  durationSec: number;
  voice?: string;
}
