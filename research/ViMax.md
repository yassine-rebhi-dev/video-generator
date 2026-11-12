# ViMax — code study

- Repo: https://github.com/HKUDS/ViMax
- Studied commit: `fd4b72e` (2026-09-30), shallow clone, nothing executed
- Licence: MIT (`LICENSE`, "Copyright (c) 2025")
- Size: ~5k lines of Python in `agents/` + `pipelines/`; 12.9k stars

## Architecture and data flow

A chain of single-purpose LLM "agents" (LangChain chat model + Pydantic output parser + `tenacity` retry), orchestrated by `pipelines/idea2video_pipeline.py` and `pipelines/script2video_pipeline.py`:

```
idea ─► Screenwriter.develop_story ─► Screenwriter.write_script_based_on_story (list of scenes)
     ─► CharacterExtractor ─► CharacterPortraitsGenerator (front, then side/back from front)
     for each scene:
        StoryboardArtist.design_storyboard (shots)
        ─► decompose each shot into first-frame / last-frame / motion descriptions
        ─► camera tree (reuse camera positions)
        ─► ReferenceImageSelector (pick ≤8 prior images) ─► image generation (N candidates)
        ─► BestImageSelector (vision model picks the most consistent candidate)
        ─► video generation per shot (first-frame → video)
     ─► concatenate (MoviePy)
```

Every stage writes its output to a working directory and **skips itself if the file already exists** ("🚀 Skipped … already exists"), so an interrupted run resumes without re-paying for images or video.

## Exact prompts (structure; all in `agents/*.py`)

All prompts share a `[Role] / [Task] / [Input] / [Output] / [Guidelines]` layout with inputs wrapped in XML-style tags.

- **Story** (`screenwriter.py`): input `<IDEA>` and `<USER_REQUIREMENT>`. Output: title, audience and genre, 100–200 word outline, characters, then the narrative as "Introduction - Development - Climax - Conclusion" or N titled scenes. Guidelines: *Idea-Centric*, *Logical Consistency*, *"Show, Don't Tell"* ("use 'He clenched his fist, nails digging deep into his palm' instead of 'He was very angry'"), originality.
- **Script from story** (`screenwriter.py`): "Each scene must be a continuous dramatic action unit occurring at the same time and location"; *"All descriptions must be 'filmable'. Use concrete actions instead of abstract emotions"*; describe lighting, props, weather.
- **Characters** (`character_extractor.py`): per character `static_features` (face, build — unchanging) and `dynamic_features` (clothes, accessories — changeable); "Don't include any information about the character's personality, role, or relationships"; "different character appearances should be made more distinct from each other"; "avoid … abstract terms … specific clothing colors and concrete physical traits".
- **Portraits** (`character_portraits_generator.py`): "full-body, front-view portrait of character {identifier} … pure white background … Gazing straight ahead. Standing with arms relaxed at sides." Side and back views are generated *from the front image as a reference*.
- **Storyboard** (`storyboard_artist.py`): every shot needs a narrative purpose; state each element's position in frame and the direction a character faces; "Each shot requires an independent description without reference to each other"; in visual text, character names go in angle brackets (`<Alice>`); safety substitution ("ketchup for blood").
- **Shot decomposition**: first frame and last frame must be "pure snapshots, containing no ongoing actions"; motion text must not use names but visible traits ("Alice (short hair, wearing a green dress) is walking") — because the video model never saw the name.
- **Reference selection** (`reference_image_selector.py`): choose ≤8 prior images, prefer same camera, prefer recent frames, at most one portrait view per character.

## Captions and audio

**None.** There is no TTS, no narration track, no subtitles and no music in the pipeline (grep for tts/subtitle/whisper matches only an unrelated field). Sound is whatever the video model (Veo 3.1) generates. Output is horizontal.

## Settings that matter

| Setting | Value | Where |
|---|---|---|
| Video model | `veo-3.1-generate-preview`, 1080p, **16:9**, 8 s clips | `tools/video_generator_veo_google_api.py` |
| Image candidates per frame | 2, vision model picks best (1 disables) | `configs/idea2video.yaml` |
| Chat model (example) | Gemini 2.5 Flash-Lite via OpenRouter | same |
| Rate limits | chat 500/min, image 10/min, video 2/min + 10/day | same |
| Final encode | libx264, preset medium | `utils/video.py:26` |

## Weak points

- **Cost.** Every shot is a hosted video-model call plus 2 image candidates plus several LLM calls. A 45 s short would be six or more 8 s Veo clips — dollars, not cents, per video.
- **Not a shorts pipeline.** 16:9, no hook, no narration, no captions, no music, no pacing targets.
- **Portraits hard-coded to a 16:9 white canvas**, which wastes resolution for vertical character references.
- **LangChain + Pydantic parser + a custom "trailing comma tolerant" JSON parser** — a workaround for free-text JSON that native structured outputs make unnecessary.
- **Heavy chain** (camera tree, first/last-frame decomposition) is built for image-to-video continuity, most of which is wasted if the visuals are stills.

## What I may reuse

MIT: code may be copied with attribution. I take **ideas only**, with prompts rewritten for vertical narrated shorts:

1. **Character bible**: static vs dynamic features, written as concrete visual traits, injected verbatim into every image prompt (the image model never knows a name).
2. **Self-contained shot descriptions**: no shot refers to another; position and facing stated explicitly.
3. **Reference-image conditioning**: generate one character reference first, pass it to an image-edit model for each scene.
4. **"Filmable" / show-don't-tell** rules in the script prompt.
5. **Resume-by-artifact**: each stage is skipped when its output exists.
6. Optional later: N candidates + vision-model selection for the hook frame only.
