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

## Звук без видео (2026-09-07, T5-112)

Отдельно от видео поведения — у 89 объектов библиотеки видео есть только
у 8 «флагманских», у остальных не было даже звука. По запросу пользователя
поискали реальные записи ещё для 55 объектов (все звери/птицы/земноводные/
пресмыкающиеся, растения не трогали — им звук не свойственен). Нашлось
19 (для двух объектов, где нет точного вида, использована та же запись,
что уже применена по решению пользователя — генерик волк, генерик дрофа):

| Объект(ы) | Файл | Источник | Лицензия | Точный вид? |
|---|---|---|---|---|
| Волк, Волк степной | wolf-sound.mp3 | [Wolf howls](https://commons.wikimedia.org/wiki/File:Wolf_howls.ogg) | Public Domain (US Fish & Wildlife Service) | Да (степной — генерик, подвид не различали) |
| Белка | squirrel-sound.mp3 | [Squirrel squealing](https://commons.wikimedia.org/wiki/File:Squirrel_squealing-audio.ogg) | GNU FDL 1.2+ | Нет — серая белка (Sciurus carolinensis), близкий вид |
| Кабан | boar-sound.mp3 | [Pig grunt - Erdie](https://commons.wikimedia.org/wiki/File:Pig_grunt_-_Erdie.ogg) | CC BY 3.0 | Да (домашняя свинья/кабан, тот же вид Sus scrofa) |
| Косуля | roedeer-sound.mp3 | [Male roe deer growl](https://commons.wikimedia.org/wiki/File:Male_roe_deer_growl.ogg) | CC BY-SA 4.0 | Да |
| Корсак | fox-sound.mp3 | [Red Fox](https://commons.wikimedia.org/wiki/File:Red_Fox_(Vulpes_vulpes)_(W1CDR0001529_BD12).ogg) | CC BY-SA 4.0 | Нет — обыкновенная лисица, близкий вид |
| Дятел пёстрый | woodpecker-drum-sound.mp3 | [Woodpeckerdrum](https://commons.wikimedia.org/wiki/File:Woodpeckerdrum.ogg) | CC BY-SA 3.0 / GFDL | Да |
| Синица | tit-sound.mp3 | [Parus major](https://commons.wikimedia.org/wiki/File:Parus_major.ogg) | Public Domain | Да |
| Иволга | oriole-sound.mp3 | [Golden oriole song](https://commons.wikimedia.org/wiki/File:Golden_oriole_song.ogg) | CC BY-SA 4.0 | Да |
| Глупыш | fulmar-sound.mp3 | [Northern Fulmar, British Library](https://commons.wikimedia.org/wiki/File:Northern_Fulmar_(Fulmarus_glacialis)_(W1CDR0001409_BD2).ogg) | CC BY-SA 4.0 | Да |
| Желна | black-woodpecker-sound.mp3 | [Dryocopus martius spring call](https://commons.wikimedia.org/wiki/File:Dryocopus_martius_spring_call_kuikuikuikui.ogg) | CC BY-SA 4.0 | Да |
| Куропатка белая | grouse-sound.mp3 | [Red Grouse, British Library](https://commons.wikimedia.org/wiki/File:Red_Grouse_(Lagopus_lagopus)_(W1CDR0001407_BD28).ogg) | CC BY-SA 4.0 | Да (Lagopus lagopus, тот же вид) |
| Филин | eagleowl-sound.mp3 | [Bubo bubo, Xeno-canto](https://commons.wikimedia.org/wiki/File:Bubo_bubo_-_Eurasian_Eagle-Owl_XC461330.mp3) | CC BY-SA 4.0 | Да |
| Фазан уссурийский | pheasant-sound.mp3 | [Phasianus colchicus, Xeno-canto](https://commons.wikimedia.org/wiki/File:Phasianus_colchicus_-_Common_Pheasant_XC503638.mp3) | CC BY-SA 4.0 | Да (вид, без уточнения подвида) |
| Журавль чёрный | crane-sound.mp3 | [Grus grus](https://commons.wikimedia.org/wiki/File:Grus_grus.ogg) | CC0 | Нет — серый журавль, близкий вид |
| Баклан | cormorant-sound.mp3 | [Phalacrocorax carbo](https://commons.wikimedia.org/wiki/File:Cormor%C3%A1n_grande_(Phalacrocorax_carbo).mp3) | CC0 | Да |
| Пустельга | kestrel-sound.mp3 | [Falco tinnunculus, Xeno-canto](https://commons.wikimedia.org/wiki/File:Falco_tinnunculus_-_Common_Kestrel_XC485216.mp3) | CC BY-SA 4.0 | Да |
| Дрофа, Джек (дрофа-красотка) | bustard-sound.mp3 | [Głos dropa](https://commons.wikimedia.org/wiki/File:G%C5%82os_dropa.ogg) | CC BY-SA 4.0 | Да (Джек — генерик, другой вид дрофиных) |
| Курганник | buzzard-sound.mp3 | [Buteo buteo, Xeno-canto](https://commons.wikimedia.org/wiki/File:Buteo_buteo_-_Common_Buzzard_XC538678.mp3) | CC BY-SA 4.0 | Нет — канюк обыкновенный, близкий вид |
| Лягушка озёрная | frog-sound.mp3 | [Marsh frog call](https://commons.wikimedia.org/wiki/File:Marsh_frog_(Pelophylax_ridibundus)_call.ogg) | CC BY-SA 4.0 | Да |

Обработка: fade in/out 0.1–0.25с, перекодировано в mp3 96kbps mono
(звук без видео, файлы маленькие — на порядок легче видео). Короткие
исходники (дятел 0.6с, кабан 0.7с) использованы целиком, не обрезаны.

Не нашлось на Wikimedia Commons (после разумных усилий поиска, реальных
записей нет в открытом доступе): Лисица, Ёж, Морж, Песец, Лахтак, Белуха,
Овцебык, Лемминг, Росомаха, Заяц-беляк, Кабарга, Бурундук, Летяга,
Горностай, Изюбрь, Леопард амурский, Медведь гималайский, Куница, Хорь,
Тушканчик мохноногий, Ёж ушастый, Джейран, Черепаха, Глухарь (нашли файл,
но скачивание с Wikimedia Commons стабильно возвращало ошибку сервера —
не удалось получить содержимое), Сапсан, Мандаринка, Аист, Саксаульная
сойка, Стерх, Кречет, Лунь пегий, Топорик, Сова полярная — у этих объектов
звука по-прежнему нет (карточка показывает только изображение, как и
раньше). По решению пользователя — если запись не нашлась, звук не
форсируется через дальнюю замену.
