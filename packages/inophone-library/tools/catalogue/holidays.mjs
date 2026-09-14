// packages/inophone-library/tools/catalogue/holidays.mjs
// Тема «Праздник» — две сцены, 24 понятия.
//
// ЭТА ТЕМА — ЗАПАС, и заведена она именно как запас. ТЗ требует не меньше пяти
// тем и не меньше тридцати одной сцены; у эталона ровно 5 и 32, и разбор назвал
// это риском приёмки: одна выбракованная сцена сразу ломает соответствие.
// С шестой темой запас есть и по темам, и по сценам, а выбраковка одной сцены
// перестаёт быть событием.
//
// Слова подобраны так, чтобы не пересекаться с уже занятыми: «ёлка» уже стоит
// в лесу, «снег» — в горах, «зонт» — в прихожей. Повтор понятия между сценами
// сборка отвергает.

export default {
  id: 'holidays',
  titles: {
    ru: 'Праздник', en: 'Celebration', fr: 'Fête', de: 'Feier', zh: '节日', ba: 'Байрам',
  },
  scenes: [
    {
      id: 'birthday',
      titles: { ru: 'День рождения', en: 'Birthday', fr: 'Anniversaire', de: 'Geburtstag', zh: '生日', ba: 'Тыуған көн' },
      words: [
        { id: 'present',    ru: 'подарок',    en: 'present',      fr: 'cadeau',       de: 'Geschenk',     zh: '礼物', ba: 'бүләк' },
        { id: 'balloon',    ru: 'шарик',      en: 'balloon',      fr: 'ballon gonflable', de: 'Luftballon', zh: '气球', ba: 'шар' },
        { id: 'birthdaycake', ru: 'торт',     en: 'birthday cake',fr: 'gâteau d’anniversaire', de: 'Geburtstagstorte', zh: '生日蛋糕', ba: 'торт' },
        { id: 'candle',     ru: 'свеча',      en: 'candle',       fr: 'bougie',       de: 'Kerze',        zh: '蜡烛', ba: 'шәм' },
        { id: 'garland',    ru: 'гирлянда',   en: 'garland',      fr: 'guirlande',    de: 'Girlande',     zh: '彩带', ba: 'гирлянда' },
        { id: 'sweet',      ru: 'конфета',    en: 'sweet',        fr: 'bonbon',       de: 'Bonbon',       zh: '糖果', ba: 'кәнфит' },
        { id: 'card',       ru: 'открытка',   en: 'greeting card',fr: 'carte de vœux',de: 'Glückwunschkarte', zh: '贺卡', ba: 'ҡотлау открыткаһы' },
        { id: 'ribbon',     ru: 'лента',      en: 'ribbon',       fr: 'ruban',        de: 'Band',         zh: '丝带', ba: 'таҫма' },
        { id: 'partyhat',   ru: 'колпак',     en: 'party hat',    fr: 'chapeau de fête', de: 'Partyhut',  zh: '派对帽', ba: 'колпак' },
        { id: 'confetti',   ru: 'конфетти',   en: 'confetti',     fr: 'confettis',    de: 'Konfetti',     zh: '五彩纸屑', ba: 'конфетти' },
        { id: 'camera',     ru: 'фотоаппарат',en: 'camera',       fr: 'appareil photo', de: 'Fotoapparat',zh: '照相机', ba: 'фотоаппарат' },
        { id: 'invitation', ru: 'приглашение',en: 'invitation',   fr: 'invitation',   de: 'Einladung',    zh: '请柬', ba: 'саҡырыу ҡағыҙы' },
      ],
    },
    {
      id: 'newyear',
      titles: { ru: 'Новый год', en: 'New Year', fr: 'Nouvel An', de: 'Neujahr', zh: '新年', ba: 'Яңы йыл' },
      words: [
        { id: 'toydecoration', ru: 'ёлочная игрушка', en: 'bauble', fr: 'boule de Noël', de: 'Christbaumkugel', zh: '圣诞球', ba: 'шыршы уйынсығы' },
        { id: 'tinsel',     ru: 'мишура',     en: 'tinsel',       fr: 'guirlande brillante', de: 'Lametta', zh: '金箔条', ba: 'мишура' },
        { id: 'star_top',   ru: 'звезда',     en: 'star',         fr: 'étoile',       de: 'Stern',        zh: '星星', ba: 'йондоҙ' },
        { id: 'snowman',    ru: 'снеговик',   en: 'snowman',      fr: 'bonhomme de neige', de: 'Schneemann', zh: '雪人', ba: 'ҡар бабай' },
        { id: 'snowflake',  ru: 'снежинка',   en: 'snowflake',    fr: 'flocon de neige', de: 'Schneeflocke', zh: '雪花', ba: 'ҡар бөртөгө' },
        { id: 'firework',   ru: 'салют',      en: 'fireworks',    fr: 'feu d’artifice', de: 'Feuerwerk',  zh: '烟花', ba: 'салют' },
        { id: 'santa',      ru: 'Дед Мороз',  en: 'Father Frost', fr: 'Père Noël',    de: 'Väterchen Frost', zh: '冰雪老人', ba: 'Ҡыш бабай' },
        { id: 'mitten',     ru: 'варежка',    en: 'mitten',       fr: 'moufle',       de: 'Fausthandschuh', zh: '连指手套', ba: 'бирсәткә' },
        { id: 'icicle',     ru: 'сосулька',   en: 'icicle',       fr: 'glaçon',       de: 'Eiszapfen',    zh: '冰柱', ba: 'боҙ һөңгөһө' },
        { id: 'skatingrink',ru: 'каток',      en: 'skating rink', fr: 'patinoire',    de: 'Eisbahn',      zh: '溜冰场', ba: 'шыуыу майҙаны' },
        { id: 'chime',      ru: 'куранты',    en: 'chiming clock',fr: 'horloge à carillon', de: 'Turmuhr',zh: '钟楼大钟', ba: 'ҡурантылар' },
        { id: 'bell_toy',    ru: 'колокольчик',en: 'small bell',   fr: 'clochette',    de: 'Glöckchen',    zh: '小铃铛', ba: 'ҡыңғырауыҡ' },
      ],
    },
  ],
};
