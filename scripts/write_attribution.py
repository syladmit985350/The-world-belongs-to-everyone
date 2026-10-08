"""Render the reviewed archive ledger into readable local and published credits."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
records = json.loads((ROOT / 'public/assets/archive/metadata.json').read_text(encoding='utf-8'))
lines = ['# 素材授权与史料出处 / Attribution', '',
         '《为革命 · 天下为公》将真实史料与原创的抽象空间、镜头和声音结合。所有历史图像均从下列档案记录下载；没有使用生成图像冒充历史照片。资源在运行时从本项目本地读取。', '',
         '许可按各档案项目的具体权利声明记录。`metadata.json` 保留文件散列、下载日期、尺寸及原始出处；本表不把“在线可查看”解释为使用许可。', '']
for asset in records:
    lines.extend([f"## {asset['titleZh']} / {asset['titleEn']}", '',
                  f"- Title: {asset['titleEn']}", f"- Year: {asset['year']}",
                  f"- Description: {asset['descriptionZh']} / {asset['descriptionEn']}",
                  '- Person/Event: Sun Yat-sen / late Qing and early republic, as described above',
                  f"- Archive: {asset['archive']}", f"- Creator: {asset['creator']}",
                  f"- Original URL: [{asset['archive']} item record]({asset['sourceUrl']})",
                  f"- License: {asset['license']}", f"- Public Domain status / Rights advisory: {asset['publicDomainStatus']}",
                  f"- Downloaded date (UTC): {asset['downloadedDate']}", f"- Local file: `{asset['file']}`",
                  f"- SHA-256: `{asset['sha256']}`", '',
                  'Derivative use: resized/compressed for local textures where appropriate; photographs retain their historical content. The darkroom development effect is a GLSL rendering effect, not retouching presented as an original photograph.', ''])
lines.extend(['## 书法的计算衍生 / Calligraphy derivatives', '',
              '`tianxia-original.png` 保留1924年手迹原图。原件的四个字以一列竖书，旁有孙文落款。`tianxia-mask.png` 仅从真实笔画提取透明度，并把四字重排为现代从左到右的横向构图；它是明确标注的艺术衍生，并不是另一件历史原作。', '',
              '`tianxia-sdf.png` 为同一蒙版的有符号距离场；`tianxia-particles.json` 保存80,000个实际墨迹采样点（随机种子1866）。`calligraphy-processing.json` 记录裁切坐标与方法。`tianxia-inspection.jpg` 是检查用白底预览。以上资源继承原件的公共领域状态。', '',
              '再生成脚本：`scripts/prepare_calligraphy.py`。分割、采样和距离场均为确定性计算，不生成或补画历史笔迹。', '',
              '## 自然地理 / Physical geography', '',
              '- Title: Natural Earth 1:110m Coastline, version 4.1.0',
              '- Description: 真实海岸线GeoJSON，展示活动网络所跨越的自然地理；不将现代政治边界冒充晚清边界。',
              '- Archive/Creator: Natural Earth contributors; Nathaniel Vaughn Kelso and Tom Patterson',
              '- Original URL: [Natural Earth GeoJSON repository](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_coastline.geojson)',
              '- License/Public Domain status: [Natural Earth public-domain terms](https://www.naturalearthdata.com/about/terms-of-use/)',
              '- Downloaded date: 2026-10-07',
              '- Local file: `/assets/archive/world-coastline.geojson`', '',
              '## 字体 / Fonts', '',
              '- Noto Serif SC: [Google Fonts repository](https://github.com/google/fonts/tree/main/ofl/notoserifsc), SIL Open Font License 1.1. Local WOFF2 is a character subset; outlines are unchanged. License: `/assets/fonts/noto-serif-sc-OFL.txt`.',
              '- Cormorant Garamond: [Google Fonts repository](https://github.com/google/fonts/tree/main/ofl/cormorantgaramond), SIL Open Font License 1.1. Local WOFF2 subset; license: `/assets/fonts/cormorant-garamond-OFL.txt`.',
              '- Downloaded date: 2026-10-08. Fonts run locally; no Google Fonts request is made by the artwork.', '',
              '## 声音与旁白 / Sound and narration', '',
              '环境声由本作品的Web Audio程序生成，包括海浪、风、脉搏、电报、印刷、纸张、钟表与车轮等艺术性声音设计。没有引用商业歌曲或未经授权的音效录音。', '',
              '29段中文旁白是为本作品撰写的叙述，由 `zh-CN-YunxiNeural` 合成并预先保存为本地MP3。它是当代合成叙述者，不是孙中山原声、声音克隆或历史录音。每段的文本、时长与对应窗口见 `/assets/audio/narration.json`。普通运行不连接语音服务；可选再生成脚本使用 [edge-tts](https://github.com/rany2/edge-tts)。', '',
              '遗嘱中的两处短句是历史节选，简体转写；其余诗性旁白均不是孙中山引语。', '',
              '## 运行时代码库 / Runtime libraries', '',
              '发布包中的Three.js与GSAP保留其发行版版权与许可说明，见 [THIRD_PARTY_NOTICES.txt](./THIRD_PARTY_NOTICES.txt)。完整Three.js MIT许可与GSAP原始发行说明保存在 `assets/licenses/`。字体的OFL许可另存于 `assets/fonts/`。', '',
              '## 史实参考 / Historical references', '',
              '各节点的具体证据链接见 `content/timeline.json`（发布副本为 `/content/timeline.json`）。关键年份以纪念馆年表、大学档案、历史研究机构及原始文献交叉核对。', '',
              '- [孙中山故居纪念馆：生平介绍](https://www.sunyat-sen.org/portal/list/index.html?id=16)',
              '- [孙中山故居纪念馆：大事年表](https://www.sunyat-sen.org/portal/list/index.html?id=18)',
              '- [国立国父纪念馆：国父大事年表](https://sunology.yatsen.gov.tw/legend/)',
              '- [香港大学医学院：Our Milestones](https://135-med.hku.hk/milestones)',
              '- [香港大学图书馆：孙中山在香港](https://www.lib.hku.hk/syshk/A.html)',
              '- [美国国务院历史办公室：The Chinese Revolution of 1911](https://history.state.gov/milestones/1899-1913/chinese-rev)',
              '- [《临时政府公报》35号：1912年3月11日《临时约法》](https://sunology.yatsen.gov.tw/detail/793b953d3a86b2f829a5d6959c0aa861/)',
              '- [《国父全集》9册637页：遗嘱—壹](https://sunology.yatsen.gov.tw/detail/b8b520e17c5af94b8f88cfc919eeb539/)', '',
              '博物馆与学术网站在这里作为史实参考；没有因其网站可浏览而复制其未开放授权的展览图片或界面。早期带时代局限与排他性的政治措辞没有脱离背景用作当代宣传语。', '',
              '## 未纳入发布的材料', '',
              '工作区原有的两张长文件名JFIF保留原位，未复制到 `public` 或最终构建，因其来源和授权无法从文件本身确认。曾检索到名称称“1905年8月20日同盟会成立”的Commons文件，其档案正文实际写1913年留日学生欢迎会，未作为1905年成立大会影像使用。', ''])
document = '\n'.join(lines)
(ROOT / 'ATTRIBUTION.md').write_text(document, encoding='utf-8')
(ROOT / 'public' / 'ATTRIBUTION.md').write_text(document, encoding='utf-8')
print('Written: ATTRIBUTION.md and its published copy.', flush=True)
