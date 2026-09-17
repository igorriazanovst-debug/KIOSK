// packages/player/tools/physastroiq/draw-levels.mjs
//
// Рисует карты трёх уровней сложности — игровые поля викторины — и вместе с
// ними отдаёт КООРДИНАТЫ СТРУКТУР в structures.json.
//
// ЗАЧЕМ КООРДИНАТЫ ОТДЕЛЬНЫМ ФАЙЛОМ. Вопрос привязан к прямоугольнику на
// картинке. Если координаты переписывать в банк вопросов руками, они
// разъедутся с рисунком при первой же правке — и это не сломает ни сборку, ни
// тесты: вопрос останется, картинка останется, а кликать надо будет в пустое
// место рядом с органом. Ровно этот класс ошибки стоил Типу 7 примерно
// пятой части некликабельных вопросов. Здесь рисунок — единственный источник
// координат, а build-content.mjs берёт их по имени структуры; опечатка в
// имени падает на сборке.
//
// НА КАРТЕ УРОВНЯ НЕТ ПОДПИСЕЙ. Это игровое поле: подписанная структура — это
// ответ, написанный на картинке. Подписи есть у тематических изображений
// (draw-thematic.mjs) — то справочный материал, а не поле.
//
// ТОЧКИ БЕЗ ПРИВЯЗКИ К ВОПРОСУ (FR-013, не меньше 10 на уровень) — это НЕ
// пустые места фона. Обманка ценна тем, что похожа на правильный ответ,
// поэтому под них нарисованы настоящие, но безымянные объекты: лишние
// пузырьки, гранулы, вторые экземпляры органоидов. Щёлкнув по такому, ученик
// ошибается осмысленно, а не «промахивается мимо всего».
//
// Запуск: node tools/physastroiq/draw-levels.mjs [каталог вывода]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PALETTE,
  mitochondrion,
  roughER,
  smoothER,
  golgi,
  centriole,
  chloroplast,
  nucleus,
  lysosome,
  ribosomes,
  boxAround,
} from './shapes.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] || path.join(HERE, 'svg');

const W = 1800;
const H = 1200;

/**
 * Копилка одного уровня: рисунок собирается вперемешку со структурами, но
 * структура ВСЕГДА объявляется рядом с тем кодом, который её рисует.
 */
