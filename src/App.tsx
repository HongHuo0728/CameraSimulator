import { useEffect, useRef, useState, useContext, createContext, Suspense, Component, type ReactNode } from 'react';
import { Aperture, ArrowRight, ArrowsClockwise, Camera, CaretDown, Check, CheckCircle, CircleNotch, FloppyDisk, FolderOpen, Info, Minus, Plus, Square, Sun, X, WarningCircle, PencilSimple, ArrowsOut, ArrowCounterClockwise } from '@phosphor-icons/react';
import { EMPTY_DRAFT, EXAMPLE_DRAFT, FIELD_SECTION, OPTIONAL_KEYS, SCENES, completeDraft, configToDraft, constrainShot, derive, formatShutter, initialShot, requiredProgress, validateDraft, type CameraConfig, type Draft, type OptionalKey, type RequiredKey, type Section, type Shot, type SceneId } from './camera';
import { loadDraft, openConfig, saveConfig, saveDraft, savePhoto } from './storage';
import { CameraViewer } from './CameraViewer';
import { Simulation } from './Simulation';
type Toast = { message: string; error?: boolean } | null;
const SECTION_NAMES: Record<Section, string> = { identity: '身份', sensor: '传感器', lens: '镜头', exposure: '曝光' };
const OPTIONAL_NAMES: Record<OptionalKey, string> = { megapixels: '像素数量', blades: '光圈叶片', whiteBalance: '白平衡', focusDistance: '对焦距离', readNoise: '读取噪声', fullWell: '满阱容量' };
export class RenderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }; static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="render-error"><WarningCircle size={32} /><h3>三维视图未能加载</h3><p>请尝试重新加载。你的定制草稿会保留。</p><button onClick={() => location.reload()}>重新加载</button></div> : this.props.children; }
}
function Loading() { return <div className="loading"><CircleNotch size={26} className="spin" /><span>正在准备三维工作室</span></div>; }
const FormContext = createContext<{ draft: Draft; issues: ReturnType<typeof validateDraft>; update: (key: keyof Draft, value: string) => void } | null>(null);
function Field({ id, label, hint, unit, placeholder, required = false }: { id: RequiredKey | OptionalKey; label: string; hint?: string; unit?: string; placeholder?: string; required?: boolean }) {
    const { draft, issues, update } = useContext(FormContext)!;
    return <label className={'field ' + (issues[id] ? 'invalid' : '')} htmlFor={id}>
      <span className="field-label">{label}{required && <i>＊</i>}{hint && <span className="hint" title={hint} tabIndex={0}><Info size={13} /><span role="tooltip">{hint}</span></span>}{draft.automatic[id as OptionalKey] && <em>自动</em>}</span>
      <span className="input-wrap"><input id={id} aria-required={!OPTIONAL_KEYS.includes(id as OptionalKey)} aria-invalid={!!issues[id]} aria-describedby={issues[id]?`${id}-error`:undefined} value={draft[id]} onChange={e => update(id, e.target.value)} placeholder={placeholder ?? '请填写'} autoComplete="off" maxLength={24} inputMode={id === 'brand' || id === 'model' ? 'text' : 'decimal'} />{unit && <span className="unit">{unit}</span>}</span>
      {issues[id] && <span className="field-error" id={`${id}-error`}>{issues[id]}</span>}
    </label>;
  }
