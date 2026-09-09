const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawn, execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { autoUpdater } = require('electron-updater');

let win;
app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 1200, height: 950, minWidth: 900, title: 'Crown Design Invoices',
    icon: path.join(__dirname, 'invoice.ico'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile('Invoice Maker.html');
  if (process.argv.includes('--smoke')) {
    win.webContents.on('console-message', ev => { if (ev.level === 'error') { console.error(`page error line ${ev.lineNumber}: ${ev.message}`); process.exitCode = 1; } });
    win.webContents.once('did-finish-load', smoke);
  }
});
app.on('window-all-closed', () => app.quit());

const dir = p => { fs.mkdirSync(p, { recursive: true }); return p; };
const pdfDir = () => dir(path.join(app.getPath('documents'), 'Invoices'));
const backupDir = () => dir(path.join(app.getPath('userData'), 'backups'));   // %APPDATA%\Crown Design Invoices\backups on Windows
const safe = s => String(s).replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim() || 'Invoice';

async function savePdf(name) {
  const data = await win.webContents.printToPDF({ printBackground: true, pageSize: 'Letter', preferCSSPageSize: true });
  const file = path.join(pdfDir(), safe(name) + '.pdf');
  fs.writeFileSync(file, data);
  return file;
}

function findThunderbird(custom) {   // admin-panel override first, then the Windows registry, then the usual folders
  const candidates = custom ? [custom] : [];
  if (process.platform === 'win32') {
    for (const key of ['HKLM\\SOFTWARE\\Clients\\Mail\\Mozilla Thunderbird\\shell\\open\\command', 'HKCU\\SOFTWARE\\Clients\\Mail\\Mozilla Thunderbird\\shell\\open\\command',
                        'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\thunderbird.exe', 'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\thunderbird.exe']) {
      try { const m = execFileSync('reg', ['query', key, '/ve'], { encoding: 'utf8', windowsHide: true }).match(/"?([A-Z]:\\[^"\r\n]*?thunderbird\.exe)/i); if (m) candidates.push(m[1]); } catch {}
    }
  }
  for (const d of [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA].filter(Boolean)) candidates.push(path.join(d, 'Mozilla Thunderbird', 'thunderbird.exe'));
  candidates.push('/Applications/Thunderbird.app/Contents/MacOS/thunderbird');
  return candidates.find(p => fs.existsSync(p));
}

function email({ to = '', subject = '', body = '', pdf, mailer }) {
  const tb = findThunderbird(mailer);
  if (!tb) {   // no Thunderbird: fall back to the default mail program, which cannot take the attachment
    shell.openExternal(`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    return false;
  }
  const q = s => `'${String(s).replace(/'/g, '’').replace(/"/g, '”')}'`;   // -compose quotes values with ' and has no escape for it
  const compose = `to=${q(to)},subject=${q(subject)},body=${q(body)}` + (pdf ? `,attachment=${q(pathToFileURL(pdf).href)}` : '');   // file:// URL is the form Thunderbird documents
  spawn(tb, ['-compose', compose], { detached: true, stdio: 'ignore' }).unref();
  return true;
}

function backup(name, json) {
  const file = path.join(backupDir(), safe(name));
  fs.writeFileSync(file, json);
  return file;
}

// Updates: the page decides when to check (its "check automatically" setting); we report progress back to it.
// A downloaded update installs when he closes the app, or at once via installUpdate(). App data in userData is untouched.
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
const report = (state, extra = {}) => win?.webContents.send('update', { state, ...extra });
autoUpdater.on('checking-for-update', () => report('checking'));
autoUpdater.on('update-available', i => report('available', { version: i.version }));
autoUpdater.on('update-not-available', () => report('none'));
autoUpdater.on('download-progress', p => report('downloading', { percent: Math.round(p.percent) }));
autoUpdater.on('update-downloaded', i => report('ready', { version: i.version }));
autoUpdater.on('error', e => report('error', { message: String(e?.message || e) }));
ipcMain.handle('checkForUpdates', () => app.isPackaged ? autoUpdater.checkForUpdates().catch(() => null) : report('dev'));
ipcMain.handle('installUpdate', () => autoUpdater.quitAndInstall());
ipcMain.handle('version', () => app.getVersion());

ipcMain.handle('savePdf', (e, name) => savePdf(name));
ipcMain.handle('email', (e, opts) => email(opts));
ipcMain.handle('backup', (e, name, json) => backup(name, json));
ipcMain.handle('openBackups', () => shell.openPath(backupDir()));

async function smoke() {   // electron . --smoke : load the page, click New Invoice, exercise the file paths, fail on any page error, quit
  const shown = await win.webContents.executeJavaScript(`document.querySelector('#new').click(); !document.querySelector('#editor').hidden`);
  if (!shown) { console.error('New Invoice button did nothing'); process.exitCode = 1; }
  const pdf = await savePdf('Smoke test'); console.log('pdf    ', pdf); fs.rmSync(pdf);
  const bak = backup('invoices-auto-smoke.json', '{}'); console.log('backup ', bak); fs.rmSync(bak);
  console.log('tb     ', findThunderbird() || '(not installed)');
  app.quit();
}
