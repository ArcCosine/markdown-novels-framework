import type { GameState, NovelAction, NovelChoice, NovelScene, SaveSlot } from "../types";
import { parseMarkdown, resolveAssetPath } from "./parser";
import { AudioManager } from "./audio";
import { NovelUI } from "./ui";

export class NovelRunner {
  private ui: NovelUI;
  private audio: AudioManager;

  // 現在のステート
  private state!: GameState;

  // 現在読み込んでいるシーンデータ
  private currentScene: NovelScene | null = null;

  // 実行状態制御
  private isProcessing = false;
  private isRestoring = false;

  constructor(ui: NovelUI, audio: AudioManager) {
    this.ui = ui;
    this.audio = audio;
    this.resetState();
    this.bindEvents();
  }

  private resetState() {
    this.state = {
      currentFilePath: "docs/main.md",
      currentActionIndex: 0,
      variables: {},
      bg: null,
      character: null,
      bgm: null,
      history: [],
    };
    (window as any).__novel_history = this.state.history;
  }

  private bindEvents() {
    this.ui.bindOnMessageClick(() => this.next());
    this.ui.bindOnChoiceSelected((choice) => this.handleChoiceSelected(choice));
    this.ui.bindOnSave((slotId) => this.saveGame(slotId));
    this.ui.bindOnLoad((slotId) => this.loadGame(slotId));
    this.ui.bindOnStartNewGame(() => this.startNewGame());
    this.ui.bindOnBackToTitle(() => this.backToTitle());
  }

  backToTitle() {
    this.audio.stopBGM();
    this.state.bgm = null;
    this.state.character = null;
    this.ui.updateCharacter(null);
  }

  async startNewGame() {
    this.audio.unlock();
    this.resetState();
    this.audio.stopBGM();
    await this.loadScene("docs/main.md");
  }

  /**
   * シーンファイル(Markdown)をロードしてパースします
   */
  async loadScene(filePath: string, startFromIndex = 0) {
    try {
      this.isProcessing = true;
      this.ui.hideChoices();

      // シーン切り替え時にキャラクターの立ち絵を初期値（非表示）にクリア
      this.state.character = null;
      this.ui.updateCharacter(null);

      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`Failed to load scenario file: ${filePath}`);
      }

      const markdownText = await response.text();
      this.currentScene = parseMarkdown(markdownText);
      this.state.currentFilePath = filePath;
      this.state.currentActionIndex = startFromIndex;

      this.isProcessing = false;

