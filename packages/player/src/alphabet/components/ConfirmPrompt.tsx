// packages/player/src/alphabet/components/ConfirmPrompt.tsx
// Подтверждение необратимого действия.
//
// ЧТО СЧИТАЕТСЯ НЕОБРАТИМЫМ ЗДЕСЬ: удаление игрока (уносит его статистику),
// удаление своего слова (уносит картинку, записи и ссылки из комплектов),
// удаление комплекта и очистка статистики. Всё это нельзя отменить, а данные
// копились месяцами.
//
// ПОДТВЕРЖДЕНИЕ ГОВОРИТ, ЧТО ИМЕННО ПРОПАДЁТ, а не спрашивает «вы уверены?».
// «Вы уверены» не несёт сведений: педагог нажал кнопку, значит уверен. Знать
// он должен другое — что вместе со словом уйдут его записи, а вместе с
// игроком весь его график.
//
// КНОПКА ПОДТВЕРЖДЕНИЯ НЕ ПЕРВАЯ и покрашена в красный, а отмена стоит
// слева: на сенсорной панели палец идёт к ближнему краю, и случайное
// попадание должно приводить к отмене, а не к удалению.

import React from 'react';
import { BigButton, palette } from '../ui';

interface Props {
  /** Что удаляем — коротко, в заголовок */
  title: string;
  /** Что именно пропадёт — конкретно, а не «данные» */
  consequence: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmPrompt: React.FC<Props> = ({
  title,
  consequence,
  confirmLabel,
  onConfirm,
  onCancel,
}) => (
  <div
    data-testid="confirm-prompt"
    style={{
      position: 'absolute',
      inset: 0,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 25,
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
        maxWidth: 560,
      }}
    >
      <h2 data-testid="confirm-title" style={{ margin: 0, fontSize: 25 }}>
        {title}
      </h2>
      <p data-testid="confirm-consequence" style={{ margin: 0, fontSize: 20, color: palette.textDim }}>
        {consequence}
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <BigButton onClick={onCancel} tone="secondary" testId="confirm-cancel">
          Отмена
        </BigButton>
        <BigButton onClick={onConfirm} tone="danger" testId="confirm-ok">
          {confirmLabel}
        </BigButton>
      </div>
    </div>
  </div>
);

export default ConfirmPrompt;
