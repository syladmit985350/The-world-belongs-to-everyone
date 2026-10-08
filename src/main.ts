import gsap from 'gsap';
import { FilmEngine, type FrameState } from './core/FilmEngine';
import { CHAPTERS, FILM_DURATION, type Chapter } from './content/chapters';
import { CONSTITUTION_DOCUMENT } from './content/constitution';
import { ARCHIVE } from './archive/manifest';
import { AudioDirector } from './audio/AudioDirector';
import { BASE, clamp } from './core/Resources';
import './style.css';

type Language = 'zh' | 'en';
type Fact = { id: string; year: number | string; date?: string; titleZh: string; titleEn: string; descriptionZh: string; descriptionEn: string; sources: { title: string; url: string; kind: string }[]; context?: string; verified: boolean };
const icon = (name: string): string => {
  const paths: Record<string, string> = {
    sound: '<path d="m3 8 4 0 5-4v16l-5-4H3z"/><path d="M16 8c2 2 2 6 0 8m3-11c4 4 4 10 0 14"/>',
    mute: '<path d="m3 8 4 0 5-4v16l-5-4H3z"/><path d="m16 9 6 6m0-6-6 6"/>',
    voice: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 10v2a6 6 0 0 0 12 0v-2m-6 8v3m-3 0h6"/>',
    play: '<path d="m8 5 11 7-11 7z"/>',
    pause: '<path d="M8 5v14m8-14v14"/>',
    next: '<path d="m7 6 8 6-8 6m10-13v14"/>',
    previous: '<path d="m17 6-8 6 8 6M7 5v14"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    menu: '<path d="M3 7h18M3 12h18M3 17h18"/>',
    archive: '<path d="M5 4h14v17H5zM9 8h6m-6 4h6m-6 4h4"/>',
    replay: '<path d="M4 10a8 8 0 1 1 0 6m0-12v6h6"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? ''}</svg>`;
};

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <main class="experience" aria-label="为革命 · 天下为公">
    <div class="stage" id="stage" role="presentation"></div>
    <div class="grain" aria-hidden="true"></div>
    <header class="masthead">
      <button class="wordmark" id="home" aria-label="回到开场"><span class="wordmark-title">天下为公<span class="seal-mark" aria-hidden="true"></span></span><span class="wordmark-sub">一部未完成的理想 / AN UNFINISHED IDEAL</span></button>
      <nav class="utility" aria-label="作品控制">
        <button class="icon-button" id="sound" aria-label="开启声音" aria-pressed="false">${icon('mute')}</button>
        <button class="icon-button" id="narration" aria-label="关闭中文旁白" aria-pressed="true">${icon('voice')}</button>
        <button class="language-button" id="language" aria-label="Switch to English">中 <span>/</span> EN</button>
        <span class="utility-divider" aria-hidden="true"></span>
        <button class="menu-button" id="chapters-open" aria-haspopup="dialog" aria-expanded="false"><span data-ui="chapters">章节</span> ${icon('menu')}</button>
      </nav>
    </header>
    <section class="cover" id="cover" aria-labelledby="cover-title">
      <div class="cover-kicker"><span class="tiny-red-line" aria-hidden="true"></span><span data-ui="immersive">沉浸式历史艺术作品</span><span class="edition">NO. 01</span></div>
      <h1 id="cover-title"><span class="title-chinese">为革命</span><span class="title-english">FOR <br/>REVOLUTION<span class="period">.</span></span></h1>
      <p class="cover-thought"><span data-ui="forIdeal">为共和。为一个尚未完成的理想。</span><span class="thought-en">FOR A REPUBLIC. FOR AN UNFINISHED IDEAL.</span></p>
      <div class="cover-actions"><button class="entry-button" id="enter"><span data-ui="enter">进入作品</span>${icon('arrow')}</button><button class="cinematic-button" id="cinematic">${icon('play')}<span data-ui="watch">观看完整影片</span><span class="duration">04:00</span></button></div>
      <div class="cover-dates"><span>1866</span><span class="date-rule"></span><span>1925</span><span class="cover-name">SUN YAT-SEN</span></div>
    </section>
    <aside class="opening-note" id="opening-note" aria-label="开场题记"><span class="note-index">00 / 时局</span><p>一个人出现以前，<br/>时代已经开始。</p><span>BEFORE A LIFE, AN AGE.</span></aside>
    <section class="chapter-heading" id="chapter-heading" aria-live="polite" aria-atomic="true"><span class="chapter-world">01 / CUIHENG</span><h2></h2><span class="chapter-year"></span><p class="chapter-location"></p></section>
    <section class="captions" id="captions" aria-live="off"><p class="caption-zh"></p><p class="caption-en"></p></section>
    <button class="constitution-action" id="constitution-read" aria-haspopup="dialog" aria-expanded="false" hidden>${icon('archive')}<span data-ui="readConstitution">靠近约法</span>${icon('arrow')}</button>
    <div class="sound-hint" id="sound-hint" role="status"></div>
    <aside class="film-note" id="film-note" aria-label="探索操作说明"><span data-ui="explore">滚动探索 / 拖动 / 方向键</span><span class="vertical-line" aria-hidden="true"></span><span>16 WORLDS · 240 SECONDS</span></aside>
    <footer class="transport">
      <div class="transport-top"><button class="chapter-status" id="current-chapter"><span id="chapter-number">00</span><span class="status-rule"></span><span id="chapter-name">时局</span><span class="chapter-total">/ 16</span></button><button class="archive-button" id="archive-open" aria-haspopup="dialog" aria-expanded="false">${icon('archive')}<span data-ui="archive">史料与创作</span></button></div>
      <label class="sr-only" for="timeline">影片时间 / Film time</label><input class="timeline" id="timeline" type="range" min="0" max="240" step="0.1" value="0" aria-valuetext="00:00 of 04:00" />
      <div class="transport-bottom"><span class="timecode"><span id="time-current">00:00</span><span class="time-slash">/</span>04:00</span><div class="playback"><button class="icon-button small" id="previous" aria-label="上一章">${icon('previous')}</button><button class="icon-button play-control" id="play" aria-label="播放">${icon('play')}</button><button class="icon-button small" id="next" aria-label="下一章">${icon('next')}</button></div><span class="transport-credit">FOR REVOLUTION<span class="credit-separator">·</span><span data-ui="film">历史艺术影片</span></span></div>
    </footer>
    <div class="drawer-backdrop" id="drawer-backdrop" hidden></div>
    <dialog class="drawer chapter-drawer" id="chapter-drawer" aria-labelledby="chapter-drawer-title"><div class="drawer-head"><div><span class="drawer-eyebrow">THE JOURNEY</span><h2 id="chapter-drawer-title" data-ui="sixteen">十六个历史空间</h2></div><button class="icon-button drawer-close" aria-label="关闭">${icon('close')}</button></div><nav class="chapter-list" aria-label="选择章节"></nav><p class="drawer-foot" data-ui="navigation">一个人。一群人。一个未竟的理想。</p></dialog>
    <dialog class="drawer archive-drawer" id="archive-drawer" aria-labelledby="archive-drawer-title"><div class="drawer-head"><div><span class="drawer-eyebrow">ARCHIVE & ART</span><h2 id="archive-drawer-title" data-ui="sources">史料、语境与创作</h2></div><button class="icon-button drawer-close" aria-label="关闭">${icon('close')}</button></div><div class="archive-scroll"><section class="archive-context"><span class="context-year"></span><h3 class="context-title"></h3><p class="context-detail"></p></section><section class="fact-section"><h3 data-ui="historical">可追溯的历史</h3><div class="fact-list"></div></section><section class="archive-assets"><h3 data-ui="materials">影像与地图来源</h3><div class="asset-list"></div></section><section class="credits"><h3 data-ui="creative">关于这个作品</h3><p data-ui="creditText">四分钟，十六个空间。史料与抽象艺术共同构成这段旅程。建筑、海洋、剪影、镜面和声音为创作性重构；真实档案保留来源与授权。画面中的书法来自孙中山公共领域手迹。</p><p class="credits-small" data-ui="tech">Three.js / GLSL / Web Audio · 中文旁白 / 中英字幕</p><a href="${BASE}ATTRIBUTION.md" target="_blank" rel="noopener" data-ui="fullAttribution">完整素材授权记录 ↗</a></section></div></dialog>
    <dialog class="constitution-dialog" id="constitution-dialog" aria-labelledby="constitution-title" aria-describedby="constitution-note"><div class="document-head"><span class="document-date">1912 · NANJING</span><button class="icon-button drawer-close" aria-label="关闭">${icon('close')}</button></div><div class="document-scroll"><h2 id="constitution-title"></h2><p class="document-alternative"></p><p class="document-published"></p><div class="document-excerpts"></div><p class="document-note" id="constitution-note"></p><div class="document-source"></div><button class="document-return" id="constitution-return">${icon('arrow')}<span data-ui="returnScene">返回共和空间</span></button></div></dialog>
    <section class="fallback" id="fallback" hidden><span class="drawer-eyebrow">FOR REVOLUTION</span><h2 data-ui="fallbackTitle">让图形重新亮起</h2><p id="fallback-message"></p><button class="entry-button" id="retry" data-ui="reload">重新载入作品</button><button class="text-button" id="fallback-archive" data-ui="readSources">阅读史料与创作说明</button></section>
    <section class="end-note" id="end-note" hidden><span data-ui="historyContinues">历史仍在继续。</span><button class="text-button" id="replay">${icon('replay')}<span data-ui="again">重新观看</span></button></section>
  </main>`;

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const translations: Record<string, [string, string]> = {
  chapters: ['章节', 'Chapters'], immersive: ['沉浸式历史艺术作品', 'AN IMMERSIVE HISTORICAL ART FILM'],
  forIdeal: ['为共和。为一个尚未完成的理想。', 'For a republic. For an unfinished ideal.'], enter: ['进入作品', 'Enter the work'], watch: ['观看完整影片', 'Watch the film'],
  archive: ['史料与创作', 'Archive & art'], explore: ['滚动探索 / 拖动 / 方向键', 'SCROLL / DRAG / ARROW KEYS'], film: ['历史艺术影片', 'A HISTORICAL ART FILM'],
  sixteen: ['十六个历史空间', 'Sixteen historical worlds'], navigation: ['一个人。一群人。一个未竟的理想。', 'One life. Many people. An unfinished ideal.'],
  sources: ['史料、语境与创作', 'Sources, context & art'], historical: ['可追溯的历史', 'A traceable history'], materials: ['影像与地图来源', 'Images & maps'], creative: ['关于这个作品', 'About this work'],
  creditText: ['四分钟，十六个空间。史料与抽象艺术共同构成这段旅程。建筑、海洋、剪影、镜面和声音为创作性重构；真实档案保留来源与授权。画面中的书法来自孙中山公共领域手迹。', 'Four minutes, sixteen worlds. Archival evidence and abstract art share this journey. Architecture, ocean, silhouettes, reflections and sound are artistic interpretations. Historical images retain their sources and licenses; the calligraphy is sampled from Sun Yat-sen’s public-domain handwriting.'],
  tech: ['Three.js / GLSL / Web Audio · 中文旁白 / 中英字幕', 'Three.js / GLSL / Web Audio · Chinese narration / bilingual subtitles'],
  fullAttribution: ['完整素材授权记录 ↗', 'Full attribution & licenses ↗'], fallbackTitle: ['让图形重新亮起', 'Bring the artwork back to light'], reload: ['重新载入作品', 'Reload the artwork'], readSources: ['阅读史料与创作说明', 'Read the sources & art notes'], historyContinues: ['历史仍在继续。', 'History continues.'], again: ['重新观看', 'Watch again'],
  readConstitution: ['靠近约法', 'Read the constitution'], returnScene: ['返回共和空间', 'Return to the republic'],
};

const query = new URLSearchParams(location.search);
let language: Language = query.get('lang') === 'en' || localStorage.getItem('tianxia-language') === 'en' ? 'en' : 'zh';
let entered = false;
let lastChapter = -1;
let lastCaption = '';
let state: FrameState = { time: 0, chapterIndex: 0, progress: 0, playing: false, ended: false };
let facts: Fact[] = [];
let factsLoadFailed = false;
let engine: FilmEngine | undefined;
let audio: AudioDirector | undefined;
let hintTimer: number | undefined;
let activeDrawer: HTMLDialogElement | undefined;
let drawerTrigger: HTMLElement | undefined;
let drawerWasPlaying = false;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const timecode = (seconds: number): string => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;

function showHint(text: string): void {
  const hint = $('#sound-hint'); hint.textContent = text; hint.classList.add('is-visible'); clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => hint.classList.remove('is-visible'), 4800);
}

function updateAudioButtons(): void {
  const enabled = audio?.enabled ?? false, narrated = audio?.narration ?? true;
  $('#sound').innerHTML = icon(enabled ? 'sound' : 'mute'); $('#sound').setAttribute('aria-pressed', String(enabled)); $('#sound').setAttribute('aria-label', language === 'zh' ? enabled ? '关闭声音' : '开启声音' : enabled ? 'Mute sound' : 'Enable sound');
  $('#narration').setAttribute('aria-pressed', String(narrated)); $('#narration').classList.toggle('is-muted', !narrated); $('#narration').setAttribute('aria-label', language === 'zh' ? narrated ? '关闭中文旁白' : '开启中文旁白' : narrated ? 'Disable Chinese narration' : 'Enable Chinese narration');
}

async function soundOn(): Promise<void> {
  if (!audio) return;
  try { const ok = await audio.unlock(); if (ok) audio.setEnabled(true); else showHint(language === 'zh' ? '点击右上角声音按钮开启声音。' : 'Use the sound control to enable audio.'); }
  catch { showHint(language === 'zh' ? '声音暂不可用；视觉旅程可以继续。' : 'Sound is temporarily unavailable. The visual film continues.'); }
  updateAudioButtons();
}

function enter(play: boolean, gesture = true): void {
  if (!engine) return;
  if (!entered) {
    entered = true; app.classList.add('entered'); $('#cover').setAttribute('aria-hidden', 'true');
    $('#enter').setAttribute('tabindex', '-1'); $('#cinematic').setAttribute('tabindex', '-1');
    gsap.to('#cover, #opening-note', { opacity: 0, duration: reducedMotion ? 0 : 0.85, ease: 'power2.out', onComplete: () => { $('#cover').hidden = true; $('#opening-note').hidden = true; } });
    gsap.fromTo('#chapter-heading, #captions', { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: reducedMotion ? 0 : 0.8, delay: 0.35 });
  }
  if (play) engine.play(); else engine.pause();
  if (gesture) void soundOn();
  if (play && !gesture) showHint(language === 'zh' ? '影片已开始。点击声音按钮，开启中文旁白与声音。' : 'The film has started. Enable sound for Chinese narration and the soundscape.');
  updateFrame(state);
}

function jump(time: number): void {
  if (!engine) return; if (activeDrawer) closeDrawer(false); enter(false, false); engine.seek(time); audio?.seek(time);
  const current = CHAPTERS[Math.max(0, CHAPTERS.findIndex(chapter => time >= chapter.start && time < chapter.start + chapter.duration))];
  const nextQuery = new URLSearchParams(location.search); nextQuery.set('chapter', current.id); nextQuery.delete('t'); nextQuery.delete('cinematic');
  history.replaceState(null, '', `${location.pathname}?${nextQuery}`);
}

function chapterRow(chapter: Chapter): HTMLButtonElement {
  const button = document.createElement('button'); button.className = 'chapter-row'; button.dataset.index = String(chapter.index);
  const number = document.createElement('span'); number.className = 'row-number'; number.textContent = String(chapter.index).padStart(2, '0');
  const title = document.createElement('span'); title.className = 'row-title'; title.textContent = language === 'zh' ? chapter.titleZh : chapter.titleEn;
  const year = document.createElement('span'); year.className = 'row-year'; year.textContent = chapter.year;
  const arrow = document.createElement('span'); arrow.className = 'row-arrow'; arrow.innerHTML = icon('arrow');
  button.append(number, title, year, arrow); button.addEventListener('click', () => { closeDrawer(false); jump(chapter.start); });
  return button;
}

function buildChapterList(): void { const list = $('.chapter-list'); list.replaceChildren(...CHAPTERS.map(chapterRow)); updateSelectedChapter(); }
function updateSelectedChapter(): void { document.querySelectorAll<HTMLButtonElement>('.chapter-row').forEach(button => { const current = Number(button.dataset.index) === state.chapterIndex; button.classList.toggle('is-current', current); if (current) button.setAttribute('aria-current', 'true'); else button.removeAttribute('aria-current'); }); }

function sourceLink(url: string, title: string): HTMLAnchorElement {
  const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = title + ' ↗'; return link;
}

function renderArchive(): void {
  const chapter = CHAPTERS[state.chapterIndex]; $('.context-year').textContent = `${String(chapter.index).padStart(2, '0')} / ${chapter.year}`;
  $('.context-title').textContent = language === 'zh' ? chapter.titleZh : chapter.titleEn; $('.context-detail').textContent = language === 'zh' ? chapter.detailZh : chapter.detailEn;
  const list = $('.fact-list'); list.replaceChildren();
  const selected = facts.filter(fact => chapter.factIds.includes(fact.id));
  if (!selected.length) {
    const p = document.createElement('p'); p.className = 'fact-loading'; p.textContent = factsLoadFailed ? language === 'zh' ? '史料索引暂时无法打开。请查看下方素材来源与完整授权记录。' : 'The source index is unavailable. The image sources and full attribution remain below.' : language === 'zh' ? '正在打开历史出处…' : 'Opening the historical sources…'; list.append(p);
  }
  selected.forEach(fact => {
    const article = document.createElement('article'); article.className = 'historical-fact';
    const meta = document.createElement('span'); meta.className = 'fact-meta'; meta.textContent = `${fact.date || fact.year} · ${language === 'zh' ? fact.verified ? '史实已核查' : '史料说明' : fact.verified ? 'VERIFIED' : 'CONTEXT'}`;
    const title = document.createElement('h4'); title.textContent = language === 'zh' ? fact.titleZh : fact.titleEn;
    const text = document.createElement('p'); text.textContent = language === 'zh' ? fact.descriptionZh : fact.descriptionEn;
    article.append(meta, title, text);
    if (fact.context) { const context = document.createElement('p'); context.className = 'fact-context'; context.textContent = fact.context; article.append(context); }
    const citations = document.createElement('div'); citations.className = 'citations'; fact.sources.forEach(source => citations.append(sourceLink(source.url, source.title))); article.append(citations); list.append(article);
  });
  const assets = $('.asset-list'); assets.replaceChildren();
  ARCHIVE.forEach(asset => {
    const article = document.createElement('article'); article.className = 'archive-asset';
    const title = document.createElement('h4'); title.textContent = language === 'zh' ? asset.titleZh : asset.titleEn;
    const license = document.createElement('span'); license.className = 'asset-license'; license.textContent = `${asset.year} · ${asset.license}`;
    const text = document.createElement('p'); text.textContent = language === 'zh' ? asset.descriptionZh : asset.descriptionEn;
    article.append(title, license, text, sourceLink(asset.sourceUrl, asset.creator || 'Archive source')); assets.append(article);
  });
}

function renderConstitution(): void {
  const document = CONSTITUTION_DOCUMENT;
  $('#constitution-title').textContent = language === 'zh' ? document.titleZh : document.titleEn;
  $('.document-alternative').textContent = language === 'zh' ? document.titleEn : document.titleZh;
  $('.document-published').textContent = document.date;
  const clauses = $('.document-excerpts'); clauses.replaceChildren();
  document.excerpts.forEach(clause => {
    const article = window.document.createElement('article'); article.className = 'document-clause';
    const heading = window.document.createElement('h3'); heading.textContent = language === 'zh' ? clause.labelZh : clause.labelEn;
    const zh = window.document.createElement('p'); zh.className = 'clause-zh'; zh.lang = 'zh-CN'; zh.textContent = clause.zh;
    const en = window.document.createElement('p'); en.className = 'clause-en'; en.lang = 'en'; en.textContent = clause.en;
    article.append(heading, zh, en); clauses.append(article);
  });
  $('#constitution-note').textContent = language === 'zh' ? document.noteZh : document.noteEn;
  const source = $('.document-source'); source.replaceChildren();
  const label = window.document.createElement('span'); label.textContent = language === 'zh' ? '原文出处' : 'ORIGINAL SOURCE';
  source.append(label, sourceLink(document.sourceUrl, language === 'zh' ? document.sourceTitle : 'Provisional Government Gazette No. 35 · Sunology Archive'));
}

function openDrawer(which: 'chapter' | 'archive' | 'constitution', trigger: HTMLElement): void {
  if (which === 'constitution' && (!engine || state.chapterIndex !== 9)) return;
  if (activeDrawer) closeDrawer(false);
  drawerWasPlaying = engine?.playing ?? false; engine?.pause();
  activeDrawer = $<HTMLDialogElement>(which === 'chapter' ? '#chapter-drawer' : which === 'archive' ? '#archive-drawer' : '#constitution-dialog'); drawerTrigger = trigger;
  $('#drawer-backdrop').hidden = which === 'constitution'; trigger.setAttribute('aria-expanded', 'true'); app.classList.add('drawer-open');
  app.classList.toggle('reading-document', which === 'constitution');
  if (which === 'archive') renderArchive(); else if (which === 'constitution') renderConstitution(); else updateSelectedChapter();
  engine?.readDocument(which === 'constitution');
  activeDrawer.showModal(); gsap.fromTo(activeDrawer, { x: '8%', opacity: 0 }, { x: 0, opacity: 1, duration: reducedMotion ? 0 : 0.35, ease: 'power2.out' });
  window.setTimeout(() => activeDrawer?.querySelector<HTMLButtonElement>('.drawer-close')?.focus(), 30);
}

function closeDrawer(resume = true): void {
  if (!activeDrawer) return; const drawer = activeDrawer; activeDrawer = undefined; drawer.close(); $('#drawer-backdrop').hidden = true; app.classList.remove('drawer-open');
  app.classList.remove('reading-document'); if (drawer.id === 'constitution-dialog') engine?.readDocument(false);
  drawerTrigger?.setAttribute('aria-expanded', 'false'); drawerTrigger?.focus(); if (resume && drawerWasPlaying) engine?.play(); drawerWasPlaying = false;
}

function setLanguage(value: Language): void {
  language = value; document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'; localStorage.setItem('tianxia-language', language);
  $('#opening-note').setAttribute('aria-label', language === 'zh' ? '开场题记' : 'Opening reflection');
  $('#film-note').setAttribute('aria-label', language === 'zh' ? '探索操作说明' : 'Exploration instructions');
  $('.experience').setAttribute('aria-label', language === 'zh' ? '为革命 · 天下为公' : 'For Revolution · The World Belongs to All');
  $('.utility').setAttribute('aria-label', language === 'zh' ? '作品控制' : 'Artwork controls');
  $('.chapter-list').setAttribute('aria-label', language === 'zh' ? '选择章节' : 'Choose a chapter');
  $('#chapters-open').setAttribute('aria-label', language === 'zh' ? '章节' : 'Chapters');
  $('#home').setAttribute('aria-label', language === 'zh' ? '回到开场' : 'Return to the opening');
  $('#previous').setAttribute('aria-label', language === 'zh' ? '上一章' : 'Previous chapter');
  $('#next').setAttribute('aria-label', language === 'zh' ? '下一章' : 'Next chapter');
  document.querySelectorAll('.drawer-close').forEach(button => button.setAttribute('aria-label', language === 'zh' ? '关闭' : 'Close'));
  document.querySelectorAll<HTMLElement>('[data-ui]').forEach(element => { const translation = translations[element.dataset.ui!]; if (translation) element.textContent = translation[language === 'zh' ? 0 : 1]; });
  $('#language').innerHTML = language === 'zh' ? '中 <span>/</span> EN' : 'ZH <span>/</span> 英'; $('#language').setAttribute('aria-label', language === 'zh' ? 'Switch to English' : '切换中文');
  $('#opening-note').innerHTML = language === 'zh' ? '<span class="note-index">00 / 时局</span><p>一个人出现以前，<br/>时代已经开始。</p><span>BEFORE A LIFE, AN AGE.</span>' : '<span class="note-index">00 / THE AGE</span><p>Before a life begins,<br/>an age is already moving.</p><span>1866 — 1925</span>';
  updateAudioButtons(); buildChapterList(); lastChapter = -1; lastCaption = ''; updateFrame(state); if (activeDrawer?.id === 'archive-drawer') renderArchive();
  if (activeDrawer?.id === 'constitution-dialog') renderConstitution();
}

function updateFrame(nextState: FrameState): void {
  state = nextState;
  const chapter = CHAPTERS[state.chapterIndex];
  if (lastChapter !== state.chapterIndex) {
    lastChapter = state.chapterIndex; $('.chapter-world').textContent = `${String(chapter.index).padStart(2, '0')} / ${chapter.id.toUpperCase().replace(/-/g, ' ')}`;
    $('#chapter-heading h2').textContent = language === 'zh' ? chapter.titleZh : chapter.titleEn;
    $('.chapter-year').textContent = chapter.year; $('.chapter-location').textContent = language === 'zh' ? chapter.locationZh : chapter.locationEn;
    $('#chapter-number').textContent = String(chapter.index).padStart(2, '0'); $('#chapter-name').textContent = language === 'zh' ? chapter.titleZh : chapter.titleEn;
    app.classList.toggle('light-chapter', chapter.theme === 'light' && state.chapterIndex !== 15 || state.chapterIndex === 15 && state.progress > 0.86); updateSelectedChapter();
    if (entered) gsap.fromTo('#chapter-heading h2, .chapter-year, .chapter-location', { opacity: 0, y: 10 }, { opacity: 1, y: 0, stagger: 0.08, duration: reducedMotion ? 0 : 0.5 });
  }
  app.classList.toggle('light-chapter', chapter.theme === 'light' && state.chapterIndex !== 15 || state.chapterIndex === 15 && state.progress > 0.86 && state.progress < 0.995);
  app.classList.toggle('finale', state.chapterIndex === 15);
  app.classList.toggle('mirror-phase', state.chapterIndex === 15 && state.progress > 0.48 && state.progress < 0.86);
  app.classList.toggle('closing-white', state.chapterIndex === 15 && state.progress > 0.86 && state.progress < 0.995);
  $('#constitution-read').hidden = !entered || state.chapterIndex !== 9;
  const local = state.time - chapter.start, caption = chapter.captions.find(line => local >= line.at && local < line.end);
  const captionKey = caption ? caption.zh + language : '';
  if (captionKey !== lastCaption) {
    lastCaption = captionKey; $('.caption-zh').textContent = caption?.zh ?? ''; $('.caption-en').textContent = caption?.en ?? ''; $('#captions').classList.toggle('has-caption', !!caption);
    if (caption && entered) gsap.fromTo('#captions p', { opacity: 0, y: 6 }, { opacity: 1, y: 0, stagger: 0.08, duration: reducedMotion ? 0 : 0.5 });
  }
  if (document.activeElement !== $('#timeline')) $<HTMLInputElement>('#timeline').value = String(state.time);
  $('#timeline').style.setProperty('--progress', `${state.time / FILM_DURATION * 100}%`); $('#timeline').setAttribute('aria-valuetext', `${timecode(state.time)} / 04:00`);
  $('#time-current').textContent = timecode(state.time); $('#play').innerHTML = icon(state.playing ? 'pause' : state.ended ? 'replay' : 'play');
  $('#play').setAttribute('aria-label', language === 'zh' ? state.playing ? '暂停' : state.ended ? '重新播放' : '播放' : state.playing ? 'Pause' : state.ended ? 'Replay' : 'Play');
  $('#end-note').hidden = !state.ended; if (state.ended) app.classList.add('ended'); else app.classList.remove('ended');
  audio?.update(state.time, chapter.id, state.playing);
}

function fallback(message: string): void { $('#fallback-message').textContent = message; $('#fallback').hidden = !message; app.classList.toggle('has-fallback', !!message); }

try {
  audio = new AudioDirector();
  engine = new FilmEngine($('#stage'), { onFrame: updateFrame, onError: fallback, reducedMotion });
} catch (error) {
  fallback(language === 'zh' ? `此设备的图形上下文暂不可用。请开启浏览器硬件加速，或重新载入。您也可以阅读本作的全部史料。${error instanceof Error ? `（${error.message}）` : ''}` : 'The graphics context is unavailable. Enable hardware acceleration or reload. All historical sources remain accessible.');
}

void fetch(BASE + 'content/timeline.json').then(response => { if (!response.ok) throw new Error('sources unavailable'); return response.json() as Promise<Fact[] | { events: Fact[] }>; }).then(data => { facts = Array.isArray(data) ? data : data.events; if (activeDrawer?.id === 'archive-drawer') renderArchive(); }).catch(() => { factsLoadFailed = true; if (activeDrawer?.id === 'archive-drawer') renderArchive(); });

$('#enter').addEventListener('click', () => enter(true)); $('#cinematic').addEventListener('click', () => { if (engine) engine.seek(0); enter(true); });
$('#play').addEventListener('click', () => { if (!entered) enter(true); else engine?.toggle(); });
$('#previous').addEventListener('click', () => jump(CHAPTERS[Math.max(0, state.chapterIndex - 1)].start));
$('#next').addEventListener('click', () => jump(CHAPTERS[Math.min(15, state.chapterIndex + 1)].start));
$('#home').addEventListener('click', () => { closeDrawer(false); gsap.killTweensOf('#cover, #opening-note'); engine?.pause(); engine?.seek(0); audio?.seek(0); entered = false; app.classList.remove('entered'); $('#cover').hidden = false; $('#opening-note').hidden = false; $('#cover').removeAttribute('aria-hidden'); $('#enter').removeAttribute('tabindex'); $('#cinematic').removeAttribute('tabindex'); gsap.set('#cover, #opening-note', { opacity: 1 }); history.replaceState(null, '', location.pathname); });
$('#sound').addEventListener('click', () => { if (audio?.enabled) { audio.setEnabled(false); updateAudioButtons(); } else void soundOn(); });
$('#narration').addEventListener('click', () => { audio?.setNarration(!audio.narration); updateAudioButtons(); });
$('#language').addEventListener('click', () => setLanguage(language === 'zh' ? 'en' : 'zh'));
$('#chapters-open').addEventListener('click', event => openDrawer('chapter', event.currentTarget as HTMLElement));
$('#current-chapter').addEventListener('click', event => openDrawer('chapter', event.currentTarget as HTMLElement));
$('#archive-open').addEventListener('click', event => openDrawer('archive', event.currentTarget as HTMLElement));
$('#constitution-read').addEventListener('click', event => openDrawer('constitution', event.currentTarget as HTMLElement));
$('#constitution-return').addEventListener('click', () => closeDrawer());
$('#fallback-archive').addEventListener('click', event => openDrawer('archive', event.currentTarget as HTMLElement));
$('#retry').addEventListener('click', () => location.reload()); $('#replay').addEventListener('click', () => { engine?.seek(0); audio?.seek(0); enter(true); });
$('.drawer-backdrop').addEventListener('click', () => closeDrawer());
document.querySelectorAll('.drawer-close').forEach(button => button.addEventListener('click', () => closeDrawer()));
document.querySelectorAll<HTMLDialogElement>('dialog').forEach(dialog => {
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeDrawer(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeDrawer(); } });
});

let wasPlayingBeforeSeek = false;
$('#timeline').addEventListener('pointerdown', () => { wasPlayingBeforeSeek = engine?.playing ?? false; engine?.pause(); });
$('#timeline').addEventListener('input', event => { enter(false, false); const time = Number((event.target as HTMLInputElement).value); engine?.seek(time); audio?.seek(time); });
$('#timeline').addEventListener('change', () => { if (wasPlayingBeforeSeek) engine?.play(); wasPlayingBeforeSeek = false; });
document.addEventListener('keydown', event => {
  if (activeDrawer) return;
  const tag = (event.target as HTMLElement)?.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.code === 'Space' && tag !== 'BUTTON') { event.preventDefault(); if (!entered) enter(true); else engine?.toggle(); }
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); jump(CHAPTERS[Math.min(15, state.chapterIndex + 1)].start); }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); jump(CHAPTERS[Math.max(0, state.chapterIndex - 1)].start); }
});

let lastWheel = 0;
document.addEventListener('wheel', event => {
  if (activeDrawer || !engine) return; event.preventDefault(); const now = performance.now(); if (now - lastWheel < 45) return; lastWheel = now;
  enter(false, false); const delta = event.deltaMode === 1 ? event.deltaY * 18 : event.deltaY; engine.seek(engine.currentTime + clamp(delta / 55, -3.5, 3.5)); audio?.seek(engine.currentTime);
}, { passive: false });
let gesture: { x: number; y: number; time: number; pointer: number } | undefined;
$('#stage').addEventListener('pointerdown', event => { gesture = { x: event.clientX, y: event.clientY, time: engine?.currentTime ?? 0, pointer: event.pointerId }; $('#stage').setPointerCapture(event.pointerId); });
$('#stage').addEventListener('pointermove', event => {
  engine?.point(event.clientX / innerWidth * 2 - 1, -(event.clientY / innerHeight * 2 - 1));
  if (gesture && Math.abs(event.clientX - gesture.x) + Math.abs(event.clientY - gesture.y) > 12) {
    enter(false, false); const distance = (gesture.x - event.clientX) + (gesture.y - event.clientY) * 0.75; engine?.seek(gesture.time + distance / innerWidth * 50);
  }
});
$('#stage').addEventListener('pointerup', event => {
  const tapped = gesture && Math.abs(event.clientX - gesture.x) + Math.abs(event.clientY - gesture.y) < 12;
  gesture = undefined; audio?.seek(engine?.currentTime ?? 0);
  if (tapped && engine?.hitDocument(event.clientX, event.clientY)) openDrawer('constitution', $('#constitution-read'));
});
$('#stage').addEventListener('pointercancel', () => { gesture = undefined; });
document.addEventListener('pointermove', event => { if (!gesture && !activeDrawer) engine?.point(event.clientX / innerWidth * 2 - 1, -(event.clientY / innerHeight * 2 - 1)); });

setLanguage(language);
if (engine) {
  const chapter = CHAPTERS.find(chapter => chapter.id === query.get('chapter'));
  const t = query.has('t') ? Number(query.get('t')) : chapter?.start;
  if (t !== undefined && Number.isFinite(t)) { entered = true; app.classList.add('entered'); $('#cover').hidden = true; $('#opening-note').hidden = true; engine.seek(t); }
  if (query.get('cinematic') === 'true') enter(true, false);
}
let pageWasPlaying = false;
window.addEventListener('pagehide', event => {
  clearTimeout(hintTimer);
  $('#sound-hint').classList.remove('is-visible');
  if (event.persisted) {
    pageWasPlaying = engine?.playing || state.playing;
    engine?.pause();
    audio?.update(state.time, CHAPTERS[state.chapterIndex].id, false);
    return;
  }
  engine?.dispose(); audio?.dispose();
});
window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  if (pageWasPlaying && !document.hidden && !activeDrawer) engine?.play();
  pageWasPlaying = false;
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio?.update(state.time, CHAPTERS[state.chapterIndex].id, false);
});

declare global { interface Window { __TIANXIA__: { seek: (time: number) => void; play: () => void; pause: () => void; stats: () => ReturnType<FilmEngine['stats']> | undefined; state: () => FrameState; chapters: typeof CHAPTERS } } }
window.__TIANXIA__ = { seek: jump, play: () => enter(true, false), pause: () => engine?.pause(), stats: () => engine?.stats(), state: () => state, chapters: CHAPTERS };
