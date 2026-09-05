export const SCHEMA_VERSION = 1;
export type Section = 'identity' | 'sensor' | 'lens' | 'exposure';
export type RequiredKey = 'brand' | 'model' | 'sensorWidth' | 'sensorHeight' | 'focalLength' | 'apertureMin' | 'apertureMax' | 'isoMin' | 'isoMax' | 'shutterFast' | 'shutterSlow';
export type OptionalKey = 'megapixels' | 'blades' | 'whiteBalance' | 'focusDistance' | 'readNoise' | 'fullWell';
export const OPTIONAL_KEYS: OptionalKey[] = ['megapixels', 'blades', 'whiteBalance', 'focusDistance', 'readNoise', 'fullWell'];
export type Draft = Record<RequiredKey | OptionalKey, string> & {
  bodyColor: 'graphite' | 'forest' | 'titanium';
  inscription: 'silver' | 'gold';
  material: 'leather' | 'rubber';
  automatic: Partial<Record<OptionalKey, boolean>>;
};
export interface CameraConfig {
  schemaVersion: 1;
  brand: string; model: string;
  sensor: { width: number; height: number; megapixels: number };
  lens: { focalLength: number; apertureMin: number; apertureMax: number; blades: number };
  limits: { isoMin: number; isoMax: number; shutterFast: number; shutterSlow: number };
  auxiliary: { whiteBalance: number; focusDistance: number; readNoise: number; fullWell: number };
  appearance: Pick<Draft, 'bodyColor' | 'inscription' | 'material'>;
  automatic: Partial<Record<OptionalKey, boolean>>;
}
export interface Shot { aperture: number; iso: number; shutter: number; focusDistance: number; whiteBalance: number }
export type SceneId = 'still' | 'night' | 'motion';
export const SCENES: Record<SceneId, { name: string; subtitle: string; ev: number; focus: number }> = {
  still: { name: '午后静物', subtitle: '探索焦距与景深', ev: 9, focus: 4 },
  night: { name: '蓝调之夜', subtitle: '观察弱光与噪点', ev: 3.5, focus: 6 },
  motion: { name: '时间切片', subtitle: '捕捉速度与拖影', ev: 12, focus: 8 },
};
export const EMPTY_DRAFT: Draft = {
  brand: '', model: '', sensorWidth: '', sensorHeight: '', focalLength: '', apertureMin: '', apertureMax: '',
  isoMin: '', isoMax: '', shutterFast: '', shutterSlow: '', megapixels: '', blades: '', whiteBalance: '', focusDistance: '',
  readNoise: '', fullWell: '', bodyColor: 'graphite', inscription: 'silver', material: 'leather', automatic: {},
};
export const EXAMPLE_DRAFT: Draft = { ...EMPTY_DRAFT, brand: 'AURA', model: 'ONE', sensorWidth: '36', sensorHeight: '24', focalLength: '50', apertureMin: '1.4', apertureMax: '16', isoMin: '100', isoMax: '25600', shutterFast: '1/8000', shutterSlow: '30', automatic: {} };
export function parseNumber(value: string): number {
  const v = value.trim();
  if (/^[+]?(\d+(\.\d*)?|\.\d+)\s*\/\s*[+]?(\d+(\.\d*)?|\.\d+)$/.test(v)) {
    const [a, b] = v.split('/').map(Number); return a / b;
  }
  return v === '' ? NaN : Number(v);
}
export const FIELD_SECTION: Record<RequiredKey | OptionalKey, Section> = {
  brand: 'identity', model: 'identity', sensorWidth: 'sensor', sensorHeight: 'sensor', megapixels: 'sensor',
  focalLength: 'lens', apertureMin: 'exposure', apertureMax: 'exposure', blades: 'lens',
  isoMin: 'exposure', isoMax: 'exposure', shutterFast: 'exposure', shutterSlow: 'exposure',
  whiteBalance: 'exposure', focusDistance: 'lens', readNoise: 'sensor', fullWell: 'sensor',
};
export const BOUNDS: Record<Exclude<RequiredKey, 'brand' | 'model'> | OptionalKey, [number, number]> = {
  sensorWidth: [0.1, 200], sensorHeight: [0.1, 200], focalLength: [0.5, 2000], apertureMin: [0.1, 256], apertureMax: [0.1, 256],
  isoMin: [1, 10000000], isoMax: [1, 10000000], shutterFast: [0.000001, 3600], shutterSlow: [0.000001, 3600],
  megapixels: [0.1, 1000], blades: [3, 16], whiteBalance: [1000, 40000], focusDistance: [0.05, 10000], readNoise: [0.1, 100], fullWell: [100, 1000000],
};
export function validateDraft(draft: Draft): Partial<Record<RequiredKey | OptionalKey, string>> {
  const issues: Partial<Record<RequiredKey | OptionalKey, string>> = {};
  for (const key of ['brand', 'model'] as const) {
    if (!draft[key].trim()) issues[key] = '请填写此项';
    else if (draft[key].trim().length > 24) issues[key] = '最多 24 个字符';
  }
  for (const [key, [min, max]] of Object.entries(BOUNDS) as [keyof typeof BOUNDS, [number, number]][]) {
    const optional = OPTIONAL_KEYS.includes(key as OptionalKey);
    if (optional && (draft[key].trim() === '' || draft.automatic[key as OptionalKey])) continue;
    const n = parseNumber(draft[key]);
    if (!Number.isFinite(n)) issues[key] = draft[key].trim() ? '请输入有效数字' : '请选择或填写此项';
    else if (n < min || n > max) issues[key] = `支持范围 ${min} – ${max}`;
    else if (['blades', 'isoMin', 'isoMax'].includes(key) && !Number.isInteger(n)) issues[key] = '请输入整数';
  }
  for (const [low, high, message] of [
    ['apertureMin', 'apertureMax', '最小 f 值不能大于最大 f 值'],
    ['isoMin', 'isoMax', '最低 ISO 不能高于最高 ISO'],
    ['shutterFast', 'shutterSlow', '最快快门的曝光时间不能更长'],
  ] as const) {
    if (parseNumber(draft[low]) > parseNumber(draft[high])) issues[high] = message;
  }
  if (!issues.focusDistance && !draft.automatic.focusDistance && draft.focusDistance && parseNumber(draft.focusDistance) * 1000 <= parseNumber(draft.focalLength)) issues.focusDistance = '对焦距离必须大于焦距';
  return issues;
}
const round = (n: number, places = 2) => Number(n.toFixed(places));
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export function completeDraft(draft: Draft): { draft: Draft; config: CameraConfig; filled: OptionalKey[] } {
  const issues = validateDraft(draft);
  if (Object.keys(issues).length) throw new Error('请先完成关键参数');
  const d: Draft = { ...draft, brand: draft.brand.trim(), model: draft.model.trim(), automatic: { ...draft.automatic } };
  const area = parseNumber(d.sensorWidth) * parseNumber(d.sensorHeight);
  const defaults = { megapixels: round(clamp(area / 36, 0.1, 1000)), blades: 9, whiteBalance: 5500, focusDistance: Math.max(4, parseNumber(d.focalLength) / 1000 * 3), readNoise: 2.4, fullWell: 45000 };
  const filled: OptionalKey[] = [];
  for (const key of OPTIONAL_KEYS) {
    if (d[key].trim() === '' || d.automatic[key]) {
      d[key] = String(defaults[key]); d.automatic[key] = true; filled.push(key);
    } else d.automatic[key] = false;
  }
  const config: CameraConfig = {
    schemaVersion: SCHEMA_VERSION, brand: d.brand, model: d.model,
    sensor: { width: parseNumber(d.sensorWidth), height: parseNumber(d.sensorHeight), megapixels: parseNumber(d.megapixels) },
    lens: { focalLength: parseNumber(d.focalLength), apertureMin: parseNumber(d.apertureMin), apertureMax: parseNumber(d.apertureMax), blades: parseNumber(d.blades) },
    limits: { isoMin: parseNumber(d.isoMin), isoMax: parseNumber(d.isoMax), shutterFast: parseNumber(d.shutterFast), shutterSlow: parseNumber(d.shutterSlow) },
    auxiliary: { whiteBalance: parseNumber(d.whiteBalance), focusDistance: parseNumber(d.focusDistance), readNoise: parseNumber(d.readNoise), fullWell: parseNumber(d.fullWell) },
    appearance: { bodyColor: d.bodyColor, inscription: d.inscription, material: d.material }, automatic: { ...d.automatic },
  };
  return { draft: d, config, filled };
}
export function configToDraft(c: CameraConfig): Draft {
  return {
    brand: c.brand, model: c.model, sensorWidth: String(c.sensor.width), sensorHeight: String(c.sensor.height), megapixels: String(c.sensor.megapixels),
    focalLength: String(c.lens.focalLength), apertureMin: String(c.lens.apertureMin), apertureMax: String(c.lens.apertureMax), blades: String(c.lens.blades),
    isoMin: String(c.limits.isoMin), isoMax: String(c.limits.isoMax), shutterFast: String(c.limits.shutterFast), shutterSlow: String(c.limits.shutterSlow),
    ...Object.fromEntries(Object.entries(c.auxiliary).map(([k, v]) => [k, String(v)])) as Record<keyof CameraConfig['auxiliary'], string>,
    ...c.appearance, automatic: { ...c.automatic },
  };
}
export function parseConfig(text: string): CameraConfig {
  if (text.length > 1000000) throw new Error('配置文件过大');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('无法读取 JSON 配置'); }
  const c = value as CameraConfig;
  if (!c || c.schemaVersion !== 1) throw new Error('不支持此配置版本');
  if (typeof c.brand !== 'string' || typeof c.model !== 'string' || !c.sensor || !c.lens || !c.limits || !c.auxiliary || !c.appearance) throw new Error('配置内容不完整');
  if (!['graphite', 'forest', 'titanium'].includes(c.appearance.bodyColor) || !['silver', 'gold'].includes(c.appearance.inscription) || !['leather', 'rubber'].includes(c.appearance.material)) throw new Error('外观配置无效');
  for (const group of [c.sensor, c.lens, c.limits, c.auxiliary]) for (const v of Object.values(group)) if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('配置参数必须为有效数字');
  let d: Draft;
  try { d = configToDraft(c); } catch { throw new Error('配置结构无效'); }
  // Validate all imported numeric values, including values marked automatic.
  if (Object.keys(validateDraft({ ...d, automatic: {} })).length) throw new Error('配置参数超出支持范围或相互矛盾');
  const validated = completeDraft({ ...d, automatic: {} }).config;
  validated.automatic = Object.fromEntries(OPTIONAL_KEYS.filter(k => c.automatic?.[k] === true).map(k => [k, true]));
  return validated;
}
export function initialShot(c: CameraConfig): Shot {
  return constrainShot({ aperture: 4, iso: 400, shutter: 1 / 125, focusDistance: c.auxiliary.focusDistance, whiteBalance: c.auxiliary.whiteBalance }, c).shot;
}
export function constrainShot(s: Shot, c: CameraConfig): { shot: Shot; changed: boolean } {
  const shot = {
    aperture: clamp(s.aperture, c.lens.apertureMin, c.lens.apertureMax), iso: clamp(s.iso, c.limits.isoMin, c.limits.isoMax),
    shutter: clamp(s.shutter, c.limits.shutterFast, c.limits.shutterSlow), focusDistance: clamp(s.focusDistance, Math.max(0.05, c.lens.focalLength / 1000 + 0.01), 10000),
    whiteBalance: clamp(s.whiteBalance, 1000, 40000),
  };
  return { shot, changed: Object.keys(shot).some(k => shot[k as keyof Shot] !== s[k as keyof Shot]) };
}
export function derive(c: CameraConfig, s?: Shot) {
  const diagonal = Math.hypot(c.sensor.width, c.sensor.height);
  const crop = Math.hypot(36, 24) / diagonal;
  return { crop, equivalent: c.lens.focalLength * crop, pixelPitch: Math.sqrt(c.sensor.width * c.sensor.height / (c.sensor.megapixels * 1e6)) * 1000,
    fov: 2 * Math.atan(c.sensor.height / (2 * c.lens.focalLength)) * 180 / Math.PI, aspect: c.sensor.width / c.sensor.height,
    pupil: c.lens.focalLength / (s?.aperture ?? c.lens.apertureMin), circleOfConfusion: diagonal / 1500 };
}
export function cameraEV(s: Pick<Shot, 'aperture' | 'shutter' | 'iso'>) { return Math.log2(s.aperture * s.aperture / s.shutter) - Math.log2(s.iso / 100); }
export function exposureMultiplier(s: Shot, sceneEV: number) { return Math.pow(2, sceneEV - cameraEV(s)); }
export function depthOfField(c: CameraConfig, s: Shot) {
  const f = c.lens.focalLength; const coc = derive(c).circleOfConfusion;
  const H = f * f / (s.aperture * coc) + f; const distance = s.focusDistance * 1000;
  return { near: H * distance / (H + distance - f) / 1000, far: distance >= H ? Infinity : H * distance / (H - distance + f) / 1000, hyperfocal: H / 1000 };
}
export function formatShutter(seconds: number, suffix = true): string {
  const n = seconds >= 0.25 ? String(round(seconds, seconds < 1 ? 3 : 1)) : `1/${Math.round(1 / seconds)}`;
  return n + (suffix ? ' s' : '');
}
export function requiredProgress(d: Draft) {
  return [!!d.brand.trim(), !!d.model.trim(), !!d.sensorWidth && !!d.sensorHeight, !!d.focalLength, !!d.apertureMin && !!d.apertureMax, !!d.isoMin && !!d.isoMax, !!d.shutterFast && !!d.shutterSlow].filter(Boolean).length;
}
