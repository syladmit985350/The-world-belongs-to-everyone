"""Fetch reviewed public-domain archive files and retain a provenance ledger.

Run: python scripts/prepare_archive.py [--proxy http://127.0.0.1:PORT]
The proxy argument is optional, never saved. Existing files are validated and reused.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'assets' / 'archive'

ASSETS = [
    dict(id='east-asia', titleZh='1892年中国与朝鲜地图', titleEn='Map of China and Korea, 1892', year='1892',
         commons='1892 map of China and Korea by the Imperial Japanese Army.jpg', file='east-asia-1892.jpg',
         creator='Imperial Japanese Army General Staff Office (Sanbō-honbu)', license='Public domain · PD-old-70-expired',
         descriptionZh='十九世纪地图；用于晚清记忆空间，不作为1866年边界复原。', descriptionEn='A nineteenth-century map, evoking late-Qing geography; not a reconstruction of the borders of 1866.', width=1920),
    dict(id='calligraphy', titleZh='孙文「天下為公」手迹', titleEn='Sun Wen: All under heaven is for the public', year='1924',
         commons='TianXiaWeiGong.png', file='tianxia-original.png', creator='Sun Yat-sen (1866–1925)',
         license='Public domain · PD-art / PD-old-auto / PD-1996',
         descriptionZh='原件四字竖书，左侧为孙文署名；终章墨粒直接由原图笔画提取。', descriptionEn='Four vertically arranged characters with Sun Wen’s signature on the left; its strokes supply the final ink particles.'),
    dict(id='calligraphy-horizontal', titleZh='孙文「天下為公」横幅', titleEn='Horizontal inscription by Sun Wen', year='before 1925',
         commons='Calligraphy Sun Yat-Sen 3.jpg', file='tianxia-horizontal.jpg', creator='Sun Yat-sen (1866–1925)',
         license='Public domain · PD-art / PD-China / PD-1996',
         descriptionZh='来自故宫文献的二维书法复制品，原件从右至左。', descriptionEn='A faithful two-dimensional reproduction credited to the National Palace Museum, originally read right to left.'),
    dict(id='portrait', titleZh='孙中山坐于合影中的近景', titleEn='Dr. Sun Yat Sen, close of him seated in group', year='date unrecorded; before 1925',
         file='sun-portrait.jpg', creator='Bain News Service', license='No known restrictions on publication · Library of Congress Bain Collection',
         sourceUrl='https://www.loc.gov/item/2014686338/',
         url='https://cdn.loc.gov/service/pnp/ggbain/06300/06346v.jpg',
         descriptionZh='美国国会图书馆Bain玻璃底片；档案未记具体拍摄日，不擅自标年。', descriptionEn='A Bain glass-negative photograph at the Library of Congress. The caption card does not record a precise date.'),
    dict(id='tongmenghui', titleZh='孙中山与马君武合影', titleEn='Sun Yat-sen and Ma Junwu', year='1905',
         commons='1905年孙中山在日本与同盟会书记马君武合影.jpg', file='tongmenghui.jpg', creator='Unknown photographer',
         license='Public domain · PD-China-expired / PD-US-expired',
         descriptionZh='1905年日本；不是同盟会成立大会现场的照片。', descriptionEn='Japan, 1905. This is not a photograph of the founding meeting.'),
    dict(id='president', titleZh='临时大总统孙中山在南京', titleEn='Provisional President Sun in Nanjing', year='January 1912',
         commons='1912年1月临时大总统孙中山在南京总统府内的照片.jpg', file='sun-provisional-president.jpg', creator='Unknown photographer',
         license='Public domain · PD-China-expired / PD-US-expired',
         descriptionZh='1912年1月，南京总统府内。', descriptionEn='Inside the Presidential Office, Nanjing, January 1912.'),
    dict(id='nanjing', titleZh='南京临时政府第一次国务会议', titleEn='First cabinet meeting of the provisional government', year='5 January 1912',
         commons='Nanjinglinshizhengfu.jpg', file='nanjing-government.jpg', creator='Unknown photographer',
         license='Public domain · PD-China',
         descriptionZh='孙中山与南京临时政府成员；文件注明1912年1月5日。', descriptionEn='Sun and members of the Nanjing government; the archive records 5 January 1912.'),
    dict(id='whampoa', titleZh='黄埔军校开学典礼后的合影', titleEn='After the opening of Whampoa Military Academy', year='16 June 1924',
         commons='Sun Yat-sen, He Yingqin, Chiang Kai-shek & Wang Bo-ling at the Whampoa Military Academy, June 1924.jpg', file='whampoa.jpg', creator='Unknown photographer',
         license='Public domain · PD-China',
         descriptionZh='孙中山与何应钦、蒋介石、王柏龄合影。', descriptionEn='Sun pictured with He Yingqin, Chiang Kai-shek and Wang Boling.'),
]

def commons_url(name: str, width: int | None = None) -> str:
    canonical = name.replace(' ', '_')
    digest = hashlib.md5(canonical.encode('utf-8')).hexdigest()
    suffix = f'{digest[0]}/{digest[:2]}/{quote(canonical, safe="")}'
    if width:
        return f'https://upload.wikimedia.org/wikipedia/commons/thumb/{suffix}/{width}px-{quote(canonical, safe="")}'
    return f'https://upload.wikimedia.org/wikipedia/commons/{suffix}'

def fetch(asset: dict, proxies: dict | None) -> dict:
    target = OUT / asset['file']
    record = {k: v for k, v in asset.items() if k not in ('commons', 'url', 'width')}
    record['file'] = '/assets/archive/' + asset['file']
    if 'commons' in asset:
        record['sourceUrl'] = 'https://commons.wikimedia.org/wiki/File:' + quote(asset['commons'].replace(' ', '_'), safe='')
    record['downloadUrl'] = asset.get('url') or commons_url(asset['commons'], asset.get('width'))
    record['archive'] = 'Wikimedia Commons' if 'commons' in asset else 'Library of Congress · Bain News Service collection'
    record['reviewedLicense'] = True
    record['licenseEvidenceUrl'] = record['sourceUrl']
    record['downloadedDate'] = datetime.now(timezone.utc).date().isoformat()
    record['publicDomainStatus'] = asset['license']
    ledger = OUT / 'metadata.json'
    if target.exists() and ledger.exists():
        previous = next((r for r in json.loads(ledger.read_text(encoding='utf-8')) if r['id'] == asset['id']), None)
        if previous:
            record['downloadedDate'] = previous['downloadedDate']
            record['downloadUrl'] = previous['downloadUrl']
    if not target.exists():
        response = requests.get(record['downloadUrl'], proxies=proxies, timeout=(15, 60),
                                headers={'User-Agent': 'TianxiaArchiveArtwork/1.0 (educational archive attribution)'})
        if response.status_code == 429 and 'commons' in asset:
            candidates = [commons_url(asset['commons'], w) for w in (960, 500, 330)]
            candidates += [u.replace('upload.wikimedia.org', 'thumb.wikimedia.org') for u in candidates]
            for alternative in candidates:
                response = requests.get(alternative, proxies=proxies, timeout=(10, 25),
                                        headers={'User-Agent': 'Mozilla/5.0 (compatible; TianxiaArchive/1.0)'})
                if response.ok:
                    record['downloadUrl'] = alternative
                    break
        response.raise_for_status()
        raw = response.content
        image = Image.open(io.BytesIO(raw))
        image.load()
        if asset['file'].endswith('.jpg'):
            image = image.convert('RGB')
            image.thumbnail((1920, 1920), Image.Resampling.LANCZOS)
            image.save(target, quality=89, optimize=True)
        else:
            image.save(target, optimize=True)
    with Image.open(target) as image:
        record['dimensions'] = list(image.size)
    record['sha256'] = hashlib.sha256(target.read_bytes()).hexdigest()
    print(f"Ready: {asset['file']} ({target.stat().st_size:,} bytes)", flush=True)
    return record

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--proxy')
    args = parser.parse_args()
    proxies = {'http': args.proxy, 'https': args.proxy} if args.proxy else None
    OUT.mkdir(parents=True, exist_ok=True)
    records: list[dict] = []
    failed: list[str] = []
    with ThreadPoolExecutor(max_workers=3) as pool:
        jobs = {pool.submit(fetch, a, proxies): a['file'] for a in ASSETS}
        for job in as_completed(jobs):
            try:
                records.append(job.result())
            except Exception as error:
                failed.append(jobs[job])
                print(f'FAILED: {jobs[job]}: {error}', flush=True)
    by_id = {r['id']: r for r in records}
    records = [by_id[a['id']] for a in ASSETS if a['id'] in by_id]
    previous_path = OUT / 'metadata.json'
    if previous_path.exists():
        previous = json.loads(previous_path.read_text(encoding='utf-8'))
        current_ids = {r['id'] for r in records}
        records.extend(r for r in previous if r['id'] not in current_ids and (ROOT / 'public' / r['file'].lstrip('/')).exists())
    previous_path.write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    archive_dir = ROOT / 'src' / 'archive'
    archive_dir.mkdir(parents=True, exist_ok=True)
    (archive_dir / 'manifest.ts').write_text(
        'export interface ArchiveAsset {\n  id: string; titleZh: string; titleEn: string; year: string; file: string; sourceUrl: string; creator: string; license: string; descriptionZh: string; descriptionEn: string;\n}\n\n'
        + 'export const ARCHIVE: ArchiveAsset[] = ' + json.dumps(
            [{k: r[k] for k in ('id', 'titleZh', 'titleEn', 'year', 'file', 'sourceUrl', 'creator', 'license', 'descriptionZh', 'descriptionEn')} for r in records],
            ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
    if failed:
        raise SystemExit('Missing reviewed archive files: ' + ', '.join(failed))

if __name__ == '__main__':
    main()
