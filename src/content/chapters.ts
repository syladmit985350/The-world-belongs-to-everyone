export interface Caption {
  /** Seconds relative to the beginning of this chapter. */
  at: number;
  end: number;
  zh: string;
  en: string;
  voice: string;
}

export interface Chapter {
  id: string;
  index: number;
  titleZh: string;
  titleEn: string;
  year: string;
  locationZh: string;
  locationEn: string;
  start: number;
  duration: number;
  theme: 'dark' | 'light' | 'cold';
  quoteZh: string;
  quoteEn: string;
  detailZh: string;
  detailEn: string;
  factIds: string[];
  captions: Caption[];
}

const line = (id: string, at: number, end: number, zh: string, en: string): Caption => ({
  at, end, zh, en, voice: `/assets/audio/${id}.mp3`,
});

export const FILM_DURATION = 240;

export const CHAPTERS: Chapter[] = [
  {
    id: 'darkness', index: 0, titleZh: '时局', titleEn: 'An age in upheaval',
    year: '1866', locationZh: '晚清 · 中国沿海', locationEn: 'Late Qing · The China coast',
    start: 0, duration: 12, theme: 'dark',
    quoteZh: '一个人出现以前，时代已经开始。', quoteEn: 'Before a life begins, an age is already moving.',
    detailZh: '从十九世纪的海岸、纸张和地图进入历史。开场地图为1892年东亚地图，用来呈现晚清的地理记忆，并非1866年边界复原。声音与建筑是原创的抽象艺术重构。',
    detailEn: 'An archival map, paper and an imagined sea introduce the late Qing. The map dates to 1892; it is not a reconstruction of the borders of 1866. Sound and architecture are original abstract interpretations.',
    factIds: ['birth', 'map-context'],
    captions: [line('00-era', 2, 10.5, '他出生的时候，中国正在进入一个前所未有的时代。', 'He was born as China entered an age of unprecedented upheaval.')],
  },
  {
    id: 'cuiheng', index: 1, titleZh: '翠亨', titleEn: 'A world beyond home',
    year: '1866 — 1883', locationZh: '香山 · 翠亨', locationEn: 'Xiangshan · Cuiheng',
    start: 12, duration: 10, theme: 'dark',
    quoteZh: '世界，本来就只能如此吗？', quoteEn: 'Must the world always remain as it is?',
    detailZh: '孙文于1866年11月12日出生于广东香山县翠亨村。1879年赴檀香山求学，1883年回乡。乡村与海风构成记忆中的空间；人物只以无面孔剪影出现。',
    detailEn: 'Sun Wen was born in Cuiheng, Xiangshan, Guangdong, on 12 November 1866. He studied in Honolulu from 1879 and returned home in 1883. The village is evoked through faceless silhouettes and sea wind.',
    factIds: ['birth', 'honolulu-study'],
    captions: [line('01-world', 1, 7, '世界，本来就只能如此吗？', 'Must the world always remain as it is?')],
  },
  {
    id: 'medicine', index: 2, titleZh: '医者', titleEn: 'From a life to an age',
    year: '1886 — 1892', locationZh: '广州 · 香港 · 澳门', locationEn: 'Guangzhou · Hong Kong · Macao',
    start: 22, duration: 12, theme: 'light',
    quoteZh: '如果病的是一个时代呢？', quoteEn: 'But what if an age itself was ill?',
    detailZh: '1886年在广州博济医院学医，1887年转入香港西医书院，1892年毕业，随后行医。脉搏扩展为地图的艺术转喻，表达由救人到寻求社会改变的选择。',
    detailEn: 'He began medical studies in Guangzhou in 1886, entered the Hong Kong College of Medicine in 1887 and graduated in 1892. A pulse growing into a map is an artistic metaphor for widening responsibility.',
    factIds: ['medicine'],
    captions: [
      line('02-medicine', 1, 4.8, '最初，他选择医学，因为医学可以救人。', 'Medicine could save a life.'),
      line('02-age', 5.5, 11, '可是，如果病的是一个时代呢？', 'But what if an age itself was ill?'),
    ],
  },
  {
    id: 'awakening', index: 3, titleZh: '问路', titleEn: 'Another path',
    year: '1894', locationZh: '天津', locationEn: 'Tianjin',
    start: 34, duration: 13, theme: 'dark',
    quoteZh: '一封信，未能推开旧世界的门。', quoteEn: 'A letter could not open the doors of the old order.',
    detailZh: '1894年孙中山上书李鸿章，提出改革建议，未能获得预期的支持。烧纸是道路受阻的艺术表达，并不意味着历史原件曾被焚毁。',
    detailEn: 'In 1894 Sun petitioned Li Hongzhang for reform, without obtaining the support he sought. Burning paper represents a blocked path; it does not claim that the original petition was destroyed.',
    factIds: ['petition'],
    captions: [line('03-path', 2, 10.5, '当改良的道路受阻，他开始选择另一条道路。', 'When the path of reform was blocked, another path emerged.')],
  },
  {
    id: 'xingzhonghui', index: 4, titleZh: '兴中会', titleEn: 'People, connected',
    year: '1894 — 1895', locationZh: '檀香山 · 香港', locationEn: 'Honolulu · Hong Kong',
    start: 47, duration: 15, theme: 'dark',
    quoteZh: '改变，从人的连接开始。', quoteEn: 'Change begins with people, connected.',
    detailZh: '1894年11月24日兴中会在檀香山成立，1895年在香港设总会。孙眉、邓荫南、杨衢云、陈少白、陆皓东等人的组织与支持，使个人选择成为共同的行动。',
    detailEn: 'The Xingzhonghui was founded in Honolulu on 24 November 1894 and established a Hong Kong headquarters in 1895. Diaspora supporters and fellow organisers transformed an individual choice into collective action.',
    factIds: ['xingzhonghui', 'hongkong-headquarters'],
    captions: [
      line('04-people', 1, 5.5, '革命，首先是一群人的连接。', 'A revolution begins with people, connected.'),
      line('04-believe', 7.5, 14, '他们相信，改变仍然可能发生。', 'They still believed that change was possible.'),
    ],
  },
  {
    id: 'exile', index: 5, titleZh: '流亡', titleEn: 'The distance from home',
    year: '1895 — 1905', locationZh: '香港 · 横滨 · 伦敦 · 南洋', locationEn: 'Hong Kong · Yokohama · London · Southeast Asia',
    start: 62, duration: 16, theme: 'dark',
    quoteZh: '每一次远行，都意味着无法回家。', quoteEn: 'Each departure carries the distance from home.',
    detailZh: '1895年广州起义计划泄露，孙中山流亡海外。1896年在伦敦被清使馆拘禁，康德黎等人的营救与舆论压力促成获释。地图线条表示跨年份的活动网络，并非一趟连续航程。',
    detailEn: 'The failed Guangzhou uprising of 1895 led to exile. In London in 1896 he was detained at the Qing legation and released following intervention by James Cantlie and others. Routes represent a network across years, not one continuous journey.',
    factIds: ['guangzhou-1895', 'london', 'diaspora'],
    captions: [
      line('05-exile', 1, 8, '有些革命，发生在漫长的漂泊之中。', 'Some revolutions are sustained through years of exile.'),
      line('05-letter', 10, 15, '一封传出的信，让被困的空间重新打开。', 'A message carried outwards opened a confined world.'),
    ],
  },
  {
    id: 'tongmenghui', index: 6, titleZh: '同盟会', titleEn: 'Three principles, one horizon',
    year: '1905', locationZh: '东京', locationEn: 'Tokyo',
    start: 78, duration: 16, theme: 'dark',
    quoteZh: '民族。民权。民生。', quoteEn: "Nationalism. Democracy. People's livelihood.",
    detailZh: '1905年8月20日中国同盟会在东京成立，孙中山被推为总理。三民主义在《民报》发刊词中得到集中阐述。三个空间呈现自主、权利与生活的时代诉求；不将当时带有排他性的措辞用作今日口号。',
    detailEn: 'The Tongmenghui was founded in Tokyo on 20 August 1905. The Three Principles were articulated in the inaugural Minbao editorial. Spatial metaphors evoke autonomy, rights and livelihood within their historical context.',
    factIds: ['tongmenghui', 'principles'],
    captions: [
      line('06-alliance', 1, 7, '不同的道路，开始通向一个共同的理想。', 'Different paths began to converge on a shared ideal.'),
      line('06-principles', 9, 15, '民族，民权，民生。国家，也关乎普通人的生活。', 'Nationalism, democracy, livelihood: a country also concerns ordinary lives.'),
    ],
  },
  {
    id: 'uprisings', index: 7, titleZh: '再一次', titleEn: 'What failure leaves behind',
    year: '1907 — 1911', locationZh: '华南 · 黄花岗', locationEn: 'Southern China · Huanghuagang',
    start: 94, duration: 16, theme: 'dark',
    quoteZh: '失败，改变了下一次出发的位置。', quoteEn: 'Each failure changed where the next attempt began.',
    detailZh: '黄冈、七女湖、防城、镇南关、钦廉、河口、广州新军等起义相继受挫。1911年4月27日黄兴率广州起义，死难者后来葬于黄花岗。灯光只对应有记录的事件，不虚构总次数。',
    detailEn: 'Repeated uprisings met setbacks. On 27 April 1911 Huang Xing led the Guangzhou uprising, whose dead were later commemorated at Huanghuagang. Lamps represent documented events rather than an invented count.',
    factIds: ['uprisings', 'huanghuagang'],
    captions: [
      line('07-failure', 1, 8, '失败，没有自动成为成功。但每次失败，都改变了下一次出发的位置。', 'Failure did not automatically become victory. It changed where the next attempt began.'),
      line('07-petals', 10, 14.5, '有些名字，留在了出发的地方。', 'Some names remained where the journey began.'),
    ],
  },
  {
    id: 'revolution1911', index: 8, titleZh: '风暴', titleEn: 'History accelerates',
    year: '10 OCT 1911', locationZh: '武昌 / 孙中山身在美国', locationEn: 'Wuchang / Sun in the United States',
    start: 110, duration: 15, theme: 'dark',
    quoteZh: '历史，由无数人的行动改变。', quoteEn: 'History changes through the actions of many.',
    detailZh: '1911年10月10日武昌起义爆发时，孙中山在美国，并未在武昌现场指挥。湖北新军中的革命组织、地方革命党人及各省响应推动局势。孙中山12月25日抵上海，12月29日当选临时大总统。',
    detailEn: 'When the Wuchang uprising began on 10 October 1911, Sun was in the United States, not commanding it in person. Revolutionary organisations in the Hubei New Army and provincial responses drove events. He reached Shanghai on 25 December and was elected on 29 December.',
    factIds: ['wuchang', 'return', 'election', 'collective-revolution'],
    captions: [
      line('08-overseas', 1, 7, '武昌起义爆发时，他身在海外。消息，越过了大洋。', 'When Wuchang rose, he was overseas. The news crossed an ocean.'),
      line('08-many', 8, 14, '新军，革命党人，华侨与各地民众，共同改变了历史。', 'New Army soldiers, revolutionaries, diaspora communities and local people changed history together.'),
    ],
  },
  {
    id: 'nanjing', index: 9, titleZh: '共和', titleEn: 'What comes after',
    year: '1 JAN 1912', locationZh: '南京', locationEn: 'Nanjing',
    start: 125, duration: 18, theme: 'light',
    quoteZh: '推翻之后，如何建设？', quoteEn: 'After overthrowing an order, how do we build?',
    detailZh: '1912年1月1日南京临时政府成立，孙中山就任临时大总统。3月11日公布《临时约法》，第二条规定主权属于国民全体。南北议和、清帝退位与让位袁世凯交织，4月1日孙中山正式解职。',
    detailEn: 'Sun took office in Nanjing on 1 January 1912. The Provisional Constitution was promulgated on 11 March; Article 2 placed sovereignty in the people. Negotiation, the Qing abdication and transfer to Yuan Shikai intertwined. Sun left office on 1 April.',
    factIds: ['republic', 'constitution-1912', 'resignation'],
    captions: [
      line('09-old-order', 1, 6.5, '革命，可以推倒旧世界。', 'A revolution may overthrow an old order.'),
      line('09-build', 8, 14.5, '共和国必须开始回答，新的世界如何运转。', 'A republic must decide what comes after.'),
      line('09-secure', 15, 17.8, '共和，仍未稳固。', 'The republic was not yet secure.'),
    ],
  },
  {
    id: 'broken-republic', index: 10, titleZh: '裂痕', titleEn: 'A fragile republic',
    year: '1913 — 1916', locationZh: '上海 · 广州 · 日本', locationEn: 'Shanghai · Guangzhou · Japan',
    start: 143, duration: 17, theme: 'cold',
    quoteZh: '历史似乎回到原点。但人没有。', quoteEn: 'History seemed to return to the beginning. He did not.',
    detailZh: '1913年宋教仁在上海遇刺后身亡，议会政治陷入危机；二次革命失败后孙中山再赴日本。1914年组织中华革命党。新制度的困境不能被化约为人物善恶；袁世凯扩张权力与帝制尝试进一步破坏共和秩序。',
    detailEn: 'Song Jiaoren died after being shot in Shanghai in 1913. Parliamentary politics entered crisis and the Second Revolution failed, followed by renewed exile. Sun founded the Chinese Revolutionary Party in 1914. Institutional failure exceeds a simple morality tale.',
    factIds: ['song-jiaoren', 'second-revolution', 'chinese-revolutionary-party', 'yuan-monarchy'],
    captions: [
      line('10-cracks', 1, 7, '一个新生的制度，在裂缝中摇晃。', 'A young institution trembled along its fault lines.'),
      line('10-return', 9, 15.5, '历史似乎回到了原点。但人没有。', 'History seemed to return to the beginning. He did not.'),
    ],
  },
  {
    id: 'constitution', index: 11, titleZh: '护法', titleEn: 'Holding on to a promise',
    year: '1917 — 1923', locationZh: '广州 · 上海', locationEn: 'Guangzhou · Shanghai',
    start: 160, duration: 9, theme: 'cold',
    quoteZh: '要守住的，不只是一个名字。', quoteEn: 'What must endure is more than a name.',
    detailZh: '1917年在广州建立护法军政府。护法涉及恢复《临时约法》和国会合法性，也受地方军事力量与政治联盟的制约。1918年后著述与建设规划描绘铁路、港口、水利和实业的国家蓝图。',
    detailEn: 'The Constitutional Protection government was established in Guangzhou in 1917, amid competing military and political forces. Development writings after 1918 imagined railways, ports, waterworks and industry as part of a future country.',
    factIds: ['constitutional-protection', 'development'],
    captions: [line('11-constitution', 1, 8.5, '他想象的不只是一次革命，还有革命之后的国家。', 'He imagined not only a revolution, but the country that had to follow.')],
  },
  {
    id: 'reorganization', index: 12, titleZh: '再出发', titleEn: 'A wider constellation',
    year: '1924', locationZh: '广州', locationEn: 'Guangzhou',
    start: 169, duration: 9, theme: 'dark',
    quoteZh: '理想，必须找到更多的人。', quoteEn: 'An ideal must find more people.',
    detailZh: '1924年1月中国国民党第一次全国代表大会在广州召开，改组政党。联俄、容纳共产党员以个人身份加入国民党以及扶助农工，是当时的政治选择与组织方向，在此仅按历史语境呈现。',
    detailEn: 'The KMT held its First National Congress in Guangzhou in January 1924 and reorganised. Soviet cooperation, admission of Communists as individual KMT members and support for workers and peasants are presented as choices in that specific historical setting.',
    factIds: ['reorganization'],
    captions: [line('12-network', 0.8, 8.3, '理想，再次交给工人，农民，青年，与更广阔的人群。', 'The ideal reached workers, farmers, young people, and a wider public.')],
  },
  {
    id: 'northward', index: 13, titleZh: '北上', titleEn: 'Beyond one generation',
    year: '1924', locationZh: '黄埔 · 天津 · 北京', locationEn: 'Whampoa · Tianjin · Beijing',
    start: 178, duration: 15, theme: 'cold',
    quoteZh: '一个人的时代，交给下一代。', quoteEn: 'The work of one life passes to another generation.',
    detailZh: '黄埔军校于1924年6月16日举行开学典礼。孙中山11月由广州北上，经上海、日本抵天津，12月31日扶病乘车抵北京。列车场景对应天津至北京的末段，并不表示全程乘火车。',
    detailEn: 'Whampoa held its opening ceremony on 16 June 1924. Sun left Guangzhou in November, travelled via Shanghai and Japan to Tianjin, and reached Beijing by train on 31 December. The train evokes the final leg, not the whole journey.',
    factIds: ['whampoa', 'northward'],
    captions: [
      line('13-generation', 1, 6, '一个人的时代，逐渐成为下一代人的时代。', 'One person’s era gradually becomes the era of the next generation.'),
      line('13-north', 7.5, 14, '冬天，他继续北上，寻找和平与统一的可能。', 'In winter he continued north, seeking a possibility of peace and unity.'),
    ],
  },
  {
    id: 'unfinished', index: 14, titleZh: '未竟', titleEn: 'An unfinished ideal',
    year: '12 MAR 1925', locationZh: '北京', locationEn: 'Beijing',
    start: 193, duration: 17, theme: 'cold',
    quoteZh: '现在革命尚未成功。', quoteEn: 'The revolution remained unfinished.',
    detailZh: '孙中山于1925年3月12日在北京逝世。遗嘱文本由汪精卫笔录，孙中山签署；其中“现在革命尚未成功”与“继续努力，以求贯彻”为史料节选。片中其余旁白均为本作品撰写，不冒充历史引语。',
    detailEn: 'Sun died in Beijing on 12 March 1925. His political testament was recorded by Wang Jingwei and signed by Sun. The two quoted phrases are excerpts from that document; other narration is original writing for this work.',
    factIds: ['testament', 'death'],
    captions: [
      line('14-unfinished', 1, 4.5, '现在革命尚未成功。', 'The revolution remained unfinished.'),
      line('14-continue', 8.5, 12.5, '继续努力，以求贯彻。', 'Continue the effort, to carry it through.'),
    ],
  },
  {
    id: 'tianxia', index: 15, titleZh: '天下为公', titleEn: 'The world belongs to all',
    year: '1866 — 1925 · 此后', locationZh: '历史，仍在继续', locationEn: 'History continues',
    start: 210, duration: 30, theme: 'light',
    quoteZh: '天下，何以为公？', quoteEn: 'For whom should the world exist?',
    detailZh: '终章以孙中山1924年“天下為公”手迹为依据。墨迹从原图分割提取，再以深度与粒子重构，最后走向普通人的剪影。镜中形象是抽象的后来人，不采集摄像头影像。“天下为公”见《礼记·礼运》，这里将其作为仍需追问的公共理想。',
    detailEn: 'The finale samples Sun’s 1924 handwritten inscription, rebuilding its strokes in depth and particles before they become ordinary people. The mirror contains an abstract later viewer, with no camera capture. The phrase, from the Liji, is approached as a continuing public ideal.',
    factIds: ['calligraphy', 'public-ideal'],
    captions: [
      line('15-life', 10.5, 17, '一个人的生命终有尽头。但有些问题，会交给下一个时代。', 'A life comes to an end. Some questions pass to another age.'),
      line('15-for-whom', 18.5, 23, '天下，究竟应该属于谁？', 'For whom should the world exist?'),
      line('15-history', 25.5, 29.5, '历史，仍在继续。', 'History continues.'),
    ],
  },
];
