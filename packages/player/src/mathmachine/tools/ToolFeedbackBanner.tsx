import React from 'react';
import Mascot from '../Mascot';
import { COLOR, FONT, RADIUS } from '../theme';

// Единый баннер обратной связи для инструментов лаборатории (Весы не
// используют — там нет проверяемого правильного ответа, только свободное
// исследование). "Неверно" сознательно оформлено янтарным, не красным —
// та же тональность, что hintStyle в TaskRunner (см. Эпик 23: revealStyle
// там же намеренно заменён с тревожного красного на спокойный индиго).

interface Props {
  correct: boolean;
  text: string;
}

const ToolFeedbackBanner: React.FC<Props> = ({ correct, text }) => (
  <div style={correct ? successStyle : hintStyle}>
    <Mascot pose={correct ? 'celebrating' : 'thinking'} size={56} />
    <span>{text}</span>
  </div>
);

const bannerBaseStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '12px 20px',
  borderRadius: RADIUS.md,
  fontFamily: FONT.ui,
  fontSize: 15,
  fontWeight: 700,
};

const successStyle: React.CSSProperties = {
  ...bannerBaseStyle,
  background: COLOR.mintLight,
  border: `2px solid ${COLOR.mint}`,
  color: COLOR.mintDark,
};

const hintStyle: React.CSSProperties = {
  ...bannerBaseStyle,
  background: COLOR.amberLight,
  border: `2px solid ${COLOR.amber}`,
  color: COLOR.text,
};

export default ToolFeedbackBanner;
