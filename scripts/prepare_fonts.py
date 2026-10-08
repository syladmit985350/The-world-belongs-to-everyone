"""Bundle OFL fonts as local WOFF2 subsets. No runtime font network requests."""
from __future__ import annotations

import argparse
import io
import re
from pathlib import Path

import requests
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'assets' / 'fonts'

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--proxy')
    args = parser.parse_args()
    proxies = {'http': args.proxy, 'https': args.proxy} if args.proxy else None
    OUT.mkdir(parents=True, exist_ok=True)
    characters = set(chr(i) for i in range(32, 127))
    characters.update('为革命天下为公时局翠亨医者问路兴中会流亡同盟起义风暴共和挫折护法再出发北上未竟重新观看开始进入作品声音开启关闭中文旁白字幕章节史料档案返回目录播放暂停自动观影自由探索低中高画质降低动态历史继续跳过加载阅读出处序章终章选择恢复影像按空格拖动滚动滑动静音取消第幕见证民族民权民生主权国民权利制度法律总统学校港口铁路水利工厂城市海风华侨革命党人地方新军会党知识分子普通人黄兴陆皓东林觉民宋教仁汪精卫孙眉邓荫南广州香港伦敦东京天津上海南京北京檀香山横滨新加坡旧金山日本美国英国海外香山博爱和平统一一二三四五六七八九十宋文现在尚成功努力以求贯彻全体平等临时约法中华民国总统府艺术重构博物馆公共领域原件手迹繁简笔画免登陆体验操作时间全屏退出触屏旅程选择播放器载入对不起网络失败无法恢复重试设置提示革命者与后来人战争停止生命理想世代遗嘱空椅照片黑白声音合成旁白档案说明摄像头镜面太平洋跨越文明书信报纸电报群众未来人民共和国')
    for directory in ('src', 'content'):
        for path in (ROOT / directory).rglob('*'):
            if path.suffix in ('.ts', '.json', '.html', '.css'):
                characters.update(path.read_text(encoding='utf-8'))
    texts = {
        'noto-serif-sc': ('notoserifsc', 'NotoSerifSC[wght].ttf', ''.join(sorted(characters))),
        'cormorant-garamond': ('cormorantgaramond', 'CormorantGaramond[wght].ttf', ''.join(chr(i) for i in range(32, 384)) + '—–’“”·…'),
    }
    for name, (folder, filename, text) in texts.items():
        url = f'https://raw.githubusercontent.com/google/fonts/main/ofl/{folder}/{filename}'
        response = requests.get(url, proxies=proxies, timeout=(15, 90))
        response.raise_for_status()
        font = TTFont(io.BytesIO(response.content))
        options = subset.Options()
        options.flavor = 'woff2'; options.layout_features = ['*']
        worker = subset.Subsetter(options=options)
        worker.populate(text=text)
        worker.subset(font)
        font.flavor = 'woff2'
        dest = OUT / f'{name}.woff2'
        font.save(dest)
        license_response = requests.get(f'https://raw.githubusercontent.com/google/fonts/main/ofl/{folder}/OFL.txt', proxies=proxies, timeout=25)
        license_response.raise_for_status()
        (OUT / f'{name}-OFL.txt').write_text(license_response.text, encoding='utf-8')
        print(f'Ready: {dest.name} ({dest.stat().st_size:,} bytes)', flush=True)
    (OUT / 'NOTICE.txt').write_text('Noto Serif SC and Cormorant Garamond are distributed under the SIL Open Font License 1.1.\nSource: https://github.com/google/fonts/tree/main/ofl/\nFonts are subset without changes to outlines. Included license files apply.\n', encoding='utf-8')

if __name__ == '__main__':
    main()
