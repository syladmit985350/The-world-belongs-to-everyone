import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CHAPTERS, FILM_DURATION } from '../src/content/chapters.ts';
import { ARCHIVE } from '../src/archive/manifest.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const readJson = async relative => JSON.parse(await readFile(path.join(root, relative), 'utf8'));
const timeline = await readJson('content/timeline.json');
assert.deepEqual(await readJson('public/content/timeline.json'), timeline, 'Published fact ledger differs from source');
const ids = new Set(timeline.map(event => event.id));
assert.equal(ids.size, timeline.length, 'Duplicate historical node IDs');
for (const event of timeline) {
  assert.equal(event.verified, true, `Unreviewed historical node: ${event.id}`);
  assert.ok(event.sources.length > 0, `No sources: ${event.id}`);
  for (const source of event.sources) assert.match(source.url, /^https:\/\//, 'Source URLs must be explicit HTTPS archive records');
}
assert.equal(timeline.find(e => e.id === 'birth').date, '1866-11-12');
assert.equal(timeline.find(e => e.id === 'death').date, '1925-03-12');
assert.equal(timeline.find(e => e.id === 'constitution-1912').date, '1912-03-11');
const wuchang = timeline.find(e => e.id === 'wuchang');
assert.match(wuchang.descriptionZh, /身在美国/);
assert.match(wuchang.descriptionEn, /did not command it in person/);
assert.ok(new Set(wuchang.sources.map(s => s.kind)).size >= 2, 'Wuchang needs independent source categories');

const narration = await readJson('public/assets/audio/narration.json');
const voices = new Map(narration.map(cue => [cue.file, cue]));
let end = 0, captionCount = 0;
assert.equal(CHAPTERS.length, 16);
for (const [index, chapter] of CHAPTERS.entries()) {
  assert.equal(chapter.index, index);
  assert.equal(chapter.start, end, `Gap or overlap before ${chapter.id}`);
  end = chapter.start + chapter.duration;
  assert.ok(chapter.titleZh && chapter.titleEn && chapter.detailZh && chapter.detailEn, 'Missing bilingual chapter content');
  for (const factId of chapter.factIds) assert.ok(ids.has(factId), `Broken source association: ${factId}`);
  let previous = 0;
  for (const cue of chapter.captions) {
    assert.ok(cue.at >= previous && cue.end > cue.at && cue.end <= chapter.duration, `Invalid caption interval in ${chapter.id}`);
    previous = cue.end;
    assert.ok(cue.zh && cue.en, 'Missing bilingual caption');
    const recording = voices.get(cue.voice);
    assert.ok(recording, `Narration not generated: ${cue.voice}`);
    assert.ok(recording.duration <= cue.end - cue.at + 0.15, `Narration exceeds its interval: ${cue.voice}`);
    await access(path.join(root, 'public', cue.voice));
    captionCount++;
  }
}
assert.equal(end, FILM_DURATION);
assert.equal(FILM_DURATION, 240);
assert.ok(CHAPTERS.at(-1).captions[0].at >= 10, 'Keep the opening calligraphy contemplation silent');

const records = await readJson('public/assets/archive/metadata.json');
for (const asset of ARCHIVE) {
  assert.ok(asset.sourceUrl && asset.license && asset.creator, `Missing attribution: ${asset.id}`);
  const record = records.find(item => item.id === asset.id);
  assert.ok(record?.reviewedLicense, `No rights review recorded: ${asset.id}`);
  const bytes = await readFile(path.join(root, 'public', asset.file));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256, `Archive checksum differs: ${asset.file}`);
}
const coastline = await readJson('public/assets/archive/world-coastline.geojson');
assert.equal(coastline.type, 'FeatureCollection');
assert.ok(coastline.features.length >= 100);
const ink = await readJson('public/assets/archive/tianxia-particles.json');
assert.ok(ink.points.length >= 60000, 'The actual inscription needs a detailed stroke sample');
for (const point of ink.points) assert.ok(point.length === 3 && point.every(v => Number.isFinite(v) && v >= 0 && v <= 1), 'Malformed ink sample');
for (const file of ['tianxia-original.png', 'tianxia-mask.png', 'tianxia-sdf.png']) await access(path.join(root, 'public/assets/archive', file));
for (const name of ['noto-serif-sc', 'cormorant-garamond']) {
  await access(path.join(root, `public/assets/fonts/${name}.woff2`));
  await access(path.join(root, `public/assets/fonts/${name}-OFL.txt`));
}
console.log(`Verified: ${CHAPTERS.length} continuous worlds / ${FILM_DURATION}s, ${captionCount} local narration cues, ${timeline.length} sourced nodes, ${ARCHIVE.length} attributed archive images, ${ink.points.length.toLocaleString()} authentic ink samples.`);
