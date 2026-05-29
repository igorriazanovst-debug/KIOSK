// packages/editor-web/src/components/NavigationEditorModal.tsx
// Модалка редактора плана навигации (шаг 3a, hotfix-1: inline-хранение SVG).
// SVG-планы хранятся прямо в navData.floors[].svgContent — без upload на сервер,
// по той же схеме, что и виджет «Изображение» (data-URL в properties).

import React, { useEffect, useRef, useState } from 'react';
import { NAV_DATA_VERSION } from '../utils/navigation/widgetType';
import type { FloorData, NavigationData } from '../utils/navigation/types';
import './NavigationEditorModal.css';

type Tool =
  | 'pan'
  | 'corridor'
  | 'room'
  | 'poi'
  | 'entry'
  | 'stairs'
  | 'elevator'
  | 'terminal';

interface NavigationEditorModalProps {
  navData: NavigationData;
  onSave: (data: NavigationData, activeFloorId: string | null) => void;
  onClose: () => void;
  initialActiveFloorId?: string | null;
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

const NavigationEditorModal: React.FC<NavigationEditorModalProps> = ({
  navData: initialData,
  onSave,
  onClose,
  initialActiveFloorId,
}) => {
  // Локальная копия данных — все правки в ней, при сохранении пушим наружу.
  const [navData, setNavData] = useState<NavigationData>(() => {
    return JSON.parse(JSON.stringify(initialData));
  });
  const [activeFloorId, setActiveFloorId] = useState<string | null>(
    initialActiveFloorId ?? initialData.floors[0]?.id ?? null,
  );

  const [tool, setTool] = useState<Tool>('pan');
  const [planError, setPlanError] = useState<string>('');

  const stageRef = useRef<HTMLDivElement | null>(null);
  const svgHostRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const activeFloor = navData.floors.find((f) => f.id === activeFloorId) || null;

  // ── Парсинг viewBox после вставки SVG в DOM ────────────────────────
  useEffect(() => {
    setPlanError('');
    if (!activeFloor?.svgContent || !svgHostRef.current) return;
    const svg = svgHostRef.current.querySelector('svg');
    if (!svg) {
      setPlanError('SVG не распознан');
      return;
    }
    const vb = svg.getAttribute('viewBox');
    let width = activeFloor.viewBox.width;
    let height = activeFloor.viewBox.height;
    if (vb) {
      const parts = vb.split(/\s+|,/).map(Number);
      if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
        width = parts[2];
        height = parts[3];
      }
    } else {
      const w = svg.getAttribute('width');
      const h = svg.getAttribute('height');
      if (w) width = parseFloat(w);
      if (h) height = parseFloat(h);
    }
    if (width !== activeFloor.viewBox.width || height !== activeFloor.viewBox.height) {
      patchFloor(activeFloor.id, { viewBox: { width, height } });
    }
    fitToStage(width, height);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFloor?.svgContent]);

  // ── Помощники изменения данных ─────────────────────────────────────
  function patchNav(patch: Partial<NavigationData>) {
    setNavData((prev) => ({ ...prev, ...patch }));
  }
  function patchFloor(floorId: string, patch: Partial<FloorData>) {
    setNavData((prev) => ({
      ...prev,
      floors: prev.floors.map((f) => (f.id === floorId ? { ...f, ...patch } : f)),
    }));
  }

  // ── Добавление этажа ────────────────────────────────────────────────
  function addFloor() {
    const id = genId('floor');
    const level = navData.floors.length + 1;
    const floor: FloorData = {
      id,
      name: `Этаж ${level}`,
      level,
      svgContent: undefined,
      viewBox: { width: 1000, height: 1000 },
      corridors: [],
      rooms: [],
      service: [],
      terminals: [],
    };
    setNavData((prev) => ({ ...prev, floors: [...prev.floors, floor] }));
    setActiveFloorId(id);
  }

