import type { NovelChoice, SaveSlot } from "../types";

export class NovelUI {
  private root: HTMLElement;
  private viewport!: HTMLDivElement;
  private bgLayer!: HTMLDivElement;
  private characterLayer!: HTMLDivElement;
  private messageBox!: HTMLDivElement;
  private speakerName!: HTMLDivElement;
  private messageText!: HTMLDivElement;
  private clickIndicator!: HTMLDivElement;
  private choicesContainer!: HTMLDivElement;

  // モーダル関連
  private modalOverlay!: HTMLDivElement;
  private modalTitle!: HTMLDivElement;
  private modalContent!: HTMLDivElement;

  // タイトル画面関連
  private titleOverlay!: HTMLDivElement;

  // テキスト表示のアニメーション状態
  private isTyping = false;
  private typingTimer: any = null;
  private currentFullText = "";

  // コールバック
  private onMessageClickCallback: () => void = () => {};
  private onChoiceSelectedCallback: (choice: NovelChoice) => void = () => {};
  private onSaveCallback: (slotId: number) => void = () => {};
  private onLoadCallback: (slotId: number) => void = () => {};
  private onStartNewGameCallback: () => void = () => {};
  private onBackToTitleCallback: () => void = () => {};

  constructor(rootId: string) {
    const root = document.getElementById(rootId);
    if (!root) throw new Error(`Root element with id "${rootId}" not found.`);
    this.root = root;
    this.initDOM();
  }

  private initDOM() {
    this.root.innerHTML = "";

    // ビューポート
    this.viewport = document.createElement("div");
    this.viewport.className = "game-viewport";

    // 背景レイヤー
    this.bgLayer = document.createElement("div");
    this.bgLayer.className = "layer bg-layer";
    this.viewport.appendChild(this.bgLayer);

    // キャラクターレイヤー
    this.characterLayer = document.createElement("div");
    this.characterLayer.className = "layer character-layer";
    this.viewport.appendChild(this.characterLayer);

    // UIレイヤー (メッセージウィンドウ等)
    const uiLayer = document.createElement("div");
    uiLayer.className = "ui-layer";

    // メッセージボックス
    this.messageBox = document.createElement("div");
    this.messageBox.className = "message-box";
    this.messageBox.addEventListener("click", () => this.handleMessageClick());

    this.speakerName = document.createElement("div");
    this.speakerName.className = "speaker-name";
    this.messageBox.appendChild(this.speakerName);

    this.messageText = document.createElement("div");
    this.messageText.className = "message-text";
    this.messageBox.appendChild(this.messageText);

    this.clickIndicator = document.createElement("div");
    this.clickIndicator.className = "click-indicator";
    this.clickIndicator.style.display = "none";
    this.messageBox.appendChild(this.clickIndicator);

    uiLayer.appendChild(this.messageBox);

    // メニューバー
    const menuBar = document.createElement("div");
    menuBar.className = "menu-bar";

    const btnBacklog = this.createMenuButton("履歴", () => this.showBacklogModal());
    const btnSave = this.createMenuButton("セーブ", () => this.showSaveModal());
    const btnLoad = this.createMenuButton("ロード", () => this.showLoadModal());
    const btnTitle = this.createMenuButton("タイトルへ", () => {
      this.showTitleScreen();
      this.onBackToTitleCallback();
    });

    menuBar.appendChild(btnBacklog);
    menuBar.appendChild(btnSave);
    menuBar.appendChild(btnLoad);
    menuBar.appendChild(btnTitle);
    uiLayer.appendChild(menuBar);

    this.viewport.appendChild(uiLayer);

    // 選択肢コンテナ
    this.choicesContainer = document.createElement("div");
    this.choicesContainer.className = "choices-container";
    this.viewport.appendChild(this.choicesContainer);

    // モーダルオーバーレイ
    this.initModalDOM();

    // タイトル画面オーバーレイ
    this.initTitleDOM();

    this.root.appendChild(this.viewport);
  }

  private createMenuButton(text: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = "menu-button";
    btn.textContent = text;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  private initModalDOM() {
    this.modalOverlay = document.createElement("div");
    this.modalOverlay.className = "modal-overlay";

    const header = document.createElement("div");
    header.className = "modal-header";

    this.modalTitle = document.createElement("div");
    this.modalTitle.className = "modal-title";
    header.appendChild(this.modalTitle);

    const closeBtn = document.createElement("button");
    closeBtn.className = "modal-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", () => this.hideModal());
    header.appendChild(closeBtn);

    this.modalOverlay.appendChild(header);

    this.modalContent = document.createElement("div");
    this.modalContent.className = "modal-content";
    this.modalOverlay.appendChild(this.modalContent);

    // ビューポートに追加（モーダルはゲーム内でのみ表示）
    this.viewport.appendChild(this.modalOverlay);
  }

