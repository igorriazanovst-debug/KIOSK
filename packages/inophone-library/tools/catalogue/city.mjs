// packages/inophone-library/tools/catalogue/city.mjs
// Тема «Город» — шесть сцен, 72 понятия.
//
// Сцена «Магазин» ПЕРЕЕХАЛА в тему «Покупки»: ТЗ строка 97 требует «покупки»
// именно темой, а не подтемой города, и на приёмке перечень тем сверяют
// построчно.
//
// Здесь сознательно много слов, которые инофону нужны В ПЕРВУЮ ОЧЕРЕДЬ:
// «аптека», «остановка», «билет», «врач», «расписание». Пособие рассчитано не
// на полноту словаря, а на то, чтобы человек смог объясниться в городе.

export default {
  id: 'city',
  titles: {
    ru: 'Город', en: 'City', fr: 'Ville', de: 'Stadt', zh: '城市', ba: 'Ҡала',
  },
  scenes: [
    {
      id: 'street',
      titles: { ru: 'Улица', en: 'Street', fr: 'Rue', de: 'Straße', zh: '街道', ba: 'Урам' },
      words: [
        { id: 'house',      ru: 'дом',        en: 'house',        fr: 'maison',       de: 'Haus',         zh: '房子', ba: 'йорт' },
        { id: 'road',       ru: 'дорога',     en: 'road',         fr: 'route',        de: 'Straße',       zh: '马路', ba: 'юл' },
        { id: 'crosswalk',  ru: 'переход',    en: 'crosswalk',    fr: 'passage piéton', de: 'Zebrastreifen', zh: '人行横道', ba: 'үтеү юлы' },
        { id: 'trafficlight', ru: 'светофор', en: 'traffic light',fr: 'feu tricolore',de: 'Ampel',        zh: '红绿灯', ba: 'светофор' },
        { id: 'streetlamp', ru: 'фонарь',     en: 'street lamp',  fr: 'lampadaire',   de: 'Straßenlaterne', zh: '路灯', ba: 'фонарь' },
        { id: 'bench',      ru: 'скамейка',   en: 'bench',        fr: 'banc',         de: 'Bank',         zh: '长椅', ba: 'эскәмйә' },
        { id: 'bin',        ru: 'урна',       en: 'litter bin',   fr: 'poubelle',     de: 'Mülleimer',    zh: '垃圾桶', ba: 'сүп һауыты' },
        { id: 'sign',       ru: 'вывеска',    en: 'shop sign',    fr: 'enseigne',     de: 'Ladenschild',  zh: '招牌', ba: 'вывеска' },
        { id: 'busstop',    ru: 'остановка',  en: 'bus stop',     fr: 'arrêt de bus', de: 'Haltestelle',  zh: '公交站', ba: 'туҡталыш' },
        { id: 'pharmacy',   ru: 'аптека',     en: 'pharmacy',     fr: 'pharmacie',    de: 'Apotheke',     zh: '药店', ba: 'дарыуханә' },
        { id: 'postbox',    ru: 'почтовый ящик', en: 'postbox',   fr: 'boîte aux lettres', de: 'Briefkasten', zh: '邮箱', ba: 'почта йәшниге' },
        { id: 'fence',      ru: 'забор',      en: 'fence',        fr: 'clôture',      de: 'Zaun',         zh: '围栏', ba: 'ҡойма' },
      ],
    },
    {
      id: 'school',
      titles: { ru: 'Школа', en: 'School', fr: 'École', de: 'Schule', zh: '学校', ba: 'Мәктәп' },
      words: [
        { id: 'blackboard', ru: 'доска',      en: 'board',        fr: 'tableau',      de: 'Tafel',        zh: '黑板', ba: 'таҡта' },
        { id: 'chalk',      ru: 'мел',        en: 'chalk',        fr: 'craie',        de: 'Kreide',       zh: '粉笔', ba: 'аҡбур' },
        { id: 'schooldesk', ru: 'парта',      en: 'school desk',  fr: 'pupitre',      de: 'Schulbank',    zh: '课桌', ba: 'парта' },
        { id: 'teacher',    ru: 'учитель',    en: 'teacher',      fr: 'enseignant',   de: 'Lehrer',       zh: '老师', ba: 'уҡытыусы' },
        { id: 'pupil',      ru: 'ученик',     en: 'pupil',        fr: 'élève',        de: 'Schüler',      zh: '学生', ba: 'уҡыусы' },
        { id: 'bell',       ru: 'школьный звонок', en: 'school bell', fr: 'sonnerie', de: 'Schulglocke',  zh: '上课铃', ba: 'мәктәп ҡыңғырауы' },
        { id: 'globe',      ru: 'глобус',     en: 'globe',        fr: 'globe',        de: 'Globus',       zh: '地球仪', ba: 'глобус' },
        { id: 'map',        ru: 'карта',      en: 'map',          fr: 'carte',        de: 'Landkarte',    zh: '地图', ba: 'карта' },
        { id: 'gymhall',    ru: 'спортзал',   en: 'gym',          fr: 'gymnase',      de: 'Turnhalle',    zh: '体育馆', ba: 'спорт залы' },
        { id: 'canteen',    ru: 'столовая',   en: 'canteen',      fr: 'cantine',      de: 'Mensa',        zh: '食堂', ba: 'ашхана' },
        { id: 'corridor',   ru: 'коридор',    en: 'corridor',     fr: 'couloir',      de: 'Flur',         zh: '走廊', ba: 'коридор' },
        { id: 'timetable',  ru: 'расписание', en: 'timetable',    fr: 'emploi du temps', de: 'Stundenplan', zh: '课程表', ba: 'дәрес таблицаһы' },
      ],
    },
    {
      id: 'hospital',
      titles: { ru: 'Больница', en: 'Hospital', fr: 'Hôpital', de: 'Krankenhaus', zh: '医院', ba: 'Дауахана' },
      words: [
        { id: 'doctor',     ru: 'врач',       en: 'doctor',       fr: 'médecin',      de: 'Arzt',         zh: '医生', ba: 'табип' },
        { id: 'nurse',      ru: 'медсестра',  en: 'nurse',        fr: 'infirmière',   de: 'Krankenschwester', zh: '护士', ba: 'шәфҡәт туташы' },
        { id: 'patient',    ru: 'пациент',    en: 'patient',      fr: 'patient',      de: 'Patient',      zh: '病人', ba: 'ауырыу' },
        { id: 'thermometer',ru: 'градусник',  en: 'thermometer',  fr: 'thermomètre',  de: 'Fieberthermometer', zh: '体温计', ba: 'градусник' },
        { id: 'bandage',    ru: 'бинт',       en: 'bandage',      fr: 'bandage',      de: 'Verband',      zh: '绷带', ba: 'бинт' },
        { id: 'plaster',    ru: 'пластырь',   en: 'plaster',      fr: 'pansement',    de: 'Pflaster',     zh: '创可贴', ba: 'пластырь' },
        { id: 'syringe',    ru: 'шприц',      en: 'syringe',      fr: 'seringue',     de: 'Spritze',      zh: '注射器', ba: 'шприц' },
        { id: 'medicine',   ru: 'лекарство',  en: 'medicine',     fr: 'médicament',   de: 'Medikament',   zh: '药',   ba: 'дарыу' },
        { id: 'hospitalbed',ru: 'больничная койка', en: 'hospital bed', fr: 'lit d’hôpital', de: 'Krankenbett', zh: '病床', ba: 'дауахана карауаты' },
        { id: 'stethoscope',ru: 'стетоскоп',  en: 'stethoscope',  fr: 'stéthoscope',  de: 'Stethoskop',   zh: '听诊器', ba: 'стетоскоп' },
        { id: 'ambulance',  ru: 'скорая помощь', en: 'ambulance', fr: 'ambulance',    de: 'Krankenwagen', zh: '救护车', ba: 'ашығыс ярҙам' },
        { id: 'wheelchair', ru: 'инвалидная коляска', en: 'wheelchair', fr: 'fauteuil roulant', de: 'Rollstuhl', zh: '轮椅', ba: 'коляска' },
      ],
    },
    {
      id: 'park',
      titles: { ru: 'Парк', en: 'Park', fr: 'Parc', de: 'Park', zh: '公园', ba: 'Парк' },
      words: [
        { id: 'swing',      ru: 'качели',     en: 'swing',        fr: 'balançoire',   de: 'Schaukel',     zh: '秋千', ba: 'арғымаҡ' },
        { id: 'slide',      ru: 'горка',      en: 'slide',        fr: 'toboggan',     de: 'Rutsche',      zh: '滑梯', ba: 'тау шыуыу' },
        { id: 'sandbox',    ru: 'песочница',  en: 'sandpit',      fr: 'bac à sable',  de: 'Sandkasten',   zh: '沙坑', ba: 'ҡом әрйәһе' },
        { id: 'fountain',   ru: 'фонтан',     en: 'fountain',     fr: 'fontaine',     de: 'Springbrunnen',zh: '喷泉', ba: 'фонтан' },
        { id: 'pond',       ru: 'пруд',       en: 'pond',         fr: 'étang',        de: 'Teich',        zh: '池塘', ba: 'быуа' },
        { id: 'duck',       ru: 'утка',       en: 'duck',         fr: 'canard',       de: 'Ente',         zh: '鸭子', ba: 'өйрәк' },
        { id: 'path',       ru: 'дорожка',    en: 'path',         fr: 'allée',        de: 'Weg',          zh: '小路', ba: 'һуҡмаҡ' },
        { id: 'lawn',       ru: 'газон',      en: 'lawn',         fr: 'pelouse',      de: 'Rasen',        zh: '草坪', ba: 'газон' },
        { id: 'bicycle',    ru: 'велосипед',  en: 'bicycle',      fr: 'vélo',         de: 'Fahrrad',      zh: '自行车', ba: 'велосипед' },
        { id: 'kite',       ru: 'воздушный змей', en: 'kite',     fr: 'cerf-volant',  de: 'Drachen',      zh: '风筝', ba: 'осҡос' },
        { id: 'icecream',   ru: 'мороженое',  en: 'ice cream',    fr: 'glace',        de: 'Eis',          zh: '冰淇淋', ba: 'туңдырма' },
        { id: 'pigeon',     ru: 'голубь',     en: 'pigeon',       fr: 'pigeon',       de: 'Taube',        zh: '鸽子', ba: 'күгәрсен' },
      ],
    },
    {
      id: 'station',
      titles: { ru: 'Вокзал', en: 'Station', fr: 'Gare', de: 'Bahnhof', zh: '火车站', ba: 'Вокзал' },
      words: [
        { id: 'train',      ru: 'поезд',      en: 'train',        fr: 'train',        de: 'Zug',          zh: '火车', ba: 'поезд' },
        { id: 'platform',   ru: 'перрон',     en: 'platform',     fr: 'quai',         de: 'Bahnsteig',    zh: '站台', ba: 'перрон' },
        { id: 'rails',      ru: 'рельсы',     en: 'rails',        fr: 'rails',        de: 'Gleise',       zh: '铁轨', ba: 'рельстар' },
        { id: 'ticket',     ru: 'билет',      en: 'ticket',       fr: 'billet',       de: 'Fahrkarte',    zh: '车票', ba: 'билет' },
        { id: 'suitcase',   ru: 'чемодан',    en: 'suitcase',     fr: 'valise',       de: 'Koffer',       zh: '行李箱', ba: 'чемодан' },
        { id: 'schedule',   ru: 'табло',      en: 'departure board', fr: 'tableau des départs', de: 'Anzeigetafel', zh: '时刻表', ba: 'табло' },
        { id: 'waitingroom',ru: 'зал ожидания', en: 'waiting room', fr: 'salle d’attente', de: 'Wartesaal', zh: '候车室', ba: 'көтөү залы' },
        { id: 'conductor',  ru: 'проводник',  en: 'train conductor', fr: 'contrôleur',de: 'Schaffner',    zh: '列车员', ba: 'проводник' },
        { id: 'luggage',    ru: 'багаж',      en: 'luggage',      fr: 'bagages',      de: 'Gepäck',       zh: '行李', ba: 'багаж' },
        { id: 'clock_station', ru: 'вокзальные часы', en: 'station clock', fr: 'horloge de gare', de: 'Bahnhofsuhr', zh: '车站大钟', ba: 'вокзал сәғәте' },
        { id: 'kiosk',      ru: 'киоск',      en: 'kiosk',        fr: 'kiosque',      de: 'Kiosk',        zh: '小卖部', ba: 'киоск' },
        { id: 'bus',        ru: 'автобус',    en: 'bus',          fr: 'autobus',      de: 'Bus',          zh: '公共汽车', ba: 'автобус' },
      ],
    },
    {
      id: 'cafe',
      titles: { ru: 'Кафе', en: 'Café', fr: 'Café', de: 'Café', zh: '咖啡馆', ba: 'Кафе' },
      words: [
        { id: 'menu',       ru: 'меню',       en: 'menu',         fr: 'menu',         de: 'Speisekarte',  zh: '菜单', ba: 'меню' },
        { id: 'waiter',     ru: 'официант',   en: 'waiter',       fr: 'serveur',      de: 'Kellner',      zh: '服务员', ba: 'официант' },
        { id: 'tray',       ru: 'поднос',     en: 'tray',         fr: 'plateau',      de: 'Tablett',      zh: '托盘', ba: 'поднос' },
        { id: 'napkin',     ru: 'салфетка',   en: 'napkin',       fr: 'serviette',    de: 'Serviette',    zh: '餐巾', ba: 'салфетка' },
        { id: 'coffee',     ru: 'кофе',       en: 'coffee',       fr: 'café',         de: 'Kaffee',       zh: '咖啡', ba: 'ҡәһүә' },
        { id: 'tea',        ru: 'чай',        en: 'tea',          fr: 'thé',          de: 'Tee',          zh: '茶',   ba: 'сәй' },
        { id: 'juice',      ru: 'сок',        en: 'juice',        fr: 'jus',          de: 'Saft',         zh: '果汁', ba: 'һут' },
        { id: 'cake',       ru: 'пирожное',   en: 'cake',         fr: 'gâteau',       de: 'Kuchen',       zh: '蛋糕', ba: 'бәлеш' },
        { id: 'straw',      ru: 'трубочка',   en: 'drinking straw', fr: 'paille',     de: 'Trinkhalm',    zh: '吸管', ba: 'көпшә' },
        { id: 'sugar',      ru: 'сахар',      en: 'sugar',        fr: 'sucre',        de: 'Zucker',       zh: '糖',   ba: 'шәкәр' },
        { id: 'saucer',     ru: 'блюдце',     en: 'saucer',       fr: 'soucoupe',     de: 'Untertasse',   zh: '茶碟', ba: 'сәйтабаҡ' },
        { id: 'bill',       ru: 'счёт',       en: 'bill',         fr: 'addition',     de: 'Rechnung',     zh: '账单', ba: 'иҫәп' },
      ],
    },
  ],
};
