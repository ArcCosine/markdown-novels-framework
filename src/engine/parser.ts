import { marked } from "marked";
import type { NovelAction, NovelChoice, NovelScene } from "../types";

export function parseMarkdown(markdownText: string): NovelScene {
  const tokens = marked.lexer(markdownText);
  let title = "Untitled Scene";
  let actions: NovelAction[] = [];
  const choices: NovelChoice[] = [];

  // トークンの再帰的走査によりリンク（選択肢）を抽出
  function extractLinks(tokenList: any[]) {
    for (const token of tokenList) {
      if (token.type === "link") {
        choices.push({
          text: token.text,
          target: token.href,
        });
      } else if (token.tokens) {
        extractLinks(token.tokens);
      } else if (token.items) {
        extractLinks(token.items);
      }
    }
  }

  for (const token of tokens) {
    if (token.type === "heading" && token.depth === 1) {
      title = token.text;
    } else if (token.type === "code") {
      try {
        // json もしくは指定なしのコードブロックをパース
        const parsed = JSON.parse(token.text);
        if (Array.isArray(parsed)) {
          actions = parsed as NovelAction[];
        }
      } catch (e) {
        console.error("Failed to parse JSON code block in scenario:", e);
      }
    }
  }

  // 選択肢の抽出
  extractLinks(tokens);

  return {
    title,
    actions,
    choices,
  };
}

/**
 * 現在のMarkdownファイルのURLを基準に、アセットの絶対URLを解決します。
 * @param currentFilePath 現在のMarkdownのパス (例: "docs/chapter1/scene.md")
 * @param relativeAssetPath アセットの相対パス (例: "../images/bg.png")
 */
export function resolveAssetPath(
  currentFilePath: string,
  relativeAssetPath: string | null | undefined,
): string | null {
  if (!relativeAssetPath) return null;

  // ブラウザの現在のオリジンからのフルパスを作るために URL を利用する
  const base = new URL(window.location.href);

  // currentFilePath から親ディレクトリのURLパスを計算する
  // 例: "/docs/chapter1/scene.md" -> "/docs/chapter1/"
  const pathParts = currentFilePath.split("/");
  pathParts.pop(); // ファイル名を取り除く
  const directoryPath = pathParts.join("/") + "/";

  // directoryPath をベースに相対パスを解決
  const resolvedUrl = new URL(relativeAssetPath, new URL(directoryPath, base.origin));

  return resolvedUrl.href;
}
