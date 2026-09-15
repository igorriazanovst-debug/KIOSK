// packages/inophone-library/tools/catalogue/travel.mjs
// Тема «Путешествие» — три сцены, 36 понятий.
//
// ПОСЛЕДНЯЯ ИЗ ОБЯЗАТЕЛЬНОГО ПЕРЕЧНЯ ТЗ. Строка 97 называет пять тем дословно:
// квартира, город, покупки, человек, путешествие. Четыре были закрыты раньше,
// «путешествие» существовало только как сцена «Вокзал» внутри «Города» — по
// перечню тем это не засчитывалось. Сцена перенесена сюда, к ней добавлены
// «Аэропорт» и «Гостиница».
//
// СЛОВА ВЫБРАНЫ ПО НУЖДЕ ИНОФОНА, а не по полноте темы: «паспорт», «таможня»,
// «стойка регистрации», «посадочный талон» — это то, без чего человек в дороге
// не объяснится. Красивых, но бесполезных слов вроде «турбулентность» здесь
// нет: их нельзя показать пальцем, а пособие держится на связке «вижу предмет
// — слышу слово».

export default {
  id: 'travel',
  titles: {
    ru: 'Путешествие', en: 'Travel', fr: 'Voyage', de: 'Reise', zh: '旅行', ba: 'Сәйәхәт',
  },
  scenes: [
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
      id: 'airport',
      titles: { ru: 'Аэропорт', en: 'Airport', fr: 'Aéroport', de: 'Flughafen', zh: '机场', ba: 'Аэропорт' },
      words: [
        { id: 'passport',   ru: 'паспорт',    en: 'passport',     fr: 'passeport',    de: 'Reisepass',    zh: '护照', ba: 'паспорт' },
        { id: 'boardingpass', ru: 'посадочный талон', en: 'boarding pass', fr: 'carte d’embarquement', de: 'Bordkarte', zh: '登机牌', ba: 'ултырыу талоны' },
        { id: 'checkin',    ru: 'стойка регистрации', en: 'check-in desk', fr: 'comptoir d’enregistrement', de: 'Check-in-Schalter', zh: '值机柜台', ba: 'теркәлеү урыны' },
        { id: 'baggagebelt',ru: 'багажная лента', en: 'baggage belt', fr: 'tapis à bagages', de: 'Gepäckband', zh: '行李传送带', ba: 'багаж таҫмаһы' },
        { id: 'runway',     ru: 'взлётная полоса', en: 'runway',   fr: 'piste',        de: 'Startbahn',    zh: '跑道', ba: 'осоу юлы' },
        { id: 'terminal',   ru: 'терминал',   en: 'terminal',     fr: 'terminal',     de: 'Terminal',     zh: '航站楼', ba: 'терминал' },
        { id: 'stewardess', ru: 'стюардесса', en: 'flight attendant', fr: 'hôtesse de l’air', de: 'Flugbegleiterin', zh: '空乘', ba: 'стюардесса' },
        { id: 'porthole',   ru: 'иллюминатор',en: 'cabin window', fr: 'hublot',       de: 'Kabinenfenster', zh: '舷窗', ba: 'иллюминатор' },
        { id: 'seatbelt',   ru: 'ремень безопасности', en: 'seat belt', fr: 'ceinture de sécurité', de: 'Sicherheitsgurt', zh: '安全带', ba: 'хәүефһеҙлек ҡайышы' },
        { id: 'travelbag',  ru: 'дорожная сумка', en: 'travel bag', fr: 'sac de voyage', de: 'Reisetasche', zh: '旅行包', ba: 'юл сумкаһы' },
        { id: 'customs',    ru: 'таможня',    en: 'customs',      fr: 'douane',       de: 'Zoll',         zh: '海关', ba: 'таможня' },
        { id: 'scanner',    ru: 'рамка металлоискателя', en: 'metal detector', fr: 'portique de sécurité', de: 'Metalldetektor', zh: '安检门', ba: 'металл табыу рамкаһы' },
      ],
    },
    {
      id: 'hotel',
      titles: { ru: 'Гостиница', en: 'Hotel', fr: 'Hôtel', de: 'Hotel', zh: '酒店', ba: 'Ҡунаҡханә' },
      words: [
        { id: 'reception',  ru: 'стойка администратора', en: 'reception desk', fr: 'réception', de: 'Rezeption', zh: '前台', ba: 'администратор урыны' },
        { id: 'keycard',    ru: 'карта-ключ', en: 'key card',     fr: 'carte-clé',    de: 'Schlüsselkarte', zh: '房卡', ba: 'асҡыс картаһы' },
        { id: 'bellboy',    ru: 'носильщик',  en: 'porter',       fr: 'bagagiste',    de: 'Gepäckträger', zh: '行李员', ba: 'йөк ташыусы' },
        { id: 'luggagecart',ru: 'тележка для багажа', en: 'luggage cart', fr: 'chariot à bagages', de: 'Gepäckwagen', zh: '行李车', ba: 'багаж арбаһы' },
        { id: 'safe',       ru: 'сейф',       en: 'safe',         fr: 'coffre-fort',  de: 'Safe',         zh: '保险箱', ba: 'сейф' },
        { id: 'minibar',    ru: 'мини-бар',   en: 'minibar',      fr: 'minibar',      de: 'Minibar',      zh: '迷你吧', ba: 'мини-бар' },
        { id: 'deskbell',   ru: 'звонок на стойке', en: 'service bell', fr: 'sonnette de comptoir', de: 'Tischglocke', zh: '服务铃', ba: 'өҫтәл ҡыңғырауы' },
        { id: 'bathrobe',   ru: 'халат',      en: 'bathrobe',     fr: 'peignoir',     de: 'Bademantel',   zh: '浴袍', ba: 'халат' },
        { id: 'hanger',     ru: 'плечики',    en: 'clothes hanger',fr: 'cintre',      de: 'Kleiderbügel', zh: '衣架子', ba: 'кейем элгесе' },
        { id: 'balcony',    ru: 'балкон',     en: 'balcony',      fr: 'balcon',       de: 'Balkon',       zh: '阳台', ba: 'балкон' },
        { id: 'roomnumber', ru: 'номер на двери', en: 'room number', fr: 'numéro de chambre', de: 'Zimmernummer', zh: '门牌号', ba: 'ишектәге һан' },
        { id: 'guidebook',  ru: 'путеводитель', en: 'guidebook',  fr: 'guide touristique', de: 'Reiseführer', zh: '旅游指南', ba: 'юл күрһәткесе' },
      ],
    },
  ],
};
