const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('novncElectron', {
  tcpOpen: (host, port) => ipcRenderer.invoke('tcp-open', { host, port }),

  tcpSend: (u8) => {
    ipcRenderer.send('tcp-send', u8);
  },

  tcpClose: () => ipcRenderer.invoke('tcp-close'),

  onTcpData: (cb) => {
    const fn = (_e, /** @type {Buffer} */ buf) => {
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      cb(ab);
    };
    ipcRenderer.on('tcp-data', fn);
    return () => ipcRenderer.removeListener('tcp-data', fn);
  },

  onTcpClosed: (cb) => {
    const fn = () => cb();
    ipcRenderer.on('tcp-closed', fn);
    return () => ipcRenderer.removeListener('tcp-closed', fn);
  },

  onTcpError: (cb) => {
    const fn = (_e, msg) => cb(String(msg));
    ipcRenderer.on('tcp-error', fn);
    return () => ipcRenderer.removeListener('tcp-error', fn);
  },
});
