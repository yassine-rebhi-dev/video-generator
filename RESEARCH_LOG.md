# Research log

A running record of what was searched, what was found and what was decided. Newest phase last.

## Inputs (confirmed 2026-11-12)

| Question | Answer |
|---|---|
| Niche | Storytelling (narrated stories with AI-generated scenes) |
| Language | English |
| Hardware | No GPU, API-only. No monthly budget stated — assumed ~$20–30/month until told otherwise |
| Stack | TypeScript/NestJS; Python only if a model requires it |
| Posting | Manual export |

## Limits of this research

- **Network.** This session's network policy blocks most third-party sites for direct page fetches (`fal.ai`, `remotion.dev`, vendor blogs all failed to resolve). Web *search* and `github.com` worked. So prices and policy details below come from search-result summaries of secondary sources, not from vendor pricing pages. Every such number is marked "unverified" and must be checked on the vendor page before money is spent.
- **Niche analysis.** I could not watch videos or open YouTube/Instagram. Section 4 is a synthesis of written guides, mostly vendor blogs with undisclosed methodology. Treat it as hypotheses for the benchmark, not findings.
- **GitHub search API** is restricted in this session to repository-level queries; topic and repo searches worked, code search across other repos was not used.

## Phase 1 — Discovery

### 1.1 Searches run

| # | Query (abridged) | Mode | Useful result |
|---|---|---|---|
| 1 | best open-source AI short video generator pipeline 2026 | extended | Candidate list; many low-star self-promotional repos and mirrored forks |
| 2 | best open-source text-to-video / image-to-video models, licences, hosted price per second | extended | Wan 2.2 Apache-2.0; HunyuanVideo and LTX licence caveats |
| 3 | GitHub trending video-generation / shorts-maker repos | extended | Most "shorts" repos are long-video *clippers*, not generators |
| 4 | What top AI storytelling shorts have in common | extended ×3 | Hooks, loops, captions; weak evidence |
| 5 | TTS APIs with word-level timestamps and prices | extended + standard | ElevenLabs `with-timestamps` endpoint; price ranges conflict |
| 6 | fal.ai / Replicate image and video prices | extended | Image prices for Nov 2026; no confirmed Wan/LTX per-second price |
| 7 | YouTube / Instagram AI-content policy 2026 | standard | "Inauthentic content" policy; Meta AI labelling |
| 8 | `github.com/trending` daily / weekly / monthly, plus `/typescript?since=monthly`, `/python?since=weekly` | page fetch | See 1.2 |
| 9 | GitHub API: topics `video-generation`, `shorts-maker`, `text-to-video`, `faceless`, `comfyui`, `youtube-shorts`, pushed after 2026-09-13, sorted by stars | API | See 1.3 |

### 1.2 GitHub Trending (fetched 2026-11-12)

- **Daily**: nothing video-related (13 repos, all agents/dev tools).
- **Weekly**: nothing video-related overall. Python weekly: **harry0703/MoneyPrinterTurbo** (+3.9k) and `scenario-labs/skills` (media-generation agent skills).
- **Monthly**: **heygen-com/hyperframes** (HTML→video renderer, +22k) and **debpalash/VoiceStudio** (local TTS/voice cloning, +50k, AGPL-3.0). TypeScript monthly adds **remotion-dev/remotion** (+9.5k).

Reading: what is trending is *rendering* and *voice* infrastructure and agent skills, not a new end-to-end shorts generator. No trending repo targets narrated story shorts specifically.

### 1.3 Candidates found (stars / licence / last push, from the GitHub API on 2026-11-12)

