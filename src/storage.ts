import { EMPTY_DRAFT, OPTIONAL_KEYS, parseConfig, type Draft, type CameraConfig } from './camera';
const KEY = 'camera-studio-draft-v1';
export async function loadDraft(): Promise<Draft | null> {
  const raw = window.desktop ? await window.desktop.readDraft() : localStorage.getItem(KEY);
  if (!raw) return null;
  const saved = JSON.parse(raw);
  if (saved.version !== 1 || typeof saved.draft !== 'object' || !saved.draft) throw new Error('草稿版本不受支持');
  const d: Draft = { ...EMPTY_DRAFT, automatic: {} };
  for (const key of Object.keys(EMPTY_DRAFT)) {
    if (key === 'automatic') continue;
    if (typeof saved.draft[key] !== 'string' || saved.draft[key].length > 100) throw new Error('草稿损坏');
    (d as unknown as Record<string, unknown>)[key] = saved.draft[key];
  }
  if (!['graphite', 'forest', 'titanium'].includes(d.bodyColor) || !['silver', 'gold'].includes(d.inscription) || !['leather', 'rubber'].includes(d.material)) throw new Error('草稿外观配置无效');
  for (const key of OPTIONAL_KEYS) if (saved.draft.automatic?.[key] === true) d.automatic[key] = true;
  return d;
}
export async function saveDraft(draft: Draft) {
  const text = JSON.stringify({ version: 1, draft });
  if (window.desktop) await window.desktop.writeDraft(text); else localStorage.setItem(KEY, text);
}
export async function saveConfig(config: CameraConfig) {
  const text = JSON.stringify(config, null, 2); const name = `${config.brand}-${config.model}`;
  if (window.desktop) return window.desktop.saveConfig(text, name);
  download(new Blob([text], { type: 'application/json' }), name + '.camera.json'); return true;
}
export async function openConfig(): Promise<CameraConfig | null> {
  if (window.desktop) { const text = await window.desktop.openConfig(); return text === null ? null : parseConfig(text); }
  return new Promise((resolve, reject) => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
    input.oncancel = () => resolve(null);
    input.onchange = async () => { try { const file = input.files?.[0]; resolve(file ? parseConfig(await file.text()) : null); } catch (e) { reject(e); } }; input.click();
  });
}
export async function savePhoto(data: string, name: string) {
  if (window.desktop) return window.desktop.savePhoto(data, name);
  const blob = await (await fetch(data)).blob(); download(blob, name + '.png'); return true;
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name.replace(/[<>:"/\\|?*]/g, '_'); a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