export function App() {
  const [draft, setDraft] = useState<Draft>({ ...EMPTY_DRAFT, automatic: {} });
  const [ready, setReady] = useState(false); const [section, setSection] = useState<Section>('identity');
  const [mode, setMode] = useState<'design' | 'shoot'>('design'); const [advanced, setAdvanced] = useState(false);
  const [issues, setIssues] = useState<ReturnType<typeof validateDraft>>({}); const [config, setConfig] = useState<CameraConfig | null>(null);
  const [dirty, setDirty] = useState(false); const [completed, setCompleted] = useState<OptionalKey[] | null>(null);
  const [shot, setShot] = useState<Shot | null>(null); const [scene, setScene] = useState<SceneId>('still');
  const [toast, setToast] = useState<Toast>(null); const [saveState, setSaveState] = useState('');
  const [view, setView] = useState('hero'); const [viewTick, setViewTick] = useState(0); const [rotate, setRotate] = useState(false);
  const [light, setLight] = useState(0); const [zoomDelta, setZoomDelta] = useState({ n: 0, delta: 0 });
  const [help, setHelp] = useState(false); const captureRef = useRef<(() => Promise<string>) | null>(null); const [capturing, setCapturing] = useState(false);
  const notify = (message: string, error = false) => setToast({ message, error });
  useEffect(() => { loadDraft().then(d => { if (d) { setDraft(d); notify('已恢复上次的定制草稿'); } }).catch(() => notify('上次的草稿无法读取，已保留原文件', true)).finally(() => setReady(true)); }, []);
  useEffect(() => { if (!ready) return; setSaveState(''); const t = setTimeout(() => { saveDraft(draft).then(() => setSaveState('草稿已保存')).catch(() => { setSaveState('保存失败'); notify('草稿保存失败，请检查磁盘空间', true); }); }, 600); return () => clearTimeout(t); }, [draft, ready]);
  const latestDraft=useRef({draft,ready});latestDraft.current={draft,ready};
  useEffect(()=>window.desktop?.onCloseRequested(async()=>{
    try{if(latestDraft.current.ready)await saveDraft(latestDraft.current.draft);await window.desktop?.finishClose(true);}
    catch{notify('草稿保存失败，窗口已保留。请保存配置后重试。',true);await window.desktop?.finishClose(false);}
  }),[]);
  useEffect(()=>{if(window.desktop)return;const flush=()=>{if(latestDraft.current.ready)void saveDraft(latestDraft.current.draft);};window.addEventListener('beforeunload',flush);return()=>window.removeEventListener('beforeunload',flush);},[]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4500); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') { setCompleted(null); setHelp(false); } }; window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn); }, []);
  useEffect(()=>{
    if(!completed&&!help)return;
    const previous=document.activeElement as HTMLElement|null;const dialog=document.querySelector<HTMLElement>('[role="dialog"]');
    const items=()=>Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex="0"]')??[]);
    items()[0]?.focus();
    const trap=(e:KeyboardEvent)=>{if(e.key!=='Tab')return;const focusable=items(),first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}};
    dialog?.addEventListener('keydown',trap);return()=>{dialog?.removeEventListener('keydown',trap);previous?.focus();};
  },[!!completed,help]);
  const update = (key: keyof Draft, value: string) => {
    setDraft(d => ({ ...d, [key]: value, automatic: OPTIONAL_KEYS.includes(key as OptionalKey) ? { ...d.automatic, [key]: false } : d.automatic }));
    setIssues(i => ({ ...i, [key]: undefined })); if (config) setDirty(true);
  };
  const changePreset = (patch: Partial<Draft>) => { setDraft(d => ({ ...d, ...patch })); setIssues({}); if (config) setDirty(true); };
  function confirm() {
    const errors = validateDraft(draft); setIssues(errors);
    if (Object.keys(errors).length) {
      const key = Object.keys(errors)[0] as RequiredKey; setSection(FIELD_SECTION[key]);
      if (OPTIONAL_KEYS.includes(key as OptionalKey)) setAdvanced(true);
      requestAnimationFrame(() => document.getElementById(key)?.focus()); notify('请先完成标记出的参数', true); return null;
    }
    const result = completeDraft(draft); setDraft(result.draft); setConfig(result.config); setDirty(false);
    const constrained = shot ? constrainShot(shot, result.config) : { shot: initialShot(result.config), changed: false };
    setShot(constrained.shot); setCompleted(result.filled);
    if (constrained.changed) notify('拍摄设置已调整到新的相机能力范围');
    return result.config;
  }
  async function exportConfig() {
    try { const active = dirty || !config ? confirm() : config; if (!active) return; if (await saveConfig(active)) notify('相机配置已保存'); } catch (e) { notify((e as Error).message || '配置保存失败', true); }
  }
  async function importConfig() {
    try { const c = await openConfig(); if (!c) return; setConfig(c); setDraft(configToDraft(c)); setShot(initialShot(c)); setDirty(false); setIssues({}); setSection('exposure'); setMode('design'); notify(`已打开 ${c.brand} ${c.model}`); } catch (e) { notify((e as Error).message, true); }
  }
  function enterSimulation() {
    if (!config || dirty) { notify('先确认当前配置，即可进入拍摄模拟'); confirm(); return; }
    setMode('shoot'); setCompleted(null);
  }
  async function capture() {
    if (!captureRef.current || !config) return;
    setCapturing(true);
    try { const data = await captureRef.current(); if (await savePhoto(data, `${config.brand}-${config.model}-${SCENES[scene].name}`)) notify('模拟照片已保存'); } catch (e) { notify((e as Error).message || '拍摄失败', true); } finally { setCapturing(false); }
  }
  const progress = requiredProgress(draft);
  return <FormContext.Provider value={{draft, issues, update}}><div className="app-shell">
    <header className="titlebar">
      <div className="wordmark"><Aperture size={30} weight="thin" /><span>CameraSimulator</span></div>
      <nav className="mode-tabs" aria-label="工作区"><button className={mode === 'design' ? 'active' : ''} onClick={() => setMode('design')}>相机定制</button><button className={mode === 'shoot' ? 'active' : ''} onClick={enterSimulation}>拍摄模拟</button></nav>
      <div className="file-actions"><button title="打开相机配置" aria-label="打开相机配置" onClick={importConfig}><FolderOpen size={20} /></button><button title="保存相机配置" aria-label="保存相机配置" onClick={exportConfig}><FloppyDisk size={19} /></button><button title="使用说明" aria-label="使用说明" onClick={() => setHelp(true)}><Info size={19} /></button></div>
      {window.desktop && <div className="window-controls"><button aria-label="最小化" onClick={() => window.desktop?.windowAction('minimize')}><Minus size={16} /></button><button aria-label="最大化" onClick={() => window.desktop?.windowAction('maximize')}><Square size={13} /></button><button className="close-window" aria-label="关闭" onClick={() => window.desktop?.windowAction('close')}><X size={16} /></button></div>}
    </header>
    {mode === 'design' ? <main className="workspace">
      <aside className="inspector">
        <div className="inspector-heading"><h1>定制你的相机</h1><p>从核心规格开始</p></div>
        <nav className="section-tabs" aria-label="定制参数">{Object.entries(SECTION_NAMES).map(([id, label]) => <button key={id} className={section === id ? 'active' : ''} onClick={() => setSection(id as Section)}>{label}</button>)}</nav>
        <div className="identity-line"><span>{draft.brand || 'YOUR BRAND'}<b>/</b>{draft.model || 'MODEL'}</span><button aria-label="编辑品牌型号" onClick={() => setSection('identity')}><PencilSimple size={15} /></button></div>
        <div className="inspector-scroll" key={section}>
          {section === 'identity' && <>
            <h2>赋予它你的名字</h2><Field id="brand" label="相机品牌" required placeholder="例如 AURA" hint="支持中文或英文，最多 24 个字符。铭文会显示在机身正面。" /><Field id="model" label="相机型号" required placeholder="例如 ONE" />
            <div className="form-section"><h2>机身配色</h2><div className="swatches">{[['graphite', '曜石黑'], ['forest', '松石绿'], ['titanium', '钛银灰']].map(([id, label]) => <button key={id} className={'swatch ' + (draft.bodyColor === id ? 'selected' : '')} aria-label={label} onClick={() => update('bodyColor', id)}><span className={'swatch-color ' + id}>{draft.bodyColor === id && <Check size={15} />}</span><small>{label}</small></button>)}</div></div>
            <div className="form-section"><h2>握柄材质</h2><div className="segmented"><button className={draft.material === 'leather' ? 'active' : ''} onClick={() => update('material', 'leather')}>细纹蒙皮</button><button className={draft.material === 'rubber' ? 'active' : ''} onClick={() => update('material', 'rubber')}>柔触橡胶</button></div></div>
            <div className="inline-option"><span>铭文颜色</span><div className="mini-swatches"><button className={'silver ' + (draft.inscription === 'silver' ? 'selected' : '')} aria-label="银色铭文" onClick={() => update('inscription', 'silver')} /><button className={'gold ' + (draft.inscription === 'gold' ? 'selected' : '')} aria-label="金色铭文" onClick={() => update('inscription', 'gold')} /></div></div>
            <button className="example-link" onClick={() => { changePreset({ ...EXAMPLE_DRAFT, automatic: {} }); setSection('exposure'); notify('已载入示例参数，你可以继续自由修改'); }}>先从示例相机开始 <ArrowRight size={14} /></button>
          </>}
          {section === 'sensor' && <>
            <h2>传感器规格</h2><p className="section-description">画幅决定视角，像素决定细节。</p>
            <div className="preset-list">{[['全画幅',36,24],['APS-C',23.5,15.6],['M4/3',17.3,13],['中画幅',44,33]].map(([name,w,h]) => <button key={name} className={draft.sensorWidth === String(w) && draft.sensorHeight === String(h) ? 'selected' : ''} onClick={() => changePreset({ sensorWidth: String(w), sensorHeight: String(h) })}><span>{name}</span><small>{w} × {h} mm</small></button>)}</div>
            <div className="field-pair"><Field id="sensorWidth" label="宽度" required unit="mm" placeholder="36" /><Field id="sensorHeight" label="高度" required unit="mm" placeholder="24" /></div>
            <p className="helper">也可以输入自定义画幅。支持宽、高分别为 0.1–200 mm 的概念相机。</p>
            <div className="form-section"><Field id="megapixels" label="有效像素" unit="MP" placeholder="自动补齐" hint="留空时按约 6 μm 像素间距推算；影响像素间距与噪声模拟，不改变照片导出尺寸。" /></div>
            {draft.sensorWidth && draft.sensorHeight && <p className="helper">外观为固定展示机身，不代表传感器的真实装配尺寸。</p>}
          </>}
          {section === 'lens' && <>
            <h2>你的视角</h2><Field id="focalLength" label="定焦镜头焦距" required unit="mm" placeholder="50" hint="焦距越长，视角越窄。这里使用实际焦距；等效焦距会按画幅计算。" />
            <div className="focal-presets">{[24,35,50,85,135].map(n => <button key={n} className={draft.focalLength === String(n) ? 'selected' : ''} onClick={() => update('focalLength', String(n))}>{n}<small>mm</small></button>)}</div>
            <p className="helper">镜头外观固定，焦距直接影响模拟拍摄的视角。</p>
            <div className="form-section"><Field id="blades" label="光圈叶片" unit="片" placeholder="自动补齐" hint="3–16 片，影响散景光斑形状和镜头内部光圈。" /><Field id="focusDistance" label="初始对焦距离" unit="m" placeholder="自动补齐" hint="进入拍摄后也可以点击主体对焦。" /></div>
          </>}
          {section === 'exposure' && <>
            <h2>曝光能力限制</h2>
            <div className="range-group"><h3>ISO 范围 <i>＊</i></h3><div className="field-pair"><Field id="isoMin" label="最低" placeholder="100" /><Field id="isoMax" label="最高" placeholder="25600" /></div></div>
            <div className="range-group"><h3>快门范围 <i>＊</i><span className="hint" title="支持 1/8000 或 0.000125。最快指最短曝光时间。"><Info size={13} /></span></h3><div className="field-pair"><Field id="shutterFast" label="最快" unit="s" placeholder="1/8000" /><Field id="shutterSlow" label="最慢" unit="s" placeholder="30" /></div></div>
            <div className="range-group"><h3>光圈范围 <i>＊</i></h3><div className="field-pair"><Field id="apertureMin" label="最大开口" unit="f" placeholder="1.4" /><Field id="apertureMax" label="最小开口" unit="f" placeholder="16" /></div></div>
            <p className="helper exposure-helper">拍摄时只能在你设定的范围内调节</p>
            <button className="subtle-link" onClick={() => changePreset({ isoMin: '100', isoMax: '25600', shutterFast: '1/8000', shutterSlow: '30', apertureMin: '1.4', apertureMax: '16' })}>使用常用曝光范围</button>
          </>}
          <div className="advanced"><button className="accordion" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}><span>附属参数 · 自动补齐</span><CaretDown size={16} className={advanced ? 'flipped' : ''} /></button><p className="helper">不确定的附属参数可以留空</p>{advanced && <div className="advanced-fields"><Field id="whiteBalance" label="初始白平衡" unit="K" placeholder="自动补齐" /><Field id="readNoise" label="读取噪声" unit="e⁻" placeholder="自动补齐" hint="传感器电子读出产生的噪声，默认 2.4 e⁻。" /><Field id="fullWell" label="满阱容量" unit="e⁻" placeholder="自动补齐" hint="参考像素可容纳的电子数量，默认 45000 e⁻；用于噪声估算。" /></div>}</div>
        </div>
        <div className="inspector-footer"><div className="completion-status"><span>{config && !dirty ? <><Check size={13} /> 配置已确认</> : <>关键参数 {progress} / 7</>}</span><span>{saveState}</span></div><button className="primary confirm-button" onClick={confirm}>确定并补齐参数 <ArrowRight size={16} /></button><button className="save-draft" onClick={() => saveDraft(draft).then(() => notify('草稿已保存，可在下次继续')).catch(() => notify('草稿保存失败', true))}>保存草稿</button></div>
      </aside>
      <section className="model-stage" aria-label="相机三维预览">
        <div className="stage-toolbar"><span className="studio-label"><b /> 原创微单 / 外观预览</span><div><button className={rotate ? 'active' : ''} onClick={() => setRotate(!rotate)}><ArrowsClockwise size={19} />旋转</button><button onClick={() => { setView('hero'); setViewTick(t => t + 1); setRotate(false); }}><ArrowCounterClockwise size={19} />重置</button><button onClick={() => setLight(l => (l+1)%3)}><Sun size={20} />{['光源','柔光','轮廓光'][light]}</button></div></div>
        <div className="model-canvas"><RenderBoundary><Suspense fallback={<Loading />}><CameraViewer draft={draft} view={view} viewTick={viewTick} autoRotate={rotate} light={light} zoomDelta={zoomDelta} /></Suspense></RenderBoundary></div>
        <div className="viewport-controls"><span className="orbit-help">拖动旋转 · 滚轮缩放</span><div className="view-tabs">{[['front','正面'],['back','背面'],['top','顶部']].map(([id,label]) => <button key={id} className={view === id || view === 'hero' && id === 'front' ? 'active' : ''} onClick={() => { setView(id); setViewTick(t=>t+1); setRotate(false); }}>{label}</button>)}</div><div className="zoom-controls"><button aria-label="放大模型" onClick={() => setZoomDelta(s=>({n:s.n+1,delta:1}))}><Plus size={18} /></button><button aria-label="缩小模型" onClick={() => setZoomDelta(s=>({n:s.n+1,delta:-1}))}><Minus size={18} /></button></div></div>
        <div className="spec-strip"><div><small>传感器规格</small><strong>{draft.sensorWidth && draft.sensorHeight ? <>{draft.sensorWidth==='36' && draft.sensorHeight==='24' ? '全画幅 ' : ''}{draft.sensorWidth} × {draft.sensorHeight} <em>mm</em></> : '等待定义'}</strong></div><div><small>焦距</small><strong>{draft.focalLength || '—'} <em>mm</em></strong></div><div><small>光圈范围</small><strong>{draft.apertureMin && draft.apertureMax ? `f/${draft.apertureMin} – f/${draft.apertureMax}` : '等待定义'}</strong></div></div>
      </section>
    </main> : config && shot && <main className="shoot-workspace"><RenderBoundary><Simulation config={config} shot={shot} setShot={setShot} sceneId={scene} setScene={setScene} captureRef={captureRef} /></RenderBoundary><button className="capture-button" onClick={capture} disabled={capturing}>{capturing ? <CircleNotch className="spin" size={20} /> : <Camera size={21} />} {capturing ? '正在曝光…' : '拍摄并保存 PNG'}</button></main>}
    {toast && <div role={toast.error ? 'alert' : 'status'} className={'toast ' + (toast.error ? 'error' : '')}>{toast.error ? <WarningCircle size={19} /> : <CheckCircle size={19} />}<span>{toast.message}</span><button aria-label="关闭提示" onClick={() => setToast(null)}><X size={14} /></button></div>}
    {completed && config && <div className="modal-backdrop" onClick={() => setCompleted(null)}><section role="dialog" aria-modal="true" aria-labelledby="complete-title" className="completion-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" aria-label="关闭结果" onClick={()=>setCompleted(null)}><X size={20}/></button><CheckCircle size={34} weight="thin" /><p className="eyebrow">你的相机，准备就绪</p><h2 id="complete-title">{config.brand} <span>{config.model}</span></h2><p className="modal-intro">已保留你填写的参数，并补齐可选项。</p><dl className="completed-values">{OPTIONAL_KEYS.map(k => <div key={k}><dt>{OPTIONAL_NAMES[k]}</dt><dd>{draft[k]} <small>{({megapixels:'MP',blades:'片',whiteBalance:'K',focusDistance:'m',readNoise:'e⁻',fullWell:'e⁻'})[k]}</small><em>{config.automatic[k] ? '自动补齐' : '手动设置'}</em></dd></div>)}</dl><div className="derived-row"><span>等效焦距 <b>{derive(config).equivalent.toFixed(1)} mm</b></span><span>像素间距 <b>{derive(config).pixelPitch.toFixed(2)} μm</b></span></div><button className="primary" onClick={()=>{setCompleted(null);setMode('shoot');}}>进入拍摄模拟 <ArrowRight size={18}/></button><button className="save-draft" onClick={()=>setCompleted(null)}>继续调整相机</button></section></div>}
    {help && <div className="modal-backdrop" onClick={()=>setHelp(false)}><section role="dialog" aria-modal="true" aria-labelledby="help-title" className="help-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" aria-label="关闭说明" onClick={()=>setHelp(false)}><X size={20}/></button><Aperture size={32} weight="thin"/><h2 id="help-title">把想象，变成你的相机。</h2><p>依次填写品牌、型号、传感器、焦距和曝光范围。附属参数可以留空，点击确定后自动补齐。</p><p>三维视图支持拖动旋转、滚轮缩放。机身形状固定；画幅和镜头参数将在拍摄模拟中生效。</p><p>拍摄采用手动曝光。点击场景主体对焦，调整光圈、快门和 ISO，观察景深、曝光、运动拖影与噪点。导出的 PNG 是摄影规律模拟结果。</p><p className="helper">所有核心功能在本机运行。模拟不代表实际制造可行性或特定品牌的实验室性能。</p><button className="primary" onClick={()=>setHelp(false)}>开始定制</button></section></div>}
  </div></FormContext.Provider>;
}
