// packages/inophone-library/tools/catalogue/home.mjs
// Тема «Квартира» — семь сцен, 84 понятия.
//
// НАЗВАНИЕ — ДОСЛОВНО ИЗ ТЗ. Строка 97 перечисляет обязательные темы:
// «квартира, город, покупки, человек, путешествие». Тема называлась «Дом» —
// по смыслу то же самое, но на приёмке перечень сверяют построчно, и «Дом»
// пришлось бы объяснять. Идентификатор темы остался `home`: он живёт в
// статистике на устройствах педагогов, и переименование обнулило бы им
// накопленные результаты.
//
// Слова подобраны по одному правилу: ПРЕДМЕТ ДОЛЖЕН БЫТЬ УЗНАВАЕМ НА РИСУНКЕ
// БЕЗ ПОДПИСИ. Пособие для инофона держится на связке «вижу предмет — слышу
// слово»; абстрактное понятие эту связку рвёт, и ребёнок запоминает не слово, а
// картинку, про которую не понял, что на ней.
//
// Тот же просчёт уже стоил переделки целой темы в Типе 3: слова выбрали по
// буквам, а назвать нарисованное можно было двояко.

export default {
  id: 'home',
  titles: {
    ru: 'Квартира', en: 'Home', fr: 'Maison', de: 'Zuhause', zh: '家', ba: 'Фатир',
  },
  scenes: [
    {
      id: 'bedroom',
      titles: {
        ru: 'Спальня', en: 'Bedroom', fr: 'Chambre', de: 'Schlafzimmer', zh: '卧室', ba: 'Йоҡо бүлмәһе',
      },
      words: [
        { id: 'bed',       ru: 'кровать',  en: 'bed',        fr: 'lit',         de: 'Bett',        zh: '床',   ba: 'карауат' },
        { id: 'pillow',    ru: 'подушка',  en: 'pillow',     fr: 'oreiller',    de: 'Kissen',      zh: '枕头', ba: 'мендәр' },
        { id: 'blanket',   ru: 'одеяло',   en: 'blanket',    fr: 'couverture',  de: 'Decke',       zh: '被子', ba: 'юрған' },
        { id: 'wardrobe',  ru: 'шкаф',     en: 'wardrobe',   fr: 'armoire',     de: 'Schrank',     zh: '衣柜', ba: 'шкаф' },
        { id: 'lamp',      ru: 'лампа',    en: 'lamp',       fr: 'lampe',       de: 'Lampe',       zh: '灯',   ba: 'лампа' },
        { id: 'window',    ru: 'окно',     en: 'window',     fr: 'fenêtre',     de: 'Fenster',     zh: '窗户', ba: 'тәҙрә' },
        { id: 'curtain',   ru: 'занавеска',en: 'curtain',    fr: 'rideau',      de: 'Vorhang',     zh: '窗帘', ba: 'пәрҙә' },
        { id: 'carpet',    ru: 'ковёр',    en: 'carpet',     fr: 'tapis',       de: 'Teppich',     zh: '地毯', ba: 'келәм' },
        { id: 'mirror',    ru: 'зеркало',  en: 'mirror',     fr: 'miroir',      de: 'Spiegel',     zh: '镜子', ba: 'көҙгө' },
        { id: 'clock',     ru: 'часы',     en: 'clock',      fr: 'horloge',     de: 'Uhr',         zh: '钟',   ba: 'сәғәт' },
        { id: 'slippers',  ru: 'тапочки',  en: 'slippers',   fr: 'chaussons',   de: 'Hausschuhe',  zh: '拖鞋', ba: 'өй аяҡ кейеме' },
        { id: 'door',      ru: 'дверь',    en: 'door',       fr: 'porte',       de: 'Tür',         zh: '门',   ba: 'ишек' },
      ],
    },
    {
      id: 'kitchen',
      titles: {
        ru: 'Кухня', en: 'Kitchen', fr: 'Cuisine', de: 'Küche', zh: '厨房', ba: 'Аш бүлмәһе',
      },
      words: [
        { id: 'table',     ru: 'стол',     en: 'table',      fr: 'table',       de: 'Tisch',       zh: '桌子', ba: 'өҫтәл' },
        { id: 'chair',     ru: 'стул',     en: 'chair',      fr: 'chaise',      de: 'Stuhl',       zh: '椅子', ba: 'ултырғыс' },
        { id: 'fridge',    ru: 'холодильник', en: 'fridge',  fr: 'réfrigérateur', de: 'Kühlschrank', zh: '冰箱', ba: 'һыуытҡыс' },
        { id: 'stove',     ru: 'плита',    en: 'stove',      fr: 'cuisinière',  de: 'Herd',        zh: '炉子', ba: 'мейес' },
        { id: 'kettle',    ru: 'чайник',   en: 'kettle',     fr: 'bouilloire',  de: 'Wasserkocher',zh: '水壶', ba: 'сәйнүк' },
        { id: 'pan',       ru: 'сковорода',en: 'pan',        fr: 'poêle',       de: 'Pfanne',      zh: '平底锅', ba: 'таба' },
        { id: 'pot',       ru: 'кастрюля', en: 'pot',        fr: 'casserole',   de: 'Topf',        zh: '锅',   ba: 'ҡаҙан' },
        { id: 'sink',      ru: 'раковина', en: 'sink',       fr: 'évier',       de: 'Spüle',       zh: '水槽', ba: 'йыуғыс' },
        { id: 'tap',       ru: 'кран',     en: 'tap',        fr: 'robinet',     de: 'Wasserhahn',  zh: '水龙头', ba: 'кран' },
        { id: 'shelf',     ru: 'полка',    en: 'shelf',      fr: 'étagère',     de: 'Regal',       zh: '架子', ba: 'кәштә' },
        { id: 'bread',     ru: 'хлеб',     en: 'bread',      fr: 'pain',        de: 'Brot',        zh: '面包', ba: 'икмәк' },
        { id: 'salt',      ru: 'соль',     en: 'salt',       fr: 'sel',         de: 'Salz',        zh: '盐',   ba: 'тоҙ' },
      ],
    },
    {
      id: 'living',
      titles: {
        ru: 'Гостиная', en: 'Living room', fr: 'Salon', de: 'Wohnzimmer', zh: '客厅', ba: 'Ҡунаҡ бүлмәһе',
      },
      words: [
        { id: 'sofa',      ru: 'диван',    en: 'sofa',       fr: 'canapé',      de: 'Sofa',        zh: '沙发', ba: 'диван' },
        { id: 'armchair',  ru: 'кресло',   en: 'armchair',   fr: 'fauteuil',    de: 'Sessel',      zh: '扶手椅', ba: 'кресло' },
        { id: 'tv',        ru: 'телевизор',en: 'television', fr: 'télévision',  de: 'Fernseher',   zh: '电视', ba: 'телевизор' },
        { id: 'bookcase',  ru: 'книжный шкаф', en: 'bookcase', fr: 'bibliothèque', de: 'Bücherregal', zh: '书柜', ba: 'китап шкафы' },
        { id: 'book',      ru: 'книга',    en: 'book',       fr: 'livre',       de: 'Buch',        zh: '书',   ba: 'китап' },
        { id: 'picture',   ru: 'картина',  en: 'picture',    fr: 'tableau',     de: 'Bild',        zh: '画',   ba: 'картина' },
        { id: 'vase',      ru: 'ваза',     en: 'vase',       fr: 'vase',        de: 'Vase',        zh: '花瓶', ba: 'ваза' },
        { id: 'flowerpot', ru: 'цветок в горшке', en: 'houseplant', fr: 'plante verte', de: 'Zimmerpflanze', zh: '盆栽', ba: 'гөл' },
        { id: 'cushion',   ru: 'диванная подушка', en: 'cushion', fr: 'coussin', de: 'Sofakissen', zh: '靠垫', ba: 'диван мендәре' },
        { id: 'chandelier',ru: 'люстра',   en: 'chandelier', fr: 'lustre',      de: 'Kronleuchter',zh: '吊灯', ba: 'люстра' },
        { id: 'remote',    ru: 'пульт',    en: 'remote control', fr: 'télécommande', de: 'Fernbedienung', zh: '遥控器', ba: 'пульт' },
        { id: 'coffeetable',ru: 'журнальный столик', en: 'coffee table', fr: 'table basse', de: 'Couchtisch', zh: '茶几', ba: 'бәләкәй өҫтәл' },
      ],
    },
    {
      id: 'bathroom',
      titles: {
        ru: 'Ванная', en: 'Bathroom', fr: 'Salle de bains', de: 'Badezimmer', zh: '浴室', ba: 'Йыуыныу бүлмәһе',
      },
      words: [
        { id: 'bath',      ru: 'ванна',    en: 'bathtub',    fr: 'baignoire',   de: 'Badewanne',   zh: '浴缸', ba: 'ванна' },
        { id: 'shower',    ru: 'душ',      en: 'shower',     fr: 'douche',      de: 'Dusche',      zh: '淋浴', ba: 'душ' },
        { id: 'towel',     ru: 'полотенце',en: 'towel',      fr: 'serviette',   de: 'Handtuch',    zh: '毛巾', ba: 'һөлгө' },
        { id: 'soap',      ru: 'мыло',     en: 'soap',       fr: 'savon',       de: 'Seife',       zh: '肥皂', ba: 'һабын' },
        { id: 'toothbrush',ru: 'зубная щётка', en: 'toothbrush', fr: 'brosse à dents', de: 'Zahnbürste', zh: '牙刷', ba: 'теш щёткаһы' },
        { id: 'toothpaste',ru: 'зубная паста', en: 'toothpaste', fr: 'dentifrice', de: 'Zahnpasta', zh: '牙膏', ba: 'теш пастаһы' },
        { id: 'comb',      ru: 'расчёска', en: 'comb',       fr: 'peigne',      de: 'Kamm',        zh: '梳子', ba: 'тарак' },
        { id: 'sponge',    ru: 'мочалка',  en: 'sponge',     fr: 'éponge',      de: 'Schwamm',     zh: '海绵', ba: 'мунсала' },
        { id: 'washer',    ru: 'стиральная машина', en: 'washing machine', fr: 'machine à laver', de: 'Waschmaschine', zh: '洗衣机', ba: 'кер йыуыу машинаһы' },
        { id: 'shampoo',   ru: 'шампунь',  en: 'shampoo',    fr: 'shampooing',  de: 'Shampoo',     zh: '洗发水', ba: 'шампунь' },
        { id: 'scales',    ru: 'весы',     en: 'scales',     fr: 'balance',     de: 'Waage',       zh: '体重秤', ba: 'үлсәү' },
        { id: 'basket',    ru: 'корзина',  en: 'basket',     fr: 'panier',      de: 'Korb',        zh: '篮子', ba: 'кәрзин' },
      ],
    },
    {
      id: 'hallway',
      titles: {
        ru: 'Прихожая', en: 'Hallway', fr: 'Entrée', de: 'Flur', zh: '门厅', ba: 'Ишек алды бүлмәһе',
      },
      words: [
        { id: 'coathanger',ru: 'вешалка',  en: 'coat rack',  fr: 'portemanteau',de: 'Garderobe',   zh: '衣架', ba: 'элгес' },
        { id: 'shoes',     ru: 'ботинки',  en: 'shoes',      fr: 'chaussures',  de: 'Schuhe',      zh: '鞋',   ba: 'ботинка' },
        { id: 'umbrella',  ru: 'зонт',     en: 'umbrella',   fr: 'parapluie',   de: 'Regenschirm', zh: '雨伞', ba: 'ҡулсатыр' },
        { id: 'key',       ru: 'ключ',     en: 'key',        fr: 'clé',         de: 'Schlüssel',   zh: '钥匙', ba: 'асҡыс' },
        { id: 'bag',       ru: 'сумка',    en: 'bag',        fr: 'sac',         de: 'Tasche',      zh: '包',   ba: 'сумка' },
        { id: 'doorbell',  ru: 'звонок',   en: 'doorbell',   fr: 'sonnette',    de: 'Türklingel',  zh: '门铃', ba: 'ҡыңғырау' },
        { id: 'mat',       ru: 'коврик',   en: 'doormat',    fr: 'paillasson',  de: 'Fußmatte',    zh: '门垫', ba: 'келәмсә' },
        { id: 'hat',       ru: 'шапка',    en: 'hat',        fr: 'bonnet',      de: 'Mütze',       zh: '帽子', ba: 'бүрек' },
        { id: 'scarf',     ru: 'шарф',     en: 'scarf',      fr: 'écharpe',     de: 'Schal',       zh: '围巾', ba: 'шарф' },
        { id: 'gloves',    ru: 'перчатки', en: 'gloves',     fr: 'gants',       de: 'Handschuhe',  zh: '手套', ba: 'бейәләй' },
        { id: 'stool',     ru: 'табурет',  en: 'stool',      fr: 'tabouret',    de: 'Hocker',      zh: '凳子', ba: 'тәпәш ултырғыс' },
        { id: 'lock',      ru: 'замок',    en: 'lock',       fr: 'serrure',     de: 'Schloss',     zh: '锁',   ba: 'йоҙаҡ' },
      ],
    },
    {
      id: 'nursery',
      titles: {
        ru: 'Детская', en: "Children's room", fr: "Chambre d'enfant", de: 'Kinderzimmer', zh: '儿童房', ba: 'Балалар бүлмәһе',
      },
      words: [
        { id: 'toy',       ru: 'игрушка',  en: 'toy',        fr: 'jouet',       de: 'Spielzeug',   zh: '玩具', ba: 'уйынсыҡ' },
        { id: 'doll',      ru: 'кукла',    en: 'doll',       fr: 'poupée',      de: 'Puppe',       zh: '娃娃', ba: 'ҡурсаҡ' },
        { id: 'ball',      ru: 'мяч',      en: 'ball',       fr: 'ballon',      de: 'Ball',        zh: '球',   ba: 'туп' },
        { id: 'cubes',     ru: 'кубики',   en: 'blocks',     fr: 'cubes',       de: 'Bauklötze',   zh: '积木', ba: 'кубиктар' },
        { id: 'teddybear', ru: 'медвежонок', en: 'teddy bear', fr: 'ours en peluche', de: 'Teddybär', zh: '泰迪熊', ba: 'айыу балаһы' },
        { id: 'pyramid',   ru: 'пирамидка',en: 'stacking rings', fr: 'pyramide', de: 'Stapelturm', zh: '套圈玩具', ba: 'пирамида' },
        { id: 'car_toy',   ru: 'машинка',  en: 'toy car',    fr: 'petite voiture', de: 'Spielzeugauto', zh: '玩具车', ba: 'уйынсыҡ машина' },
        { id: 'crayons',   ru: 'карандаши',en: 'crayons',    fr: 'crayons',     de: 'Buntstifte',  zh: '彩笔', ba: 'ҡәләмдәр' },
        { id: 'album',     ru: 'альбом',   en: 'drawing pad',fr: 'album à dessin', de: 'Malblock', zh: '图画本', ba: 'альбом' },
        { id: 'cot',       ru: 'кроватка', en: 'cot',        fr: 'lit bébé',    de: 'Kinderbett',  zh: '婴儿床', ba: 'бәпес карауаты' },
        { id: 'rattle',    ru: 'погремушка', en: 'rattle',   fr: 'hochet',      de: 'Rassel',      zh: '拨浪鼓', ba: 'шылтырауыҡ' },
        { id: 'puzzle',    ru: 'пазл',     en: 'jigsaw puzzle', fr: 'puzzle',   de: 'Puzzle',      zh: '拼图', ba: 'пазл' },
      ],
    },
    {
      id: 'study',
      titles: {
        ru: 'Кабинет', en: 'Study', fr: 'Bureau', de: 'Arbeitszimmer', zh: '书房', ba: 'Эш бүлмәһе',
      },
      words: [
        { id: 'desk',      ru: 'письменный стол', en: 'desk', fr: 'bureau',     de: 'Schreibtisch',zh: '书桌', ba: 'яҙыу өҫтәле' },
        { id: 'computer',  ru: 'компьютер',en: 'computer',   fr: 'ordinateur',  de: 'Computer',    zh: '电脑', ba: 'компьютер' },
        { id: 'keyboard',  ru: 'клавиатура', en: 'keyboard', fr: 'clavier',     de: 'Tastatur',    zh: '键盘', ba: 'клавиатура' },
        { id: 'mouse_pc',  ru: 'мышь',     en: 'computer mouse', fr: 'souris',  de: 'Maus',        zh: '鼠标', ba: 'сысҡан' },
        { id: 'printer',   ru: 'принтер',  en: 'printer',    fr: 'imprimante',  de: 'Drucker',     zh: '打印机', ba: 'принтер' },
        { id: 'paper',     ru: 'бумага',   en: 'paper',      fr: 'papier',      de: 'Papier',      zh: '纸',   ba: 'ҡағыҙ' },
        { id: 'pen',       ru: 'ручка',    en: 'pen',        fr: 'stylo',       de: 'Kugelschreiber', zh: '钢笔', ba: 'ручка' },
        { id: 'notebook',  ru: 'тетрадь',  en: 'notebook',   fr: 'cahier',      de: 'Heft',        zh: '本子', ba: 'дәфтәр' },
        { id: 'folder',    ru: 'папка',    en: 'folder',     fr: 'dossier',     de: 'Ordner',      zh: '文件夹', ba: 'папка' },
        { id: 'calendar',  ru: 'календарь',en: 'calendar',   fr: 'calendrier',  de: 'Kalender',    zh: '日历', ba: 'календарь' },
        { id: 'desk_lamp',  ru: 'настольная лампа', en: 'desk lamp', fr: 'lampe de bureau', de: 'Schreibtischlampe', zh: '台灯', ba: 'өҫтәл лампаһы' },
        { id: 'glasses',   ru: 'очки',     en: 'glasses',    fr: 'lunettes',    de: 'Brille',      zh: '眼镜', ba: 'күҙлек' },
      ],
    },
  ],
};
