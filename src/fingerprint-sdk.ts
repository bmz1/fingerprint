async function createHash(message: string): Promise<string> {
  // Step 1: Convert the message to an ArrayBuffer
  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  // Step 2: Hash the data using SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Step 3: Convert the ArrayBuffer to a hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export class FingerprintSDK {
  private canvas: HTMLCanvasElement;
  private audio: AudioContext;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.audio = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  // Canvas Fingerprint
  public async getCanvasFingerprint(): Promise<string> {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return '';

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
    const gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl') as WebGLRenderingContext;
    if (!gl) return '';

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return '';

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
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(10000, this.audio.currentTime);
      
      oscillator.connect(analyser);
      analyser.connect(gainNode);
      gainNode.connect(this.audio.destination);
      
      oscillator.start(0);
      
      setTimeout(() => {
        const frequencyData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(frequencyData);
        oscillator.stop();
        resolve(this.hashData(frequencyData.join(',')));
      }, 100);
    });
  }

  // Font List
  public getFontList(): string[] {
    // const fontTestSize = '12px';
    const baseFonts = ['monospace', 'sans-serif', 'serif'];
    const fontList = [
      'Arial', 'Helvetica', 'Times New Roman', 'Courier', 'Verdana', 'Georgia', 'Palatino', 'Garamond',
      'Bookman', 'Comic Sans MS', 'Trebuchet MS', 'Arial Black', 'Impact'
    ];

    const testString = 'mmmmmmmmmmlli';
    const testSize = '12px';
    const h = document.getElementsByTagName('body')[0];

    const s = document.createElement('span');
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

    const detectedFonts: string[] = [];
    for (const font of fontList) {
      let detected = false;
      for (const baseFont of baseFonts) {
        s.style.fontFamily = `'${font}',${baseFont}`;
        h.appendChild(s);
        const matched = s.offsetWidth !== defaultWidth[baseFont] || s.offsetHeight !== defaultHeight[baseFont];
        h.removeChild(s);
        if (matched) {
          detected = true;
          break;
        }
      }
      if (detected) {
        detectedFonts.push(font);
      }
    }

    return detectedFonts;
  }

  // Weights for each fingerprinting method
  private weights = {
    canvas: 0.3,
    webGL: 0.25,
    audio: 0.25,
    fonts: 0.2
  };

  // Generate a weighted visitorId
  public async generateVisitorId(): Promise<string> {
    const canvasFingerprint = await this.getCanvasFingerprint();
    const webGLFingerprint = await this.getWebGLFingerprint();
    const audioFingerprint = await this.getAudioFingerprint();
    const fontFingerprint = await this.hashData(this.getFontList().join(','));

    const weightedComponents = [
      canvasFingerprint.repeat(Math.floor(this.weights.canvas * 100)),
      webGLFingerprint.repeat(Math.floor(this.weights.webGL * 100)),
      audioFingerprint.repeat(Math.floor(this.weights.audio * 100)),
      fontFingerprint.repeat(Math.floor(this.weights.fonts * 100))
    ];

    const combinedFingerprint = weightedComponents.join('');
    return await this.hashData(combinedFingerprint);
  }

  // Utility method to get the entropy of a string
  private getEntropy(str: string): number {
    const len = str.length;
    const frequencies: { [char: string]: number } = {};
    for (let i = 0; i < len; i++) {
      frequencies[str[i]] = (frequencies[str[i]] || 0) + 1;
    }
    return Object.values(frequencies).reduce((entropy, freq) => {
      const p = freq / len;
      return entropy - p * Math.log2(p);
    }, 0);
  }

  // Method to adjust weights based on entropy
  public async adjustWeights(): Promise<void> {
    const canvasEntropy = this.getEntropy(await this.getCanvasFingerprint());
    const webGLEntropy = this.getEntropy(await this.getWebGLFingerprint());
    const audioEntropy = this.getEntropy(await this.getAudioFingerprint());
    const fontEntropy = this.getEntropy(await this.hashData(this.getFontList().join(',')));

    const totalEntropy = canvasEntropy + webGLEntropy + audioEntropy + fontEntropy;

    this.weights = {
      canvas: canvasEntropy / totalEntropy,
      webGL: webGLEntropy / totalEntropy,
      audio: audioEntropy / totalEntropy,
      fonts: fontEntropy / totalEntropy
    };
  }

  // Method to get current weights
  public getWeights(): typeof this.weights {
    return { ...this.weights };
  }

  // Method to set custom weights
  public setWeights(newWeights: Partial<typeof this.weights>): void {
    this.weights = { ...this.weights, ...newWeights };
    // Normalize weights to ensure they sum to 1
    const sum = Object.values(this.weights).reduce((a, b) => a + b, 0);
    for (const key in this.weights) {
      this.weights[key as keyof typeof this.weights] /= sum;
    }
  }

  private async hashData(data: string): Promise<string> {
    return await createHash(data)
  }
}

// Usage example
const fingerprintSDK = new FingerprintSDK();

fingerprintSDK.generateVisitorId().then(visitorId => {
  console.log('Visitor ID:', visitorId);
  console.log('Current Weights:', fingerprintSDK.getWeights());

  // Adjust weights based on entropy
  fingerprintSDK.adjustWeights();
  console.log('Adjusted Weights:', fingerprintSDK.getWeights());

  // Set custom weights
  fingerprintSDK.setWeights({ canvas: 0.4, webGL: 0.3, audio: 0.2, fonts: 0.1 });
  console.log('Custom Weights:', fingerprintSDK.getWeights());

  // Generate a new visitorId with custom weights
  fingerprintSDK.generateVisitorId().then(newVisitorId => {
    console.log('New Visitor ID:', newVisitorId);
  });
});
