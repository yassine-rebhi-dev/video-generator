# MoneyPrinterTurbo — code study

- Repo: https://github.com/harry0703/MoneyPrinterTurbo
- Studied commit: `82216cc` (2026-11-12), shallow clone, nothing executed
- Licence: MIT (`LICENSE`, "Copyright (c) 2024 Harry")
- Size: ~25k lines of Python in `app/services/`; 142.8k stars; in GitHub's weekly Python trending list

## Architecture and data flow

FastAPI + Streamlit WebUI over one synchronous pipeline, `app/services/task.py::_run_pipeline`:

```
subject ──► llm.generate_script ──► llm.generate_terms ──► voice (TTS) ──► subtitle
                                          │                                   │
                                          ▼                                   ▼
                         material.search/download (stock)  ──► video.combine_videos ──► video.generate_video ──► MP4
```

1. **Script** – one LLM call returns plain prose split into N paragraphs (`llm.py:927`).
2. **Search terms** – second LLM call returns a JSON array of 1–3 word English stock-footage queries (`llm.py:1056`). An optional "match script order" mode asks for chronological terms.
3. **Voice** – `voice.py` (3,950 lines) wraps Edge TTS, Azure, and several other providers. Edge returns word-boundary cues in a `SubMaker`.
4. **Subtitles** – `task.py:655` picks a provider: `edge` (TTS cues) or `whisper` (faster-whisper).
5. **Materials** – `material.py` (3,392 lines) searches Pexels / Pixabay / Coverr or local files, filtered by orientation and minimum resolution; there are also newer hosted text-to-video providers (Seedance, Wavespeed, etc.).
6. **Compose** – `video.py::combine_videos` slices each source clip into pieces of at most `max_clip_duration` (default **5 s**), shuffles or sequences them, fits them to the canvas, and concatenates with ffmpeg until the narration length (plus a safety margin) is covered.
7. **Final** – `video.py::generate_video` overlays subtitles (MoviePy text clips), mixes narration and BGM, and encodes.

State is kept per task in a directory (`script.json`, `audio.mp3`, `subtitle.srt`, clips), with an in-memory or Redis task manager.

## Exact prompts

Script (`llm.py:56`, `DEFAULT_SCRIPT_SYSTEM_PROMPT`), verbatim constraints:

> 1. the script is to be returned as a string with the specified number of paragraphs.
> 2. do not under any circumstance reference this prompt in your response.
> 3. get straight to the point, don't start with unnecessary things like, "welcome to this video".
> 4. you must not include any type of markdown or formatting in the script, never use a title.
> 5. only return the raw content of the script.
> 6. do not include "voiceover", "narrator" or similar indicators …
> 7. you must not mention the prompt, or anything about the script itself …
> 8. respond in the same language as the video subject.

followed by `# Initialization: - video subject: … - number of paragraphs: … - language: …` and optional `# Additional User Requirements`.

Search terms (`llm.py:1100`): role "Video Search Terms Generator"; "each search term should consist of 1-3 words, always add the main subject of the video"; "you must only return the json-array of strings"; "reply with english search terms only".

There is **no hook prompt, no scene structure and no visual prompt**. The script is undifferentiated prose and visuals are matched only by keyword.

## Caption sync

Two paths:

- **Edge cues** (`voice.py:3779 create_subtitle`): the script is split into lines at punctuation, then the TTS word-boundary cues are consumed in order to give each script line a start and end. If the line count and the cue-derived item count differ, it logs a warning and writes **no subtitle file at all**.
- **Whisper** (`subtitle.py:61 create`): `faster-whisper` with `beam_size=5, word_timestamps=True, vad_filter=True, min_silence_duration_ms=500`. Words are accumulated into a cue until one ends in punctuation. Then `subtitle.py:541 correct` re-aligns the recognised cues to the *known script lines* using Levenshtein similarity (threshold 0.8), so the displayed text is the script, not Whisper's transcription. If it runs out of timed cues it keeps the raw transcription.

Word-by-word mode exists (`word_level=True`) but skips the correction step, so in that mode on-screen words are whatever Whisper heard.

The idea worth taking: **the script is the source of truth for caption text; the recogniser only supplies timing.**

## Visual selection

Keyword search against stock APIs (`per_page=20` Pexels, 50 Pixabay), orientation and resolution filters, de-duplication across sources (`_prioritize_unique_source_clips`), then clips are cut to ≤5 s segments. Images are supported with a slow centre zoom (`_smooth_zoom_clip`, affine transform with bicubic resampling at a fixed canvas size — the comment explains that resizing to integer sizes per frame produced visible jitter at 1080×1920).

## Settings that matter

| Setting | Value | Where |
|---|---|---|
| Max clip duration | 5 s (1–15) | `schema.py:119`, `video.py:988` |
| BGM volume / voice volume | 0.2 / 1.0 | `schema.py:135-139` |
| Subtitle font size / stroke | 60 px / 1.5 | `schema.py:163-165` |
| Subtitle position | bottom | `schema.py:146` |
| Audio | AAC 192k | `video.py:76-79` |
| Image clips | 30 fps, BT.709 flags | `video.py:2112` |
| Whisper | beam 5, VAD 500 ms | `subtitle.py:79` |

## Weak points

- **Wrong tool for storytelling.** Stock footage matched by 1–3 word keywords cannot show specific characters or plot beats; visuals are loosely thematic at best.
- **No hook, no beats, no pacing control.** One generic script prompt; scene length is whatever 5 s slicing gives.
- **Caption fragility.** The Edge path silently produces no captions on a line-count mismatch; word-level Whisper captions are uncorrected.
- **Captions are plain.** Static text clips (an optional spring-scale animation exists) — no per-word highlight.
- **MoviePy rendering.** Frame-by-frame Python compositing is slow, and much of `video.py` is codec fallback and handle-leak handling.
- **Sprawl.** `voice.py` and `material.py` are each over 3,000 lines with a dozen providers inlined; hard to extend cleanly.
- **Edge TTS** is an unofficial use of a Microsoft consumer endpoint — fine for a hobby, risky as the default for something monetised.

## What I may reuse

MIT: code may be copied with the copyright notice retained. I am taking **ideas only**, reimplemented in TypeScript:

1. Script-as-truth caption alignment (recogniser gives timing, script gives text).
2. Per-task artifact directory with one file per stage.
3. Fixed-canvas, sub-pixel zoom for still images to avoid jitter.
4. Default mix levels (BGM ≈ 0.2 of voice) as a starting point.
