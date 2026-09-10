// packages/player/src/words/screens/WordEditorScreen.tsx
// Создание и правка своего слова — ТЗ строка 55: «редактирование материалов
// и дополнения контента собственными учебными материалами: аудио,
// текстовыми и графическими». Ровно три типа материала, как у эталона.
//
// Запись с микрофона идёт через MediaRecorder прямо в рендерере (спайк 0.4
// подтвердил, что доступ выдаётся без обработчика разрешений), а байты
// уходят в главный процесс — файл создаёт он, рендерер к диску не ходит.
//
// Отказ в доступе к микрофону обрабатывается отдельно: на чистом устройстве
// Windows может блокировать микрофон системной политикой приватности, и
// педагогу нужно понятное объяснение, а не тишина.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BigButton, ErrorBanner, ScreenFrame, palette, TOUCH_TARGET_PX } from '../ui';
import Keyboard from '../components/Keyboard';
import { userMediaUrl } from '../mediaUrl';
import type { UserWord } from '@kiosk/shared';
import type { UserWordDraft, WordsApi } from '../types';

interface Props {
  api: WordsApi;
  /** null — создаём новое слово */
  editing: UserWord | null;
  error: string | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (draft: UserWordDraft) => void;
}

type RecordState = 'idle' | 'recording' | 'saving';

const WordEditorScreen: React.FC<Props> = ({ api, editing, error, busy, onCancel, onSave }) => {
  const [name, setName] = useState(editing?.name ?? '');
  const [imageFile, setImageFile] = useState<string | null>(editing?.imageFile ?? null);
  const [audioFile, setAudioFile] = useState<string | null>(editing?.audioFile ?? null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [recordState, setRecordState] = useState<RecordState>('idle');

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);

  // Микрофон обязательно освобождается при уходе с экрана: иначе на
  // устройстве остаётся гореть индикатор записи, и педагог решит, что
  // приложение слушает урок
  useEffect(
    () => () => {
      recorderRef.current?.state === 'recording' && recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    []
  );

  const pick = useCallback(
    async (kind: 'image' | 'audio') => {
      setLocalError(null);
      const res = await api.pickMediaFile(kind);
      if (!res.ok) {
        setLocalError(res.error ?? 'Не удалось добавить файл');
        return;
      }
      if (!res.data || res.data.canceled) return;
      if (kind === 'image') setImageFile(res.data.fileName);
      else setAudioFile(res.data.fileName);
    },
    [api]
  );

  const startRecording = useCallback(async () => {
    setLocalError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setRecordState('saving');
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType });
          const bytes = new Uint8Array(await blob.arrayBuffer());
          const res = await api.saveRecording(bytes);
          if (res.ok && res.data) setAudioFile(res.data.fileName);
          else setLocalError(res.error ?? 'Не удалось сохранить запись');
        } catch (err) {
          setLocalError(err instanceof Error ? err.message : 'Не удалось сохранить запись');
        } finally {
          setRecordState('idle');
        }
      };
      recorder.start();
      setRecordState('recording');
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      setRecordState('idle');
      if (name === 'NotAllowedError') {
        setLocalError(
          'Доступ к микрофону запрещён. Проверьте разрешения микрофона в параметрах Windows или обратитесь к администратору.'
        );
      } else if (name === 'NotFoundError') {
        setLocalError('Микрофон не найден. Подключите микрофон или загрузите готовый звуковой файл.');
      } else {
        setLocalError('Не удалось начать запись');
      }
    }
  }, [api]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  const playPreview = useCallback(() => {
    if (!audioFile) return;
    if (!previewRef.current) previewRef.current = new Audio();
    previewRef.current.src = userMediaUrl(audioFile);
    void previewRef.current.play().catch(() => setLocalError('Не удалось воспроизвести запись'));
  }, [audioFile]);

  const canSave = name.trim().length > 0 && (!!imageFile || !!audioFile) && !busy;

  return (
    <ScreenFrame title={editing ? 'Правка слова' : 'Новое слово'} onBack={onCancel}>
      <ErrorBanner text={localError ?? error} />

      <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0 }}>
        {/* Название */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 24 }}>Название</span>
          <div
            data-testid="word-name"
            style={{
              minHeight: TOUCH_TARGET_PX,
              fontSize: 32,
              padding: '12px 18px',
              borderRadius: 12,
              border: `2px solid ${palette.accent}`,
              background: palette.bg,
            }}
          >
            {name || <span style={{ color: palette.textMuted }}>Введите название</span>}
          </div>
          <Keyboard value={name} onChange={setName} maxLength={64} />
        </div>

        {/* Картинка и звук */}
        <div style={{ width: 380, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span style={{ fontSize: 24 }}>Изображение</span>
          <div
            data-testid="word-image"
            style={{
              height: 190,
              borderRadius: 12,
              border: `2px dashed ${palette.panelLight}`,
              background: palette.panel,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {imageFile ? (
              <img
                src={userMediaUrl(imageFile)}
                alt=""
                style={{ maxWidth: '100%', maxHeight: '100%' }}
              />
            ) : (
              <span style={{ fontSize: 20, color: palette.textMuted }}>картинки нет</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <BigButton onClick={() => void pick('image')} testId="pick-image">
              Выбрать файл
            </BigButton>
            {imageFile && (
              <BigButton onClick={() => setImageFile(null)} tone="danger" testId="clear-image">
                Убрать
              </BigButton>
            )}
          </div>

          <span style={{ fontSize: 24 }}>Звук</span>
          <div data-testid="word-audio" style={{ fontSize: 20, color: palette.textMuted }}>
            {recordState === 'recording'
              ? '● идёт запись…'
              : recordState === 'saving'
                ? 'сохраняем запись…'
                : audioFile
                  ? 'запись есть'
                  : 'записи нет'}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {recordState === 'recording' ? (
              <BigButton onClick={stopRecording} tone="danger" testId="stop-recording">
                ■ Стоп
              </BigButton>
            ) : (
              <BigButton onClick={() => void startRecording()} disabled={recordState === 'saving'} testId="start-recording">
                ● Записать
              </BigButton>
            )}
            <BigButton onClick={() => void pick('audio')} tone="secondary" testId="pick-audio">
              Файл
            </BigButton>
            {audioFile && (
              <>
                <BigButton onClick={playPreview} tone="secondary" testId="play-audio">
                  ▶ Прослушать
                </BigButton>
                <BigButton onClick={() => setAudioFile(null)} tone="danger" testId="clear-audio">
                  Убрать
                </BigButton>
              </>
            )}
          </div>

          {!imageFile && !audioFile && (
            <span style={{ fontSize: 18, color: palette.textMuted }}>
              Нужна хотя бы картинка или запись — иначе слово нечем показать ребёнку.
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <BigButton onClick={onCancel} tone="secondary" testId="cancel-word">
          Отмена
        </BigButton>
        <BigButton
          onClick={() => onSave({ name: name.trim(), imageFile, audioFile })}
          disabled={!canSave}
          wide
          testId="save-word"
        >
          Сохранить
        </BigButton>
      </div>
    </ScreenFrame>
  );
};

export default WordEditorScreen;
