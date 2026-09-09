const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { autoUpdater } = require('electron-updater');

let win;
app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 1200, height: 950, minWidth: 900, title: 'Crown Design Invoices',
    icon: path.join(__dirname, 'invoice.ico'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile('Invoice Maker.html');
  if (app.isPackaged) {   // pull new releases from GitHub; the update installs itself the next time he closes the app. App data lives in userData and is untouched.
    const check = () => autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    check(); setInterval(check, 4 * 60 * 60 * 1000);
  }
  if (process.env.SMOKE) win.webContents.once('did-finish-load', smoke);
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

function findThunderbird() {
  const candidates = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA].filter(Boolean)
    .map(d => path.join(d, 'Mozilla Thunderbird', 'thunderbird.exe'));
  candidates.push('/Applications/Thunderbird.app/Contents/MacOS/thunderbird');
  return candidates.find(p => fs.existsSync(p));
}

function email({ to = '', subject = '', body = '', pdf }) {
  const tb = findThunderbird();
  if (!tb) {   // no Thunderbird: fall back to the default mail program, which cannot take the attachment
    shell.openExternal(`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    return false;
  }
  const q = s => `'${String(s).replace(/'/g, '’').replace(/"/g, '”')}'`;   // -compose quotes values with ' and has no escape for it
  const compose = `to=${q(to)},subject=${q(subject)},body=${q(body)}` + (pdf ? `,attachment=${q(pdf)}` : '');
  spawn(tb, ['-compose', compose], { detached: true, stdio: 'ignore' }).unref();
  return true;
}

function backup(name, json) {
  const file = path.join(backupDir(), safe(name));
  fs.writeFileSync(file, json);
  return file;
}

ipcMain.handle('savePdf', (e, name) => savePdf(name));
ipcMain.handle('email', (e, opts) => email(opts));
ipcMain.handle('backup', (e, name, json) => backup(name, json));
ipcMain.handle('openBackups', () => shell.openPath(backupDir()));

async function smoke() {   // SMOKE=1 npm start : exercise the file paths without clicking, then quit
  console.log('pdf    ', await savePdf('Smoke test'));
  console.log('backup ', backup('invoices-auto-smoke.json', '{"settings":{},"invoices":[]}'));
  console.log('tb     ', findThunderbird() || '(not installed)');
  app.quit();
}
