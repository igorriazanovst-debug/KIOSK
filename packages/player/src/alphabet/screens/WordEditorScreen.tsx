// packages/player/src/alphabet/screens/WordEditorScreen.tsx
// Редактор своего слова — ТЗ строка 76 («аудио, текстовые и графические»
// материалы) и строка 78 («создание своих слов»).
//
// ТРИ РОДА ЗАПИСЕЙ, как у эталона: слово целиком, слово без последнего слога
// и каждый слог отдельно. Это не педантизм — без записи «без последнего
// слога» слово не работает на этапе 2, без слоговых не работает этап 3.
//
// НО СОХРАНИТЬ МОЖНО И БЕЗ НИХ. Запрещать сохранение до полной озвучки
// значило бы заставить педагога сделать всё за один присест, а запись
// голоса — дело не одной минуты. Чего не хватает и какие этапы от этого
// недоступны, экран показывает прямо; правила считает домен.
//
// СЛОГИ НАБИРАЮТСЯ ИЗ ГОТОВЫХ, а не вводятся строкой с дефисами. Причина
// в том, что слог — самостоятельная сущность со своей озвучкой: разобрав
// «ко-шка» из текста, пришлось бы догадываться, тот ли это слог «ко», что
// уже есть в наборе, или новый. Выбор из списка снимает вопрос.

import React, { useMemo, useState } from 'react';
import { BigButton, Panel, ScrollArea, palette } from '../ui';
import { SyllableTile, WordCell, WordPicture } from '../components/GamePieces';
import type { Syllable, UserWordDraft, VoiceKind, Word, WordReadiness } from '../types';
import { getAlphabetPlatform } from '../platform/AlphabetPlatform';

interface Props {
  /** Все слоги: поставочные и свои */
  syllables: Syllable[];
  /** Редактируемое слово; null — создаём новое */
  word: Word | null;
  readiness: WordReadiness | null;
  /** Какие записи уже есть: ключ «род:id» */
  hasVoice: (kind: VoiceKind, id: string) => boolean;
  busy: boolean;
  onSave: (draft: UserWordDraft) => void;
  onPickImage: () => void;
  onRecord: (kind: VoiceKind, id: string) => void;
  onPlayVoice: (kind: VoiceKind, id: string) => void;
  onNewSyllable: () => void;
  onBack: () => void;
}

