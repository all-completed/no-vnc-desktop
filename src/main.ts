import RFB from '@novnc/novnc/lib/rfb.js';
import { TcpSocketWebSocketShim } from './tcp-shim.js';

const $ = (id: string) => document.getElementById(id)!;

const addressEl = $('address') as HTMLInputElement;
const btnConnect = $('btn-connect') as HTMLButtonElement;
const btnPaste = $('btn-paste') as HTMLButtonElement;
const statusEl = $('status');
const screenEl = $('screen');

let rfb: InstanceType<typeof RFB> | null = null;

type StatusKind = 'default' | 'connecting' | 'connected' | 'error';

function setStatus(msg: string, kind: StatusKind = 'default'): void {
  statusEl.textContent = msg;
  statusEl.classList.remove('status-connecting', 'status-connected', 'status-error');
  if (kind === 'connecting') statusEl.classList.add('status-connecting');
  else if (kind === 'connected') statusEl.classList.add('status-connected');
  else if (kind === 'error') statusEl.classList.add('status-error');
}

function updateConnectionButtons(connected: boolean): void {
  btnConnect.disabled = false;
  btnConnect.textContent = connected ? 'Disconnect' : 'Connect';
  btnConnect.classList.toggle('primary', !connected);
}

/** Infer transport from a single address line: vnc://, ws(s)://, or bare host → wss:// */
function transportFromAddress(raw: string):
  | { ok: true; transport: string | TcpSocketWebSocketShim }
  | { ok: false; message: string } {
  const t = raw.trim();
  if (!t) return { ok: false, message: 'Enter an address' };

  if (/^vnc:/i.test(t)) {
    let u: URL;
    try {
      u = new URL(t);
    } catch {
      return { ok: false, message: 'Invalid vnc:// URL' };
    }
    if (u.protocol !== 'vnc:') {
      return { ok: false, message: 'Expected vnc://' };
    }
    const host = u.hostname;
    if (!host) {
      return { ok: false, message: 'Missing host in vnc:// URL' };
    }
    const port = u.port ? Number.parseInt(u.port, 10) : 5900;
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      return { ok: false, message: 'Invalid port in vnc:// URL' };
    }
    if (!window.novncElectron) {
      return { ok: false, message: 'vnc:// requires the Electron desktop app.' };
    }
    return { ok: true, transport: new TcpSocketWebSocketShim(host, port) };
  }

  if (/^wss?:\/\//i.test(t)) {
    try {
      void new URL(t);
    } catch {
      return { ok: false, message: 'Invalid ws(s):// URL' };
    }
    return { ok: true, transport: t };
  }

  const rest = t.replace(/^\/+/, '');
  return { ok: true, transport: `wss://${rest}` };
}

function sendTextAsRemoteKeys(text: string): void {
  if (!rfb || !text) return;

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  rfb.focus({ preventScroll: true });

  for (const ch of normalized) {
    switch (ch) {
      case '\n':
        rfb.sendKey(0xff0d, 'Enter');
        break;
      case '\t':
        rfb.sendKey(0xff09, 'Tab');
        break;
      case '\b':
        rfb.sendKey(0xff08, 'Backspace');
        break;
      case '\u001b':
        rfb.sendKey(0xff1b, 'Escape');
        break;
      default:
        rfb.sendKey(ch.codePointAt(0), undefined);
        break;
    }
  }
}

async function copyToDeviceClipboard(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    }
  } catch {
    /* ignore */
  }
}

async function pasteFromDeviceClipboard(): Promise<void> {
  if (!rfb) return;
  try {
    let text = '';
    if (navigator.clipboard?.readText) {
      text = await navigator.clipboard.readText();
    }
    if (text) {
      rfb.clipboardPasteFrom(text);
      sendTextAsRemoteKeys(text);
      setStatus('Pasted to remote');
    }
  } catch (e) {
    setStatus('Paste failed (permission?)', 'error');
    console.warn(e);
  }
}

function disconnect(): void {
  if (rfb) {
    try {
      rfb.disconnect();
    } catch {
      /* */
    }
    rfb = null;
  }
  updateConnectionButtons(false);
}

function connect(): void {
  disconnect();
  const parsed = transportFromAddress(addressEl.value);
  if (!parsed.ok) {
    setStatus(parsed.message, 'error');
    return;
  }
  const transport = parsed.transport;

  updateConnectionButtons(true);
  setStatus('Connecting', 'connecting');

  let inst: InstanceType<typeof RFB>;
  try {
    inst = new RFB(screenEl, transport, {
      shared: true,
    });
  } catch (err) {
    console.error(err);
    setStatus('Error', 'error');
    updateConnectionButtons(false);
    return;
  }

  inst.scaleViewport = true;

  rfb = inst;

  inst.addEventListener('connect', () => {
    setStatus('Connected', 'connected');
  });

  inst.addEventListener('disconnect', (ev: Event) => {
    const detail = (ev as CustomEvent<{ clean: boolean }>).detail;
    if (detail?.clean) {
      setStatus('Disconnected');
    } else {
      setStatus('Error', 'error');
    }
    rfb = null;
    updateConnectionButtons(false);
  });

  inst.addEventListener('securityfailure', (ev: Event) => {
    const ce = ev as CustomEvent<{ status?: number; reason?: string }>;
    const reason = ce.detail?.reason?.trim();
    setStatus('Error', 'error');
    if (reason) {
      console.warn('VNC security failure:', reason);
    }
  });

  inst.addEventListener('credentialsrequired', () => {
    const pw = window.prompt('VNC password');
    if (pw !== null && rfb) {
      rfb.sendCredentials({ password: pw });
    }
  });

  inst.addEventListener('clipboard', (ev: Event) => {
    const ce = ev as CustomEvent<{ text: string }>;
    const text = ce.detail?.text ?? '';
    if (text) {
      void copyToDeviceClipboard(text);
    }
  });
}

btnConnect.addEventListener('click', () => {
  if (rfb) {
    disconnect();
    setStatus('Idle');
    return;
  }
  connect();
});
btnPaste.addEventListener('click', () => {
  void pasteFromDeviceClipboard();
});

document.addEventListener(
  'paste',
  (e: ClipboardEvent) => {
    if (!rfb) return;
    const text = e.clipboardData?.getData('text/plain');
    if (text) {
      e.preventDefault();
      rfb.clipboardPasteFrom(text);
      sendTextAsRemoteKeys(text);
    }
  },
  true,
);

updateConnectionButtons(false);

const LS_ADDRESS = 'novnc-desktop-address';

function loadSavedAddress(): void {
  let addr = localStorage.getItem(LS_ADDRESS);
  if (!addr) {
    addr = localStorage.getItem('novnc-desctop-address');
  }
  if (!addr) {
    addr = localStorage.getItem('novnc-wrap-address');
  }
  if (!addr) {
    const oldWs = localStorage.getItem('novnc-wrap-ws-url');
    const oldSchema = localStorage.getItem('novnc-wrap-schema');
    const oldHost = localStorage.getItem('novnc-wrap-tcp-host');
    const oldPort = localStorage.getItem('novnc-wrap-tcp-port');
    if (oldWs) {
      addr = oldWs;
    } else if (oldSchema === 'vnc' && oldHost) {
      const p = oldPort && oldPort.trim() !== '' ? oldPort : '5900';
      addr = `vnc://${oldHost}:${p}`;
    }
  }
  if (addr) addressEl.value = addr;
}

loadSavedAddress();

addressEl.addEventListener('change', () => {
  localStorage.setItem(LS_ADDRESS, addressEl.value);
});
