export class AudioManager {
  private audioContext: AudioContext | null = null;
  private bgmAudio: HTMLAudioElement | null = null;
  private currentBgmPath: string | null = null;

  // ダミーBGM用
  private dummyBgmInterval: any = null;
  private dummyOscillators: OscillatorNode[] = [];

  constructor() {
    // ユーザーインタラクションを待って初期化するため、コンストラクタでは何もしない
  }

  private initContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }
  }

  /**
   * ユーザーアクションの瞬間に呼び出して、ブラウザの音声制限を解除します。
   */
  unlock() {
    this.initContext();
  }

  /**
   * BGMを再生します
   * @param path 解決済みのアセットパス (例: "/docs/sounds/peaceful.mp3")
   */
  async playBGM(path: string) {
    this.initContext();

    if (this.currentBgmPath === path) {
      return; // 既に同じBGMが再生中
    }

    this.stopBGM();
    this.currentBgmPath = path;

    // まず実際にアセットが存在するかfetchで確認
    let assetExists = false;
    try {
      const response = await fetch(path, { method: "HEAD" });
      const contentType = response.headers.get("content-type") || "";
      assetExists = response.ok && !contentType.includes("text/html");
    } catch {
      assetExists = false;
    }

    if (assetExists) {
      // 実ファイルが存在する場合は HTMLAudioElement でループ再生
      this.bgmAudio = new Audio(path);
      this.bgmAudio.loop = true;
      this.bgmAudio.volume = 0.5;
      this.bgmAudio.play().catch((err) => {
        console.warn("Audio play auto-play block, waiting for interaction:", err);
      });
    } else {
      // アセットがない場合は Web Audio API でダミーBGMを合成
      console.log(`BGM asset not found: ${path}. Playing synthesized dummy BGM.`);
      this.playDummyBGM(path);
    }
  }

  stopBGM() {
    // 実BGMの停止
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio = null;
    }
    this.currentBgmPath = null;

    // ダミーBGMの停止
    if (this.dummyBgmInterval) {
      clearInterval(this.dummyBgmInterval);
      this.dummyBgmInterval = null;
    }
    this.dummyOscillators.forEach((osc) => {
      try {
        osc.stop();
      } catch {}
    });
    this.dummyOscillators = [];
  }

  /**
   * 効果音を再生します
   * @param path 解決済みのアセットパス
   */
  async playSE(path: string) {
    this.initContext();

    let assetExists = false;
    try {
      const response = await fetch(path, { method: "HEAD" });
      const contentType = response.headers.get("content-type") || "";
      assetExists = response.ok && !contentType.includes("text/html");
    } catch {
      assetExists = false;
    }

    if (assetExists) {
      const seAudio = new Audio(path);
      seAudio.volume = 0.6;
      seAudio.play().catch((err) => console.warn("SE playback error:", err));
    } else {
      console.log(`SE asset not found: ${path}. Playing synthesized dummy SE.`);
      this.playDummySE(path);
    }
  }

  // Web Audio API によるダミーBGM合成再生
  private playDummyBGM(path: string) {
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    let notes: number[] = [261.63, 329.63, 392.0, 523.25]; // C4, E4, G4, C5 (Peaceful)
    let tempo = 500; // ミリ秒単位の音符間隔

    if (path.includes("adventure")) {
      notes = [293.66, 349.23, 440.0, 587.33]; // D4, F4, A4, D5 (Adventure - マイナー調)
      tempo = 250; // アップテンポ
    }

    let step = 0;

    this.dummyBgmInterval = setInterval(() => {
      if (ctx.state === "suspended") return;

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = "triangle"; // 柔らかいレトロ音
      osc.frequency.value = notes[step % notes.length];

      gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
      // フェードアウト
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.45);

      this.dummyOscillators.push(osc);
      // メモリリーク防止のため配列の上限を制限
      if (this.dummyOscillators.length > 20) {
        this.dummyOscillators.shift();
      }

      step++;
    }, tempo);
  }

  // Web Audio API によるダミー効果音合成再生
  private playDummySE(path: string) {
    if (!this.audioContext) return;

    const ctx = this.audioContext;

    if (path.includes("rustle")) {
      // カサカサ音：ホワイトノイズ風
      const bufferSize = ctx.sampleRate * 0.3; // 0.3秒
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1000;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
    } else {
      // デフォルト：プピッという短い警告音
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    }
  }
}
