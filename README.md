# story-shorts

Turns a topic into a narrated vertical story video (1080×1920, 15–60 s) with burned-in
word-highlight captions, for Instagram Reels and YouTube Shorts. Built to run at zero cost:
free API tier for the script, local CPU models for voice and caption timing, ffmpeg for rendering.

**Status: early.** The whole path from topic to MP4 works, but no AI video clip has been
generated yet: scene visuals are placeholder gradients until a free GPU backend has run
successfully. See [docs/DESIGN.md](docs/DESIGN.md).

| Part | Works today | Notes |
|---|---|---|
| Story writer | Gemini free tier, any OpenAI-compatible endpoint, or a built-in sample | The Gemini and OpenAI-compatible adapters have not been run against a live key yet |
| Voice | Kokoro-82M on CPU; ffmpeg's flite as an offline fallback | |
| Caption timing | Whisper on CPU, matched to the script text; proportional fallback | |
| Scene video | Placeholder gradients; Hugging Face Space adapter (`VIDEO_PROVIDER=hf-space`) | The adapter's request and its out-of-allowance handling were run live; a successful clip has not been, because the guest allowance was already used up. That Space reserves 120 s of free GPU per clip, so a free account gets about 2 clips a day. The Kaggle backend is not built yet |
| Music | Ducked under the voice when a track is in `assets/music` | No tracks bundled |
| Render and checks | ffmpeg; automatic checks of size, length, codecs, loudness | |

## Requirements

Node 20 or newer, and ffmpeg 6 or newer built with libass. The default caption font is Inter
(`fonts-inter` on Debian/Ubuntu); set `CAPTION_FONT` to use another installed font.

## Use

```bash
npm install
npm run build
cp .env.example .env    # then fill in GEMINI_API_KEY, or set LLM_PROVIDER=fake
```

Generate one video:

```bash
node --env-file=.env dist/cli/main.js generate --topic "the lighthouse keeper who vanished in 1900" --style dark-mystery --duration 40
```

The result is `output/<job>/final.mp4`, next to `metadata.json` (title, description, hashtags),
`qa.json` (automatic checks) and `frames/` (one frame per scene).

Other commands:

```bash
node --env-file=.env dist/cli/main.js resume <job>     # continue a job from the files it already made
node --env-file=.env dist/cli/main.js benchmark        # render three sample videos and print a table
node --env-file=.env dist/main.js                      # start the REST API
```

REST API:

```bash
curl -X POST localhost:3000/videos -H 'content-type: application/json' \
  -d '{"topic":"the lighthouse keeper who vanished in 1900","style":"dark-mystery","durationSec":40}'
curl localhost:3000/videos/<id>          # status and checks
curl -O localhost:3000/videos/<id>/file  # the MP4, once status is "done"
```

`--style` takes a preset from `styles/` (`dark-mystery`, `historical`, `uplifting`) or any free text.

To try everything with no key and no downloads:

```bash
LLM_PROVIDER=fake TTS_PROVIDER=flite ALIGN_PROVIDER=proportional node dist/cli/main.js generate --topic "test"
```

## Docker

```bash
docker build -t story-shorts .
docker run --rm -p 3000:3000 --env-file .env -v "$PWD/output:/data/output" story-shorts
```

The image has not been built or run yet; treat the Dockerfile as untested.

## Tests

```bash
npm test
```

Covers word alignment, caption paging and subtitle output, the ffmpeg filter graph, config
validation, storyboard checks, and one real ffmpeg render of a tiny two-scene video.

## How it works

1. **Storyboard** — one model call returns JSON: a hook, scenes (narration, visual, motion), a
   character sheet and an art-direction paragraph. It is checked mechanically (word budget, hook
   length, character tags) and sent back with the list of problems, up to three attempts.
2. **Voice and video** — each scene is spoken separately, so scene timing comes from the audio.
   Each scene's visual prompt goes to the video provider; a failed clip is replaced so the video
   still finishes.
3. **Align** — Whisper hears each scene and its word times are matched to the script. Captions
   always show the script's words; the recogniser only supplies timing.
4. **Captions** — words are grouped into short pages and written as an ASS subtitle file with the
   spoken word highlighted.
5. **Render** — ffmpeg fits each clip to its scene, crossfades them, burns the captions, mixes the
   narration (and music) and normalises loudness.
6. **Checks** — the finished file is measured against the output spec.

Every stage saves its result in the job folder and is skipped when that file exists, so `resume`
never repeats finished work. Delete a file to redo that stage. The exception is video clips:
`resume` asks again for every scene that got a placeholder, so a job can be completed over
several days when the free allowance only covers a few clips a day.

Background, research and licences: [docs/DESIGN.md](docs/DESIGN.md), [RESEARCH_LOG.md](RESEARCH_LOG.md),
[THIRD_PARTY.md](THIRD_PARTY.md).
