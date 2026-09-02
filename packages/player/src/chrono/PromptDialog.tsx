// packages/player/src/chrono/PromptDialog.tsx
// Замена window.prompt() - Electron его не реализует вообще (бросает
// "Uncaught Error: prompt() is not supported." при вызове, не показывая
// никакого диалога), найдено вживую при первом реальном запуске в
// Electron. window.alert()/window.confirm() Electron поддерживает нативно
// (проверено там же), поэтому их трогать не нужно - только prompt().

import React, { useState } from 'react';
import './PromptDialog.css';

export interface PromptDialogProps {
  title: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

const PromptDialog: React.FC<PromptDialogProps> = ({
  title,
  initialValue = '',
  placeholder,
  confirmLabel = 'ОК',
  onSubmit,
  onCancel,
}) => {
  const [value, setValue] = useState(initialValue);
  const canSubmit = value.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit(value.trim());
  };

  return (
    <div className="chrono-prompt__overlay" onClick={onCancel}>
      <form className="chrono-prompt" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3 className="chrono-prompt__title">{title}</h3>
        <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
        <div className="chrono-prompt__actions">
          <button type="button" onClick={onCancel}>
            Отмена
          </button>
          <button type="submit" disabled={!canSubmit}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PromptDialog;
