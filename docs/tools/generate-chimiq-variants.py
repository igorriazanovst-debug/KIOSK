# -*- coding: utf-8 -*-
# Генерирует дополнительные варианты раскладки картинок-карт ХимIQ поверх
# уже существующего chimiqRealContent.json (вариант 1, не трогается этим
# скриптом). Каждый новый вариант: та же геометрия сетки (размер тайла,
# шаг, число колонок/строк, размер картинки на уровень), тот же текст
# (вопросы/ответы/decoy-символы не меняются) — перемешивается только то,
# КАКОЙ тайл попадает в КАКУЮ клетку сетки, чтобы видимый набор позиций
# отличался между партиями (предложение пользователя 2026-09-16, см.
# Тип9_ХимIQ/Тип9_план_реализации.md §15).
#
# ЗАЧЕМ ЭТОТ СКРИПТ СОХРАНЁН В РЕПОЗИТОРИИ (не разовый, как скрипт Фазы 7,
# что уже стоило проекту урока о невоспроизводимости — см.
# docs/tools/README.md): если понадобится ещё один вариант раскладки или
# перегенерировать существующий (например, изменится текст вопроса и
# картинку придётся перерисовать), это должно быть воспроизводимо без
# повторного реверс-инжиниринга параметров сетки/цветов/шрифта.
#
# LEVEL_DECOYS ниже — не выдуманы заново, а извлечены вырезкой существующих
# decoy-тайлов из уже опубликованных картинок уровня (в схеме данных у
# generic-decoy точек нет текстового поля — их подпись существует только
# как пиксели на картинке).
#
# Запуск (из docs/tools/):
#   python generate-chimiq-variants.py
import json
import os
import random
import copy
from PIL import Image, ImageDraw, ImageFont

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
PLAYER = os.path.join(REPO_ROOT, 'packages', 'player')

FONT_PATH = 'arialbd.ttf'

THEME_COLORS = {
    'Экспериментальная химия': (98, 214, 138),
    'Химические элементы': (46, 230, 184),
    'Строение атома': (255, 209, 102),
    'История химии': (255, 159, 64),
    'Химические соединения': (184, 107, 255),
    'Таблица Менделеева': (77, 184, 255),
}
DECOY_COLOR = (90, 100, 110)
BG_COLOR = (8, 18, 28)
TEXT_COLOR = (0, 0, 0)

TILE_W, TILE_H = 174, 144
COL_SPACING, ROW_SPACING = 190, 160
START_X, START_Y = 95, 80

# Извлечены вырезкой существующих decoy-тайлов (см. комментарий выше) —
# порядок соответствует сортировке decoy-точек уровня по (y, x) в
# оригинальном chimiqRealContent.json.
LEVEL_DECOYS = {
    1: ['Mg', 'Fr', 'Nb', 'Pu', 'Lr', 'Tc', 'Np', 'No', 'Mn', 'Re', 'Mo', 'Te', 'Sr', 'Ir', 'Md'],
    2: ['Re', 'Sc', 'Nb', 'Kr', 'Ne', 'Fm', 'Pa', 'Lr', 'Mn', 'Ga', 'Ac', 'V', 'Rn', 'Cs', 'Tc'],
    3: ['Th', 'Am', 'Cm', 'No', 'Ti', 'At', 'Rh', 'Li', 'Pu', 'Tc', 'Mn', 'Rb', 'Be', 'Sc', 'Sr'],
}
LEVEL_IMG_SIZE = {1: (1520, 1440), 2: (1710, 1440), 3: (1710, 1280)}
LEVEL_COLS = {1: 8, 2: 9, 3: 9}

PADDING = 14


def text_width(draw, text, font):
    return draw.textbbox((0, 0), text, font=font)[2]


def wrap_text(draw, text, font, max_w):
    words = text.split(' ')
    lines = []
    cur = ''
    for word in words:
        trial = (cur + ' ' + word).strip()
        if text_width(draw, trial, font) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)

    final_lines = []
    for line in lines:
        if text_width(draw, line, font) <= max_w or ' ' in line:
            final_lines.append(line)
            continue
        # длинный "неразрывный" токен без пробелов - режем посимвольно
        # (тот же фикс, что уже был нужен в Фазе 7 для таких слов)
        chunk = ''
        for ch in line:
            trial = chunk + ch
            if text_width(draw, trial, font) <= max_w or not chunk:
                chunk = trial
            else:
                final_lines.append(chunk)
                chunk = ch
        if chunk:
            final_lines.append(chunk)
    return final_lines


