Write the COMPLETE contents of one new file: apps/web/src/app/core/live-socket.ts. Output ONLY one ```ts code block.

THE APP: The Hub, Angular 19, TypeScript strict. This file is a plain TypeScript class, NO Angular decorator, no import at all,
no library: the browser's own WebSocket only.

WHAT IT IS: the app's ear for live updates. The server sends a Supabase Realtime BROADCAST on the client's topic after every
write; this class listens and calls onChange(kind, id). It NEVER asks the server on a timer. When the connection comes back
after a drop it calls onBack() once, so the app can read once to catch up.

EXPORTS, exactly:
export type LiveKind = 'msg' | 'task' | 'post';
export interface LiveConfig { url: string; key: string; topic: string; }
export type LiveState = 'off' | 'connecting' | 'live';
export class LiveSocket {
  constructor(cfg: LiveConfig, onChange: (kind: LiveKind, id: string) => void, onBack: () => void)
  start(): void    // opens the connection; calling it again while connecting or live does nothing
  stop(): void     // closes for good: no reconnect, timers cleared, window and document listeners removed
  state(): LiveState
}

THE PROTOCOL (Phoenix channels, exactly this, proven against BB's database on 25 Oct 2026):
- Address: cfg.url with its leading 'http' replaced by 'ws' (so https becomes wss) + '/realtime/v1/websocket?apikey=' +
  encodeURIComponent(cfg.key) + '&vsn=1.0.0'.
- Every message sent is JSON.stringify of { topic, event, payload, ref } (and join_ref on the join). ref is a counter as a
  string ('1', '2', ...), one counter for the socket.
- On open, send the join: { topic: 'realtime:' + cfg.topic, event: 'phx_join', payload: { config: { broadcast: { ack: false,
  self: false }, presence: { key: '' }, private: false } }, ref: r, join_ref: r } and remember r as the join ref.
- Every 25000 ms while open send { topic: 'phoenix', event: 'heartbeat', payload: {}, ref }.
- An incoming message is JSON; ignore anything that does not parse.
  - event 'phx_reply' with ref equal to the join ref and payload.status === 'ok': state becomes 'live', the reconnect delay
    resets to 1000 ms. If this is NOT the first successful join since start(), call onBack().
  - event 'broadcast' whose payload.event === 'change': read payload.payload.kind and payload.payload.id; call onChange only
    when kind is 'msg', 'task' or 'post' and id is a string of 1 to 64 characters. Nothing else in the message is used.
- On close or error: state 'off'; clear the heartbeat; unless stop() was called, open again after the reconnect delay, then
  double the delay up to 30000 ms.
- When the page becomes visible again (document 'visibilitychange' and document.visibilityState === 'visible') or the
  browser comes back online (window 'online'): if the state is 'off' and stop() was not called, cancel any waiting
  reconnect and open now.
- No `any`. Use ReturnType<typeof setTimeout> and ReturnType<typeof setInterval> for timer types.

Start the file with this comment, word for word:
/* THE LIVE EAR (Stage 2, 25 Oct 2026). The app is TOLD when something changes, it never asks on a timer. Supabase Realtime
   broadcast on the client's topic, the Phoenix protocol by hand so the app carries no library for it. The nudge carries the
   kind and the id only; the app reads the row itself through the signed in server. */