  private initTitleDOM() {
    this.titleOverlay = document.createElement("div");
    this.titleOverlay.className = "title-overlay";

    const titleText = document.createElement("h1");
    titleText.className = "game-title";
    titleText.innerHTML = "Markdown Novel<br>Framework";
    this.titleOverlay.appendChild(titleText);

    const menu = document.createElement("div");
    menu.className = "title-menu";

    const startBtn = document.createElement("button");
    startBtn.className = "title-btn";
    startBtn.textContent = "最初から始める";
    startBtn.addEventListener("click", () => {
      this.titleOverlay.classList.add("hidden");
      this.onStartNewGameCallback();
    });
    menu.appendChild(startBtn);

    const loadBtn = document.createElement("button");
    loadBtn.className = "title-btn";
    loadBtn.textContent = "ロードする";
    loadBtn.addEventListener("click", () => {
      this.showLoadModal(true); // タイトル用ロード
    });
    menu.appendChild(loadBtn);

    this.titleOverlay.appendChild(menu);
    this.viewport.appendChild(this.titleOverlay);
  }

  showTitleScreen() {
    this.titleOverlay.classList.remove("hidden");
    this.hideModal();
  }

  // 背景の更新（クロスフェード）
  updateBackground(src: string | null) {
    if (!src) {
      this.bgLayer.style.backgroundImage = "none";
      return;
    }

    // フェードを滑らかにするため、テンポラリの裏イメージを作成して読み込み完了後に適用
    const img = new Image();
    img.src = src;
    img.onload = () => {
      this.bgLayer.style.opacity = "0";
      setTimeout(() => {
        this.bgLayer.style.backgroundImage = `url(${src})`;
        this.bgLayer.style.opacity = "1";
      }, 150);
    };
  }

  // 立ち絵の更新
  updateCharacter(src: string | null, position: "left" | "center" | "right" = "center") {
    this.characterLayer.innerHTML = "";
    if (!src) return;

    const img = document.createElement("img");
    img.src = src;
    img.className = "character-img enter";

    // 位置の制御
    if (position === "left") {
      img.style.marginRight = "auto";
      img.style.marginLeft = "10%";
    } else if (position === "right") {
      img.style.marginLeft = "auto";
      img.style.marginRight = "10%";
    } else {
      img.style.margin = "0 auto";
    }

    this.characterLayer.appendChild(img);

    // 表示アニメーション用
    requestAnimationFrame(() => {
      img.classList.add("active");
    });
  }

  // 文字送りアニメーションでテキストを表示
  showText(speaker: string, text: string) {
    this.speakerName.textContent = speaker || "";
    this.currentFullText = text;
    this.clickIndicator.style.display = "none";

    // 既に走っているタイマーがあれば停止
    if (this.typingTimer) {
      clearInterval(this.typingTimer);
    }

    this.isTyping = true;
    this.messageText.textContent = "";
    let index = 0;

    this.typingTimer = setInterval(() => {
      this.messageText.textContent += text[index];
      index++;

      if (index >= text.length) {
        this.completeTyping();
      }
    }, 30); // 30ms間隔で文字送り
  }

  private completeTyping() {
    if (this.typingTimer) {
      clearInterval(this.typingTimer);
      this.typingTimer = null;
    }
    this.messageText.textContent = this.currentFullText;
    this.isTyping = false;
    this.clickIndicator.style.display = "block";
  }

  private handleMessageClick() {
    if (this.isTyping) {
      // タイピング中なら一瞬で全文表示
      this.completeTyping();
    } else {
      // タイピング終了後なら次へ進む
      this.onMessageClickCallback();
    }
  }

  // 選択肢の表示
  showChoices(choices: NovelChoice[]) {
    this.choicesContainer.innerHTML = "";
    if (choices.length === 0) {
      this.choicesContainer.classList.remove("active");
      return;
    }

    choices.forEach((choice) => {
      const btn = document.createElement("button");
      btn.className = "choice-button";
      btn.textContent = choice.text;
      btn.addEventListener("click", () => {
        this.choicesContainer.classList.remove("active");
        this.onChoiceSelectedCallback(choice);
      });
      this.choicesContainer.appendChild(btn);
    });

    this.choicesContainer.classList.add("active");
  }

  hideChoices() {
    this.choicesContainer.classList.remove("active");
  }

  // モーダルの開閉
  private showModal(title: string, buildContent: (container: HTMLDivElement) => void) {
    this.modalTitle.textContent = title;
    this.modalContent.innerHTML = "";
    buildContent(this.modalContent);
    this.modalOverlay.classList.add("active");
  }