  function removeFloor(floorId: string) {
    if (!confirm('Удалить этаж со всей разметкой?')) return;
    setNavData((prev) => {
      const floors = prev.floors.filter((f) => f.id !== floorId);
      const transitions = prev.transitions.filter(
        (t) => t.fromFloorId !== floorId && t.toFloorId !== floorId,
      );
      return { ...prev, floors, transitions };
    });
    if (activeFloorId === floorId) {
      const remaining = navData.floors.filter((f) => f.id !== floorId);
      setActiveFloorId(remaining[0]?.id ?? null);
    }
  }

  // ── Загрузка SVG плана (inline, без сервера) ───────────────────────
  function handleUploadPlan(file: File) {
    if (!activeFloor) return;
    const isSvgMime = file.type.includes('svg');
    const isSvgExt = file.name.toLowerCase().endsWith('.svg');
    if (!isSvgMime && !isSvgExt) {
      alert('Поддерживаются только SVG-файлы');
      return;
    }
    // Лёгкий лимит на размер inline (10 МБ — для SVG этого достаточно с запасом)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert(`SVG-файл слишком большой (${Math.round(file.size / 1024)} КБ). Максимум 10 МБ.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        alert('Не удалось прочитать файл');
        return;
      }
      if (!text.includes('<svg')) {
        alert('Файл не содержит SVG-разметки');
        return;
      }
      patchFloor(activeFloor.id, { svgContent: text });
    };
    reader.onerror = () => alert('Ошибка чтения файла');
    reader.readAsText(file);
  }

  function clearPlan() {
    if (!activeFloor) return;
    if (!confirm('Удалить текущий SVG-план этажа?')) return;
    patchFloor(activeFloor.id, { svgContent: undefined });
  }

  // ── Стейдж: панорама/зум ────────────────────────────────────────────
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  function onStageMouseDown(e: React.MouseEvent) {
    if (tool === 'pan' || e.button === 1 || e.button === 2) {
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    }
  }
  function onStageMouseMove(e: React.MouseEvent) {
    if (isPanning && panStart.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setPan({ x: panStart.current.px + dx, y: panStart.current.py + dy });
    }
  }
  function onStageMouseUp() {
    setIsPanning(false);
    panStart.current = null;
  }
  function onStageWheel(e: React.WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.05, Math.min(20, zoom * factor));
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) {
      setZoom(newZoom);
      return;
    }
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const sx = (mx - pan.x) / zoom;
    const sy = (my - pan.y) / zoom;
    setZoom(newZoom);
    setPan({ x: mx - sx * newZoom, y: my - sy * newZoom });
  }

  function fitToStage(vbWidth: number, vbHeight: number) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const z = Math.min(rect.width / vbWidth, rect.height / vbHeight) * 0.9;
    setZoom(z);
    setPan({
      x: (rect.width - vbWidth * z) / 2,
      y: (rect.height - vbHeight * z) / 2,
    });
  }
  function handleFit() {
    if (!activeFloor) return;
    fitToStage(activeFloor.viewBox.width, activeFloor.viewBox.height);
  }
  function handleZoomIn() {
    setZoom((z) => Math.min(20, z * 1.2));
  }
  function handleZoomOut() {
    setZoom((z) => Math.max(0.05, z / 1.2));
  }

  // ── Сохранение/закрытие ────────────────────────────────────────────
  function handleSave() {
    onSave(navData, activeFloorId);
    onClose();
  }
  function handleCancel() {
    if (!confirm('Отменить изменения и закрыть редактор?')) return;
    onClose();
  }

  // ── Импорт/экспорт JSON ────────────────────────────────────────────
  function handleExportJson() {
    const blob = new Blob([JSON.stringify(navData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'navigation.json';
    a.click();
    URL.revokeObjectURL(url);
  }
  function handleImportJson(file: File) {
    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text);
        if (!parsed.version || !Array.isArray(parsed.floors)) {
          alert('Неверный формат JSON');
          return;
        }
        if (!confirm('Заменить текущие данные навигации импортом?')) return;
        setNavData(parsed);
        setActiveFloorId(parsed.floors[0]?.id ?? null);
      } catch (e: any) {
        alert('Ошибка чтения JSON: ' + (e?.message || e));
      }
    });
  }

  // ── Hint для активного инструмента ─────────────────────────────────
  const hintByTool: Record<Tool, string> = {
    pan: 'Просмотр: тяните мышью, колесо — зум',
    corridor: 'Кликайте по точкам осевой линии коридора. Enter — закончить, Esc — отмена. (логика появится в 3b)',
    room: 'Кликайте по углам контура помещения. Enter — замкнуть, Esc — отмена. (логика появится в 3b)',
    poi: 'Кликом ставится POI помещения. (логика появится в 3b)',
    entry: 'Кликом ставится точка входа в помещение. (логика появится в 3b)',
    stairs: 'Кликом ставится лестница. (логика появится в 3b)',
    elevator: 'Кликом ставится лифт. (логика появится в 3b)',
    terminal: 'Кликом ставится терминал. (логика появится в 3b)',
  };

  const hasPlan = !!activeFloor?.svgContent;

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="nav-editor-backdrop" onMouseDown={(e) => e.stopPropagation()}>
      <div className="nav-editor-modal">
        <div className="nav-editor-header">
          <h3>🧭 Редактор плана навигации</h3>
          <div className="actions">
            <button className="sec" onClick={handleExportJson}>
              Экспорт JSON
            </button>
            <label className="sec" style={{ background: '#3a3a3a', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: '#fff' }}>
              Импорт JSON
              <input
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImportJson(f);
                  e.target.value = '';
                }}
              />
            </label>
            <button className="danger" onClick={handleCancel}>
              Отмена
            </button>
            <button onClick={handleSave}>Сохранить</button>
          </div>
        </div>

        <div className="nav-editor-body">
          {/* Левая колонка */}
          <div className="nav-editor-side">
            <div className="scroll">
              <h4>Этажи</h4>
              <div className="nav-editor-floors-list">
                {navData.floors.length === 0 && (
                  <div className="nav-editor-info">Этажей нет. Добавьте первый.</div>
                )}
                {navData.floors.map((f) => (
                  <div
                    key={f.id}
                    className={`nav-editor-floor-row ${f.id === activeFloorId ? 'active' : ''}`}
                    onClick={() => setActiveFloorId(f.id)}
                  >
                    <input
                      type="text"
                      value={f.name}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => patchFloor(f.id, { name: e.target.value })}
                      style={{ flex: 1, margin: 0, padding: '2px 6px', background: 'transparent', border: 'none', color: '#e0e0e0', fontSize: 12 }}
                    />
                    <span style={{ fontSize: 10, color: '#888' }}>уровень {f.level}</span>
                    <span
                      className="del"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFloor(f.id);
                      }}
                    >
                      ✕
                    </span>
                  </div>
                ))}
              </div>
              <button onClick={addFloor}>+ Добавить этаж</button>

              {activeFloor && (
                <>
                  <h4>План активного этажа</h4>
                  <label>SVG-файл (только .svg)</label>
                  <input
                    type="file"
                    accept=".svg,image/svg+xml"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadPlan(f);
                      e.target.value = '';
                    }}
                  />
                  {hasPlan ? (
                    <>
                      <div className="nav-editor-info" style={{ marginBottom: 8 }}>
                        План загружен (inline).
                        <br />
                        viewBox: {Math.round(activeFloor.viewBox.width)} × {Math.round(activeFloor.viewBox.height)}
                        <br />
                        Размер: {Math.round((activeFloor.svgContent?.length || 0) / 1024)} КБ
                      </div>
                      <button className="sec" onClick={clearPlan}>
                        Удалить план
                      </button>
                    </>
                  ) : (
                    <div className="nav-editor-info" style={{ marginBottom: 8 }}>
                      План не загружен.
                    </div>
                  )}

                  <h4>Инструменты разметки</h4>
                  {(
                    [
                      ['pan', '✋ Просмотр / выбор'],
                      ['corridor', '🛣️ Осевая коридора'],
                      ['room', '⬛ Контур помещения'],
                      ['poi', '📍 POI помещения'],
                      ['entry', '🚪 Точка входа'],
                      ['stairs', '🪜 Лестница'],
                      ['elevator', '🛗 Лифт'],
                      ['terminal', '🖥️ Терминал'],
                    ] as Array<[Tool, string]>
                  ).map(([t, label]) => (
                    <button
                      key={t}
                      className={`tool ${tool === t ? 'active' : ''}`}
                      onClick={() => setTool(t)}
                      disabled={!hasPlan && t !== 'pan'}
                      title={!hasPlan ? 'Сначала загрузите SVG-план' : ''}
                    >
                      {label}
                    </button>
                  ))}

                  <h4>Объекты этажа</h4>
                  <div className="nav-editor-info">
                    Коридоров: {activeFloor.corridors.length}
                    <br />
                    Помещений: {activeFloor.rooms.length}
                    <br />
                    Лестниц/лифтов: {activeFloor.service.length}
                    <br />
                    Терминалов: {activeFloor.terminals.length}
                  </div>
                </>
              )}

              <h4>Маршрут (общие настройки)</h4>
              <label>Штраф за лестницу</label>
              <input
                type="number"
                min={0}
                value={navData.edgeCosts.stairsPenalty}
                onChange={(e) =>
                  patchNav({
                    edgeCosts: {
                      ...navData.edgeCosts,
                      stairsPenalty: Math.max(0, Number(e.target.value) || 0),
                    },
                  })
                }
              />
              <label>Штраф за лифт</label>
              <input
                type="number"
                min={0}
                value={navData.edgeCosts.elevatorPenalty}
                onChange={(e) =>
                  patchNav({
                    edgeCosts: {
                      ...navData.edgeCosts,
                      elevatorPenalty: Math.max(0, Number(e.target.value) || 0),
                    },
                  })
                }
              />

              <h4>Версия формата</h4>
              <div className="nav-editor-info">v{navData.version || NAV_DATA_VERSION}</div>
            </div>
          </div>

          {/* Правая область — стейдж */}
          <div
            ref={stageRef}
            className={`nav-editor-stage ${!activeFloor || !hasPlan ? 'empty' : ''}`}
            onMouseDown={onStageMouseDown}
            onMouseMove={onStageMouseMove}
            onMouseUp={onStageMouseUp}
            onMouseLeave={onStageMouseUp}
            onWheel={onStageWheel}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              cursor: isPanning ? 'grabbing' : tool === 'pan' ? 'grab' : 'crosshair',
            }}
          >
            {!activeFloor && (
              <div className="placeholder">
                Добавьте этаж и загрузите SVG-план, чтобы начать разметку.
              </div>
            )}
            {activeFloor && !hasPlan && (
              <div className="placeholder">
                Загрузите SVG-план для этажа «{activeFloor.name}».
              </div>
            )}
            {activeFloor && hasPlan && planError && (
              <div className="placeholder" style={{ color: '#e07a7a' }}>
                Ошибка: {planError}
              </div>
            )}
            {activeFloor && hasPlan && (
              <>
                <div
                  ref={svgHostRef}
                  className="nav-editor-svg-host"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  }}
                  dangerouslySetInnerHTML={{ __html: activeFloor.svgContent || '' }}
                />
                <svg
                  className="nav-editor-overlay"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    width: activeFloor.viewBox.width,
                    height: activeFloor.viewBox.height,
                  }}
                  viewBox={`0 0 ${activeFloor.viewBox.width} ${activeFloor.viewBox.height}`}
                >
                  {/* На шаге 3b сюда добавится overlay с разметкой */}
                </svg>
                <div className="nav-editor-hint">{hintByTool[tool]}</div>
                <div className="nav-editor-topbar">
                  <button className="sec" onClick={handleZoomOut}>
                    －
                  </button>
                  <button className="sec" onClick={handleZoomIn}>
                    ＋
                  </button>
                  <button className="sec" onClick={handleFit}>
                    ⤢ Fit
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NavigationEditorModal;
