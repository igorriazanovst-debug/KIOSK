# -*- coding: utf-8 -*-
# Сборка самодостаточной HTML-страницы из пользовательской инструкции.
#
# ЗАЧЕМ. Markdown со ссылками на папку картинок нельзя переслать одним файлом:
# получатель откроет документ без снимков и решит, что инструкция сломана.
# Здесь снимки вшиваются в страницу как data:URI — файл открывается двойным
# щелчком, работает без интернета и пересылается целиком.
#
# Разбор намеренно НЕ общего назначения: он понимает ровно те конструкции,
# которые есть в этих двух документах. Полноценный парсер здесь был бы
# лишней сложностью, а тихо «почти работающий» — хуже явно ограниченного:
# на незнакомой конструкции этот падает, а не выдаёт кашу.
import base64
import html
import io
import os
import re
import sys


def slug(text):
    """Якорь как у GitHub: строчные, пробелы в дефисы, знаки долой."""
    s = text.strip().lower()
    s = re.sub(r'[^\w\s-]', '', s, flags=re.UNICODE)
    s = re.sub(r'\s+', '-', s)
    return s


def inline(text, base_dir, embedded):
    """
    Разметка внутри строки.

    Код ВЫНИМАЕТСЯ ЗАГЛУШКАМИ, а не разрезает строку на части. Первая редакция
    резала: разбирала куски между `код` по отдельности — и жирный текст, внутри
    которого есть код, разваливался. «**Пароль по умолчанию — `12345`.**»
    давала два обрывка, ни в одном из которых пара ** не сходилась, и звёздочки
    уезжали в готовый документ как есть.
    """
    stash = []

    def keep(m):
        stash.append('<code>' + html.escape(m.group(1)) + '</code>')
        return '%d' % (len(stash) - 1)

    protected = re.sub(r'`([^`]+)`', keep, text)
    rendered = _inline_rest(protected, base_dir, embedded)
    return re.sub('([0-9]+)', lambda m: stash[int(m.group(1))], rendered)


def _data_uri(path, base_dir, embedded):
    full = os.path.join(base_dir, path)
    if not os.path.exists(full):
        raise SystemExit('нет файла снимка: ' + full)
    with open(full, 'rb') as f:
        raw = f.read()
    embedded.append((path, len(raw)))
    return 'data:image/png;base64,' + base64.b64encode(raw).decode('ascii')


def _inline_rest(text, base_dir, embedded):
    # Картинка обязана разбираться РАНЬШЕ ссылки: синтаксис отличается одним
    # восклицательным знаком, и обратный порядок превратил бы снимок в ссылку
    def img(m):
        alt, src = m.group(1), m.group(2)
        return ('<figure><img src="%s" alt="%s"><figcaption>%s</figcaption></figure>'
                % (_data_uri(src, base_dir, embedded), html.escape(alt), html.escape(alt)))

    parts = []
    pos = 0
    for m in re.finditer(r'!\[([^\]]*)\]\(([^)]+)\)', text):
        parts.append(_text_only(text[pos:m.start()]))
        parts.append(img(m))
        pos = m.end()
    parts.append(_text_only(text[pos:]))
    return ''.join(parts)


def _text_only(text):
    t = html.escape(text)
    t = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', t)
    t = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', t)
    return t


