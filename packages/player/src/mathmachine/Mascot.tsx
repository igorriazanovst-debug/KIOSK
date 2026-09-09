import React from 'react';

// Маскот «Матвей» — финальный арт, сгенерированный через syntx.ai (Nano
// Banana) по промптам из Тип6_маскот_промпты_syntx.md, см.
// Тип6_визуальная_идентичность.md для полного описания образа. Файлы лежат
// в public/mascot/*.jpg — vite копирует public/* в dist/* без изменений
// (тот же принцип, что и озвучка, см. `./media/${id}.mp3` в TaskRunner.tsx).

export type MascotPose = 'greeting' | 'thinking' | 'celebrating';

interface Props {
  pose: MascotPose;
  size?: number;
}

const Mascot: React.FC<Props> = ({ pose, size = 120 }) => (
  <img
    src={`./mascot/matvey-${pose}.jpg`}
    alt="Матвей"
    width={size}
    height={size}
    style={{ objectFit: 'contain' }}
  />
);

export default Mascot;
