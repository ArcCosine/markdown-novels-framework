import "./style.css";
import { NovelUI } from "./engine/ui";
import { AudioManager } from "./engine/audio";
import { NovelRunner } from "./engine/runner";

// アプリの起動
const ui = new NovelUI("app");
const audio = new AudioManager();
new NovelRunner(ui, audio);

// 最初にタイトル画面を表示
ui.showTitleScreen();
