# Источники звука для видео поведения (2026-09-07)

Исходные ИИ-сгенерированные аудиодорожки в `*-behavior.mp4` заменены на
реальные записи с открытой лицензией (Wikimedia Commons), потому что
исходный сгенерированный звук был перегружен фоновым шумом и заглушал
основной звук животного. Для части объектов точная запись нужного вида
не нашлась в открытом доступе — использована запись близкого вида
(отмечено ниже).

| Объект | Файл | Источник | Лицензия | Точный вид? |
|---|---|---|---|---|
| Медведь бурый | medved-behavior.mp4 | [Yellowstone sound library — Grizzly Bears Roar](https://commons.wikimedia.org/wiki/File:Yellowstone_sound_library_-_Grizzly_Bears_Roar_-_001.mp3) | Public Domain (US federal government work) | Да |
| Неясыть | sova-behavior.mp4 | [Tawny Owl (Strix aluco), British Library](https://commons.wikimedia.org/wiki/File:Tawny_Owl_(Strix_aluco)_(W1CDR0001427_BD9).ogg) | CC BY-SA 4.0, © Lawrence Shove / British Library | Да |
| Медведь белый | medved-white-behavior.mp4 | [Bear growl](https://commons.wikimedia.org/wiki/File:Bear_growl.ogg) | CC BY 3.0 / GFDL, © Shizhao | Нет — вид не указан автором, использовано как общий рык медведя |
| Олень северный | olen-severny-behavior.mp4 | [Fallow Deer (Dama dama), British Library](https://commons.wikimedia.org/wiki/File:Fallow_Deer_(Dama_dama)_(W1CDR0001444_BD17).ogg) | CC BY-SA 4.0, © Lawrence Shove / British Library | Нет — лань, близкий вид оленевых |
| Лось | los-behavior.mp4 | [Moose mate](https://commons.wikimedia.org/wiki/File:Moose_mate.ogg) | Public Domain | Да |
| Тигр уссурийский | tigr-behavior.mp4 | [Lionroar.wav](https://commons.wikimedia.org/wiki/File:Lionroar.wav) (Growcott et al.) | CC BY 4.0 | Нет — рык льва, записи именно тигра в открытом доступе не нашлось |
| Сайгак | saygak-behavior.mp4 | [Springbok grunt (asthma)](https://commons.wikimedia.org/wiki/File:Springbok_grunt_(asthma).ogg) | CC BY-SA 4.0 | Нет — спрингбок, другой вид антилопы |
| Верблюд двугорбый | verblyud-behavior.mp4 | [Braying donkey](https://commons.wikimedia.org/wiki/File:Braying_donkey_(Equus_africanus_asinus).webm) | CC BY-SA 2.0 | Нет — осёл, отдалённая замена (записей камелид на Wikimedia Commons не нашлось вообще) |

Обработка: видео-дорожка не тронута (`-c:v copy`), заменена только
аудио-дорожка (вырезан 5.04с фрагмент с максимальной громкостью из
исходной записи, fade in/out 0.15–0.2с, AAC 128kbps). Скрипт и
оригиналы фрагментов — `/root/audio-fix/` на проде (не в git).

CC BY / CC BY-SA требуют указания авторства при дальнейшем
распространении за пределы этого закрытого учебного инструмента.
