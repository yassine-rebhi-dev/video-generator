import type { LlmProvider, LlmRequest } from "./llm.js";

/** A fixed sample story, so the rest of the pipeline can run with no key and no network. */
export const SAMPLE_STORYBOARD = {
  title: "The Lighthouse Keeper Who Never Left",
  description: "In 1900 a lighthouse keeper lit the lamp one last time. What the relief crew found still has no answer.",
  hashtags: ["#mystery", "#storytime", "#lighthouse", "#unsolved"],
  musicMood: "tense",
  styleBlock:
    "Moody painterly realism, cold teal and grey palette with one warm amber light source, heavy sea mist, soft film grain, shallow depth of field, slow deliberate camera.",
  characters: [
    {
      id: "keeper",
      look: "a weathered man in his fifties with a grey beard, deep-set eyes, a dark navy wool coat with brass buttons and a knitted grey cap",
    },
  ],
  scenes: [
    {
      narration: "The lamp was still burning, but the keeper was gone.",
      visual: "A lonely stone lighthouse on a black rock in a stormy sea at night, its amber lamp glowing through thick mist, placed in the upper half of the frame.",
      motion: "Waves crash against the rock while the camera slowly pushes in toward the light.",
      shot: "wide",
    },
    {
      narration: "Every night for twenty years, he climbed the same spiral stairs.",
      visual: "<keeper> seen from behind in the upper centre of the frame, climbing a narrow spiral stone staircase, holding a small oil lantern that lights the damp walls.",
      motion: "He takes slow steps upward as the camera follows from below.",
      shot: "medium",
    },
    {
      narration: "On the last night, his logbook had only one line.",
      visual: "An open leather logbook on a rough wooden desk beside a guttering candle, pages blank and yellowed, a pen resting across them, viewed from above.",
      motion: "The candle flame flickers and the camera drifts slowly closer to the page.",
      shot: "close",
    },
    {
      narration: "It said the sea was calm. But the storm outside was the worst in years.",
      visual: "A tall lighthouse window streaked with rain, enormous dark waves rising beyond the glass under a sky split by lightning.",
      motion: "Rain runs down the glass as a wave swells and the camera holds steady.",
      shot: "medium",
    },
    {
      narration: "When the relief boat arrived, the door was locked from the inside.",
      visual: "A heavy iron-banded wooden door at the base of a lighthouse at grey dawn, wet stone steps leading up to it, seen from the foot of the steps.",
      motion: "Mist drifts across the steps while the camera tilts up slowly toward the door.",
      shot: "wide",
    },
    {
      narration: "His coat hung by the stove. His dinner was still warm.",
      visual: "A dark navy wool coat with brass buttons hanging on a hook beside a small iron stove, a plate of food steaming on a table in the upper part of the frame.",
      motion: "Steam curls up from the plate and the camera pans gently from the coat to the table.",
      shot: "close",
    },
    {
      narration: "They searched every room, every rock, every inch of the shore.",
      visual: "Two small figures with lanterns walking along a jagged rocky shoreline below a lighthouse in fog, seen from far above.",
      motion: "The lantern lights move slowly across the rocks while the camera glides sideways.",
      shot: "wide",
    },
    {
      narration: "They never found him. And no one could explain who kept the light.",
      visual: "<keeper> standing still at the top of the lighthouse beside the huge glass lamp, facing the camera, half lit by amber light and half in shadow.",
      motion: "The lamp's beam sweeps past him and the camera slowly pulls back.",
      shot: "medium",
    },
    {
      narration: "Because that night, the lamp was still burning.",
      visual: "The lighthouse lamp room from outside at night, amber light blazing through the glass panes against a black sky and mist, filling the upper half of the frame.",
      motion: "The light pulses brighter as the camera pushes in until the glow fills the frame.",
      shot: "close",
    },
  ],
};

export class FakeLlmProvider implements LlmProvider {
  readonly name = "fake";
  async complete(_request: LlmRequest): Promise<string> {
    return JSON.stringify(SAMPLE_STORYBOARD);
  }
}