| Repo | Stars | Licence | Last push | What it is |
|---|---|---|---|---|
| [harry0703/MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) | 142.8k | MIT | 2026-11-12 | Topic → stock-footage short, Python |
| [OpenMontageInc/OpenMontage](https://github.com/OpenMontageInc/OpenMontage) | 79.9k | AGPL-3.0 | 2026-11-09 | Agentic video production system |
| [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | 83.3k | Apache-2.0 | 2026-11-12 | HTML → video renderer |
| [remotion-dev/remotion](https://github.com/remotion-dev/remotion) | 72.7k | custom | 2026-11-12 | React → video renderer |
| [HBAI-Ltd/Toonflow-app](https://github.com/HBAI-Ltd/Toonflow-app) | 21.5k | MIT | 2026-11-05 | Short-drama authoring app, TypeScript |
| [HKUDS/ViMax](https://github.com/HKUDS/ViMax) | 12.9k | MIT | 2026-09-30 | Idea → multi-shot film, agent chain |
| [ArcReel/ArcReel](https://github.com/ArcReel/ArcReel) | 6.5k | AGPL-3.0 | 2026-11-12 | Novel → storyboard → video workbench |
| [digitalsamba/claude-code-video-toolkit](https://github.com/digitalsamba/claude-code-video-toolkit) | 2.5k | MIT | 2026-11-12 | Coding-agent video toolkit |
| [gyoridavid/short-video-maker](https://github.com/gyoridavid/short-video-maker) | 1.5k | MIT | **2025-06-21** | Scenes → short, TypeScript + Remotion |
| [RayVentura/ShortGPT](https://github.com/RayVentura/ShortGPT) | 8.2k | MIT | **2025-02-10** | Dropped: stale |
| [FujiwaraChoki/MoneyPrinterV2](https://github.com/FujiwaraChoki/MoneyPrinterV2) | 32.4k | AGPL-3.0 | 2026-09-15 | Dropped: AGPL, automation-for-money focus |
| [mutonby/openshorts](https://github.com/mutonby/openshorts), [FujiwaraChoki/supoclip](https://github.com/FujiwaraChoki/supoclip), [Anil-matcha/AI-Youtube-Shorts-Generator](https://github.com/Anil-matcha/AI-Youtube-Shorts-Generator) | — | MIT / AGPL / MIT | active | Dropped: they clip long videos; they do not generate |
| dramaclaw, hypit, waoowaoo, yumcut | — | no standard licence | active | Dropped: licence unclear |
| Local video models: [Wan2.2](https://github.com/Wan-Video/Wan2.2) (Apache-2.0), [HunyuanVideo](https://github.com/Tencent-Hunyuan/HunyuanVideo) (custom), [LTX-Video](https://github.com/Lightricks/LTX-Video) (Apache-2.0 repo; newer weights have revenue terms per search results) | — | — | — | Not runnable here: no GPU. Relevant only through hosted APIs |

### 1.4 Shortlist of 8, scored 1–5

Scores are my judgement from the READMEs, licence files and (for the first five) the code. "Hardware fit" means it works with no GPU, on APIs.

| # | Repo | Output quality | Fit to storytelling | Hardware fit | Licence | Maintenance | Ease of extending | Total /30 |
|---|---|---|---|---|---|---|---|---|
| 1 | MoneyPrinterTurbo | 3 | 2 | 5 | 5 | 5 | 2 | **22** |
| 2 | ViMax | 4 | 4 | 4 | 5 | 4 | 3 | **24** |
| 3 | hyperframes (renderer) | 5 | 3 | 4 | 5 | 5 | 4 | **26** |
| 4 | Toonflow-app | 4 | 4 | 4 | 5 | 5 | 2 | **24** |
| 5 | short-video-maker | 3 | 2 | 5 | 5 | 1 | 5 | **21** |
| 6 | OpenMontage | 4 | 3 | 4 | 1 | 5 | 2 | **19** |
| 7 | ArcReel | 4 | 5 | 4 | 1 | 5 | 2 | **21** |
| 8 | claude-code-video-toolkit | 3 | 2 | 4 | 5 | 5 | 3 | **22** |

Notes on the scores:

- **None scores high on both "fit" and "ease of extending".** The story-capable ones (ViMax, Toonflow, ArcReel) are either costly per video, interactive, or AGPL. The simple ones (MoneyPrinterTurbo, short-video-maker) use stock footage, which cannot show a specific story.
- AGPL (OpenMontage, ArcReel) scores 1 on licence because I want to monetise and keep the option of not publishing my server code. I read their READMEs only and take no code.
- short-video-maker fails the 60-day activity filter (maintenance 1) but is the closest TypeScript analogue, so it was studied for its design.

**Chosen for code study:** MoneyPrinterTurbo, ViMax, short-video-maker, Toonflow (survey depth), plus hyperframes as a renderer evaluation.

### 1.5 What narrated story shorts appear to have in common (low confidence)

Sources: [virvid hooks](https://virvid.ai/blog/first-3-seconds-hook-faceless-shorts-2026), [virvid looping](https://virvid.ai/blog/looping-structure-shorts-retention-2026), [facelesslab scripts](https://facelesslab.video/blog/en/faceless-video-script), [faceless.my guide](https://faceless.my/youtube/faceless-youtube-shorts/), [learnwithhasan guide](https://learnwithhasan.com/guide/how-to-make-faceless-youtube-shorts-with-claude-code/), [hassancs91/claude-faceless-shorts-creator](https://github.com/hassancs91/claude-faceless-shorts-creator), [mean.ceo hook stats](https://blog.mean.ceo/video-hook-retention-statistics/), [ugccopilot hooks](https://ugccopilot.ai/blog/viral-hooks-that-convert/).

| Pattern | What the guides say | How sure |
|---|---|---|
| Hook | Decided in the first 1–3 s. First frame is already the most striking image: no fade-in, no logo, no intro line. | Consistent across sources |
| Story hook | Open a loop (a question or an unresolved situation), do not give away the ending. | Several sources |
| Structure | Setup → escalation → twist, one beat per short. | Two sources |
| Length | 60–130 words for a 20–45 s voiceover. Shorter videos complete more often. | One or two sources each |
| Captions | Word-timed, large, on screen from the first word; many viewers watch muted. | Consistent |
| Ending | Loop back into the opening instead of a call to action; last line should read into the first. | Consistent |
| Visual change | "Pattern interrupt" roughly every few seconds; the one explicit figure found was every 10 s, not the 2–4 s often repeated. | Weak, conflicting |
| Voice | A consistent narrator voice across a channel. | One source, no data |

### 1.6 Platform policy that affects the design

- YouTube's "inauthentic content" monetisation policy targets videos that look templated "with little to no variation across videos" and is enforced at channel level; AI use itself is not banned ([Tubefilter](https://www.tubefilter.com/2026-07-13/youtube-inauthentic-content-monetization-policy-update/), [TechCrunch](https://techcrunch.com/2026/07/20/youtube-clarifies-policies-around-ai-slop-and-upsetting-videos/), [vidIQ](https://vidiq.com/blog/post/youtube-ai-monetization/)).
- Meta requires labelling photorealistic AI video or realistic AI audio, and applies a label itself if it detects unlabelled AI content ([Instagram help](https://help.instagram.com/761121959519495)).

Consequence: the pipeline must make variation easy (style presets, structure variants, voices) and the export must remind me to apply the AI label. A pipeline that stamps out near-identical videos is a monetisation risk regardless of quality.

## Phase 2 — Code study

Cloned (shallow, hooks disabled, nothing installed or executed) into `./research/<repo>/`; those directories are git-ignored. Notes:

- [research/MoneyPrinterTurbo.md](research/MoneyPrinterTurbo.md)
- [research/ViMax.md](research/ViMax.md)
- [research/short-video-maker.md](research/short-video-maker.md)
- [research/Toonflow-app.md](research/Toonflow-app.md) (survey depth)
- [research/hyperframes.md](research/hyperframes.md) (renderer evaluation)

Two concrete bugs found in short-video-maker (token merge uses the whole segment's text; scene sequence duration is cumulative) and one silent-failure path in MoneyPrinterTurbo (Edge captions dropped on a line-count mismatch) — all three are in the caption/timing code, which is why that part of my pipeline gets the most tests.

## Phase 3 — Decisions (details in docs/DESIGN.md)

| Decision | Choice | Main reason | Source |
|---|---|---|---|
| Visuals | AI still images per scene with camera motion; optional image-to-video for the hook only | Stock footage cannot show a specific story; full AI video costs dollars per short | MoneyPrinterTurbo and ViMax studies |
| Character consistency | Character bible + one reference image fed to an image-edit model | Image models never see names | ViMax |
| Captions | Script text is the truth; recogniser only supplies timing | Both simpler repos show wrong words or lose captions | MoneyPrinterTurbo, short-video-maker |
| Renderer | Plain ffmpeg + ASS | No browser, fast on CPU, permissive, testable | hyperframes evaluation |
| TTS default | Kokoro-82M in-process (Apache-2.0), ElevenLabs optional | Free, no Python, good enough to start | short-video-maker; [hexgrad/kokoro](https://github.com/hexgrad/kokoro) |
| LLM | Claude via the official TypeScript SDK with structured outputs | One validated JSON object per stage, no JSON-repair code | ViMax's parser workaround |
| Not using | Remotion (licence), Edge TTS (unofficial endpoint), AGPL code, local video models (no GPU) | — | — |

## Open items carried into Phase 4

1. Confirm real prices on the vendor pages (image provider, ElevenLabs) — blocked from this session.
2. Confirm Kokoro and Whisper ONNX models download and run on CPU here (both are far below the 10 GB ask-first threshold).
3. Measure, don't assume: render time per video and caption timing error, in the benchmark script.

## Revision 2026-11-12 — owner requires full AI video at zero cost

The stills-with-motion proposal was rejected: every scene must be generated video and running cost must be $0.

Searches run (extended): free video-generation APIs; Hugging Face ZeroGPU free quota; Wan 2.2 / LTX on free Kaggle or Colab GPUs; free LLM API tiers.

Findings:

- No free, unlimited, scriptable video API was found. Offers are one-time signup credits or web apps with daily credits ([genrelay](https://genrelay.ai/blog/free-ai-video-generation-api), [seedance.tv](https://www.seedance.tv/blog/ai-video-generator-free-no-limits)) — both vendor pages.
- Hugging Face ZeroGPU: 5 GPU-minutes/day on a free account, 2 for guests, reset 24 h after first use ([forum](https://discuss.huggingface.co/t/what-is-the-free-zerogpu-quota-for-1-space/178610), [forum](https://discuss.huggingface.co/t/what-is-the-guest-daily-zerogpu-quota/179433)).
- Free T4 GPUs run Wan 2.2 5B FastWan at 480p; larger checkpoints do not fit ([Wan2GP-on-Colab](https://github.com/Square-Zero-Labs/Wan2GP-on-Colab), [WanGP-Kaggle](https://github.com/kayas881/WanGP-Kaggle), [Wan2.2-Lightning](https://huggingface.co/lightx2v/Wan2.2-Lightning)). No reliable per-clip timing found.
- Gemini API has a free tier with small, non-guaranteed limits ([official](https://ai.google.dev/gemini-api/docs/rate-limits), [memetik](https://www.memetik.ai/guides/gemini-api-free-tier-limits)). Nothing verified for Groq, OpenRouter or Pollinations.
- Not verified: Kaggle's weekly GPU hours; which public Wan/LTX Spaces exist today; `@gradio/client` call shape.
- From this session, `huggingface.co`, `www.kaggle.com`, `api.groq.com`, `openrouter.ai` and Pollinations are unreachable; `generativelanguage.googleapis.com` and npm are reachable.

Decision: video backends `kaggle` (default, Python worker) and `hf-zerogpu`, behind one interface, with a still-image fallback per clip; Gemini free tier for the script; Kokoro and Whisper locally. See docs/DESIGN.md sections 2, 5, 6.

## Phase 4 — build log

### 2026-11-12: first end-to-end slice

- Created a personal cloud environment `video-generator` allowing `huggingface.co`, `us.aws.cdn.hf.co` (where model files are actually served), `www.kaggle.com` and `generativelanguage.googleapis.com`.
- NestJS 12 and commander are ES-module only, so the project is ES modules throughout.
- Measured on this machine (4 CPU cores, no GPU), 33 s sample video with placeholder visuals:
  - Kokoro voice, 9 scenes: about 26 s. Whisper word timing: about 14 s. ffmpeg render: about 28 s. Total about 72 s.
  - Whisper matched 99% of script words (one scene at 91%).
  - Speech onsets measured in the final file by silence detection fall within 0.03 s of the planned scene starts.
  - Loudness measured -15.8 LUFS against a -14 target: single-pass normalisation undershoots; a two-pass measure-then-apply step would fix it.
- Not done yet: real video backends (Kaggle, Hugging Face), a live run of the Gemini adapter, music tracks, Docker build.
