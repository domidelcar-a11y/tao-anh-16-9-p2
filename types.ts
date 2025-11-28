
export type AspectRatio = "1:1" | "4:3" | "16:9" | "9:16";

export interface Character {
  id: string;
  name: string;
  imageBase64: string;
  mimeType: string;
}

export interface Scene {
  prompt: string;
  characterName: string;
  fullText: string;
  sceneNumber: number;
}

export interface GeneratedImage {
  id: string;
  prompt: string;
  src: string;
  isLoading: boolean;
  characterRefId?: string;
  isSelected: boolean;
  sceneName: string;
  sceneScript: string;
}