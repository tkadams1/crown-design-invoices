// The only bridge between the page and the operating system. Everything the page can ask for is listed here.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  savePdf: name => ipcRenderer.invoke('savePdf', name),                 // -> full path of the PDF in Documents\Invoices
  email: opts => ipcRenderer.invoke('email', opts),                      // { to, subject, body, pdf } -> true if Thunderbird opened
  backup: (name, json) => ipcRenderer.invoke('backup', name, json),      // -> full path of the backup file
  openBackups: () => ipcRenderer.invoke('openBackups'),
  loadData: () => ipcRenderer.invoke('loadData'),                        // -> { settings, invoices } or null
  saveData: json => ipcRenderer.invoke('saveData', json),                // whole data set as JSON text
  printers: () => ipcRenderer.invoke('printers'),                        // -> [{ name, isDefault, virtual }]
  print: choice => ipcRenderer.invoke('print', choice),                  // 'auto' | 'ask' | printer name
  version: () => ipcRenderer.invoke('version'),
  checkForUpdates: () => ipcRenderer.invoke('checkForUpdates'),
  installUpdate: () => ipcRenderer.invoke('installUpdate'),
  onUpdate: cb => ipcRenderer.on('update', (e, info) => cb(info)),   // { state: checking|available|downloading|ready|none|error|dev, version?, percent?, message? }
});
