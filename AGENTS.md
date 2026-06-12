# Agent Guidelines

This repository uses common guidelines for all AI agents (Gemini, Claude, etc.).

## RTK - Rust Token Killer

**Usage**: Token-optimized CLI proxy (60-90% savings on dev operations)

### Meta Commands (always use rtk directly)

```bash
rtk gain              # Show token savings analytics
rtk gain --history    # Show command usage history with savings
rtk discover          # Analyze Claude Code history for missed opportunities
rtk proxy <cmd>       # Execute raw command without filtering (for debugging)
```

### Installation Verification

```bash
rtk --version         # Should show: rtk X.Y.Z
rtk gain              # Should work (not "command not found")
which rtk             # Verify correct binary
```

⚠️ **Name collision**: If `rtk gain` fails, you may have reachingforthejack/rtk (Rust Type Kit) installed instead.

### Hook-Based Usage

All other commands are automatically rewritten by the Claude Code hook.
Example: `git status` → `rtk git status` (transparent, 0 tokens overhead)

## Markdown Novel Game Framework Guidelines

### 開発コマンド

- **プロジェクトセットアップ**: `rtk bun init`
- **開発サーバー起動**: `rtk bun run dev`
- **ビルド**: `rtk bun run build`
- **Linter (Oxlint)**: `rtk bunx oxlint .`
- **Formatter (Oxfmt)**: `rtk bunx oxfmt --write .`

### ディレクトリ要件

- `docs/` ディレクトリにMarkdownファイルを格納
- `docs/main.md` を最初のエントリーポイントとする
- 画像アセット: `docs/images/` （相対参照）
- 音声アセット: `docs/sounds/` （相対参照）

### アーキテクチャ方針

- **フロントエンドのみの構成**: バックエンドはなく、ブラウザ上で `fetch()` を用いて `docs/` 配下のファイルを動的に取得してパース
- **Vite 8.0**: 高速な開発サーバーとビルド
- **Cloudflare Pages**: SPAとしての配信
- **アセットパス解決**: 画像および音声アセットは、ブラウザの実行時オリジンを付与した絶対URL（フルURL）に解決して取得を行います。これにより、環境によらず確実なリソースロードを担保します。
