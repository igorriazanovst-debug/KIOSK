// packages/player/src/alphabet/components/VoiceRecorder.tsx
// Запись голоса педагога — ТЗ строка 76 («дополнение контента собственными
// материалами: аудио»).
//
// ЗАПИСЬ ИДЁТ В РЕНДЕРЕРЕ, потому что MediaRecorder есть только там. Байты
// уезжают в главный процесс, и уже он проверяет сигнатуру и пишет файл:
// рендерер — граница системы, и доверять его слову «это звук» нельзя.
//
// РАЗДЕЛЬНЫЕ «ЗАПИСЬ» И «СТОП», а не удержание кнопки. У эталона поведение
// зависит от типа устройства: на планшете удержание, на доске раздельные.
// Раздельные выбраны для всех: у доски палец далеко от кнопки, удержание там
// неудобно, а на планшете раздельные кнопки работают не хуже удержания.
//
// ДОСТУП К МИКРОФОНУ МОЖЕТ БЫТЬ НЕ ДАН — и это не исключительная ситуация:
// на школьном компьютере микрофона может не быть вовсе. Поэтому отказ
// показывается текстом, а не роняет экран.

import React, { useEffect, useRef, useState } from 'react';
import { BigButton, palette } from '../ui';

interface Props {
  title: string;
  onSave: (bytes: Uint8Array) => Promise<void>;
  onCancel: () => void;
}

/** Предел длины записи. Слово или слог — это секунды, а не минуты */
const MAX_SECONDS = 15;

const VoiceRecorder: React.FC<Props> = ({ title, onSave, onCancel }) => {
  const [state, setState] = useState<'idle' | 'recording' | 'ready' | 'saving'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const blob = useRef<Blob | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Дорожка микрофона обязана быть закрыта. Без этого индикатор записи на
   * устройстве горит после ухода с экрана, и педагог справедливо считает,
   * что приложение его слушает.
   */
  const release = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  useEffect(() => release, []);

  const start = async () => {
    setError(null);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      chunks.current = [];
      const mr = new MediaRecorder(media);
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      mr.onstop = () => {
        blob.current = new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' });
        setState('ready');
        release();
      };
      recorder.current = mr;
      mr.start();
      setState('recording');
      setSeconds(0);
      timer.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) {
            try {
              mr.stop();
            } catch {
              /* уже остановлен */
            }
          }
          return s + 1;
        });
      }, 1000);
    } catch (err) {
      // Микрофона может не быть вовсе — это не поломка приложения
      setError(
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Доступ к микрофону не разрешён'
          : 'Микрофон недоступен'
      );
      setState('idle');
      release();
    }
  };

  const stop = () => {
    try {
      recorder.current?.stop();
    } catch {
      release();
      setState('idle');
    }
  };

  const save = async () => {
    if (!blob.current) return;
    setState('saving');
    try {
      const buffer = new Uint8Array(await blob.current.arrayBuffer());
      await onSave(buffer);
    } catch {
      setError('Не удалось сохранить запись');
      setState('ready');
    }
  };

  return (
    <div
      data-testid="voice-recorder"
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
      }}
    >
      <div
        style={{
          background: palette.panel,
          borderRadius: 22,
          padding: 26,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          alignItems: 'center',
          minWidth: 420,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 24 }}>{title}</h2>

        <div
          data-testid="voice-recorder-state"
          style={{ fontSize: 20, color: state === 'recording' ? '#ff8f7a' : palette.textDim }}
        >
          {state === 'idle' && 'Готово к записи'}
          {state === 'recording' && `● Идёт запись… ${seconds} с (не больше ${MAX_SECONDS})`}
          {state === 'ready' && 'Запись сделана — прослушайте и сохраните'}
          {state === 'saving' && 'Сохраняю…'}
        </div>

        {error && (
          <div data-testid="voice-recorder-error" style={{ fontSize: 19, color: '#ffd2c9' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {state !== 'recording' && (
            <BigButton onClick={start} disabled={state === 'saving'} testId="voice-recorder-start">
              {state === 'ready' ? 'Записать заново' : 'Записать'}
            </BigButton>
          )}
          {state === 'recording' && (
            <BigButton onClick={stop} tone="danger" testId="voice-recorder-stop">
              Стоп
            </BigButton>
          )}
          {state === 'ready' && blob.current && (
            <BigButton
              onClick={() => {
                const url = URL.createObjectURL(blob.current as Blob);
                const audio = new Audio(url);
                void audio.play().finally(() => URL.revokeObjectURL(url));
              }}
              tone="secondary"
              testId="voice-recorder-play"
            >
              ▶ Прослушать
            </BigButton>
          )}
          {state === 'ready' && (
            <BigButton onClick={save} testId="voice-recorder-save">
              Сохранить
            </BigButton>
          )}
          <BigButton
            onClick={() => {
              release();
              onCancel();
            }}
            tone="secondary"
            testId="voice-recorder-cancel"
          >
            Закрыть
          </BigButton>
        </div>
      </div>
    </div>
  );
};

export default VoiceRecorder;
