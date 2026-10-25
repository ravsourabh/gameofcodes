export type ConnectionState = 'connecting' | 'ready' | 'offline' | 'error';
type PreviewEvents = {
  frame: (image: ImageBitmap) => void;
  status: (state: ConnectionState, message: string) => void;
  latency: (milliseconds: number) => void;
  focus: (focused: boolean) => void;
  exported: (data: unknown) => void;
};

export class PreviewConnection {
  private socket?: WebSocket;
  private retry?: number;
  private watchdog: number;
  private lastFrame = 0;
  private lastInput = 0;
  private decoding = false;
  private disposed = false;
  private attempts = 0;
  private offline = false;
  state: ConnectionState = 'connecting';
  private handleOffline = () => {
    clearTimeout(this.retry);
    this.socket?.close();
    this.events.focus(false);
    this.setStatus('offline', 'Connection lost · your saved tasks are preserved');
  };
  private handleOnline = () => this.connect();

  constructor(readonly project: string, private events: PreviewEvents) {
    window.addEventListener('offline', this.handleOffline);
    window.addEventListener('online', this.handleOnline);
    this.connect();
    this.watchdog = window.setInterval(() => {
      if (this.state === 'connecting' && performance.now() - this.lastFrame > 15000) {
        this.setStatus('error', 'No preview frames arrived. Reconnecting to your application…');this.socket?.close();
      }
      if (this.state === 'ready' && performance.now() - this.lastFrame > 30_000) {
        this.offline = true;
        this.setStatus('offline', 'Preview paused · reconnecting');
        this.socket?.close();
      }
    }, 1000);
  }

  private setStatus(state: ConnectionState, message: string) {
    this.state = state;
    this.events.status(state, message);
  }

  connect() {
    if (this.disposed) return;
    if (!navigator.onLine) { this.handleOffline(); return; }
    clearTimeout(this.retry);
    this.socket?.close();
    this.setStatus('connecting', this.attempts ? 'Reconnecting to your application…' : 'Opening your application…');
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${location.host}/preview?project=${this.project}`);
    this.socket = ws; this.lastFrame = performance.now();
    ws.binaryType = 'blob';
    ws.onmessage = async event => {
      if (ws !== this.socket || this.disposed || ws.readyState !== WebSocket.OPEN || !navigator.onLine) return;
      if (event.data instanceof Blob) {
        if (this.decoding) return;
        this.decoding = true;
        try {
          const bitmap = await createImageBitmap(event.data, { imageOrientation: 'flipY' });
          if (ws !== this.socket || this.disposed || ws.readyState !== WebSocket.OPEN || !navigator.onLine) { bitmap.close(); return; }
          this.lastFrame = performance.now();
          if (this.offline || this.state !== 'ready') {
            this.offline = false;
            this.setStatus('ready', 'Live browser · saved to your project');
          }
          this.attempts = 0;
          this.events.frame(bitmap);
        } catch { this.setStatus('error', 'Could not display the browser preview. Try reconnecting.'); }
        finally { this.decoding = false; }
        return;
      }
      let message;try{message=JSON.parse(event.data);}catch{this.setStatus('error','The preview sent an invalid response. Try reconnecting.');return;}
      if (message.type === 'status') {
        this.lastFrame = performance.now();
        this.setStatus(message.status === 'ready' ? 'connecting' : message.status, message.message);
      }
      if (message.type === 'error') this.setStatus('error', message.message);
      if (message.type === 'input') {
        this.events.focus(message.textFocused);
        if (this.lastInput) this.events.latency(Math.round(performance.now() - this.lastInput));
      }
      if (message.type === 'export') this.events.exported(message.data);
    };
    ws.onclose = () => {
      if (ws !== this.socket || this.disposed) return;
      this.events.focus(false);
      if (this.state !== 'error') this.setStatus('offline', 'Connection lost · your saved tasks are preserved');
      this.attempts++;
      if (navigator.onLine) this.retry = window.setTimeout(() => this.connect(), Math.min(10_000, 1000 * this.attempts));
    };
    ws.onerror = () => { /* onclose owns reconnect and user-visible status. */ };
  }

  send(input: Record<string, unknown>) {
    if (this.socket?.readyState !== WebSocket.OPEN || this.state !== 'ready') return false;
    this.lastInput = performance.now();
    this.socket.send(JSON.stringify(input));
    return true;
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.retry);
    clearInterval(this.watchdog);
    window.removeEventListener('offline', this.handleOffline);
    window.removeEventListener('online', this.handleOnline);
    this.socket?.close();
  }
}