def convert(md_path, out_path, title):
    base_dir = os.path.dirname(os.path.abspath(md_path))
    src = io.open(md_path, encoding='utf-8').read()
    lines = src.split('\n')
    embedded = []
    body = []
    i = 0
    while i < len(lines):
        line = lines[i]

        if not line.strip():
            i += 1
            continue

        if line.startswith('```'):
            block = []
            i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                block.append(lines[i]); i += 1
            i += 1
            body.append('<pre><code>' + html.escape('\n'.join(block)) + '</code></pre>')
            continue

        if line.strip() == '---':
            body.append('<hr>'); i += 1; continue

        m = re.match(r'^(#{1,6})\s+(.*)$', line)
        if m:
            level = len(m.group(1))
            text = m.group(2)
            body.append('<h%d id="%s">%s</h%d>' % (level, slug(text), inline(text, base_dir, embedded), level))
            i += 1
            continue

        # Таблица: строка заголовка, строка-разделитель, затем данные
        if line.lstrip().startswith('|') and i + 1 < len(lines) and re.match(r'^\s*\|[\s:|-]+\|\s*$', lines[i + 1]):
            def cells(row):
                return [c.strip() for c in row.strip().strip('|').split('|')]
            head = cells(line)
            i += 2
            rows = []
            while i < len(lines) and lines[i].lstrip().startswith('|'):
                rows.append(cells(lines[i])); i += 1
            t = ['<div class="tablewrap"><table><thead><tr>']
            t += ['<th>%s</th>' % inline(c, base_dir, embedded) for c in head]
            t.append('</tr></thead><tbody>')
            for r in rows:
                t.append('<tr>' + ''.join('<td>%s</td>' % inline(c, base_dir, embedded) for c in r) + '</tr>')
            t.append('</tbody></table></div>')
            body.append(''.join(t))
            continue

        if line.startswith('> '):
            block = []
            while i < len(lines) and lines[i].startswith('> '):
                block.append(lines[i][2:]); i += 1
            body.append('<blockquote>%s</blockquote>' % inline(' '.join(block), base_dir, embedded))
            continue

        if re.match(r'^\s*[-*]\s+', line):
            items = []
            while i < len(lines) and re.match(r'^\s*[-*]\s+', lines[i]):
                items.append(re.sub(r'^\s*[-*]\s+', '', lines[i])); i += 1
            body.append('<ul>' + ''.join('<li>%s</li>' % inline(x, base_dir, embedded) for x in items) + '</ul>')
            continue

        if re.match(r'^\s*\d+\.\s+', line):
            items = []
            while i < len(lines) and re.match(r'^\s*\d+\.\s+', lines[i]):
                items.append(re.sub(r'^\s*\d+\.\s+', '', lines[i])); i += 1
            body.append('<ol>' + ''.join('<li>%s</li>' % inline(x, base_dir, embedded) for x in items) + '</ol>')
            continue

        # Абзац: собираем до пустой строки
        para = []
        while i < len(lines) and lines[i].strip() and not lines[i].startswith(('#', '>', '|', '---', '```')) \
                and not re.match(r'^\s*([-*]|\d+\.)\s+', lines[i]):
            para.append(lines[i]); i += 1
        body.append('<p>%s</p>' % inline(' '.join(para), base_dir, embedded))

    css = """
:root{--bg:#f6f7f9;--card:#fff;--ink:#1c2530;--muted:#5b6875;--line:#dde3ea;--accent:#1f6feb}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
 font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
.page{max-width:940px;margin:0 auto;padding:40px 24px 96px}
h1{font-size:2.1rem;line-height:1.2;margin:0 0 .6em;border-bottom:3px solid var(--accent);padding-bottom:.3em}
h2{font-size:1.5rem;margin:2.4em 0 .7em;padding-bottom:.25em;border-bottom:1px solid var(--line)}
h3{font-size:1.18rem;margin:1.8em 0 .5em;color:#20303f}
p{margin:0 0 1em}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
strong{color:#0f1720}
code{background:#eef1f5;border:1px solid var(--line);border-radius:4px;padding:.08em .35em;font-size:.92em;
 font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
pre{background:#0f1720;color:#e6edf3;border-radius:8px;padding:14px 16px;overflow-x:auto}
pre code{background:none;border:none;color:inherit;padding:0}
hr{border:0;border-top:1px solid var(--line);margin:2.4em 0}
blockquote{margin:1.4em 0;padding:.9em 1.1em;background:#eef5ff;border-left:4px solid var(--accent);border-radius:0 8px 8px 0}
blockquote p{margin:0}
ul,ol{margin:0 0 1em;padding-left:1.4em}
li{margin:.3em 0}
figure{margin:1.6em 0;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;
 box-shadow:0 1px 3px rgba(16,24,40,.06)}
figure img{display:block;width:100%;height:auto;border-radius:6px}
figcaption{margin-top:.6em;color:var(--muted);font-size:.9rem;text-align:center}
.tablewrap{overflow-x:auto;margin:0 0 1.4em}
table{border-collapse:collapse;width:100%;background:var(--card);border:1px solid var(--line);border-radius:8px}
th,td{border-bottom:1px solid var(--line);padding:.6em .75em;text-align:left;vertical-align:top}
th{background:#eef1f5;font-weight:600}
tr:last-child td{border-bottom:none}
@media print{body{background:#fff}.page{max-width:none;padding:0}figure{break-inside:avoid}}
"""
    out = ['<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">',
           '<meta name="viewport" content="width=device-width,initial-scale=1">',
           '<title>%s</title><style>%s</style></head><body><div class="page">' % (html.escape(title), css),
           '\n'.join(body),
           '</div></body></html>']
    io.open(out_path, 'w', encoding='utf-8', newline='\n').write('\n'.join(out))
    size = os.path.getsize(out_path)
    print('%s — %d снимков вшито, %.1f МБ' % (os.path.basename(out_path), len(embedded), size / 1024 / 1024))


if __name__ == '__main__':
    convert(sys.argv[1], sys.argv[2], sys.argv[3])