def fit_text(draw, text, max_w, max_h, start_size=22, min_size=9):
    size = start_size
    while size >= min_size:
        font = ImageFont.truetype(FONT_PATH, size)
        lines = wrap_text(draw, text, font, max_w)
        line_h = size + 4
        total_h = len(lines) * line_h
        widths_ok = all(text_width(draw, l, font) <= max_w for l in lines)
        if total_h <= max_h and widths_ok:
            return font, lines, line_h
        size -= 1
    font = ImageFont.truetype(FONT_PATH, min_size)
    lines = wrap_text(draw, text, font, max_w)
    return font, lines, min_size + 4


def draw_tile(draw, cx, cy, color, text):
    left, top = cx - TILE_W // 2, cy - TILE_H // 2
    right, bottom = cx + TILE_W // 2, cy + TILE_H // 2
    draw.rectangle([left, top, right, bottom], fill=color)
    max_w = TILE_W - 2 * PADDING
    max_h = TILE_H - 2 * PADDING
    font, lines, line_h = fit_text(draw, text, max_w, max_h)
    total_h = len(lines) * line_h
    y = cy - total_h / 2
    for line in lines:
        w = text_width(draw, line, font)
        draw.text((cx - w / 2, y), line, fill=TEXT_COLOR, font=font)
        y += line_h


def grid_positions(level, count):
    cols = LEVEL_COLS[level]
    positions = []
    row = 0
    col = 0
    while len(positions) < count:
        x = START_X + col * COL_SPACING
        y = START_Y + row * ROW_SPACING
        positions.append((x, y))
        col += 1
        if col >= cols:
            col = 0
            row += 1
    return positions


def generate_variant(content, variant_num, seed):
    rng = random.Random(seed)
    new_content = copy.deepcopy(content)
    new_content['id'] = f"{content['id']}-v{variant_num}"

    for level in (1, 2, 3):
        w, h = LEVEL_IMG_SIZE[level]
        img = Image.new('RGB', (w, h), BG_COLOR)
        draw = ImageDraw.Draw(img)

        items = []
        for q in new_content['questions']:
            if q['level'] != level:
                continue
            items.append({'ref': q, 'text': q['answer'], 'color': THEME_COLORS[q['theme']]})
        decoy_labels = LEVEL_DECOYS[level]
        level_decoys = [d for d in new_content['genericDecoyPoints'] if d['level'] == level]
        assert len(level_decoys) == len(decoy_labels), f"level {level}: {len(level_decoys)} decoys vs {len(decoy_labels)} labels"
        for d, label in zip(level_decoys, decoy_labels):
            items.append({'ref': d, 'text': label, 'color': DECOY_COLOR})

        positions = grid_positions(level, len(items))

        shuffled = items[:]
        rng.shuffle(shuffled)

        for item, (x, y) in zip(shuffled, positions):
            draw_tile(draw, x, y, item['color'], item['text'])
            item['ref']['x'] = x
            item['ref']['y'] = y
            item['ref']['width'] = TILE_W
            item['ref']['height'] = TILE_H

        fname = f'level{level}_map_v{variant_num}.png'
        img.save(os.path.join(PLAYER, 'public', 'chimiq', fname))
        new_content['images'][str(level)] = {'fileName': fname, 'width': w, 'height': h}
        print(f'variant {variant_num} level {level}: {len(items)} tiles rendered -> {fname}')

    return new_content


def main():
    src_path = os.path.join(PLAYER, 'src', 'chimiq', 'content', 'chimiqRealContent.json')
    with open(src_path, encoding='utf-8') as f:
        content = json.load(f)

    for variant_num, seed in [(2, 20260916), (3, 20260917)]:
        variant_content = generate_variant(content, variant_num, seed)
        out_path = os.path.join(PLAYER, 'src', 'chimiq', 'content', f'chimiqRealContent.v{variant_num}.json')
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(variant_content, f, ensure_ascii=False, indent=2)
            f.write('\n')
        print('saved', out_path)


if __name__ == '__main__':
    main()
