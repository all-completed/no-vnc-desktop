export {};

declare global {
  interface Window {
    novncElectron?: {
      tcpOpen(host: string, port: number): Promise<{ ok: boolean }>;
      tcpSend(data: Uint8Array): void;
      tcpClose(): Promise<{ ok: boolean }>;
      onTcpData(cb: (data: ArrayBuffer) => void): () => void;
      onTcpClosed(cb: () => void): () => void;
      onTcpError(cb: (msg: string) => void): () => void;
    };
  }
}