function plate() {
  const svg = [];
  const structures = [];
  const decoys = [];
  return {
    draw(...parts) {
      svg.push(...parts);
    },
    /** Структура: рисунок + кликабельная область + русское название для банка вопросов. */
    put(id, label, drawing, box) {
      svg.push(drawing);
      structures.push({ id, label, ...box });
    },
    /** Точка без привязки к вопросу: рисунок есть, имени нет. */
    decoy(drawing, box) {
      svg.push(drawing);
      decoys.push(box);
    },
    build(title) {
      return {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${PALETTE.bg}"/>
  ${svg.join('\n  ')}
</svg>`,
        meta: { title, width: W, height: H, structures, decoys },
      };
    },
  };
}

// ─── Уровень 1. Строение клетки ────────────────────────────────────────────

function level1() {
  const p = plate();

  // ── Животная клетка, левая половина плиты.
  //
  // Координаты здесь проставлены С УЧЁТОМ ТОГО, ЧТО КЛЕТКА — ЭЛЛИПС: к краям
  // он резко сужается (на высоте ±240 от центра полуширина уже 245 против 370
  // в середине), и органоид, поставленный «примерно там же, что соседний»,
  // оказывается снаружи оболочки. Проверка внизу файла ловит и это.
  const ax = 500;
  const ay = 620;

  p.put(
    'animal-membrane',
    'Клеточная мембрана животной клетки',
    `<ellipse cx="${ax}" cy="${ay}" rx="370" ry="320" fill="${PALETTE.cytoplasm}" stroke="${PALETTE.membrane}" stroke-width="8"/>`,
    // Область — на самой линии оболочки слева, а не на всей клетке: иначе
    // «мембрана» накрыла бы собой все органоиды внутри и отобрала у них клик.
    boxAround(130, 620, 70, 130)
  );

  p.put('animal-cytoplasm', 'Цитоплазма животной клетки', '', boxAround(440, 790, 120, 80));

  // Ядро: область НЕ на всём круге, а в его нижне-правой части — ядрышко
  // лежит слева сверху, и область на весь круг накрыла бы его целиком.
  p.put('animal-nucleus', 'Ядро животной клетки', nucleus(520, 570, 120, -34, -32, 40), boxAround(565, 620, 80, 60));
  p.put('animal-nucleolus', 'Ядрышко', '', boxAround(486, 538, 80, 80));

  p.put('animal-mitochondrion', 'Митохондрия', mitochondrion(660, 420, -20), boxAround(660, 420, 150, 90));
  p.put('animal-rough-er', 'Шероховатая эндоплазматическая сеть', roughER(620, 660, 180, 4, 34), boxAround(710, 700, 190, 130));
  p.put('animal-smooth-er', 'Гладкая эндоплазматическая сеть', smoothER(195, 700, 150, 3, 32), boxAround(270, 715, 170, 110));
  p.put('animal-golgi', 'Аппарат Гольджи', golgi(205, 470, 140, 5, 21), boxAround(275, 520, 170, 140));
  p.put('animal-lysosome', 'Лизосома', lysosome(600, 850, 28), boxAround(600, 850, 70, 70));
  p.put('animal-ribosome', 'Рибосома', ribosomes([[300, 815]], 10), boxAround(300, 815, 46, 46));
  p.put('animal-centriole', 'Клеточный центр', centriole(760, 540), boxAround(760, 530, 130, 100));

  // Обманки животной клетки — настоящие объекты без имени
  p.decoy(ribosomes([[235, 800]], 9), boxAround(235, 800, 44, 44));
  p.decoy(ribosomes([[350, 855]], 9), boxAround(350, 855, 44, 44));
  p.decoy(lysosome(680, 810, 19), boxAround(680, 810, 52, 52));
  p.decoy(mitochondrion(330, 400, 12, 52, 25), boxAround(330, 400, 112, 66));
  p.decoy(`<circle cx="420" cy="690" r="15" fill="${PALETTE.golgi}"/>`, boxAround(420, 690, 50, 50));
  p.decoy(`<circle cx="480" cy="420" r="13" fill="${PALETTE.er}"/>`, boxAround(480, 420, 46, 46));
  // Нижний пузырёк, отшнуровавшийся от Гольджи: он НАРИСОВАН, поэтому обязан
  // быть кликабельным. Нарисованное, но мёртвое к нажатию — та самая жалоба,
  // из-за которой в Типе 9 переписывали buildBoardTiles.
  p.decoy('', boxAround(292, 611, 40, 40));

  // ── Растительная клетка, правая половина плиты
  const px0 = 1040;
  const py0 = 330;
  const pw = 680;
  const ph = 590;

  p.put(
    'plant-wall',
    'Клеточная стенка',
    `<rect x="${px0}" y="${py0}" width="${pw}" height="${ph}" rx="40" fill="${PALETTE.plantCyto}" stroke="${PALETTE.wall}" stroke-width="20"/>`,
    boxAround(px0 + pw / 2, py0, 200, 46)
  );
  p.put(
    'plant-membrane',
    'Клеточная мембрана растительной клетки',
    `<rect x="${px0 + 18}" y="${py0 + 18}" width="${pw - 36}" height="${ph - 36}" rx="30" fill="none" stroke="${PALETTE.membrane}" stroke-width="6"/>`,
    boxAround(px0 + 18, py0 + ph / 2, 44, 150)
  );
  p.put(
    'plant-vacuole',
    'Вакуоль',
    `<rect x="${px0 + 170}" y="${py0 + 140}" width="${pw - 340}" height="${ph - 280}" rx="60" fill="${PALETTE.vacuole}" stroke="${PALETTE.vacuoleEdge}" stroke-width="5"/>`,
    boxAround(px0 + pw / 2, py0 + ph / 2, 240, 200)
  );
  p.put('plant-nucleus', 'Ядро растительной клетки', nucleus(1136, 446, 74, -22, -20, 24), boxAround(1136, 446, 148, 148));
  p.put('plant-chloroplast', 'Хлоропласт', chloroplast(1150, 690, -18), boxAround(1150, 690, 124, 82));
  p.put('plant-mitochondrion', 'Митохондрия растительной клетки', mitochondrion(1624, 800, -10, 54, 26), boxAround(1624, 800, 118, 70));
  p.put('plant-cytoplasm', 'Цитоплазма растительной клетки', '', boxAround(1640, 410, 100, 90));

  // Обманки растительной клетки — вторые экземпляры органоидов, без имени
  p.decoy(chloroplast(1140, 820, 12), boxAround(1140, 820, 124, 82));
  p.decoy(chloroplast(1628, 520, 20), boxAround(1628, 520, 124, 82));
  p.decoy(chloroplast(1620, 650, -14), boxAround(1620, 650, 124, 82));
  p.decoy(ribosomes([[1290, 400]], 9), boxAround(1290, 400, 44, 44));
  p.decoy(ribosomes([[1370, 850]], 9), boxAround(1370, 850, 44, 44));
  p.decoy(lysosome(1470, 845, 18), boxAround(1470, 845, 50, 50));

  return p.build('Строение клетки');
}

// ─── Уровень 2. Строение растений ──────────────────────────────────────────
//
// Плита из четырёх частей: растение целиком, цветок в разрезе, лист в разрезе
// и семя. Одна картинка на весь уровень, а не четыре: игровое поле в
// «ФизАстроIQ» — ровно одно изображение на уровень (quiz.images[level]).

function level2() {
  const p = plate();
  const G = PALETTE.chloroplast;
  const GL = PALETTE.chloroplastEdge;

  // ── A. Растение целиком, левая колонка
  const sx = 290;
  const ground = 760;

  p.draw(`<rect x="60" y="${ground}" width="470" height="380" fill="#15120c"/>
    <line x1="60" y1="${ground}" x2="530" y2="${ground}" stroke="#4a3b2a" stroke-width="5"/>`);

  p.put(
    'main-root',
    'Главный корень',
    `<path d="M ${sx} ${ground} L ${sx} ${ground + 290}" stroke="${PALETTE.wall}" stroke-width="16" stroke-linecap="round" fill="none"/>`,
    boxAround(sx, ground + 215, 60, 110)
  );
  p.put(
    'lateral-root',
    'Боковой корень',
    `<path d="M ${sx} ${ground + 70} q -70 22 -118 62" stroke="${PALETTE.wall}" stroke-width="8" fill="none" stroke-linecap="round"/>
     <path d="M ${sx} ${ground + 130} q 76 22 126 66" stroke="${PALETTE.wall}" stroke-width="8" fill="none" stroke-linecap="round"/>
     <path d="M ${sx} ${ground + 195} q -66 20 -106 58" stroke="${PALETTE.wall}" stroke-width="8" fill="none" stroke-linecap="round"/>`,
    boxAround(sx + 104, ground + 186, 80, 58)
  );
  p.put('root-collar', 'Корневая шейка', '', boxAround(sx, ground - 18, 56, 46));
  p.put(
    'stem',
    'Стебель',
    `<path d="M ${sx} ${ground} L ${sx} 300" stroke="#4f9a56" stroke-width="18" stroke-linecap="round" fill="none"/>`,
    boxAround(sx, 640, 56, 90)
  );

  const leaf = (y, dir) => `<g transform="translate(${sx} ${y})">
    <path d="M 0 0 q ${dir * 68} -58 ${dir * 150} -14 q ${dir * -76} 58 ${dir * -150} 14 z" fill="#4f9a56" stroke="${GL}" stroke-width="4"/>
    <path d="M 0 0 q ${dir * 80} -22 ${dir * 142} -16" fill="none" stroke="#2c6234" stroke-width="3.5"/>
  </g>`;
  p.put('leaf-blade', 'Листовая пластинка', leaf(560, -1), boxAround(sx - 108, 534, 110, 62));
  p.put('leaf-vein-outer', 'Жилка листа', '', boxAround(sx - 12, 552, 48, 34));
  p.put('petiole', 'Черешок', `<path d="M ${sx} 480 l -34 -6" stroke="#4f9a56" stroke-width="9" stroke-linecap="round"/>`, boxAround(sx - 20, 476, 46, 36));
  p.draw(leaf(480, -1));
  p.draw(leaf(620, 1));

  p.put(
    'flower',
    'Цветок',
    `<g transform="translate(${sx} 300)">
      ${[0, 60, 120, 180, 240, 300].map((a) => `<ellipse rx="38" ry="72" cy="-58" fill="#d86f9a" stroke="#f3b6cd" stroke-width="3.5" transform="rotate(${a})"/>`).join('')}
      <circle cy="0" r="26" fill="#e8c65e" stroke="#f6e3a6" stroke-width="4"/>
    </g>`,
    boxAround(sx, 232, 90, 70)
  );
  p.put(
    'bud',
    'Бутон',
    `<path d="M ${sx} 430 q 80 -18 112 -70" stroke="#4f9a56" stroke-width="9" fill="none"/>
     <ellipse cx="${sx + 122}" cy="344" rx="26" ry="42" fill="#a34e73" stroke="#f3b6cd" stroke-width="3.5"/>`,
    boxAround(sx + 122, 344, 66, 96)
  );
  p.put(
    'fruit',
    'Плод',
    `<path d="M ${sx} 690 q -92 -8 -128 -52" stroke="#4f9a56" stroke-width="9" fill="none"/>
     <circle cx="${sx - 142}" cy="626" r="36" fill="#c0442f" stroke="#f0a08e" stroke-width="4"/>`,
    boxAround(sx - 142, 626, 82, 82)
  );

  p.decoy(leaf(700, 1), boxAround(sx + 100, 676, 110, 62));
  p.decoy('', boxAround(sx - 96, ground + 114, 80, 54));
  p.decoy('', boxAround(sx - 92, ground + 240, 80, 60));

  // ── B. Цветок в разрезе, вторая колонка
  const fx = 830;
  const fbase = 880;

  p.put('pedicel', 'Цветоножка', `<path d="M ${fx} ${fbase + 150} L ${fx} ${fbase}" stroke="#4f9a56" stroke-width="15" stroke-linecap="round"/>`, boxAround(fx, fbase + 112, 52, 70));
  p.put('receptacle', 'Цветоложе', `<path d="M ${fx - 94} ${fbase} q 94 80 188 0 z" fill="#4f9a56" stroke="${GL}" stroke-width="4"/>`, boxAround(fx, fbase + 30, 120, 44));
  p.put(
    'sepal',
    'Чашелистик',
    `<path d="M ${fx - 92} ${fbase - 6} q -72 -44 -106 -122 q 78 34 116 104 z" fill="#3f7a46" stroke="${GL}" stroke-width="3.5"/>
     <path d="M ${fx + 92} ${fbase - 6} q 72 -44 106 -122 q -78 34 -116 104 z" fill="#3f7a46" stroke="${GL}" stroke-width="3.5"/>`,
    boxAround(fx - 150, fbase - 72, 84, 60)
  );
  p.put(
    'petal',
    'Лепесток',
    `<path d="M ${fx - 88} ${fbase - 20} q -166 -156 -96 -340 q 114 114 158 306 z" fill="#d86f9a" stroke="#f3b6cd" stroke-width="4"/>
     <path d="M ${fx + 88} ${fbase - 20} q 166 -156 96 -340 q -114 114 -158 306 z" fill="#d86f9a" stroke="#f3b6cd" stroke-width="4"/>`,
    boxAround(fx - 180, fbase - 350, 60, 70)
  );

  const stamen = (dx) => `<g>
    <path d="M ${fx + dx * 0.35} ${fbase - 30} q ${dx * 0.4} -130 ${dx} -220" stroke="#e8c65e" stroke-width="7" fill="none"/>
    <ellipse cx="${fx + dx}" cy="${fbase - 250}" rx="23" ry="38" fill="#e8c65e" stroke="#f6e3a6" stroke-width="3.5"/>
  </g>`;
  p.put('anther', 'Пыльник', stamen(-166), boxAround(fx - 166, fbase - 250, 58, 88));
  p.put('filament', 'Тычиночная нить', stamen(166), boxAround(fx + 130, fbase - 160, 50, 64));
  p.draw(stamen(-104));
  p.draw(stamen(104));

  p.put('ovary', 'Завязь', `<ellipse cx="${fx}" cy="${fbase - 96}" rx="78" ry="96" fill="${PALETTE.centriole}" stroke="${PALETTE.centrioleEdge}" stroke-width="5"/>`, boxAround(fx + 40, fbase - 60, 62, 62));
  p.put(
    'ovule',
    'Семязачаток',
    `<circle cx="${fx - 28}" cy="${fbase - 110}" r="18" fill="${PALETTE.grana}" stroke="${GL}" stroke-width="3"/>
     <circle cx="${fx + 26}" cy="${fbase - 146}" r="16" fill="${PALETTE.grana}" stroke="${GL}" stroke-width="3"/>`,
    boxAround(fx - 28, fbase - 110, 52, 52)
  );
  p.put('style', 'Столбик', `<path d="M ${fx} ${fbase - 194} L ${fx} ${fbase - 344}" stroke="${PALETTE.centriole}" stroke-width="14" stroke-linecap="round"/>`, boxAround(fx, fbase - 280, 50, 80));
  p.put('stigma', 'Рыльце', `<ellipse cx="${fx}" cy="${fbase - 366}" rx="52" ry="27" fill="${PALETTE.centrioleEdge}" stroke="#d9f6ee" stroke-width="4"/>`, boxAround(fx, fbase - 366, 110, 60));

  p.decoy('', boxAround(fx - 104, fbase - 250, 56, 86));
  p.decoy('', boxAround(fx + 166, fbase - 250, 58, 88));
  p.decoy('', boxAround(fx + 152, fbase - 72, 84, 60));

  // ── C. Лист в разрезе, правый верх
  const lx = 1250;
  const ly = 170;
  const lw = 480;

  p.put('leaf-upper-skin', 'Кожица листа', `<rect x="${lx}" y="${ly}" width="${lw}" height="46" fill="#7fd4c1" stroke="#d9f6ee" stroke-width="3"/>`, boxAround(lx + 90, ly + 23, 150, 42));
  p.put(
    'palisade',
    'Столбчатая ткань',
    `<g>${Array.from({ length: 12 }, (_, i) => `<rect x="${lx + 10 + i * 39}" y="${ly + 50}" width="30" height="86" rx="10" fill="${G}" stroke="${GL}" stroke-width="3"/>`).join('')}</g>`,
    boxAround(lx + 90, ly + 93, 150, 80)
  );
  p.put(
    'spongy',
    'Губчатая ткань',
    `<g>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<circle cx="${lx + 34 + i * 58}" cy="${ly + 176}" r="24" fill="${G}" stroke="${GL}" stroke-width="3"/><circle cx="${lx + 62 + i * 58}" cy="${ly + 222}" r="20" fill="${G}" stroke="${GL}" stroke-width="3"/>`).join('')}</g>`,
    boxAround(lx + 90, ly + 200, 150, 76)
  );
  p.put(
    'leaf-vein',
    'Проводящий пучок',
    `<ellipse cx="${lx + 330}" cy="${ly + 196}" rx="58" ry="40" fill="${PALETTE.wall}" stroke="#f0d9a8" stroke-width="4"/>
     <ellipse cx="${lx + 330}" cy="${ly + 196}" rx="26" ry="18" fill="#8a4a33"/>`,
    boxAround(lx + 330, ly + 196, 124, 88)
  );
  p.put('leaf-lower-skin', 'Нижняя кожица', `<rect x="${lx}" y="${ly + 254}" width="${lw}" height="40" fill="#7fd4c1" stroke="#d9f6ee" stroke-width="3"/>`, boxAround(lx + 80, ly + 274, 130, 38));
  p.put(
    'stoma',
    'Устьице',
    `<g><path d="M ${lx + 300} ${ly + 254} q 22 34 0 40 z" fill="#3f7a46" stroke="${GL}" stroke-width="3"/>
      <path d="M ${lx + 344} ${ly + 254} q -22 34 0 40 z" fill="#3f7a46" stroke="${GL}" stroke-width="3"/></g>`,
    boxAround(lx + 322, ly + 276, 76, 56)
  );

  p.decoy('', boxAround(lx + 420, ly + 23, 100, 42));
  p.decoy('', boxAround(lx + 300, ly + 93, 110, 80));
  p.decoy('', boxAround(lx + 440, ly + 200, 80, 76));

  // ── D. Семя в разрезе, правый низ
  const dx0 = 1440;
  const dy0 = 790;

  p.put(
    'seed-coat',
    'Семенная кожура',
    `<ellipse cx="${dx0}" cy="${dy0}" rx="220" ry="160" fill="#6b4a2a" stroke="${PALETTE.wall}" stroke-width="10"/>`,
    boxAround(dx0, dy0 - 142, 150, 60)
  );
  p.put(
    'cotyledon',
    'Семядоля',
    `<ellipse cx="${dx0 + 54}" cy="${dy0}" rx="130" ry="118" fill="#d8c56e" stroke="#f6e3a6" stroke-width="5"/>`,
    boxAround(dx0 + 112, dy0, 100, 120)
  );
  p.put(
    'embryo-root',
    'Зародышевый корешок',
    `<path d="M ${dx0 - 60} ${dy0 + 30} q -70 26 -110 70" stroke="${PALETTE.centrioleEdge}" stroke-width="16" fill="none" stroke-linecap="round"/>`,
    boxAround(dx0 - 148, dy0 + 82, 90, 70)
  );
  p.put(
    'embryo-bud',
    'Зародышевая почечка',
    `<path d="M ${dx0 - 60} ${dy0 - 34} q -60 -28 -96 -70" stroke="${PALETTE.centrioleEdge}" stroke-width="14" fill="none" stroke-linecap="round"/>
     <circle cx="${dx0 - 162}" cy="${dy0 - 110}" r="22" fill="${PALETTE.centriole}" stroke="${PALETTE.centrioleEdge}" stroke-width="3"/>`,
    boxAround(dx0 - 162, dy0 - 110, 62, 62)
  );

  p.decoy('', boxAround(dx0 - 40, dy0 + 118, 90, 56));
  p.decoy('', boxAround(dx0 + 150, dy0 - 110, 90, 56));

  return p.build('Строение растений');
}

// ─── Уровень 3. Организм человека ──────────────────────────────────────────

function level3() {
  const p = plate();

  // ── A. Туловище с органами, левая часть плиты
  const cx = 470;

  const torso = `M ${cx - 40} 120
    L ${cx + 40} 120
    C ${cx + 130} 130, ${cx + 214} 170, ${cx + 230} 270
    C ${cx + 243} 390, ${cx + 198} 500, ${cx + 186} 600
    C ${cx + 176} 690, ${cx + 214} 760, ${cx + 213} 840
    C ${cx + 211} 940, ${cx + 190} 1030, ${cx + 178} 1110
    L ${cx - 178} 1110
    C ${cx - 190} 1030, ${cx - 211} 940, ${cx - 213} 840
    C ${cx - 214} 760, ${cx - 176} 690, ${cx - 186} 600
    C ${cx - 198} 500, ${cx - 243} 390, ${cx - 230} 270
    C ${cx - 214} 170, ${cx - 130} 130, ${cx - 40} 120
    Z`;
  p.draw(`<path d="${torso}" fill="#16232e" stroke="#3d5568" stroke-width="4"/>`);

  p.put('trachea', 'Трахея', `<path d="M ${cx} 158 L ${cx} 268" stroke="#9fb3c4" stroke-width="16" stroke-linecap="round"/>`, boxAround(cx, 200, 54, 66));
  p.put(
    'lung',
    'Лёгкое',
    `<path d="M ${cx - 22} 272 q -104 20 -122 126 q -14 96 26 142 q 66 22 98 -42 q 20 -100 -2 -226 z" fill="#5f8fb0" stroke="#a8cfe6" stroke-width="4"/>
     <path d="M ${cx + 22} 272 q 104 20 122 126 q 14 96 -26 142 q -66 22 -98 -42 q -20 -100 2 -226 z" fill="#5f8fb0" stroke="#a8cfe6" stroke-width="4"/>`,
    boxAround(cx - 104, 402, 90, 120)
  );
  p.put(
    'heart',
    'Сердце',
    `<path d="M ${cx - 12} 324 q 56 -42 92 6 q 28 44 -16 92 q -32 34 -80 58 q -38 -62 -34 -106 q 2 -32 38 -50 z" fill="#c0442f" stroke="#f0a08e" stroke-width="4"/>`,
    boxAround(cx + 20, 396, 76, 76)
  );
  p.put(
    'liver',
    'Печень',
    `<path d="M ${cx - 172} 552 q 88 -22 184 6 q 22 62 -38 88 q -106 24 -146 -26 q -16 -36 0 -68 z" fill="#8a4a33" stroke="#d09274" stroke-width="4"/>`,
    boxAround(cx - 100, 594, 110, 70)
  );
  p.put(
    'stomach',
    'Желудок',
    `<path d="M ${cx + 44} 550 q 104 -6 114 76 q 6 72 -66 88 q -66 12 -76 -46 q -6 -62 28 -118 z" fill="#c98a4e" stroke="#f0c79a" stroke-width="4"/>`,
    boxAround(cx + 104, 628, 84, 84)
  );
  p.put(
    'spleen',
    'Селезёнка',
    `<ellipse cx="${cx + 168}" cy="580" rx="32" ry="50" fill="#6d3f66" stroke="#c79fc0" stroke-width="4" transform="rotate(20 ${cx + 168} 580)"/>`,
    boxAround(cx + 180, 560, 56, 66)
  );
  p.put(
    'pancreas',
    'Поджелудочная железа',
    `<path d="M ${cx - 56} 690 q 126 -26 208 28" fill="none" stroke="#d8b25e" stroke-width="18" stroke-linecap="round"/>`,
    boxAround(cx - 30, 688, 88, 50)
  );
  p.put(
    'diaphragm',
    'Диафрагма',
    `<path d="M ${cx - 178} 528 q 178 76 356 0" fill="none" stroke="#b58ea8" stroke-width="9"/>`,
    boxAround(cx + 15, 562, 84, 36)
  );
  p.put(
    'kidney',
    'Почка',
    `<path d="M ${cx - 184} 688 q -42 4 -44 54 q -2 48 40 54 q 20 2 22 -26 q -28 -28 -28 -56 q 0 -24 10 -26 z" fill="#7a4a58" stroke="#d2a0ae" stroke-width="4"/>
     <path d="M ${cx + 184} 688 q 42 4 44 54 q 2 48 -40 54 q -20 2 -22 -26 q 28 -28 28 -56 q 0 -24 -10 -26 z" fill="#7a4a58" stroke="#d2a0ae" stroke-width="4"/>`,
    boxAround(cx - 200, 742, 66, 80)
  );
  p.put(
    'large-intestine',
    'Толстая кишка',
    `<path d="M ${cx - 146} 906 L ${cx - 146} 792 q 0 -28 28 -28 L ${cx + 118} 764 q 28 0 28 28 L ${cx + 146} 906"
      fill="none" stroke="#a8763f" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>`,
    boxAround(cx - 146, 860, 60, 76)
  );
  p.put(
    'small-intestine',
    'Тонкая кишка',
    `<path d="M ${cx - 92} 822 q 58 -28 96 10 q 38 38 -20 60 q -68 22 -10 56 q 60 32 116 -2" fill="none" stroke="#c98a4e" stroke-width="17" stroke-linecap="round"/>
     <path d="M ${cx - 86} 900 q 68 24 146 -10" fill="none" stroke="#c98a4e" stroke-width="17" stroke-linecap="round"/>`,
    boxAround(cx - 10, 886, 86, 56)
  );
  p.put(
    'bladder',
    'Мочевой пузырь',
    `<path d="M ${cx - 52} 962 q 52 -24 104 0 q 12 58 -52 70 q -64 -12 -52 -70 z" fill="#4e7f96" stroke="#a8cfe6" stroke-width="4"/>`,
    boxAround(cx, 992, 90, 62)
  );

  p.decoy('', boxAround(cx + 104, 402, 90, 120));
  p.decoy('', boxAround(cx + 200, 742, 66, 80));
  p.decoy('', boxAround(cx + 146, 860, 60, 76));
  p.decoy('', boxAround(cx - 40, 772, 80, 44));
  p.decoy('', boxAround(cx + 104, 310, 70, 56));

  // ── B. Сердце в разрезе, правая часть плиты
  const hx = 1260;

  p.draw(`<path d="M ${hx} 300 q 146 -38 224 88 q 68 116 30 292 q -40 174 -186 262 q -38 24 -78 -10 q -146 -106 -184 -262 q -38 -176 30 -292 q 78 -126 164 -78 z"
    fill="#3a1f21" stroke="#e08b6e" stroke-width="5"/>`);

  p.put('aorta', 'Аорта', `<path d="M ${hx + 24} 332 q 10 -126 -126 -146" fill="none" stroke="#c0442f" stroke-width="34" stroke-linecap="round"/>`, boxAround(hx - 70, 206, 90, 56));
  p.put('pulmonary-trunk', 'Лёгочный ствол', `<path d="M ${hx - 38} 342 q -28 -116 58 -164" fill="none" stroke="#4e7f96" stroke-width="28" stroke-linecap="round"/>`, boxAround(hx + 18, 190, 76, 56));
  p.put('vena-cava', 'Верхняя полая вена', `<path d="M ${hx - 166} 388 q -106 -28 -136 -106" fill="none" stroke="#4e7f96" stroke-width="26" stroke-linecap="round"/>`, boxAround(hx - 272, 322, 84, 60));
  p.put('pulmonary-vein', 'Лёгочные вены', `<path d="M ${hx + 172} 408 q 106 -20 146 -88" fill="none" stroke="#c0442f" stroke-width="22" stroke-linecap="round"/>`, boxAround(hx + 282, 344, 84, 56));

  p.put(
    'right-atrium',
    'Правое предсердие',
    `<path d="M ${hx - 10} 354 q -146 -10 -176 88 q -14 58 38 74 q 88 22 138 -30 z" fill="#3f6f9a" stroke="#a8cfe6" stroke-width="4"/>`,
    boxAround(hx - 104, 434, 110, 70)
  );
  p.put(
    'left-atrium',
    'Левое предсердие',
    `<path d="M ${hx + 10} 354 q 146 -10 176 88 q 14 58 -38 74 q -88 22 -138 -30 z" fill="#8a3a30" stroke="#f0a08e" stroke-width="4"/>`,
    boxAround(hx + 104, 434, 110, 70)
  );
  p.put(
    'right-ventricle',
    'Правый желудочек',
    `<path d="M ${hx - 12} 552 q -126 10 -146 126 q -16 106 88 186 q 38 26 60 -10 z" fill="#3f6f9a" stroke="#a8cfe6" stroke-width="4"/>`,
    boxAround(hx - 84, 690, 110, 110)
  );
  p.put(
    'left-ventricle',
    'Левый желудочек',
    `<path d="M ${hx + 12} 552 q 136 10 156 126 q 18 116 -98 194 q -38 24 -58 -14 z" fill="#8a3a30" stroke="#f0a08e" stroke-width="4"/>`,
    boxAround(hx + 94, 690, 110, 110)
  );
  p.put(
    'tricuspid',
    'Трёхстворчатый клапан',
    `<path d="M ${hx - 146} 534 q 68 38 134 0" fill="none" stroke="#f6e3a6" stroke-width="8"/>`,
    boxAround(hx - 80, 546, 110, 42)
  );
  p.put(
    'bicuspid',
    'Двустворчатый клапан',
    `<path d="M ${hx + 12} 534 q 70 38 142 0" fill="none" stroke="#f6e3a6" stroke-width="8"/>`,
    boxAround(hx + 84, 546, 110, 42)
  );
  p.put(
    'septum',
    'Межжелудочковая перегородка',
    `<path d="M ${hx} 354 L ${hx} 858" stroke="#e0b8a8" stroke-width="10"/>`,
    boxAround(hx, 790, 48, 100)
  );

  p.decoy('', boxAround(hx - 40, 900, 70, 60));
  p.decoy('', boxAround(hx - 210, 560, 76, 60));
  p.decoy('', boxAround(hx + 216, 560, 76, 60));
  p.decoy('', boxAround(hx - 150, 860, 80, 60));
  p.decoy('', boxAround(hx + 150, 880, 80, 60));

  return p.build('Организм человека');
}

// ─── сборка ────────────────────────────────────────────────────────────────

const LEVELS = { 1: level1, 2: level2, 3: level3 };

/**
 * Налезающие друг на друга области — ошибка СБОРКИ, а не замечание.
 *
 * На игровом поле все области кликабельны одновременно, и две наложенные дают
 * кнопку поверх кнопки: клик достаётся верхней, а «правильный» ответ не
 * засчитывается. Ту же проверку делает model/completeness.ts над готовой
 * викториной, но там она сработает уже после сборки контента — а здесь
 * падает сразу, у того кода, который области и расставил.
 */
function overlap(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function assertNoOverlaps(levelId, m) {
  const all = [
    ...m.structures.map((s) => ({ name: s.label, rect: s })),
    ...m.decoys.map((d, i) => ({ name: `точка без привязки №${i + 1}`, rect: d })),
  ];
  const bad = [];
  for (let i = 0; i < all.length; i += 1) {
    for (let j = i + 1; j < all.length; j += 1) {
      if (overlap(all[i].rect, all[j].rect)) bad.push(`${all[i].name} ↔ ${all[j].name}`);
    }
  }
  const outside = all.filter(
    (a) => a.rect.x < 0 || a.rect.y < 0 || a.rect.x + a.rect.width > W || a.rect.y + a.rect.height > H
  );
  if (bad.length || outside.length) {
    console.error(`\nуровень ${levelId}: области расставлены неверно`);
    for (const b of bad) console.error('  налезают: ' + b);
    for (const o of outside) console.error('  за краем картинки: ' + o.name);
    return false;
  }
  return true;
}

fs.mkdirSync(OUT, { recursive: true });
const meta = {};
let ok = true;
for (const [id, make] of Object.entries(LEVELS)) {
  const { svg, meta: m } = make();
  if (!assertNoOverlaps(id, m)) ok = false;
  fs.writeFileSync(path.join(OUT, `level${id}.svg`), svg, 'utf-8');
  meta[id] = { ...m, fileName: `level${id}_map.png` };
  console.log(`уровень ${id} «${m.title}»: структур ${m.structures.length}, точек без привязки ${m.decoys.length}`);
}
fs.writeFileSync(path.join(HERE, 'structures.json'), JSON.stringify(meta, null, 2), 'utf-8');
console.log('\nкоординаты: tools/physastroiq/structures.json');
if (!ok) process.exit(1);
