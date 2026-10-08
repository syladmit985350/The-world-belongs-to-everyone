"""Package dist with portable forward-slash ZIP names for any static host."""
from __future__ import annotations

import hashlib
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = (ROOT / 'dist').resolve(strict=True)
TARGET = ROOT / 'artifacts' / 'tianxia-weigong-static.zip'
if not DIST.is_relative_to(ROOT) or not TARGET.resolve().is_relative_to(ROOT):
    raise RuntimeError('The package paths must stay inside the project')
TARGET.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(TARGET, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for file in sorted(DIST.rglob('*')):
        if file.is_file():
            archive.write(file, arcname=file.relative_to(DIST).as_posix())
with zipfile.ZipFile(TARGET) as archive:
    if archive.testzip() is not None:
        raise RuntimeError('A release ZIP entry failed its CRC check')
    names = archive.namelist()
    if any('\\' in name for name in names):
        raise RuntimeError('Non-portable ZIP paths')
    for required in ['index.html', 'ATTRIBUTION.md', 'THIRD_PARTY_NOTICES.txt',
                     'assets/archive/tianxia-original.png', 'assets/audio/00-era.mp3',
                     'assets/licenses/THREE-LICENSE.txt']:
        if required not in names:
            raise RuntimeError(f'Missing release file: {required}')
report = {'file': TARGET.name, 'bytes': TARGET.stat().st_size, 'files': len(names),
          'sha256': hashlib.sha256(TARGET.read_bytes()).hexdigest(),
          'portablePaths': True, 'crcCheck': 'passed'}
(TARGET.parent / 'release.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, indent=2))
