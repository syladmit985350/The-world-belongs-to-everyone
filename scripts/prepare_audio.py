"""Generate local Chinese narration; normal application use needs no TTS service.

Optional regeneration: pip install edge-tts mutagen
python scripts/prepare_audio.py [--proxy http://127.0.0.1:PORT]
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
from pathlib import Path

import edge_tts
from mutagen.mp3 import MP3

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'assets' / 'audio'
VOICE = 'zh-CN-YunxiNeural'

async def synthesize(cue: tuple, proxy: str | None, sem: asyncio.Semaphore) -> dict:
    clip_id, start, end, text, english = cue
    limit = float(end) - float(start)
    target = OUT / f'{clip_id}.mp3'
    async with sem:
        rate = 0
        for attempt in range(3):
            if target.exists() and target.stat().st_size > 1000:
                duration = MP3(target).info.length
                if duration <= limit + 0.1:
                    break
                rate = max(rate + 8, round((duration / (limit - 0.15) - 1) * 100))
            voice = edge_tts.Communicate(text, VOICE, rate=f'+{rate}%', pitch='-8Hz', proxy=proxy,
                                         connect_timeout=15, receive_timeout=40)
            temporary = target.with_suffix('.pending.mp3')
            await voice.save(str(temporary))
            duration = MP3(temporary).info.length
            temporary.replace(target)
            if duration <= limit + 0.1:
                break
            rate = max(rate + 8, round((duration / (limit - 0.15) - 1) * 100))
        duration = MP3(target).info.length
        if duration > limit + 0.15:
            raise RuntimeError(f'{clip_id}: {duration:.2f}s exceeds cue window {limit:.2f}s')
        print(f'Ready: {clip_id} · {duration:.2f}s / {limit:.2f}s', flush=True)
        return {'id': clip_id, 'file': f'/assets/audio/{clip_id}.mp3', 'zh': text, 'en': english,
                'duration': round(duration, 3), 'window': limit, 'voice': VOICE,
                'type': 'synthesized Chinese narrator, not a historical recording', 'textAuthor': 'Original artwork narration, except identified testament excerpts'}

async def main(proxy: str | None) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    script = (ROOT / 'src' / 'content' / 'chapters.ts').read_text(encoding='utf-8')
    cues = re.findall(r"line\('([^']+)',\s*([\d.]+),\s*([\d.]+),\s*'([^']*)',\s*'([^']*)'\)", script)
    sem = asyncio.Semaphore(3)
    results = await asyncio.gather(*(synthesize(c, proxy, sem) for c in cues), return_exceptions=True)
    failures = [str(r) for r in results if isinstance(r, Exception)]
    records = [r for r in results if isinstance(r, dict)]
    (OUT / 'narration.json').write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if failures:
        raise SystemExit('\n'.join(failures))
    print(f'Complete: {len(records)} local narration clips.', flush=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--proxy')
    asyncio.run(main(parser.parse_args().proxy))
