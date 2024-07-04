async function createHash(message: string): Promise<string> {
  // Step 1: Convert the message to an ArrayBuffer
  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  // Step 2: Hash the data using SHA-256
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  // Step 3: Convert the ArrayBuffer to a hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

export class FingerprintSDK {
  private canvas: HTMLCanvasElement;
  private audio: AudioContext;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.audio = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
  }

  // Canvas Fingerprint
  public async getCanvasFingerprint(): Promise<string> {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return "";

    // Draw various shapes and text
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("abcdefghijklmnopqrstuvwxyz", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("abcdefghijklmnopqrstuvwxyz", 4, 17);

    return await this.hashData(this.canvas.toDataURL());
  }

  // WebGL Fingerprint
  public async getWebGLFingerprint(): Promise<string> {
    const gl =
      this.canvas.getContext("webgl") ||
      (this.canvas.getContext("experimental-webgl") as WebGLRenderingContext);
    if (!gl) return "";

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (!debugInfo) return "";

    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);

    return await this.hashData(`${vendor}~${renderer}`);
  }

  // Audio Fingerprint
  public async getAudioFingerprint(): Promise<string> {
    return new Promise((resolve) => {
      const oscillator = this.audio.createOscillator();
      const analyser = this.audio.createAnalyser();
      const gainNode = this.audio.createGain();
      gainNode.gain.value = 0; // mute the sound
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(10000, this.audio.currentTime);

      oscillator.connect(analyser);
      analyser.connect(gainNode);
      gainNode.connect(this.audio.destination);

      oscillator.start(0);

      setTimeout(() => {
        const frequencyData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(frequencyData);
        oscillator.stop();
        resolve(this.hashData(frequencyData.join(",")));
      }, 100);
    });
  }

  // Font List
  public getFontList(): string[] {
    const baseFonts = ["monospace", "sans-serif", "serif"];
    const fontList = [
      "Arial",
      "Helvetica",
      "Times New Roman",
      "Courier",
      "Verdana",
      "Georgia",
      "Palatino",
      "Garamond",
      "Bookman",
      "Comic Sans MS",
      "Trebuchet MS",
      "Arial Black",
      "Impact",
    ];

    const testString = "mmmmmmmmmmlli";
    const testSize = "12px";
    const h = document.getElementsByTagName("body")[0];

    const s = document.createElement("span");
    s.style.fontSize = testSize;
    s.innerHTML = testString;
    const defaultWidth: { [key: string]: number } = {};
    const defaultHeight: { [key: string]: number } = {};

    for (const baseFont of baseFonts) {
      s.style.fontFamily = baseFont;
      h.appendChild(s);
      defaultWidth[baseFont] = s.offsetWidth;
      defaultHeight[baseFont] = s.offsetHeight;
      h.removeChild(s);
    }

    const detected: string[] = [];
    for (const font of fontList) {
      let isDetected = false;
      for (const baseFont of baseFonts) {
        s.style.fontFamily = `'${font}',${baseFont}`;
        h.appendChild(s);
        const matched =
          s.offsetWidth !== defaultWidth[baseFont] ||
          s.offsetHeight !== defaultHeight[baseFont];
        h.removeChild(s);
        if (matched) {
          isDetected = true;
          break;
        }
      }
      if (isDetected) {
        detected.push(font);
      }
    }

    return detected;
  }

  public async getTimezoneFingerprint(): Promise<string> {
    const timezoneOffset = new Date().getTimezoneOffset();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return await this.hashData(`${timezoneOffset}~${timezone}`);
  }

  // Language Fingerprint
  public async getLanguageFingerprint(): Promise<string> {
    const language = navigator.language || (navigator as any).userLanguage;
    const languages = navigator.languages ? navigator.languages.join(",") : "";
    console.log(language, languages);
    return await this.hashData(`${language}~${languages}`);
  }

  // Plugin Fingerprint
  public async getPluginFingerprint(): Promise<string> {
    if (navigator.plugins) {
      return await this.hashData(
        Array.from(navigator.plugins)
          .map((p) => `${p.name}~${p.filename}`)
          .join("|")
      );
    }
    return "";
  }

  // Hardware Concurrency Fingerprint
  public async getHardwareConcurrencyFingerprint(): Promise<string> {
    return await this.hashData(String(navigator.hardwareConcurrency || ""));
  }

  // Do Not Track Fingerprint
  public async getDoNotTrackFingerprint(): Promise<string> {
    const dnt =
      navigator.doNotTrack ||
      (window as any).doNotTrack ||
      (navigator as any).msDoNotTrack;
    return await this.hashData(String(dnt));
  }

  // Color Gamut Fingerprint
  public async getColorGamutFingerprint(): Promise<string> {
    const colorGamut =
      (window.matchMedia("(color-gamut: srgb)").matches ? "srgb" : "") +
      (window.matchMedia("(color-gamut: p3)").matches ? "p3" : "") +
      (window.matchMedia("(color-gamut: rec2020)").matches ? "rec2020" : "");
    return await this.hashData(colorGamut);
  }

  // Touch Support Fingerprint
  public async getTouchSupportFingerprint(): Promise<string> {
    const maxTouchPoints = navigator.maxTouchPoints || 0;
    const touchEvent = "ontouchstart" in window;
    const touchPoints = `${maxTouchPoints}~${touchEvent}`;
    return await this.hashData(touchPoints);
  }

  // CPU Class Fingerprint (for older IE browsers)
  public async getCPUClassFingerprint(): Promise<string> {
    return await this.hashData((navigator as any).cpuClass || "");
  }

  // Platform Fingerprint
  public async getPlatformFingerprint(): Promise<string> {
    return await this.hashData(navigator.platform || "");
  }

  // Local Storage and Session Storage Availability
  public async getStorageFingerprint(): Promise<string> {
    let localStorage = "0",
      sessionStorage = "0";
    try {
      localStorage = String(!!window.localStorage);
      sessionStorage = String(!!window.sessionStorage);
    } catch (e) {
      // Storage might be disabled
    }
    return await this.hashData(`${localStorage}~${sessionStorage}`);
  }

  // Weights for each fingerprinting method
  private weights = {
    canvas: 0.4,
    webGL: 0.25,
    audio: 0.25,
    fonts: 0.2,
    userAgent: 0.05,
    network: 0.1,
    screen: 0.02,
    timezone: 0.02,
    language: 0.001,
    plugins: 0.02,
    hardwareConcurrency: 0.02,
    doNotTrack: 0.01,
    colorGamut: 0.02,
    touchSupport: 0.02,
    cpuClass: 0.01,
    platform: 0.02,
    storage: 0.02,
  };

  // Generate a weighted visitorId
  public async generateVisitorId(): Promise<string> {
    const canvasFingerprint = await this.getCanvasFingerprint();
    const webGLFingerprint = await this.getWebGLFingerprint();
    const audioFingerprint = await this.getAudioFingerprint();
    const fontFingerprint = await this.hashData(this.getFontList().join(","));
    const userAgentFingerprint = await this.getUserAgentFingerprint();
    const networkFingerprint = await this.getNetworkFingerprint();
    const screenFingerprint = await this.getScreenFingerprint();
    const timezoneFingerprint = await this.getTimezoneFingerprint();
    const languageFingerprint = await this.getLanguageFingerprint();
    const pluginFingerprint = await this.getPluginFingerprint();
    const hardwareConcurrencyFingerprint =
      await this.getHardwareConcurrencyFingerprint();
    const doNotTrackFingerprint = await this.getDoNotTrackFingerprint();
    const colorGamutFingerprint = await this.getColorGamutFingerprint();
    const touchSupportFingerprint = await this.getTouchSupportFingerprint();
    const cpuClassFingerprint = await this.getCPUClassFingerprint();
    const platformFingerprint = await this.getPlatformFingerprint();
    const storageFingerprint = await this.getStorageFingerprint();

    const weightedComponents = [
      canvasFingerprint.repeat(Math.floor(this.weights.canvas * 100)),
      webGLFingerprint.repeat(Math.floor(this.weights.webGL * 100)),
      audioFingerprint.repeat(Math.floor(this.weights.audio * 100)),
      fontFingerprint.repeat(Math.floor(this.weights.fonts * 100)),
      userAgentFingerprint.repeat(Math.floor(this.weights.userAgent * 100)),
      networkFingerprint.repeat(Math.floor(this.weights.network * 100)),
      screenFingerprint.repeat(Math.floor(this.weights.screen * 100)),
      timezoneFingerprint.repeat(Math.floor(this.weights.timezone * 100)),
      languageFingerprint.repeat(Math.floor(this.weights.language * 100)),
      pluginFingerprint.repeat(Math.floor(this.weights.plugins * 100)),
      hardwareConcurrencyFingerprint.repeat(
      Math.floor(this.weights.hardwareConcurrency * 100)
      ),
      doNotTrackFingerprint.repeat(Math.floor(this.weights.doNotTrack * 100)),
      colorGamutFingerprint.repeat(Math.floor(this.weights.colorGamut * 100)),
      touchSupportFingerprint.repeat(
        Math.floor(this.weights.touchSupport * 100)
      ),
      cpuClassFingerprint.repeat(Math.floor(this.weights.cpuClass * 100)),
      platformFingerprint.repeat(Math.floor(this.weights.platform * 100)),
      storageFingerprint.repeat(Math.floor(this.weights.storage * 100)),
    ];

    const combinedFingerprint = weightedComponents.join("");
    return await this.hashData(combinedFingerprint);
  }

  // Method to get current weights
  public getWeights(): typeof this.weights {
    return { ...this.weights };
  }

  public async getScreenFingerprint(): Promise<string> {
    try {
      if (window.screen) {
        const width = window.screen.width || 0;
        const height = window.screen.height || 0;
        const colorDepth = window.screen.colorDepth || 0;
        const pixelRatio = window.devicePixelRatio || 1;

        return await this.hashData(
          `${width}x${height}x${colorDepth}@${pixelRatio}`
        );
      }
    } catch (e) {
      console.warn("Screen fingerprinting failed:", e);
    }
    return "";
  }

  public async getUserAgentFingerprint(): Promise<string> {
    return await this.hashData(navigator.userAgent);
  }

  // Network Information Fingerprint
  public async getNetworkFingerprint(): Promise<string> {
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;
    if (connection) {
      return await this.hashData(
        `${connection.type}~${connection.effectiveType}~${connection.downlink}~${connection.rtt}`
      );
    }
    return "";
  }

  private async hashData(data: string): Promise<string> {
    return await createHash(data);
  }
}

// Usage example
const fingerprintSDK = new FingerprintSDK();

fingerprintSDK.generateVisitorId().then((visitorId) => {
  console.log("Visitor ID:", visitorId);
  console.log("Current Weights:", fingerprintSDK.getWeights());
});
