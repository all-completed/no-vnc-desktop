const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const net = require('net');
const { createWwwServer } = require('./www-server.cjs');

/** @type {{ server: import('http').Server; url: string } | null} */
let wwwBundle = null;

/** @type {import('net').Socket | null} */
let tcpSocket = null;
/** @type {import('net').Socket | null} */
let pendingSocket = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    win.loadURL(devUrl);
  } else if (wwwBundle) {
    win.loadURL(wwwBundle.url);
  } else {
    win.loadFile(path.join(__dirname, '..', 'www', 'index.html'));
  }
}

function closeTcp() {
  if (pendingSocket) {
    try {
      pendingSocket.destroy();
    } catch {
      /* */
    }
    pendingSocket = null;
  }
  if (tcpSocket) {
    try {
      tcpSocket.destroy();
    } catch {
      /* */
    }
    tcpSocket = null;
  }
}

app.whenReady().then(async () => {
  if (!process.env.VITE_DEV_SERVER_URL) {
    const wwwRoot = path.join(__dirname, '..', 'www');
    try {
      wwwBundle = await createWwwServer(wwwRoot);
    } catch (e) {
      console.error('www-server failed', e);
    }
  }

  ipcMain.handle('tcp-open', async (event, { host, port }) => {
    closeTcp();
    const sender = event.sender;
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port });
      pendingSocket = socket;
      socket.setNoDelay(true);

      socket.once('connect', () => {
        pendingSocket = null;
        tcpSocket = socket;

        socket.on('data', (chunk) => {
          const copy = Buffer.from(chunk);
          sender.send('tcp-data', copy);
        });

        socket.on('error', (err) => {
          sender.send('tcp-error', err instanceof Error ? err.message : String(err));
        });

        socket.on('close', () => {
          sender.send('tcp-closed');
          if (tcpSocket === socket) {
            tcpSocket = null;
          }
        });

        resolve({ ok: true });
      });

      socket.once('error', (err) => {
        if (pendingSocket === socket) {
          pendingSocket = null;
        }
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });
  });

  ipcMain.handle('tcp-close', async () => {
    closeTcp();
    return { ok: true };
  });

  ipcMain.on('tcp-send', (_event, payload) => {
    if (!tcpSocket || tcpSocket.destroyed) {
      return;
    }
    let buf;
    if (payload instanceof Uint8Array) {
      buf = Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength);
    } else if (payload instanceof ArrayBuffer) {
      buf = Buffer.from(payload);
    } else if (Buffer.isBuffer(payload)) {
      buf = payload;
    } else {
      return;
    }
    try {
      tcpSocket.write(buf);
    } catch {
      /* */
    }
  });

  createWindow();

  app.on('before-quit', () => {
    if (wwwBundle?.server) {
      try {
        wwwBundle.server.close();
      } catch {
        /* */
      }
      wwwBundle = null;
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  closeTcp();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
