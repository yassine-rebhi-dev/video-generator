# Third-party material

Everything reused from another project is listed here with its licence and source.

## Code copied from other repositories

**None.** No source code, prompt text or asset from another repository is in this project. The repositories under `research/` were read for ideas only; their clones are git-ignored and are not distributed.

## Ideas reimplemented (no code copied)

| Idea | Learned from | Licence of source | Source |
|---|---|---|---|
| Script text is the caption source of truth; speech recognition only supplies timing | MoneyPrinterTurbo | MIT | https://github.com/harry0703/MoneyPrinterTurbo |
| Per-task artifact directory; sub-pixel zoom on a fixed canvas for stills | MoneyPrinterTurbo | MIT | same |
| Scene as the unit; scene duration derived from its narration audio | short-video-maker | MIT | https://github.com/gyoridavid/short-video-maker |
| Caption paging by character budget and silence gap, with active-word highlight | short-video-maker | MIT | same |
| Character bible (static vs dynamic features), self-contained shot descriptions, reference-image conditioning, resume-by-artifact | ViMax | MIT | https://github.com/HKUDS/ViMax |
| Write → review → revise-once loop; continuity checklist | Toonflow | MIT | https://github.com/HBAI-Ltd/Toonflow-app |

## Runtime dependencies

| Dependency | Purpose | Licence | Source |
|---|---|---|---|
| NestJS (`@nestjs/common`, `core`, `platform-express`) | REST API and wiring | MIT | https://github.com/nestjs/nest |
| zod | Config and schema validation | MIT | https://github.com/colinhacks/zod |
| commander | Command-line parsing | MIT | https://github.com/tj/commander.js |
| `kokoro-js` | Runs the Kokoro voice model | Apache-2.0 | https://github.com/hexgrad/kokoro |
| `@huggingface/transformers` | Runs Whisper for word timing | Apache-2.0 | https://github.com/huggingface/transformers.js |
| ffmpeg (system binary, run as a separate process) | Rendering, audio, the flite fallback voice | LGPL/GPL depending on build | https://ffmpeg.org |

## Models downloaded at run time (not stored in this repository)

| Model | Purpose | Licence | Source |
|---|---|---|---|
| Kokoro-82M (ONNX, 8-bit) | Narration voice | Apache-2.0 | https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX |
| Whisper base (ONNX, with word timestamps) | Word timing | MIT (OpenAI Whisper) | https://huggingface.co/onnx-community/whisper-base_timestamped |

## Fonts and music

| Asset | Purpose | Licence | Source |
|---|---|---|---|
| Inter (installed on the system, not bundled) | Caption font | SIL Open Font License 1.1 | https://github.com/rsms/inter |
| Background music | None bundled yet | — | — |

The licences in the tables above are as stated by each project; the model licences were not
re-checked on their model pages during the build.

Rule: nothing is added to the project without a row in this file.
