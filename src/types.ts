export interface NovelAction {
  action?: "bg" | "character" | "bgm" | "se" | "wait";
  file?: string | null;
  position?: "left" | "center" | "right";
  name?: string;
  text?: string;
  duration?: number;
}

export interface NovelChoice {
  text: string;
  target: string; // 相対パス（例: "chapter1/shortcut.md"）
}

export interface NovelScene {
  title: string;
  actions: NovelAction[];
  choices: NovelChoice[];
}

export interface GameState {
  currentFilePath: string;
  currentActionIndex: number;
  variables: Record<string, any>;
  bg: string | null;
  character: {
    file: string | null;
    position: "left" | "center" | "right";
  } | null;
  bgm: string | null;
  history: { name: string; text: string }[];
}

export interface SaveSlot {
  id: number;
  state: GameState | null;
  savedAt: string | null;
}
