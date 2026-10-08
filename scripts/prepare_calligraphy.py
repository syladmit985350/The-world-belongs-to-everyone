"""Derive alpha, signed-distance texture and ink samples from the real inscription.

This is deterministic segmentation, not AI reconstruction. The original is kept.
The four vertical original characters are re-arranged into a disclosed modern
horizontal composition; no character strokes are invented or replaced by a font.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / 'public' / 'assets' / 'archive'

def main() -> None:
    source = Image.open(ARCHIVE / 'tianxia-original.png').convert('RGBA')
    # Original dimensions 992 × 1686. Signature on left is not part of the four glyphs.
    boxes = [(430, 80, 795, 445), (440, 470, 770, 825), (425, 845, 825, 1275), (440, 1320, 805, 1615)]
    glyphs = ['天', '下', '為', '公']
    mask = Image.new('RGBA', (1680, 440), (0, 0, 0, 0))
    glyph_records = []
    for i, (glyph, box) in enumerate(zip(glyphs, boxes)):
        crop = source.crop(box)
        alpha = crop.getchannel('A')
        # Actual image has an existing transparency mask. Discard small low-alpha dust only.
        alpha = alpha.point(lambda v: v if v >= 48 else 0)
        bounds = alpha.getbbox()
        if bounds is None:
            raise RuntimeError(f'No archived ink in the {glyph} selection')
        crop.putalpha(alpha)
        crop = crop.crop(bounds)
        crop.thumbnail((360, 365), Image.Resampling.LANCZOS)
        x = i * 420 + (420 - crop.width) // 2
        y = (440 - crop.height) // 2
        # Ink remains black; the alpha is the original photographed stroke shape.
        black = Image.new('RGBA', crop.size, (0, 0, 0, 255))
        black.putalpha(crop.getchannel('A'))
        mask.alpha_composite(black, (x, y))
        glyph_records.append({'character': glyph, 'sourceCrop': list(box), 'targetPosition': [x, y]})
    mask.save(ARCHIVE / 'tianxia-mask.png', optimize=True)
    alpha = np.asarray(mask.getchannel('A')) / 255.0
    ink = alpha > 0.25
    signed = distance_transform_edt(ink) - distance_transform_edt(~ink)
    field = np.clip(0.5 + signed / 48.0, 0, 1)
    Image.fromarray((field * 255).astype(np.uint8)).save(ARCHIVE / 'tianxia-sdf.png', optimize=True)
    ys, xs = np.nonzero(alpha > 0.2)
    rng = np.random.default_rng(1866)
    selected = rng.choice(len(xs), size=80000, replace=len(xs) < 80000)
    points = [[round(float((xs[i] + rng.random()) / mask.width), 5),
               round(float((ys[i] + rng.random()) / mask.height), 5),
               round(float(alpha[ys[i], xs[i]]), 3)] for i in selected]
    particle_data = {'width': mask.width, 'height': mask.height,
                     'coordinateSystem': 'normalised x rightwards, y downwards; origin top left',
                     'source': 'TianXiaWeiGong.png', 'points': points}
    (ARCHIVE / 'tianxia-particles.json').write_text(json.dumps(particle_data, separators=(',', ':')), encoding='utf-8')
    (ARCHIVE / 'calligraphy-processing.json').write_text(json.dumps({
        'source': 'tianxia-original.png', 'method': 'original alpha segmentation; remove low-alpha dust; four-glyph horizontal rearrangement; Euclidean signed distance; seeded weighted stroke sampling',
        'glyphs': glyph_records, 'samples': len(points), 'sdfRangePixels': 24, 'seed': 1866,
        'derivative': True, 'generatedHistoricalImage': False,
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    # A white backing is useful to inspect the extracted stroke contours.
    preview = Image.new('RGBA', mask.size, (242, 238, 226, 255))
    preview.alpha_composite(mask)
    preview.convert('RGB').save(ARCHIVE / 'tianxia-inspection.jpg', quality=92)
    print(f'Ready: four original glyphs, {len(points):,} sampled ink points, alpha and SDF', flush=True)

if __name__ == '__main__':
    main()