const WordEditorScreen: React.FC<Props> = ({
  syllables,
  word,
  readiness,
  hasVoice,
  busy,
  onSave,
  onPickImage,
  onRecord,
  onPlayVoice,
  onNewSyllable,
  onBack,
}) => {
  const [name, setName] = useState(word?.name ?? '');
  const [picked, setPicked] = useState<string[]>(word?.syllableIds ?? []);
  const [search, setSearch] = useState('');

  const byId = useMemo(() => new Map(syllables.map((s) => [s.id, s])), [syllables]);
  const platform = getAlphabetPlatform();

  const spelled = picked.map((id) => byId.get(id)?.name ?? '?').join('');
  const matches = name.trim().toLowerCase() === spelled.toLowerCase();

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? syllables.filter((s) => s.name.startsWith(q)) : syllables;
    // Показываем не весь набор: полторы сотни плиток на экране бесполезны,
    // а поиск по началу слога закрывает задачу
    return list.slice(0, 60);
  }, [syllables, search]);

  return (
    <Panel testId="word-editor">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <BigButton onClick={onBack} tone="secondary" testId="word-editor-back">
          ← Назад
        </BigButton>
        <h2 style={{ margin: 0, fontSize: 26 }}>{word ? 'Своё слово' : 'Новое слово'}</h2>
        <BigButton
          onClick={() =>
            onSave({
              name,
              syllableIds: picked,
              hasWithoutLastSyllable: picked.length >= 2 && hasVoice('bgn', word?.id ?? ''),
              imageFile: word?.imageFile ?? null,
            })
          }
          disabled={busy || !matches || picked.length === 0}
          testId="word-editor-save"
        >
          Сохранить
        </BigButton>
      </div>

      <ScrollArea testId="word-editor-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingRight: 8 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 20 }}>Слово</label>
            <input
              data-testid="word-editor-name"
              value={name}
              placeholder="Кошка"
              onChange={(e) => setName(e.target.value)}
              style={{ fontSize: 22, padding: '10px 14px', borderRadius: 12, border: 'none', width: 260 }}
            />
            {/* Несовпадение показывается сразу, а не после сохранения:
                иначе педагог набирает слоги вслепую и узнаёт об ошибке
                последним действием */}
            <span
              data-testid="word-editor-match"
              style={{ fontSize: 19, color: matches ? '#8ed0a0' : palette.accent }}
            >
              {picked.length === 0
                ? 'наберите слоги'
                : matches
                  ? `слоги складываются в «${spelled}»`
                  : `слоги дают «${spelled}» — не совпадает`}
            </span>
          </div>

          <div>
            <div style={{ fontSize: 20, marginBottom: 8 }}>Слоги слова</div>
            <div data-testid="word-editor-picked" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', minHeight: 92 }}>
              {picked.map((id, index) => (
                <div key={`${id}-${index}`} style={{ position: 'relative' }}>
                  <WordCell syllable={byId.get(id)?.name ?? '?'} testId={`word-editor-cell-${index}`} />
                  <button
                    type="button"
                    aria-label="Убрать слог"
                    data-testid={`word-editor-drop-${index}`}
                    onClick={() => setPicked((p) => p.filter((_, i) => i !== index))}
                    style={{
                      position: 'absolute',
                      top: -8,
                      right: -8,
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      border: 'none',
                      background: palette.danger,
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {picked.length === 0 && (
                <span style={{ fontSize: 19, color: palette.textDim, alignSelf: 'center' }}>
                  выберите слоги ниже по порядку
                </span>
              )}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>Выбрать слог</span>
              <input
                data-testid="word-editor-search"
                value={search}
                placeholder="поиск"
                onChange={(e) => setSearch(e.target.value)}
                style={{ fontSize: 19, padding: '8px 12px', borderRadius: 10, border: 'none', width: 150 }}
              />
              <BigButton onClick={onNewSyllable} tone="secondary" testId="word-editor-new-syllable">
                + Новый слог
              </BigButton>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {visible.map((s) => (
                <SyllableTile
                  key={s.id}
                  syllable={s.name}
                  onClick={() => setPicked((p) => [...p, s.id])}
                  testId={`word-editor-pick-${s.id}`}
                />
              ))}
            </div>
          </div>

          {/* Картинка и озвучка доступны только у сохранённого слова: записи
              адресуются его идентификатором, а у несохранённого его нет */}
          {word && (
            <>
              <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                {word.imageFile && platform ? (
                  <WordPicture
                    src={platform.userMediaUrl(word.imageFile)}
                    alt={word.name}
                    size={140}
                    testId="word-editor-image"
                  />
                ) : (
                  <span data-testid="word-editor-no-image" style={{ fontSize: 19, color: palette.textDim }}>
                    иллюстрации нет
                  </span>
                )}
                <BigButton onClick={onPickImage} tone="secondary" testId="word-editor-pick-image">
                  {word.imageFile ? 'Сменить картинку' : 'Выбрать картинку'}
                </BigButton>
              </div>

              <div>
                <div style={{ fontSize: 20, marginBottom: 8 }}>Озвучка</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <VoiceRow
                    label="Слово целиком"
                    kind="word"
                    id={word.id}
                    recorded={hasVoice('word', word.id)}
                    onRecord={onRecord}
                    onPlay={onPlayVoice}
                  />
                  {picked.length >= 2 && (
                    <VoiceRow
                      label="Слово без последнего слога"
                      hint="нужна этапу «Закончи слово»"
                      kind="bgn"
                      id={word.id}
                      recorded={hasVoice('bgn', word.id)}
                      onRecord={onRecord}
                      onPlay={onPlayVoice}
                    />
                  )}
                  {picked.map((id, index) => (
                    <VoiceRow
                      key={`${id}-${index}`}
                      label={`Слог «${byId.get(id)?.name ?? '?'}»`}
                      hint={index === 0 ? 'нужны этапу «Составь слово»' : undefined}
                      kind="syllable"
                      id={id}
                      recorded={hasVoice('syllable', id)}
                      onRecord={onRecord}
                      onPlay={onPlayVoice}
                    />
                  ))}
                </div>
              </div>

              {readiness && (
                <div
                  data-testid="word-editor-readiness"
                  style={{
                    background: 'rgba(0,0,0,0.25)',
                    borderRadius: 12,
                    padding: '12px 16px',
                    fontSize: 19,
                  }}
                >
                  {readiness.missing.length === 0 ? (
                    <span>Слово готово: работает на всех трёх этапах</span>
                  ) : (
                    <span>
                      Не хватает: {readiness.missing.join(', ')}. Сейчас работает на этапах:{' '}
                      {[
                        readiness.letterShow && 'Покажи букву',
                        readiness.wordCompleting && 'Закончи слово',
                        readiness.wordMake && 'Составь слово',
                      ]
                        .filter(Boolean)
                        .join(', ') || 'ни на одном'}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </Panel>
  );
};

interface VoiceRowProps {
  label: string;
  hint?: string;
  kind: VoiceKind;
  id: string;
  recorded: boolean;
  onRecord: (kind: VoiceKind, id: string) => void;
  onPlay: (kind: VoiceKind, id: string) => void;
}

const VoiceRow: React.FC<VoiceRowProps> = ({ label, hint, kind, id, recorded, onRecord, onPlay }) => (
  <div
    data-testid={`voice-row-${kind}-${id}`}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      background: 'rgba(255,255,255,0.10)',
      borderRadius: 12,
      padding: '10px 14px',
      flexWrap: 'wrap',
    }}
  >
    <span style={{ fontSize: 19, minWidth: 260 }}>{label}</span>
    <span
      data-testid={`voice-state-${kind}-${id}`}
      style={{ fontSize: 18, color: recorded ? '#8ed0a0' : palette.textDim, minWidth: 110 }}
    >
      {recorded ? '✓ записано' : 'нет записи'}
    </span>
    <BigButton onClick={() => onRecord(kind, id)} tone="secondary" testId={`voice-record-${kind}-${id}`}>
      {recorded ? 'Перезаписать' : 'Записать'}
    </BigButton>
    {recorded && (
      <BigButton onClick={() => onPlay(kind, id)} tone="secondary" testId={`voice-play-${kind}-${id}`}>
        ▶
      </BigButton>
    )}
    {hint && <span style={{ fontSize: 17, color: palette.textDim }}>{hint}</span>}
  </div>
);

export default WordEditorScreen;
