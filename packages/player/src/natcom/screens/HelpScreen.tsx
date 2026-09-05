// packages/player/src/natcom/screens/HelpScreen.tsx
// Тип5_бэклог.md, T5-052: встроенная справка. Объём текста намеренно минимален -
// полноценный контент (Эпик 11) ещё не готов, это не пустая заглушка, а честное
// описание того, что widget умеет уже сейчас.

import React from 'react';
import './screens.css';

const HelpScreen: React.FC = () => (
  <div className="natcom-screen">
    <section className="natcom-screen__panel">
      <h2 className="natcom-screen__heading">Как это работает</h2>
      <ol className="natcom-screen__help-list">
        <li>На экране «Главная» создайте презентацию — выберите название и фон.</li>
        <li>Откройте презентацию, чтобы разместить на фоне объекты природного сообщества.</li>
        <li>
          Пока презентация открыта, ученики на других устройствах школьной сети могут
          подключиться в браузере по адресу, показанному на экране виджета.
        </li>
      </ol>
      <p className="natcom-screen__hint">
        Редактор и совместный просмотр находятся в разработке — часть функций из
        технического задания появится в следующих версиях.
      </p>
    </section>
  </div>
);

export default HelpScreen;
