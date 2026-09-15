# -*- coding: utf-8 -*-
# packages/inophone-library/tools/generate-bashkir.py
# Озвучка башкирского голосом Silero (модель `ba/v2_aigul`).
#
# ЗАЧЕМ ОТДЕЛЬНО ОТ ОСТАЛЬНЫХ ПЯТИ ЯЗЫКОВ. eSpeak NG башкирский умеет, но это
# формантный синтез: слово разборчиво, а голос отчётливо машинный. Для пособия,
# которое учит ПРОИЗНОШЕНИЮ, это слабое место — ребёнок повторяет за тем, что
# слышит. Silero даёт модель, обученную на живой башкирской речи (женский голос
# «Айгуль»), и разница слышна сразу.
#
# ВНИМАНИЕ, ЛИЦЕНЗИЯ. Модели Silero распространяются под CC BY-NC-SA 4.0 —
# НЕКОММЕРЧЕСКОЙ. То же у Meta MMS (`facebook/mms-tts-bak`, CC-BY-NC-4.0) —
# второй и единственной альтернативы с башкирским. eSpeak NG под GPL-3.0, но
# GPL распространяется на программу, а не на порождённый ею звук, поэтому
# прежние файлы коммерческих ограничений не несут.
#
# Решение, чем озвучивать поставку, принимает заказчик. Возврат к eSpeak —
# одна команда: файлы сохранены и пересобираются `generate-espeak.mjs`.
#
# Запуск: python tools/generate-bashkir.py <файл модели> <каталог wav>

import json
import os
import sys
import wave

import torch

SAMPLE_RATE = 16000  # модель умеет 8000 и 16000; берём лучшее из двух

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def main():
    if len(sys.argv) < 3:
        print("Запуск: python tools/generate-bashkir.py <файл модели> <каталог wav>")
        return 1
    model_path, out_root = sys.argv[1], sys.argv[2]
    if not os.path.exists(model_path):
        print("Нет файла модели: " + model_path)
        return 1

    plan_path = os.path.join(HERE, "narration-plan.json")
    # utf-8-sig, а не utf-8: план может быть записан с BOM, и json на нём
    # падает сообщением, из которого не видно, что дело в первых трёх байтах
    with open(plan_path, encoding="utf-8-sig") as f:
        plan = json.load(f)
    items = [it for it in plan if it["code"] == "ba"]

    # Отбор по именам — для пробных прогонов на нескольких словах. Резать сам
    # план файлом нельзя: он общий с остальными пятью языками
    only = sys.argv[3].split(",") if len(sys.argv) > 3 else None
    if only:
        items = [it for it in items if it["id"] in only]
    if not items:
        print("В плане нет башкирских слов — сначала node tools/narration-plan.mjs")
        return 1

    out_dir = os.path.join(out_root, "ba")
    os.makedirs(out_dir, exist_ok=True)

    device = torch.device("cpu")
    model = torch.package.PackageImporter(model_path).load_pickle("tts_models", "model")
    model.to(device)

    made = 0
    skipped = 0
    failed = []

    for it in items:
        wav_path = os.path.join(out_dir, it["id"] + ".wav")
        if os.path.exists(wav_path):
            skipped += 1
            continue
        try:
            # `texts`, а не `text`: модели v2 принимают СПИСОК и возвращают
            # список тензоров. Одиночный вариант есть только у v3
            # К СЛОВУ ДОБАВЛЯЕТСЯ «,.» — и это не косметика. На словах из двух
            # букв («ат» — лошадь, «эт» — собака, «ит» — мясо, «ул» — сын)
            # модель выдаёт ТИШИНУ: пик 0,002 при норме 0,8, то есть файл
            # формально есть, а слышать нечего. Запятая с точкой дают модели
            # достаточно контекста, и слово произносится. На словах обычной
            # длины добавка ничего не меняет — проверено замером пиков.
            audio = model.apply_tts(texts=[it["text"] + ",."], sample_rate=SAMPLE_RATE)[0]
        except Exception as err:  # noqa: BLE001 — причина уходит в отчёт целиком
            failed.append("%s: %s" % (it["id"], err))
            continue

        pcm = (audio.clamp(-1.0, 1.0) * 32767).to(torch.int16).numpy().tobytes()

        # ПУСТОЙ РЕЗУЛЬТАТ — НЕ УСПЕХ. Синтезатор возвращает управление и на
        # тексте, который не смог прочитать, и в пакет уезжает тишина
        if len(pcm) < 2000:
            failed.append("%s: пусто («%s»)" % (it["id"], it["text"]))
            continue

        with wave.open(wav_path, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SAMPLE_RATE)
            w.writeframes(pcm)

        made += 1
        if made % 50 == 0:
            print("  озвучено %d" % made)

    print("Silero (ba): сделано %d, пропущено (уже было) %d, не вышло %d"
          % (made, skipped, len(failed)))
    for f in failed[:20]:
        print("  " + f)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
