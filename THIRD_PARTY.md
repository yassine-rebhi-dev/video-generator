# Third-party material

Everything reused from another project is listed here with its licence and source.

## Code copied from other repositories

**None.** As of the design phase no source code, prompt text or asset from another repository is in this project. The repositories under `research/` were read for ideas only; their clones are git-ignored and are not distributed.

## Ideas reimplemented (no code copied)

| Idea | Learned from | Licence of source | Source |
|---|---|---|---|
| Script text is the caption source of truth; speech recognition only supplies timing | MoneyPrinterTurbo | MIT | https://github.com/harry0703/MoneyPrinterTurbo |
| Per-task artifact directory; sub-pixel zoom on a fixed canvas for stills | MoneyPrinterTurbo | MIT | same |
| Scene as the unit; scene duration derived from its narration audio | short-video-maker | MIT | https://github.com/gyoridavid/short-video-maker |
| Caption paging by character budget and silence gap, with active-word highlight | short-video-maker | MIT | same |
| Character bible (static vs dynamic features), self-contained shot descriptions, reference-image conditioning, resume-by-artifact | ViMax | MIT | https://github.com/HKUDS/ViMax |
| Write → review → revise-once loop; continuity checklist | Toonflow | MIT | https://github.com/HBAI-Ltd/Toonflow-app |

## Planned runtime dependencies (to be confirmed when added in Phase 4)

| Dependency | Purpose | Licence | Source |
|---|---|---|---|
| NestJS | Application framework | MIT | https://github.com/nestjs/nest |
| `@anthropic-ai/sdk` | LLM calls | MIT | https://github.com/anthropics/anthropic-sdk-typescript |
| zod | Config and schema validation | MIT | https://github.com/colinhacks/zod |
| `kokoro-js` + Kokoro-82M weights | Local text-to-speech | Apache-2.0 | https://github.com/hexgrad/kokoro |
| `@huggingface/transformers` + Whisper ONNX weights | Word timing | Apache-2.0 (library), MIT (Whisper) | https://github.com/huggingface/transformers.js , https://github.com/openai/whisper |
| ffmpeg (system binary, invoked as a process) | Rendering | LGPL/GPL depending on build | https://ffmpeg.org |
| Caption font | Burned-in captions | To be chosen; must be OFL or Apache-2.0 | — |
| Background music | Music bed | To be chosen; CC0 or licensed tracks only, each listed here | — |

Rule: nothing is added to the project without a row in this file.
