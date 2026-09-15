// packages/inophone-library/tools/catalogue/shopping.mjs
// Тема «Покупки» — три сцены, 36 понятий.
//
// ТЕМА ЗАВЕДЕНА ПО БУКВЕ ТЗ. Строка 97 требует дословно: «как минимум должны
// быть следующие темы: квартира, город, покупки, человек, путешествие».
// «Магазин» был сценой внутри «Города», и по перечню тем это не засчитывалось:
// у эталона все пять тем совпадают с перечнем дословно, и на приёмке их
// сверяют построчно. Сцена «Магазин» перенесена сюда из «Города», к ней
// добавлены «Рынок» и «Универмаг».
//
// Слова подобраны так, чтобы не пересекаться с занятыми: «корзина» уже в
// ванной, «весы» там же, «пакет» и «тележка» — в «Магазине», «зеркало» — в
// спальне. Повтор понятия между сценами сборка отвергает, одинаковое русское
// написание — тоже.

export default {
  id: 'shopping',
  titles: {
    ru: 'Покупки', en: 'Shopping', fr: 'Achats', de: 'Einkaufen', zh: '购物', ba: 'Һатып алыу',
  },
  scenes: [
    {
      id: 'shop',
      titles: { ru: 'Магазин', en: 'Shop', fr: 'Magasin', de: 'Geschäft', zh: '商店', ba: 'Магазин' },
      words: [
        { id: 'counter',    ru: 'прилавок',   en: 'counter',      fr: 'comptoir',     de: 'Theke',        zh: '柜台', ba: 'прилавок' },
        { id: 'cashdesk',   ru: 'касса',      en: 'checkout',     fr: 'caisse',       de: 'Kasse',        zh: '收银台', ba: 'касса' },
        { id: 'trolley',    ru: 'тележка',    en: 'trolley',      fr: 'chariot',      de: 'Einkaufswagen',zh: '购物车', ba: 'арба' },
        { id: 'money',      ru: 'деньги',     en: 'money',        fr: 'argent',       de: 'Geld',         zh: '钱',   ba: 'аҡса' },
        { id: 'receipt',    ru: 'чек',        en: 'receipt',      fr: 'ticket de caisse', de: 'Kassenbon',zh: '收据', ba: 'чек' },
        { id: 'pricetag',   ru: 'ценник',     en: 'price tag',    fr: 'étiquette de prix', de: 'Preisschild', zh: '价签', ba: 'хаҡ билдәһе' },
        { id: 'scales_shop', ru: 'весы в магазине', en: 'shop scales', fr: 'balance de magasin', de: 'Ladenwaage', zh: '商店秤', ba: 'магазин үлсәүе' },
        { id: 'packet',     ru: 'пакет',      en: 'carrier bag',  fr: 'sac plastique',de: 'Tüte',         zh: '购物袋', ba: 'пакет' },
        { id: 'seller',     ru: 'продавец',   en: 'shop assistant', fr: 'vendeur',    de: 'Verkäufer',    zh: '售货员', ba: 'һатыусы' },
        { id: 'buyer',      ru: 'покупатель', en: 'customer',     fr: 'client',       de: 'Kunde',        zh: '顾客', ba: 'һатып алыусы' },
        { id: 'shelves',    ru: 'стеллаж',    en: 'shelving unit',fr: 'rayonnage',    de: 'Regalwand',    zh: '货架', ba: 'стеллаж' },
        { id: 'fridge_shop', ru: 'витрина-холодильник', en: 'chiller cabinet', fr: 'vitrine réfrigérée', de: 'Kühltheke', zh: '冷藏柜', ba: 'һыуытҡыс витрина' },
      ],
    },
    {
      id: 'market',
      titles: { ru: 'Рынок', en: 'Market', fr: 'Marché', de: 'Markt', zh: '市场', ba: 'Баҙар' },
      words: [
        { id: 'watermelon', ru: 'арбуз',      en: 'watermelon',   fr: 'pastèque',     de: 'Wassermelone', zh: '西瓜', ba: 'ҡарбуҙ' },
        { id: 'grapes',     ru: 'виноград',   en: 'grapes',       fr: 'raisin',       de: 'Weintrauben',  zh: '葡萄', ba: 'йөҙөм' },
        { id: 'onion',      ru: 'лук',        en: 'onion',        fr: 'oignon',       de: 'Zwiebel',      zh: '洋葱', ba: 'һуған' },
        { id: 'cucumber',   ru: 'огурец',     en: 'cucumber',     fr: 'concombre',    de: 'Gurke',        zh: '黄瓜', ba: 'ҡыяр' },
        { id: 'nuts',       ru: 'орехи',      en: 'nuts',         fr: 'noix',         de: 'Nüsse',        zh: '坚果', ba: 'сәтләүек' },
        { id: 'sack',       ru: 'мешок',      en: 'sack',         fr: 'sac de jute',  de: 'Sack',         zh: '麻袋', ba: 'тоҡ' },
        { id: 'crate',      ru: 'ящик',       en: 'crate',        fr: 'cageot',       de: 'Kiste',        zh: '板条箱', ba: 'йәшник' },
        { id: 'awning',     ru: 'навес',      en: 'awning',       fr: 'auvent',       de: 'Markise',      zh: '遮阳篷', ba: 'ҡуйма' },
        { id: 'coin',       ru: 'монета',     en: 'coin',         fr: 'pièce',        de: 'Münze',        zh: '硬币', ba: 'тәңкә' },
        { id: 'purse',      ru: 'кошелёк',    en: 'purse',        fr: 'porte-monnaie',de: 'Geldbörse',    zh: '钱包', ba: 'кеҫә ҡалтаһы' },
        { id: 'weight',     ru: 'гиря',       en: 'weight',       fr: 'poids',        de: 'Gewicht',      zh: '砝码', ba: 'гер' },
        { id: 'apron',      ru: 'фартук',     en: 'apron',        fr: 'tablier',      de: 'Schürze',      zh: '围裙', ba: 'алъяпҡыс' },
      ],
    },
    {
      id: 'department',
      titles: { ru: 'Универмаг', en: 'Department store', fr: 'Grand magasin', de: 'Kaufhaus', zh: '百货商店', ba: 'Универмаг' },
      words: [
        { id: 'escalator',  ru: 'эскалатор',  en: 'escalator',    fr: 'escalator',    de: 'Rolltreppe',   zh: '自动扶梯', ba: 'эскалатор' },
        { id: 'lift',       ru: 'лифт',       en: 'lift',         fr: 'ascenseur',    de: 'Aufzug',       zh: '电梯', ba: 'лифт' },
        { id: 'shopwindow', ru: 'витрина',    en: 'shop window',  fr: 'vitrine',      de: 'Schaufenster', zh: '橱窗', ba: 'витрина' },
        { id: 'mannequin',  ru: 'манекен',    en: 'mannequin',    fr: 'mannequin',    de: 'Schaufensterpuppe', zh: '模特儿', ba: 'манекен' },
        { id: 'fittingroom',ru: 'примерочная',en: 'fitting room', fr: 'cabine d’essayage', de: 'Umkleidekabine', zh: '试衣间', ba: 'кейем үлсәү бүлмәһе' },
        { id: 'guard',      ru: 'охранник',   en: 'security guard',fr: 'agent de sécurité', de: 'Wachmann', zh: '保安', ba: 'һаҡсы' },
        { id: 'atm',        ru: 'банкомат',   en: 'cash machine', fr: 'distributeur', de: 'Geldautomat',  zh: '取款机', ba: 'банкомат' },
        { id: 'bankcard',   ru: 'банковская карта', en: 'bank card', fr: 'carte bancaire', de: 'Bankkarte', zh: '银行卡', ba: 'банк картаһы' },
        { id: 'queue',      ru: 'очередь',    en: 'queue',        fr: 'file d’attente', de: 'Warteschlange', zh: '排队', ba: 'сират' },
        { id: 'barcode',    ru: 'штрихкод',   en: 'barcode',      fr: 'code-barres',  de: 'Strichcode',   zh: '条形码', ba: 'штрихкод' },
        { id: 'box',        ru: 'коробка',    en: 'box',          fr: 'boîte',        de: 'Schachtel',    zh: '盒子', ba: 'ҡумта' },
        { id: 'locker',     ru: 'камера хранения', en: 'locker',  fr: 'consigne',     de: 'Schließfach',  zh: '寄存柜', ba: 'һаҡлау камераһы' },
      ],
    },
  ],
};
