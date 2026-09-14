// packages/inophone-library/tools/catalogue/person.mjs
// Тема «Человек» — пять сцен, 60 понятий.
//
// Сцена «Тело» устроена иначе остальных: объекты на ней — части одной фигуры,
// а не отдельные предметы на фоне. Разметка от этого не меняется (контуры всё
// так же не должны накладываться), но раскладке об этом сказано отдельно: рука
// и плечо, поставленные вплотную, дадут щелчок, принадлежащий обоим.

export default {
  id: 'person',
  titles: {
    ru: 'Человек', en: 'People', fr: 'La personne', de: 'Der Mensch', zh: '人', ba: 'Кеше',
  },
  scenes: [
    {
      id: 'body',
      titles: { ru: 'Тело', en: 'Body', fr: 'Le corps', de: 'Körper', zh: '身体', ba: 'Кәүҙә' },
      words: [
        { id: 'head',       ru: 'голова',     en: 'head',         fr: 'tête',         de: 'Kopf',         zh: '头',   ba: 'баш' },
        { id: 'hair',       ru: 'волосы',     en: 'hair',         fr: 'cheveux',      de: 'Haare',        zh: '头发', ba: 'сәс' },
        { id: 'eye',        ru: 'глаз',       en: 'eye',          fr: 'œil',          de: 'Auge',         zh: '眼睛', ba: 'күҙ' },
        { id: 'ear',        ru: 'ухо',        en: 'ear',          fr: 'oreille',      de: 'Ohr',          zh: '耳朵', ba: 'ҡолаҡ' },
        { id: 'nose',       ru: 'нос',        en: 'nose',         fr: 'nez',          de: 'Nase',         zh: '鼻子', ba: 'танау' },
        { id: 'mouth',      ru: 'рот',        en: 'mouth',        fr: 'bouche',       de: 'Mund',         zh: '嘴',   ba: 'ауыҙ' },
        { id: 'tooth',      ru: 'зуб',        en: 'tooth',        fr: 'dent',         de: 'Zahn',         zh: '牙齿', ba: 'теш' },
        { id: 'neck',       ru: 'шея',        en: 'neck',         fr: 'cou',          de: 'Hals',         zh: '脖子', ba: 'муйын' },
        { id: 'hand',       ru: 'рука',       en: 'hand',         fr: 'main',         de: 'Hand',         zh: '手',   ba: 'ҡул' },
        { id: 'finger',     ru: 'палец',      en: 'finger',       fr: 'doigt',        de: 'Finger',       zh: '手指', ba: 'бармаҡ' },
        { id: 'leg',        ru: 'нога',       en: 'leg',          fr: 'jambe',        de: 'Bein',         zh: '腿',   ba: 'аяҡ' },
        { id: 'back',       ru: 'спина',      en: 'back',         fr: 'dos',          de: 'Rücken',       zh: '背',   ba: 'арҡа' },
      ],
    },
    {
      id: 'clothes',
      titles: { ru: 'Одежда', en: 'Clothes', fr: 'Vêtements', de: 'Kleidung', zh: '衣服', ba: 'Кейем' },
      words: [
        { id: 'shirt',      ru: 'рубашка',    en: 'shirt',        fr: 'chemise',      de: 'Hemd',         zh: '衬衫', ba: 'күлдәк' },
        { id: 'tshirt',     ru: 'футболка',   en: 'T-shirt',      fr: 'tee-shirt',    de: 'T-Shirt',      zh: 'T恤', ba: 'футболка' },
        { id: 'trousers',   ru: 'брюки',      en: 'trousers',     fr: 'pantalon',     de: 'Hose',         zh: '裤子', ba: 'салбар' },
        { id: 'skirt',      ru: 'юбка',       en: 'skirt',        fr: 'jupe',         de: 'Rock',         zh: '裙子', ba: 'итәк' },
        { id: 'dress',      ru: 'платье',     en: 'dress',        fr: 'robe',         de: 'Kleid',        zh: '连衣裙', ba: 'күлдәк озон' },
        { id: 'coat',       ru: 'пальто',     en: 'coat',         fr: 'manteau',      de: 'Mantel',       zh: '大衣', ba: 'пальто' },
        { id: 'jacket',     ru: 'куртка',     en: 'jacket',       fr: 'blouson',      de: 'Jacke',        zh: '夹克', ba: 'куртка' },
        { id: 'sweater',    ru: 'свитер',     en: 'sweater',      fr: 'pull',         de: 'Pullover',     zh: '毛衣', ba: 'свитер' },
        { id: 'socks',      ru: 'носки',      en: 'socks',        fr: 'chaussettes',  de: 'Socken',       zh: '袜子', ba: 'ойоҡбаш' },
        { id: 'belt',       ru: 'ремень',     en: 'belt',         fr: 'ceinture',     de: 'Gürtel',       zh: '腰带', ba: 'ҡайыш' },
        { id: 'button',     ru: 'пуговица',   en: 'button',       fr: 'bouton',       de: 'Knopf',        zh: '纽扣', ba: 'төймә' },
        { id: 'pocket',     ru: 'карман',     en: 'pocket',       fr: 'poche',        de: 'Tasche',       zh: '口袋', ba: 'кеҫә' },
      ],
    },
    {
      id: 'food',
      titles: { ru: 'Еда', en: 'Food', fr: 'Nourriture', de: 'Essen', zh: '食物', ba: 'Аҙыҡ' },
      words: [
        { id: 'milk',       ru: 'молоко',     en: 'milk',         fr: 'lait',         de: 'Milch',        zh: '牛奶', ba: 'һөт' },
        { id: 'cheese',     ru: 'сыр',        en: 'cheese',       fr: 'fromage',      de: 'Käse',         zh: '奶酪', ba: 'ҡорот' },
        { id: 'butter',     ru: 'масло',      en: 'butter',       fr: 'beurre',       de: 'Butter',       zh: '黄油', ba: 'май' },
        { id: 'egg',        ru: 'яйцо',       en: 'egg',          fr: 'œuf',          de: 'Ei',           zh: '鸡蛋', ba: 'йомортҡа' },
        { id: 'meat',       ru: 'мясо',       en: 'meat',         fr: 'viande',       de: 'Fleisch',      zh: '肉',   ba: 'ит' },
        { id: 'soup',       ru: 'суп',        en: 'soup',         fr: 'soupe',        de: 'Suppe',        zh: '汤',   ba: 'һурпа' },
        { id: 'porridge',   ru: 'каша',       en: 'porridge',     fr: 'bouillie',     de: 'Brei',         zh: '粥',   ba: 'бутҡа' },
        { id: 'potato',     ru: 'картошка',   en: 'potato',       fr: 'pomme de terre', de: 'Kartoffel',  zh: '土豆', ba: 'картуф' },
        { id: 'carrot',     ru: 'морковь',    en: 'carrot',       fr: 'carotte',      de: 'Karotte',      zh: '胡萝卜', ba: 'кишер' },
        { id: 'cabbage',    ru: 'капуста',    en: 'cabbage',      fr: 'chou',         de: 'Kohl',         zh: '白菜', ba: 'кәбеҫтә' },
        { id: 'tomato',     ru: 'помидор',    en: 'tomato',       fr: 'tomate',       de: 'Tomate',       zh: '番茄', ba: 'помидор' },
        { id: 'honey',      ru: 'мёд',        en: 'honey',        fr: 'miel',         de: 'Honig',        zh: '蜂蜜', ba: 'бал' },
      ],
    },
    {
      id: 'tableware',
      titles: { ru: 'Посуда', en: 'Tableware', fr: 'Vaisselle', de: 'Geschirr', zh: '餐具', ba: 'Һауыт-һаба' },
      words: [
        { id: 'plate',      ru: 'тарелка',    en: 'plate',        fr: 'assiette',     de: 'Teller',       zh: '盘子', ba: 'тәрилкә' },
        { id: 'cup',        ru: 'чашка',      en: 'cup',          fr: 'tasse',        de: 'Tasse',        zh: '杯子', ba: 'сынаяҡ' },
        { id: 'glass',      ru: 'стакан',     en: 'glass',        fr: 'verre',        de: 'Glas',         zh: '玻璃杯', ba: 'стакан' },
        { id: 'spoon',      ru: 'ложка',      en: 'spoon',        fr: 'cuillère',     de: 'Löffel',       zh: '勺子', ba: 'ҡалаҡ' },
        { id: 'fork',       ru: 'вилка',      en: 'fork',         fr: 'fourchette',   de: 'Gabel',        zh: '叉子', ba: 'сәнске' },
        { id: 'knife',      ru: 'нож',        en: 'knife',        fr: 'couteau',      de: 'Messer',       zh: '刀',   ba: 'бысаҡ' },
        { id: 'teapot',     ru: 'заварочный чайник', en: 'teapot', fr: 'théière',     de: 'Teekanne',     zh: '茶壶', ba: 'сәйнүк ҙур' },
        { id: 'jug',        ru: 'кувшин',     en: 'jug',          fr: 'pichet',       de: 'Krug',         zh: '水壶罐', ba: 'кувшин' },
        { id: 'bowl',       ru: 'миска',      en: 'bowl',         fr: 'bol',          de: 'Schüssel',     zh: '碗',   ba: 'табаҡ' },
        { id: 'tablecloth', ru: 'скатерть',   en: 'tablecloth',   fr: 'nappe',        de: 'Tischdecke',   zh: '桌布', ba: 'ашъяулыҡ' },
        { id: 'sugarbowl',  ru: 'сахарница',  en: 'sugar bowl',   fr: 'sucrier',      de: 'Zuckerdose',   zh: '糖罐', ba: 'шәкәр һауыты' },
        { id: 'breadbox',   ru: 'хлебница',   en: 'bread bin',    fr: 'boîte à pain', de: 'Brotkasten',   zh: '面包盒', ba: 'икмәк һауыты' },
      ],
    },
    {
      id: 'family',
      titles: { ru: 'Семья', en: 'Family', fr: 'Famille', de: 'Familie', zh: '家庭', ba: 'Ғаилә' },
      words: [
        { id: 'mother',     ru: 'мама',       en: 'mother',       fr: 'mère',         de: 'Mutter',       zh: '妈妈', ba: 'әсәй' },
        { id: 'father',     ru: 'папа',       en: 'father',       fr: 'père',         de: 'Vater',        zh: '爸爸', ba: 'атай' },
        { id: 'son',        ru: 'сын',        en: 'son',          fr: 'fils',         de: 'Sohn',         zh: '儿子', ba: 'ул' },
        { id: 'daughter',   ru: 'дочь',       en: 'daughter',     fr: 'fille',        de: 'Tochter',      zh: '女儿', ba: 'ҡыҙ' },
        { id: 'brother',    ru: 'брат',       en: 'brother',      fr: 'frère',        de: 'Bruder',       zh: '兄弟', ba: 'ағай' },
        { id: 'sister',     ru: 'сестра',     en: 'sister',       fr: 'sœur',         de: 'Schwester',    zh: '姐妹', ba: 'апай' },
        { id: 'grandmother',ru: 'бабушка',    en: 'grandmother',  fr: 'grand-mère',   de: 'Großmutter',   zh: '奶奶', ba: 'өләсәй' },
        { id: 'grandfather',ru: 'дедушка',    en: 'grandfather',  fr: 'grand-père',   de: 'Großvater',    zh: '爷爷', ba: 'олатай' },
        { id: 'baby',       ru: 'малыш',      en: 'baby',         fr: 'bébé',         de: 'Baby',         zh: '婴儿', ba: 'бәпес' },
        { id: 'friend',     ru: 'друг',       en: 'friend',       fr: 'ami',          de: 'Freund',       zh: '朋友', ba: 'дуҫ' },
        { id: 'neighbour',  ru: 'сосед',      en: 'neighbour',    fr: 'voisin',       de: 'Nachbar',      zh: '邻居', ba: 'күрше' },
        { id: 'guest',      ru: 'гость',      en: 'guest',        fr: 'invité',       de: 'Gast',         zh: '客人', ba: 'ҡунаҡ' },
      ],
    },
  ],
};
