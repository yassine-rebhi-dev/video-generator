# HyperFrames — renderer evaluation (short)

- Repo: https://github.com/heygen-com/hyperframes
- Studied commit: `e1ddb2e` (2026-11-12), shallow clone, nothing executed
- Licence: Apache-2.0
- 83k stars; #4 on GitHub's monthly TypeScript trending list (+22k this month)

Read at survey depth to answer one question: **should my renderer be HTML-based (HyperFrames), React-based (Remotion), or plain ffmpeg?**

## What it is

"Write HTML. Render video." Compositions are HTML files with `data-*` timing attributes and a paused GSAP timeline; `packages/engine` seeks the page frame by frame in headless Chrome (Puppeteer) and pipes frames to ffmpeg; `packages/producer` adds the audio mix. A registry ships ~450 ready-made blocks, including caption styles. Requires Node ≥ 22 and Chrome.

## Assessment

| | HyperFrames | Remotion | Plain ffmpeg + ASS |
|---|---|---|---|
| Licence | Apache-2.0 | Custom; paid for larger companies | ffmpeg LGPL/GPL binary, called as a process |
| Extra runtime | Headless Chrome | Headless Chrome | none (ffmpeg already required) |
| Caption styling | Anything CSS/GSAP can do | Anything React/CSS can do | What libass can do: per-word colour, scale pop, outline, shadow, karaoke fill |
| Still-image motion | CSS transforms | CSS transforms | `zoompan` / `scale`+`crop` expressions |
| Speed on 4 CPU cores, no GPU | Screenshot per frame: slow | Screenshot per frame: slow | Native filters: fast |
| Testability | Needs a browser | Needs a browser | Filter graph and `.ass` file are plain strings |

## Decision

**MVP renders with plain ffmpeg and an ASS subtitle file.** My videos are stills with camera motion, crossfades, word-highlight captions and an audio mix — all inside what ffmpeg and libass do natively, with no browser in the Docker image and deterministic, unit-testable inputs. I verified the local ffmpeg 6.1 build has `ass`, `zoompan`, `xfade`, `sidechaincompress` and `loudnorm`.

HyperFrames is the upgrade path if I later want motion-graphic overlays (animated titles, lower thirds, shader transitions) that libass cannot express. The renderer sits behind an interface so it can be swapped. Remotion is ruled out for a monetised project because of its licence.

## What I may reuse

Apache-2.0: code may be reused with the licence and NOTICE retained. Nothing is taken for the MVP.
