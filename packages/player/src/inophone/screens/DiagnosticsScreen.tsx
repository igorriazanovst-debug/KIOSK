// packages/player/src/inophone/screens/DiagnosticsScreen.tsx
// Сведения о пакете контента: комплектность и соответствие квотам ТЗ.
//
// Экран нужен НЕ ИГРЕ, а разбирательству. У Типов 2 и 3 тот же вопрос
// («почему слово молчит») решался чтением журнала приложения на машине
// педагога — то есть не решался. Здесь отчёт уже посчитан главным процессом
// при старте, и показать его стоит один экран.
//
// НЕДОСТАЮЩЕЕ НАЗЫВАЕТСЯ ПОИМЁННО и с потолком: список на тысячи строк никто
// не читает, а первые двадцать имён сразу показывают закономерность — «нет
// всего каталога audio/zh» читается иначе, чем «нет трёх файлов».

import React from 'react';
import { Panel, ScreenHeader, palette } from '../ui';
import type { CompletenessReport, GeometryReport, QuotaReport } from '../types';
import { inophone } from '@kiosk/shared';

interface Props {
  onBack: () => void;
  baseDir: string;
  isFallback: boolean;
  libraryError: string | null;
  completeness: CompletenessReport | null;
  geometry: GeometryReport | null;
  quotas: QuotaReport | null;
}

const Row: React.FC<{ label: string; value: React.ReactNode; tone?: 'good' | 'bad' }> = ({
  label,
  value,
  tone,
}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '8px 0', fontSize: 20 }}>
    <span style={{ color: palette.textDim }}>{label}</span>
    <span
      style={{
        color: tone === 'bad' ? palette.danger : tone === 'good' ? palette.good : palette.text,
        fontWeight: 600,
      }}
    >
      {value}
    </span>
  </div>
);

/** «есть 352 из 350, запас 2» — запас важнее галочки: см. разбор эталона */
function quotaText(row: { have: number; need: number; spare: number }): string {
  return `${row.have} из ${row.need} (запас ${row.spare})`;
}

const DiagnosticsScreen: React.FC<Props> = ({
  onBack,
  baseDir,
  isFallback,
  libraryError,
  completeness,
  geometry,
  quotas,
}) => (
  <div>
    <ScreenHeader title="Сведения о пакете" onBack={onBack} />

    <Panel style={{ marginBottom: 20 }}>
      <Row label="Данные занятия" value={baseDir} />
      {isFallback && (
        <Row
          label="Внимание"
          tone="bad"
          value="Нет прав на общий каталог — данные пишутся в профиль пользователя"
        />
      )}
    </Panel>

    {libraryError && (
      <Panel style={{ marginBottom: 20, borderColor: palette.danger }}>
        <div style={{ color: palette.danger, fontSize: 20 }}>{libraryError}</div>
      </Panel>
    )}

    {quotas && (
      <Panel style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: palette.text, marginBottom: 8 }}>
          Требования ТЗ по объёму
        </div>
        <Row label="Слова на шести языках" value={quotaText(quotas.words)} tone={quotas.words.ok ? 'good' : 'bad'} />
        <Row label="Сцены" value={quotaText(quotas.scenes)} tone={quotas.scenes.ok ? 'good' : 'bad'} />
        <Row label="Темы" value={quotaText(quotas.themes)} tone={quotas.themes.ok ? 'good' : 'bad'} />
      </Panel>
    )}

    {completeness && (
      <Panel>
        <div style={{ fontSize: 24, fontWeight: 700, color: palette.text, marginBottom: 8 }}>
          Комплектность файлов
        </div>
        <Row
          label="Понятий с переводом на все языки"
          value={completeness.fullyTranslated}
        />
        <Row label="Понятий с озвучкой на все языки" value={completeness.fullyVoiced} />
        <Row
          label="Не хватает файлов"
          value={completeness.missingCount}
          tone={completeness.missingCount === 0 ? 'good' : 'bad'}
        />

        <div style={{ marginTop: 12, fontSize: 20, color: palette.textDim }}>
          Не записана озвучка, по языкам:
        </div>
        {inophone.LANGUAGE_CODES.map((code) => (
          <Row
            key={code}
            label={inophone.languageInfo(code).russianName}
            value={completeness.audioGapByLanguage[code]}
            tone={completeness.audioGapByLanguage[code] === 0 ? 'good' : undefined}
          />
        ))}

        {completeness.missingFiles.length > 0 && (
          <>
            <div style={{ marginTop: 12, fontSize: 20, color: palette.textDim }}>
              Недостающие файлы (первые {completeness.missingFiles.length} из {completeness.missingCount}):
            </div>
            <ul style={{ color: palette.text, fontSize: 17, lineHeight: 1.5 }}>
              {completeness.missingFiles.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </>
        )}

        {completeness.extraFiles.length > 0 && (
          <>
            <div style={{ marginTop: 12, fontSize: 20, color: palette.textDim }}>
              Лишние файлы, которых не ждёт ни одна сущность:
            </div>
            <ul style={{ color: palette.text, fontSize: 17, lineHeight: 1.5 }}>
              {completeness.extraFiles.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    )}

    {geometry && !geometry.ok && (
      <Panel style={{ marginTop: 20, borderColor: palette.danger }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: palette.danger, marginBottom: 8 }}>
          Разметка сцен
        </div>
        {/*
          Наложившиеся контуры не роняют программу и ничего не сообщают: она
          молча засчитывает нарисованный позже объект. Ученик тычет в подушку,
          ответ идёт за кровать — и понять, почему «неверно», он не может
        */}
        {geometry.ambiguous.map((p) => (
          <Row
            key={`${p.sceneId}-${p.a}-${p.b}`}
            label={`сцена ${p.sceneId}: щелчок принадлежит обоим`}
            value={`${p.a} и ${p.b}`}
            tone="bad"
          />
        ))}
        {geometry.outOfBounds.map((p) => (
          <Row
            key={`${p.sceneId}-${p.conceptId}`}
            label={`сцена ${p.sceneId}: контур вышел за край подложки`}
            value={p.conceptId}
            tone="bad"
          />
        ))}
      </Panel>
    )}

    {!completeness && !libraryError && (
      <div style={{ color: palette.textDim, fontSize: 20 }}>
        Отчёт о комплектности доступен только в установленном приложении.
      </div>
    )}
  </div>
);

export default DiagnosticsScreen;
