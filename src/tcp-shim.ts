/**
 * WebSocket-shaped transport for noVNC's Websock.attach().
 * In Electron, raw TCP is handled in the main process (see electron/main.cjs).
 */
export class TcpSocketWebSocketShim {
  binaryType: BinaryType = 'arraybuffer';
  protocol = '';
  /** WebSocket.CONNECTING | OPEN | CLOSING | CLOSED */
  readyState: number = WebSocket.CONNECTING;

  onopen: ((this: WebSocket, ev: Event) => unknown) | null = null;
  onmessage: ((this: WebSocket, ev: MessageEvent) => unknown) | null = null;
  onerror: ((this: WebSocket, ev: Event) => unknown) | null = null;
  onclose: ((this: WebSocket, ev: CloseEvent) => unknown) | null = null;

  private closedNotified = false;
  /** IPC listener teardown (only after tcp-open succeeds) */
  private cleanupIpc?: () => void;

  constructor(host: string, port: number) {
    const api = window.novncElectron;
    if (!api) {
      this.readyState = WebSocket.CLOSED;
      queueMicrotask(() => {
        const ev = new ErrorEvent('error', {
          error: new Error('TCP requires the Electron desktop app'),
        });
        this.onerror?.call(this as unknown as WebSocket, ev);
        this.notifyClose();
      });
      return;
    }

    void this.runConnect(api, host, port);
  }

  private notifyClose(): void {
    if (this.closedNotified) return;
    this.closedNotified = true;
    this.readyState = WebSocket.CLOSED;
    const ev = new CloseEvent('close');
    this.onclose?.call(this as unknown as WebSocket, ev);
  }

  private async runConnect(
    api: NonNullable<Window['novncElectron']>,
    host: string,
    port: number,
  ): Promise<void> {
    const unreg: Array<() => void> = [];
    try {
      unreg.push(
        api.onTcpData((ab) => {
          const ev = new MessageEvent('message', { data: ab });
          this.onmessage?.call(this as unknown as WebSocket, ev);
        }),
      );
      unreg.push(
        api.onTcpClosed(() => {
          this.notifyClose();
        }),
      );
      unreg.push(
        api.onTcpError((msg) => {
          this.readyState = WebSocket.CLOSED;
          const ev = new ErrorEvent('error', { error: new Error(msg) });
          this.onerror?.call(this as unknown as WebSocket, ev);
          this.notifyClose();
        }),
      );

      await api.tcpOpen(host, port);
      this.cleanupIpc = () => {
        for (const u of unreg) {
          try {
            u();
          } catch {
            /* */
          }
        }
      };
      this.readyState = WebSocket.OPEN;
      const ev = new Event('open');
      this.onopen?.call(this as unknown as WebSocket, ev);
    } catch (e) {
      for (const u of unreg) {
        try {
          u();
        } catch {
          /* */
        }
      }
      this.readyState = WebSocket.CLOSED;
      const ev = new ErrorEvent('error', { error: e });
      this.onerror?.call(this as unknown as WebSocket, ev);
      this.notifyClose();
    }
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    if (this.readyState !== WebSocket.OPEN || !window.novncElectron) {
      return;
    }
    let bytes: Uint8Array;
    if (typeof data === 'string') {
      bytes = new TextEncoder().encode(data);
    } else if (data instanceof Blob) {
      void data.arrayBuffer().then((ab) => {
        this.send(ab);
      });
      return;
    } else if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data);
    } else {
      const v = data as ArrayBufferView;
      bytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    }
    window.novncElectron.tcpSend(bytes);
  }

  close(): void {
    if (this.readyState === WebSocket.CLOSING || this.readyState === WebSocket.CLOSED) {
      return;
    }
    this.readyState = WebSocket.CLOSING;
    this.cleanupIpc?.();
    this.cleanupIpc = undefined;
    void window.novncElectron?.tcpClose().finally(() => {
      this.notifyClose();
    });
  }
}