      if (this.isRestoring) {
        // ロード復元中の場合、高速スキップで指定インデックスまで演出を適用
        await this.restoreSceneState(startFromIndex);
      } else {
        // 通常開始
        await this.executeAction();
      }
    } catch (e) {
      console.error(e);
      this.isProcessing = false;
    }
  }

  /**
   * 現在のアクションを実行します
   */
  private async executeAction() {
    if (this.isProcessing || !this.currentScene) return;

    const actions = this.currentScene.actions;
    const index = this.state.currentActionIndex;

    // アクションがすべて終了した場合、選択肢を表示
    if (index >= actions.length) {
      this.ui.showChoices(this.currentScene.choices);
      return;
    }

    this.isProcessing = true;
    const action = actions[index];

    // アクションの種類に応じて処理を分岐
    if (action.action) {
      switch (action.action) {
        case "bg":
          await this.handleBgAction(action);
          break;
        case "character":
          await this.handleCharacterAction(action);
          break;
        case "bgm":
          await this.handleBgmAction(action);
          break;
        case "se":
          await this.handleSeAction(action);
          break;
        case "wait":
          await this.handleWaitAction(action);
          break;
      }
    } else if (action.text) {
      // 会話テキストアクション（クリック待ちが発生するため、ここで処理を止める）
      this.handleTextAction(action);
      return; // click待ちにするため、自動進行はしない
    } else {
      // 空のアクションや未定義の動作はスキップして次へ
      this.isProcessing = false;
      this.state.currentActionIndex++;
      this.executeAction();
      return;
    }

    // 演出アクション（bg, character, bgm, se, wait）は完了後、自動的に次のアクションへ進む
    this.isProcessing = false;
    this.state.currentActionIndex++;
    this.executeAction();
  }

  /**
   * ユーザーのクリック（またはキー入力）で次へ進む
   */
  async next() {
    if (this.isProcessing || this.isRestoring) return;

    if (this.currentScene) {
      this.state.currentActionIndex++;
      await this.executeAction();
    }
  }

  // 各アクションのハンドリング

  private async handleBgAction(action: NovelAction) {
    const resolvedPath = resolveAssetPath(this.state.currentFilePath, action.file);
    this.state.bg = resolvedPath;
    if (!this.isRestoring) {
      this.ui.updateBackground(resolvedPath);
    }
  }

  private async handleCharacterAction(action: NovelAction) {
    const resolvedPath = resolveAssetPath(this.state.currentFilePath, action.file);
    const pos = action.position || "center";
    this.state.character = resolvedPath ? { file: resolvedPath, position: pos } : null;
    if (!this.isRestoring) {
      this.ui.updateCharacter(resolvedPath, pos);
    }
  }

  private async handleBgmAction(action: NovelAction) {
    const resolvedPath = resolveAssetPath(this.state.currentFilePath, action.file);
    this.state.bgm = resolvedPath;
    if (!this.isRestoring) {
      if (resolvedPath) {
        await this.audio.playBGM(resolvedPath);
      } else {
        this.audio.stopBGM();
      }
    }
  }

  private async handleSeAction(action: NovelAction) {
    // 復元（スキップ）中は効果音を鳴らさない
    if (!this.isRestoring && action.file) {
      const resolvedPath = resolveAssetPath(this.state.currentFilePath, action.file);
      if (resolvedPath) {
        await this.audio.playSE(resolvedPath);
      }
    }
  }

  private async handleWaitAction(action: NovelAction) {
    // 復元中は待機時間をスキップ
    if (!this.isRestoring && action.duration) {
      await new Promise((resolve) => setTimeout(resolve, action.duration));
    }
  }

  private handleTextAction(action: NovelAction) {
    const speaker = action.name || "";
    const text = action.text || "";

    // 履歴に追加
    this.state.history.push({ name: speaker, text });
    if (this.state.history.length > 50) {
      this.state.history.shift(); // 履歴の上限
    }
    (window as any).__novel_history = this.state.history;

    this.isProcessing = false;
    this.ui.showText(speaker, text);
  }

  // 選択肢のクリックハンドリング
  private async handleChoiceSelected(choice: NovelChoice) {
    const resolvedPath = resolveAssetPath(this.state.currentFilePath, choice.target);
    if (resolvedPath) {
      // フルURLからパス名を取得 (例: "/docs/chapter1/shortcut.md")
      const pathname = new URL(resolvedPath).pathname;
      let relativePath = pathname;
      if (relativePath.startsWith("/")) {
        relativePath = relativePath.substring(1);
      }

      // シーン履歴のBGMや背景情報を引き継いだまま新しいシーンへ
      await this.loadScene(relativePath, 0);
    }
  }

  // セーブ・ロードの実装

  private saveGame(slotId: number) {
    const saveSlot: SaveSlot = {
      id: slotId,
      state: JSON.parse(JSON.stringify(this.state)), // ディープコピー
      savedAt: new Date().toLocaleString(),
    };
    localStorage.setItem(`novel_save_slot_${slotId}`, JSON.stringify(saveSlot));
    console.log(`Game saved to slot ${slotId}`);
  }

  private async loadGame(slotId: number) {
    const data = localStorage.getItem(`novel_save_slot_${slotId}`);
    if (!data) return;

    try {
      this.audio.unlock();
      const saveSlot: SaveSlot = JSON.parse(data);
      if (!saveSlot.state) return;

      this.isRestoring = true;

      // 音声を一時停止
      this.audio.stopBGM();

      // ステートの復元
      const savedState = saveSlot.state;
      this.state = savedState;
      (window as any).__novel_history = this.state.history;

      // 該当のシナリオを読み込んで復元を開始
      await this.loadScene(savedState.currentFilePath, savedState.currentActionIndex);
    } catch (e) {
      console.error(`Failed to load slot ${slotId}:`, e);
      this.isRestoring = false;
    }
  }

  /**
   * セーブデータロード時に、対象のインデックスまで演出を高速スキップ適用します
   */
  private async restoreSceneState(targetIndex: number) {
    if (!this.currentScene) return;

    this.isRestoring = true;
    const actions = this.currentScene.actions;

    // 0 から targetIndex までの演出（BGM、背景、立ち絵）を同期的に高速適用
    for (let i = 0; i < targetIndex; i++) {
      if (i >= actions.length) break;
      const action = actions[i];
      if (action.action) {
        switch (action.action) {
          case "bg":
            await this.handleBgAction(action);
            break;
          case "character":
            await this.handleCharacterAction(action);
            break;
          case "bgm":
            await this.handleBgmAction(action);
            break;
          // SEとWAITはロード復元時はスキップ
        }
      }
    }

    this.isRestoring = false;

    // 現在保存されているアセット状態をUIに実際に反映
    this.ui.updateBackground(this.state.bg);

    if (this.state.character) {
      this.ui.updateCharacter(this.state.character.file, this.state.character.position);
    } else {
      this.ui.updateCharacter(null);
    }

    if (this.state.bgm) {
      await this.audio.playBGM(this.state.bgm);
    } else {
      this.audio.stopBGM();
    }

    // ターゲットインデックスのアクションを実行（会話テキストなど）
    this.state.currentActionIndex = targetIndex;
    this.isProcessing = false;
    await this.executeAction();
  }
}
export default NovelRunner;