  hideModal() {
    this.modalOverlay.classList.remove("active");
  }

  // セーブ画面の構築
  showSaveModal() {
    this.showModal("セーブデータ保存", (container) => {
      const grid = document.createElement("div");
      grid.className = "slots-grid";

      const slots = this.getSaveSlots();
      slots.forEach((slot) => {
        const slotEl = this.createSlotElement(slot, "save");
        grid.appendChild(slotEl);
      });

      container.appendChild(grid);
    });
  }

  // ロード画面の構築
  showLoadModal(isTitleContext = false) {
    this.showModal("セーブデータ読込", (container) => {
      const grid = document.createElement("div");
      grid.className = "slots-grid";

      const slots = this.getSaveSlots();
      slots.forEach((slot) => {
        const slotEl = this.createSlotElement(slot, "load", isTitleContext);
        grid.appendChild(slotEl);
      });

      container.appendChild(grid);
    });
  }

  // 履歴画面の構築
  showBacklogModal() {
    this.showModal("会話履歴", (container) => {
      const backlogContainer = document.createElement("div");
      backlogContainer.className = "backlog-container";

      // コールバック経由で履歴データを取得
      const history = (window as any).__novel_history || [];
      if (history.length === 0) {
        const empty = document.createElement("div");
        empty.style.textAlign = "center";
        empty.style.color = "var(--text-muted)";
        empty.textContent = "履歴はありません。";
        backlogContainer.appendChild(empty);
      } else {
        history.forEach((item: any) => {
          const itemEl = document.createElement("div");
          itemEl.className = "backlog-item";

          const speaker = document.createElement("div");
          speaker.className = "backlog-speaker";
          speaker.textContent = item.name || "主人公";
          itemEl.appendChild(speaker);

          const text = document.createElement("div");
          text.className = "backlog-text";
          text.textContent = item.text;
          itemEl.appendChild(text);

          backlogContainer.appendChild(itemEl);
        });
      }

      container.appendChild(backlogContainer);

      // スクロールを一番下に移動させる
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    });
  }

  private createSlotElement(
    slot: SaveSlot,
    type: "save" | "load",
    isTitleContext = false,
  ): HTMLDivElement {
    const el = document.createElement("div");
    el.className = "save-slot";

    const header = document.createElement("div");
    header.className = "slot-header";
    header.innerHTML = `<span class="slot-number">Slot ${slot.id}</span>`;
    el.appendChild(header);

    const body = document.createElement("div");
    body.className = "slot-body";

    if (slot.state) {
      // シナリオのパスやセリフの最後を表示
      const lastText =
        slot.state.history.length > 0
          ? slot.state.history[slot.state.history.length - 1].text
          : "シナリオ開始直後";
      body.textContent = lastText;
    } else {
      body.textContent = "データなし";
      body.style.color = "var(--text-muted)";
    }
    el.appendChild(body);

    const footer = document.createElement("div");
    footer.className = "slot-footer";
    footer.textContent = slot.savedAt || "--/--/-- --:--";
    el.appendChild(footer);

    el.addEventListener("click", () => {
      if (type === "save") {
        this.onSaveCallback(slot.id);
        this.hideModal();
      } else {
        if (slot.state) {
          if (isTitleContext) {
            this.titleOverlay.classList.add("hidden");
          }
          this.onLoadCallback(slot.id);
          this.hideModal();
        }
      }
    });

    return el;
  }

  // localStorage からセーブスロットの一覧を取得するユーティリティ
  private getSaveSlots(): SaveSlot[] {
    const slots: SaveSlot[] = [];
    for (let i = 1; i <= 6; i++) {
      const data = localStorage.getItem(`novel_save_slot_${i}`);
      if (data) {
        try {
          slots.push(JSON.parse(data));
        } catch {
          slots.push({ id: i, state: null, savedAt: null });
        }
      } else {
        slots.push({ id: i, state: null, savedAt: null });
      }
    }
    return slots;
  }

  // イベントバインディング用メソッド
  bindOnMessageClick(cb: () => void) {
    this.onMessageClickCallback = cb;
  }
  bindOnChoiceSelected(cb: (choice: NovelChoice) => void) {
    this.onChoiceSelectedCallback = cb;
  }
  bindOnSave(cb: (slotId: number) => void) {
    this.onSaveCallback = cb;
  }
  bindOnLoad(cb: (slotId: number) => void) {
    this.onLoadCallback = cb;
  }
  bindOnStartNewGame(cb: () => void) {
    this.onStartNewGameCallback = cb;
  }
  bindOnBackToTitle(cb: () => void) {
    this.onBackToTitleCallback = cb;
  }
}
