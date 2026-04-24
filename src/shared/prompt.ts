import type { PromptBuildInput, PromptPackage } from "./types";

const DEFAULT_NEGATIVE_PROMPT = [
  "no watermark",
  "no distorted hands",
  "no extra limbs",
  "no plastic skin",
  "no unreadable text",
  "no fake CGI look",
].join(", ");

const categoryLanguage: Record<string, string> = {
  portrait_photography:
    "ultra-realistic portrait photography, cinematic 35mm film still, natural skin texture, expressive lighting",
  poster_illustration:
    "high-end poster composition, strong visual hierarchy, polished editorial design",
  character_design:
    "production-ready character design sheet, consistent identity, clear costume and silhouette details",
  ui_social_mockup:
    "realistic social media or interface mockup, coherent layout, readable UI details",
  comparison_experiment:
    "clear visual comparison study, consistent framing, controlled lighting and style variables",
  product_ad:
    "premium product advertising image, controlled studio lighting, refined material rendering",
  infographic:
    "structured infographic composition, clean information hierarchy, readable labels",
};

function cleanIdea(idea: string): string {
  return idea.trim().replace(/\s+/g, " ");
}

function buildTitle(idea: string): string {
  const shortIdea = idea.slice(0, 24);
  return `${shortIdea || "Image"} Prompt`;
}

export function buildFallbackPromptPackage(input: PromptBuildInput): PromptPackage {
  const idea = cleanIdea(input.idea);
  const category = input.category ?? "portrait_photography";
  const styleLanguage = categoryLanguage[category] ?? categoryLanguage.portrait_photography;
  const controlLanguage = [
    input.controls?.lens,
    input.controls?.lighting,
    input.controls?.shotType,
    input.controls?.colorPalette,
    input.controls?.mood,
  ].filter(Boolean);
  const masterPrompt = [
    idea,
    styleLanguage,
    ...controlLanguage,
    "precise subject description, immersive scene atmosphere, thoughtful composition, detailed lighting, believable materials, high fidelity image quality",
  ].join(", ");

  return {
    title: buildTitle(idea),
    masterPrompt,
    negativePrompt: DEFAULT_NEGATIVE_PROMPT,
    cnExplanation:
      "系统已将你的想法拆成主体、场景、镜头、光线、构图、材质、质量和排除项，并补全更具体的摄影语言。",
    settings: {
      model: "gpt-image-2",
      quality: input.controls?.quality ?? "medium",
      size: input.controls?.size ?? "1024x1536",
      outputFormat: input.controls?.outputFormat ?? "jpeg",
    },
    references: [],
    missingFields: idea.length < 12 ? ["请补充主体或场景"] : [],
    riskFlags: [],
    promptScore: idea.length > 20 ? 82 : 68,
  };
}
