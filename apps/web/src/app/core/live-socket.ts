/* THE LIVE EAR (Stage 2, 25 Oct 2026). The app is TOLD when something changes, it never asks on a timer. Supabase Realtime
   broadcast on the client's topic, the Phoenix protocol by hand so the app carries no library for it. The nudge carries the
   kind and the id only; the app reads the row itself through the signed in server. */

export type LiveKind = 'msg' | 'task' | 'post';

export interface LiveConfig {
  url: string;
  key: string;
  topic: string;
}

export type LiveState = 'off' | 'connecting' | 'live';

export class LiveSocket {
  private readonly cfg: LiveConfig;
  private readonly onChange: (kind: LiveKind, id: string) => void;
  private readonly onBack: () => void;
  private socket: WebSocket | null = null;
  private currentState: LiveState = 'off';
  private refCounter = 0;
  private joinRef = '';
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private stopped = false;
  private joinedOnce = false;

  constructor(cfg: LiveConfig, onChange: (kind: LiveKind, id: string) => void, onBack: () => void) {
    this.cfg = cfg;
    this.onChange = onChange;
    this.onBack = onBack;
  }

  start(): void {
    if (this.currentState === 'connecting' || this.currentState === 'live') {
      return;
    }
    this.stopped = false;
    this.open();
  }

  stop(): void {
    this.stopped = true;
    this.clearHeartbeat();
    this.clearReconnect();
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.close();
      this.socket = null;
    }
    this.currentState = 'off';
    document.removeEventListener('visibilitychange', this.handleVisibility);
    window.removeEventListener('online', this.handleOnline);
  }

  state(): LiveState {
    return this.currentState;
  }

  private open(): void {
    this.currentState = 'connecting';
    const address = this.cfg.url.replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(this.cfg.key) + '&vsn=1.0.0';
    this.socket = new WebSocket(address);
    this.socket.onopen = () => this.handleOpen();
    this.socket.onmessage = (event) => this.handleMessage(event.data);
    this.socket.onclose = () => this.handleClose();
    /* an error is always followed by a close, so only the close reconnects (else the wait doubles twice) */
    this.socket.onerror = () => undefined;
    document.addEventListener('visibilitychange', this.handleVisibility);
    window.addEventListener('online', this.handleOnline);
  }

  private handleOpen(): void {
    this.refCounter += 1;
    const ref = String(this.refCounter);
    this.joinRef = ref;
    const join = {
      topic: 'realtime:' + this.cfg.topic,
      event: 'phx_join',
      payload: {
        config: {
          broadcast: { ack: false, self: false },
          presence: { key: '' },
          private: false
        }
      },
      ref,
      join_ref: ref
    };
    this.socket?.send(JSON.stringify(join));
    this.startHeartbeat();
  }

  private handleMessage(data: unknown): void {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(String(data)) as Record<string, unknown>;
    } catch {
      return;
    }

    const event = message['event'];
    if (event === 'phx_reply') {
      const ref = message['ref'];
      const payload = message['payload'] as Record<string, unknown> | undefined;
      if (ref === this.joinRef && payload && payload['status'] === 'ok') {
        this.currentState = 'live';
        this.reconnectDelay = 1000;
        /* every join, the first too: a write that landed after the app read its book but before this ear was open is
           heard by this one read, so nothing falls in the gap (found by the two person run, 25 Oct 2026) */
        this.joinedOnce = true;
        this.onBack();
      }
      return;
    }

    if (event === 'broadcast') {
      const payload = message['payload'] as Record<string, unknown> | undefined;
      if (payload && payload['event'] === 'change') {
        const inner = payload['payload'] as Record<string, unknown> | undefined;
        if (inner) {
          const kind = inner['kind'];
          const id = inner['id'];
          if ((kind === 'msg' || kind === 'task' || kind === 'post') && typeof id === 'string' && id.length >= 1 && id.length <= 64) {
            this.onChange(kind, id);
          }
        }
      }
    }
  }

  private handleClose(): void {
    this.currentState = 'off';
    this.clearHeartbeat();
    if (this.stopped) {
      return;
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    this.clearReconnect();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  private startHeartbeat(): void {
    this.clearHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.refCounter += 1;
        const heartbeat = {
          topic: 'phoenix',
          event: 'heartbeat',
          payload: {},
          ref: String(this.refCounter)
        };
        this.socket.send(JSON.stringify(heartbeat));
      }
    }, 25000);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private handleVisibility = (): void => {
    if (document.visibilityState === 'visible' && this.currentState === 'off' && !this.stopped) {
      this.clearReconnect();
      this.open();
    }
  };

  private handleOnline = (): void => {
    if (this.currentState === 'off' && !this.stopped) {
      this.clearReconnect();
      this.open();
    }
  };
}
