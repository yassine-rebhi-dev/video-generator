# short-video-maker — code study

- Repo: https://github.com/gyoridavid/short-video-maker
- Studied commit: `9bb9a21` (2025-06-21), shallow clone, nothing executed
- Licence: MIT ("Copyright (c) 2025 David Gyori")
- Size: ~1,400 lines of TypeScript; 1.5k stars
- **Maintenance: last commit June 2025 — fails the "< 60 days" filter.** Studied anyway because it is the closest TypeScript analogue of what I am building.

## Architecture and data flow

Express server exposing REST and MCP, with one in-memory queue (`ShortCreator.ts`). It does **not** write scripts: the caller (an LLM agent via MCP, or n8n) supplies scenes as `{ text, searchTerms[] }`.

```
scenes[] ─► for each scene:
              Kokoro TTS (kokoro-js, local ONNX) ─► WAV 16 kHz mono ─► whisper.cpp ─► captions[]
              Pexels search(searchTerms, minDuration = audio length) ─► download MP4
          ─► Remotion composition (React) ─► MP4
```

Per-scene audio drives everything: scene duration = that scene's narration length, and the stock clip must be at least that long.

## Prompts

None. Script and search terms come from outside. (The README suggests an agent prompt; there is no in-repo prompt.)

## Caption sync

`libraries/Whisper.ts`: `@remotion/install-whisper-cpp` `transcribe()` with `tokenLevelTimestamps: true`; tokens become `{text, startMs, endMs}`. Tokens beginning with `[_TT` are dropped; a token that does not start with a space is merged into the previous one (sub-word pieces).

`components/utils.ts::createCaptionPages` groups words into "pages": a new page starts when the gap to the previous word exceeds `maxDistanceMs`, or when the line would exceed `lineMaxLength`. The portrait template uses **`lineMaxLength: 20, lineCount: 1, maxDistanceMs: 1000`** — i.e. one short line, 2–4 words on screen at a time.

`PortraitVideo.tsx` renders each page as a Remotion `<Sequence>`, and highlights the active word by comparing the current frame to the word's start/end and giving it a coloured rounded background. Style: uppercase, `6em`, heavy weight, white with 2 px black stroke and a 10 px black glow; position top / center / bottom.

## Visual selection

`Pexels.ts`: search by term with orientation, require duration ≥ scene audio, exclude already-used video ids, pick randomly among matches. One clip per scene, no cuts inside a scene.

## Settings that matter

| Setting | Value |
|---|---|
| TTS | `onnx-community/Kokoro-82M-v1.0-ONNX` via `kokoro-js`, default voice `af_heart` |
| Whisper input | 16 kHz mono WAV (`FFmpeg.ts:27`) |
| Narration for render | MP3 128k stereo |
| Music volume | low 0.2 / medium 0.45 / high 0.7 (default **high**) |
| Caption page | ≤20 chars, 1 line, 1000 ms gap split |
| Canvas | 1080×1920 portrait |

## Weak points and bugs

- **Token-merge bug** (`Whisper.ts`): when merging a sub-word token it appends `record.text` (the whole segment's text) instead of `token.text`, and takes the segment's end time. Words can be duplicated or mistimed.
- **Scene duration bug** (`PortraitVideo.tsx`): `durationInFrames` for a scene is computed as the *cumulative* end time, not the scene's own length, so each scene's sequence overruns into later scenes (later scenes draw on top, which hides it).
- **Captions are Whisper's guess**, never reconciled with the known script text — names and unusual words will be misspelled on screen.
- **Default music volume 0.7** is loud against narration; no ducking.
- **One stock clip per scene, no motion design**, no hook treatment, no transitions.
- **No queue lock** (`// todo add mutex lock`), no persistence, failed jobs just report "failed".
- **Remotion licence**: Remotion itself is not MIT. It is free for individuals and small teams, but companies above a small headcount need a paid licence (https://www.remotion.dev/docs/license — I could not open this page from this session; the GitHub API reports the licence as non-standard, `NOASSERTION`). That is a dependency risk for a pipeline meant to be monetised.

## What I may reuse

MIT: code may be copied with attribution. I take **ideas only**:

1. Scene-as-unit data model: narration per scene, and scene duration derived from its audio.
2. Caption *paging* rule (character budget + silence gap) with an active-word highlight.
3. Kokoro via `kokoro-js` as a free, in-process Node TTS — no Python needed.
4. REST + queue shape (and MCP as a later add-on).

Not taking: Remotion as the renderer (licence, Chromium weight); Whisper-as-caption-text.
