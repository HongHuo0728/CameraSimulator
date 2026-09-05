const { app, BrowserWindow, ipcMain, dialog, protocol, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const isDev = process.argv.includes('--dev');
protocol.registerSchemesAsPrivileged([{ scheme: 'camera', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
let win;
let allowClose=false,closing=false;
let draftQueue = Promise.resolve();
function assertSender(event) {
  const url = event.senderFrame?.url || '';
  if (!(url.startsWith('camera://app/') || (isDev && url.startsWith('http://127.0.0.1:5173/')))) throw new Error('Invalid sender');
}
async function atomicWrite(file, text) {
  const temp = file + '.tmp'; await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(temp, text, 'utf8'); await fs.rename(temp, file);
}
app.whenReady().then(() => {
  const root = path.join(app.getAppPath(), 'dist', 'client');
  protocol.handle('camera', request => {
    const url = new URL(request.url);
    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const resolved = path.resolve(root, '.' + relative);
    if (url.hostname !== 'app' || !resolved.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(resolved).toString());
  });
  win = new BrowserWindow({ width: 1487, height: 1058, minWidth: 1100, minHeight: 720, backgroundColor: '#0b211b', frame: false,
    show: false, title: 'CameraSimulator', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false } });
  win.once('ready-to-show', () => win.show());
  win.on('close',event=>{if(allowClose||win.webContents.isCrashed())return;event.preventDefault();if(!closing){closing=true;win.webContents.send('window:prepare-close');}});
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, target) => { if (!(isDev ? target.startsWith('http://127.0.0.1:5173/') : target.startsWith('camera://app/'))) event.preventDefault(); });
  win.loadURL(isDev ? 'http://127.0.0.1:5173/' : 'camera://app/');
  ipcMain.handle('window:action', (event, action) => { assertSender(event); if (action === 'minimize') win.minimize(); if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize(); if (action === 'close') win.close(); });
  ipcMain.handle('window:finish-close', (event,saved) => {assertSender(event);closing=false;if(saved===true){allowClose=true;win.close();}});
  ipcMain.handle('config:open', async event => {
    assertSender(event); const result = await dialog.showOpenDialog(win, { title: '打开相机配置', filters: [{ name: '相机配置', extensions: ['json'] }], properties: ['openFile'] });
    if (result.canceled) return null;
    const stat = await fs.stat(result.filePaths[0]); if (stat.size > 1000000) throw new Error('配置文件过大');
    return fs.readFile(result.filePaths[0], 'utf8');
  });
  ipcMain.handle('config:save', async (event, { text, name }) => {
    assertSender(event); if (typeof text !== 'string' || text.length > 1000000) throw new Error('无效配置'); JSON.parse(text);
    const safe = String(name || 'Camera').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 100);
    const result = await dialog.showSaveDialog(win, { title: '保存相机配置', defaultPath: path.join(app.getPath('documents'),safe + '.camera.json'), filters: [{ name: '相机配置', extensions: ['json'] }] });
    if (result.canceled || !result.filePath) return false; await atomicWrite(result.filePath, text); return true;
  });
  ipcMain.handle('draft:read', async event => { assertSender(event); try { return await fs.readFile(path.join(app.getPath('userData'), 'draft.json'), 'utf8'); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } });
  ipcMain.handle('draft:write', (event, text) => {
    assertSender(event); if (typeof text !== 'string' || text.length > 1000000) throw new Error('无效草稿'); JSON.parse(text);
    draftQueue = draftQueue.catch(() => {}).then(() => atomicWrite(path.join(app.getPath('userData'), 'draft.json'), text)); return draftQueue;
  });
  ipcMain.handle('photo:save', async (event, { data, name }) => {
    assertSender(event); if (typeof data !== 'string' || data.length > 50000000 || !data.startsWith('data:image/png;base64,')) throw new Error('无效照片');
    const safe = String(name || 'CameraSimulator').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 100);
    const result = await dialog.showSaveDialog(win, { title: '保存模拟照片', defaultPath: path.join(app.getPath('pictures'),safe + '.png'), filters: [{ name: 'PNG 照片', extensions: ['png'] }] });
    if (result.canceled || !result.filePath) return false; await fs.writeFile(result.filePath, Buffer.from(data.split(',')[1], 'base64')); return true;
  });
});
app.on('window-all-closed', () => app.quit());

