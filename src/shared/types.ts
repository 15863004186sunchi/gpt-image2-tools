export type PromptMode = "quick" | "professional";

export type PromptCategory =
  | "portrait_photography"
  | "poster_illustration"
  | "character_design"
  | "ui_social_mockup"
  | "comparison_experiment"
  | "product_ad"
  | "infographic";

export interface PromptSettings {
  model: string;
  quality: "low" | "medium" | "high";
  size: "1024x1024" | "1024x1536" | "1536x1024";
  outputFormat: "jpeg" | "png" | "webp";
}

export interface PromptPackage {
  title: string;
  masterPrompt: string;
  negativePrompt: string;
  cnExplanation: string;
  settings: PromptSettings;
  references: string[];
  missingFields: string[];
  riskFlags: string[];
  promptScore: number;
}

export interface PromptControls {
  lens?: string;
  lighting?: string;
  shotType?: string;
  colorPalette?: string;
  mood?: string;
  quality?: PromptSettings["quality"];
  size?: PromptSettings["size"];
  outputFormat?: PromptSettings["outputFormat"];
}

export interface PromptBuildInput {
  idea: string;
  mode: PromptMode;
  category?: PromptCategory;
  controls?: PromptControls;
}
