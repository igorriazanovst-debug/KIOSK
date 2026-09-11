// packages/player/src/periodictable/tabState.ts
// Чистая логика нижней панели вкладок — вынесена из PeriodicTableRuntime.tsx,
// чтобы её можно было проверить юнит-тестами без React/DOM. Именно в этой
// логике финальное ревью всей ветки нашло 2 из 5 самых серьёзных находок
// (пустой teacherPin оставлял вкладку «Настройки вида» мёртвой; подсветка
// найденного в поиске не снималась при закрытии вкладки) — раньше это
// проверялось только живым CDP-прогоном, который не покрывал все ветки
// состояния. См. Тип8_трассировочная_матрица.md, раздел «Дефекты, найденные
// этой приёмочной сверкой».

export type BottomTab = 'none' | 'search' | 'viewSettings' | 'legend';

// Клик по вкладке «Поиск»/«Легенда»: повторный клик по уже открытой
// закрывает её, клик по другой — переключает.
export function toggleTab(current: BottomTab, clicked: 'search' | 'legend'): BottomTab {
  return current === clicked ? 'none' : clicked;
}

// Подсветка найденного элемента (SearchTab → TableScreen) должна жить
// только пока открыт Поиск — иначе ученик, закрывший вкладку или
// переключившийся на другую, остаётся с навсегда обведённой ячейкой без
// единого видимого способа её снять.
export function shouldClearHighlight(nextTab: BottomTab): boolean {
  return nextTab !== 'search';
}

export type ViewSettingsClickResult =
  | { action: 'close' }
  | { action: 'openDirectly' }
  | { action: 'showPinModal' };

// Пустой teacherPin означает «блокировка отключена» (спека, разд. 5:
// "пусто = блокировка отключена") — в этом случае клик должен открывать
// вкладку напрямую, без модалки PIN. Раньше решение было размазано между
// обработчиком клика и отдельным условием рендера панели, и второе условие
// не учитывало пустой PIN — вкладка "открывалась" (activeTab менялся), но
// панель никогда не рендерилась, то есть клик визуально не делал ничего.
export function decideViewSettingsClick(
  activeTab: BottomTab,
  viewSettingsUnlocked: boolean,
  effectivePin: string,
): ViewSettingsClickResult {
  if (activeTab === 'viewSettings') return { action: 'close' };
  if (viewSettingsUnlocked || !effectivePin) return { action: 'openDirectly' };
  return { action: 'showPinModal' };
}
