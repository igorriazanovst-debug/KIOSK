# Источники звука для видео поведения (2026-09-07)

Исходные ИИ-сгенерированные аудиодорожки в `*-behavior.mp4` заменены на
реальные записи с открытой лицензией (Wikimedia Commons), потому что
исходный сгенерированный звук был перегружен фоновым шумом и заглушал
основной звук животного (замечание пользователя после реального
использования). Для части объектов точная запись нужного вида не
нашлась в открытом доступе — по решению пользователя использована
запись ближайшего вида с тем же типом звука (отмечено ниже).

| Объект | Файл | Источник | Лицензия | Точный вид? |
|---|---|---|---|---|
| Медведь бурый | medved-behavior.mp4 | [Yellowstone sound library — Grizzly Bears Roar](https://commons.wikimedia.org/wiki/File:Yellowstone_sound_library_-_Grizzly_Bears_Roar_-_001.mp3) | Public Domain (US federal government work) | Да — гризли, подвид бурого медведя |
| Неясыть | sova-behavior.mp4 | [Tawny Owl (Strix aluco)](https://commons.wikimedia.org/wiki/File:Tawny_Owl_(Strix_aluco).ogg) | CC BY-SA 4.0, © Chris Taklis | Да |
| Медведь белый | medved-white-behavior.mp4 | [Bear growl](https://commons.wikimedia.org/wiki/File:Bear_growl.ogg) | CC BY 3.0 / GFDL, © Shizhao | Нет — вид не указан автором (детёныш медведя рода Ursus), записи именно белого медведя не нашлось |
| Олень северный | olen-severny-behavior.mp4 | [Hirsch röhrt (рёв благородного оленя)](https://commons.wikimedia.org/wiki/File:Hirsch_roehrt.ogg) | CC BY-SA 3.0, © Jugrü | Нет — благородный олень, близкий вид оленевых |
| Лось | los-behavior.mp4 | [Moose mate](https://commons.wikimedia.org/wiki/File:Moose_mate.ogg) | Public Domain | Да |
| Тигр уссурийский | tigr-behavior.mp4 | [Angry tiger (schots, Freesound)](https://commons.wikimedia.org/wiki/File:439280_schots_angry-tiger.wav) | CC0 1.0 (общественное достояние) | Да — рычание тигра в вольере |
| Сайгак | saygak-behavior.mp4 | [Springbok grunt (asthma)](https://commons.wikimedia.org/wiki/File:Springbok_grunt_(asthma).ogg) | CC BY-SA 4.0 | Нет — спрингбок, другой вид антилопы |
| Верблюд двугорбый | verblyud-behavior.mp4 | [Cri du chameau (крик верблюда)](https://commons.wikimedia.org/wiki/File:Cri_du_chameau.wav) | CC BY-SA 3.0 | Да — маркирован как двугорбый верблюд |

Обработка: видео-дорожка не тронута (`-c:v copy`), заменена только
аудио-дорожка (вырезан фрагмент 5.04с из исходной записи — под живой
участок записи, без тишины на границах, — fade in/out 0.15–0.3с,
перекодирован в AAC 128kbps). Скрипт и оригиналы полных аудио-записей —
`/root/audio-sources/` и `/root/audio-fix/` на проде (не в git, не
нужны после того как готовые фрагменты уже вшиты в mp4).
Оригинальные (со старым ИИ-звуком) видео сохранены отдельно —
`/root/natcom-assets-before-audio-fix-20260907/` на проде.

**Важно:** CC BY / CC BY-SA требуют указания авторства при дальнейшем
распространении ЗА ПРЕДЕЛАМИ этого закрытого учебного инструмента
(например, если видео когда-либо будут выложены отдельно/публично) —
таблица выше и есть эта атрибуция, обновлять при замене источников.
