// packages/editor-web/src/components/NavigationRuntime.tsx
// Шаг 5: runtime-рендер виджета навигации в PreviewPage

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { routeMultiFloor, findFloorByTerminal } from '../utils/navigation/multiFloor';
import type { NavigationData, FloorData, Room, RouteResult, Point } from '../utils/navigation/types';
import type { NavigationWidgetProperties } from '../utils/navigation/widgetType';

interface Props {
  properties: NavigationWidgetProperties;
  width: number;
  height: number;
}

interface RouteState {
  result: ReturnType<typeof routeMultiFloor> | null;
  targetRoomId: string | null;
}

const SIDEBAR_W = 260;
const SEARCH_H = 48;

const NavigationRuntime: React.FC<Props> = ({ properties, width, height }) => {
  const {
    navData,
    currentTerminalId,
    graphSnap,
    routeColor = '#e74c3c',
    routeWidth = 6,
    youAreHereColor = '#2ecc71',
    showRoomList = true,
    showSearch = true,
  } = properties;

  // ── Определяем стартовый терминал ──────────────────────────────────
  const [terminalId, setTerminalId] = useState<string | null>(null);

  useEffect(() => {
    // Пытаемся определить терминал по deviceId через API
    const tryDetect = async () => {
      try {
        const r = await fetch('/api/admin/devices/current');
        if (r.ok) {
          const d = await r.json();
          const deviceId: string = d?.id || d?.deviceId || '';
          if (deviceId) {
            for (const f of navData.floors) {
              const t = f.terminals.find((t) => t.deviceId === deviceId);
              if (t) { setTerminalId(t.id); return; }
            }
          }
        }
      } catch {}
      // Fallback: currentTerminalId из свойств
      setTerminalId(currentTerminalId);
    };
    tryDetect();
  }, [currentTerminalId, navData]);

  // ── Активный этаж ───────────────────────────────────────────────────
  const startFloor = useMemo(() => {
    if (terminalId) return findFloorByTerminal(navData, terminalId);
    return navData.floors[0] ?? null;
  }, [navData, terminalId]);

  const [activeFloorId, setActiveFloorId] = useState<string | null>(null);
  useEffect(() => {
    setActiveFloorId(startFloor?.id ?? navData.floors[0]?.id ?? null);
  }, [startFloor, navData]);

  const activeFloor = useMemo(
    () => navData.floors.find((f) => f.id === activeFloorId) ?? null,
    [navData, activeFloorId],
  );

  // ── Поиск ───────────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const allRooms = useMemo(
    () => navData.floors.flatMap((f) => f.rooms.map((r) => ({ ...r, floorId: f.id, floorName: f.name }))),
    [navData],
  );
  const filtered = useMemo(() => {
    if (!query.trim()) return allRooms;
    const q = query.toLowerCase();
    return allRooms.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.aliases || []).some((a) => a.toLowerCase().includes(q)),
    );
  }, [allRooms, query]);

  // ── Маршрут ─────────────────────────────────────────────────────────
  const [routeState, setRouteState] = useState<RouteState>({ result: null, targetRoomId: null });

  function buildRoute(roomId: string) {
    if (!terminalId) { alert('Терминал «Вы здесь» не определён.'); return; }
    const outcome = routeMultiFloor(navData, terminalId, roomId, { snap: graphSnap });
    setRouteState({ result: outcome, targetRoomId: roomId });
    // Переключаемся на этаж начала маршрута (этаж терминала)
    if (outcome.segmentsByFloor && outcome.segmentsByFloor.length > 0) {
      setActiveFloorId(outcome.segmentsByFloor[0].floorId);
    }
  }

  function clearRoute() {
    setRouteState({ result: null, targetRoomId: null });
  }

  // ── Сегмент маршрута для активного этажа ────────────────────────────
  const activeSegment = useMemo(() => {
    if (!routeState.result?.segmentsByFloor || !activeFloorId) return null;
    return routeState.result.segmentsByFloor.find((s) => s.floorId === activeFloorId) ?? null;
  }, [routeState, activeFloorId]);

  // ── SVG-план: fit ──────────────────────────────────────────────────
  const stageW = (showRoomList ? width - SIDEBAR_W : width);
  const stageH = height;

  const { zoom, panX, panY } = useMemo(() => {
    if (!activeFloor) return { zoom: 1, panX: 0, panY: 0 };
    const vbW = activeFloor.viewBox.width;
    const vbH = activeFloor.viewBox.height;
    if (!vbW || !vbH) return { zoom: 1, panX: 0, panY: 0 };
    const z = Math.min(stageW / vbW, stageH / vbH) * 0.92;
    return {
      zoom: z,
      panX: (stageW - vbW * z) / 2,
      panY: (stageH - vbH * z) / 2,
    };
  }, [activeFloor, stageW, stageH]);

  // ── Подсветка целевого помещения ────────────────────────────────────
  const targetRoom = useMemo(() => {
    if (!routeState.targetRoomId || !activeFloor) return null;
    return activeFloor.rooms.find((r) => r.id === routeState.targetRoomId) ?? null;
  }, [routeState.targetRoomId, activeFloor]);

  // ── Терминал на активном этаже ──────────────────────────────────────
  const activeTerminal = useMemo(() => {
    if (!terminalId || !activeFloor) return null;
    return activeFloor.terminals.find((t) => t.id === terminalId) ?? null;
  }, [terminalId, activeFloor]);

  // ── render ──────────────────────────────────────────────────────────
  if (navData.floors.length === 0) {
    return (
      <div style={emptyStyle(width, height)}>
        <div style={{ fontSize: 48 }}>🧭</div>
        <div style={{ fontSize: 18, marginTop: 8 }}>{properties.title || 'Навигация'}</div>
        <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Нет данных этажей</div>
      </div>
    );
  }

  return (
    <div style={{ width, height, display: 'flex', flexDirection: 'row', background: '#0d1b2a', overflow: 'hidden', userSelect: 'none' }}>

      {/* ── Левая панель ── */}
      {showRoomList && (
        <div style={{
          width: SIDEBAR_W, height, display: 'flex', flexDirection: 'column',
          background: '#111c28', borderRight: '1px solid #1e3a50', flexShrink: 0,
        }}>
          {/* Заголовок */}
          <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid #1e3a50' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e0e0e0' }}>
              {properties.title || 'Навигация'}
            </div>
            {routeState.targetRoomId && (
              <button onClick={clearRoute} style={clearBtnStyle}>
                ✕ Сбросить маршрут
              </button>
            )}
          </div>

          {/* Поиск */}
          {showSearch && (
            <div style={{ padding: '8px 10px', borderBottom: '1px solid #1e3a50' }}>
              <input
                type="text"
                placeholder="Поиск помещения…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={searchInputStyle}
              />
            </div>
          )}

          {/* Переключение этажей */}
          {navData.floors.length > 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 10px', borderBottom: '1px solid #1e3a50' }}>
              {navData.floors
                .slice()
                .sort((a, b) => a.level - b.level)
                .map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFloorId(f.id)}
                    style={floorBtnStyle(f.id === activeFloorId)}
                  >
                    {f.name}
                  </button>
                ))}
            </div>
          )}

          {/* Список помещений */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {filtered.length === 0 && (
              <div style={{ padding: '12px 14px', color: '#666', fontSize: 12 }}>Ничего не найдено</div>
            )}
            {filtered.map((room) => {
              const isTarget = room.id === routeState.targetRoomId;
              return (
                <div
                  key={room.id}
                  onClick={() => buildRoute(room.id)}
                  style={roomItemStyle(isTarget)}
                >
                  <div style={{ fontSize: 13, color: isTarget ? '#fff' : '#d0d0d0', fontWeight: isTarget ? 600 : 400 }}>
                    {room.title || room.id}
                  </div>
                  <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>{room.floorName}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Правая область: план ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {!activeFloor?.svgContent ? (
          <div style={emptyStyle(stageW, stageH)}>
            <div style={{ fontSize: 13, color: '#888' }}>
              {activeFloor ? `Нет плана для «${activeFloor.name}»` : 'Нет активного этажа'}
            </div>
          </div>
        ) : (
          <>
            {/* SVG-план */}
            <div
              style={{
                position: 'absolute',
                transformOrigin: '0 0',
                transform: `translate(${panX}px,${panY}px) scale(${zoom})`,
                width: activeFloor.viewBox.width,
                height: activeFloor.viewBox.height,
              }}
              dangerouslySetInnerHTML={{ __html: activeFloor.svgContent }}
            />

            {/* Overlay */}
            <svg
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
            >
              <g transform={`translate(${panX},${panY}) scale(${zoom})`}>

                {/* Все помещения — тонкий контур */}
                {activeFloor.rooms.map((room) => (
                  <polygon
                    key={room.id}
                    points={room.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill={room.id === routeState.targetRoomId ? 'rgba(231,76,60,0.18)' : 'rgba(255,255,255,0.04)'}
                    stroke={room.id === routeState.targetRoomId ? routeColor : 'rgba(255,255,255,0.15)'}
                    strokeWidth={room.id === routeState.targetRoomId ? 2 / zoom : 1 / zoom}
                  />
                ))}

                {/* Маршрут */}
                {activeSegment && activeSegment.coords.length > 1 && (
                  <polyline
                    points={activeSegment.coords.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke={routeColor}
                    strokeWidth={routeWidth / zoom}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={`${20 / zoom} ${8 / zoom}`}
                  />
                )}

                {/* «Вы здесь» — терминал */}
                {activeTerminal && (
                  <g>
                    <circle
                      cx={activeTerminal.x} cy={activeTerminal.y}
                      r={18 / zoom}
                      fill={youAreHereColor} stroke="#fff" strokeWidth={2 / zoom}
                    />
                    <text
                      x={activeTerminal.x} y={activeTerminal.y}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize={11 / zoom} fill="#fff"
                      style={{ userSelect: 'none' }}
                    >
                      ВЫ
                    </text>
                    <text
                      x={activeTerminal.x} y={activeTerminal.y + 26 / zoom}
                      textAnchor="middle"
                      fontSize={9 / zoom} fill={youAreHereColor}
                      style={{ userSelect: 'none' }}
                    >
                      {activeTerminal.label || 'Вы здесь'}
                    </text>
                  </g>
                )}

                {/* Цель маршрута */}
                {targetRoom && targetRoom.poi && (
                  <g>
                    <circle
                      cx={targetRoom.poi.x} cy={targetRoom.poi.y}
                      r={14 / zoom}
                      fill={routeColor} stroke="#fff" strokeWidth={2 / zoom}
                    />
                    <text
                      x={targetRoom.poi.x} y={targetRoom.poi.y}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize={10 / zoom} fill="#fff"
                      style={{ userSelect: 'none' }}
                    >
                      &#x1F3C1;
                    </text>
                  </g>
                )}

                {/* Название целевого помещения */}
                {targetRoom && (
                  (() => {
                    const cx = targetRoom.polygon.reduce((s, p) => s + p.x, 0) / targetRoom.polygon.length;
                    const cy = targetRoom.polygon.reduce((s, p) => s + p.y, 0) / targetRoom.polygon.length;
                    return (
                      <text
                        x={cx} y={cy}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize={13 / zoom} fill={routeColor}
                        fontWeight="bold"
                        style={{ userSelect: 'none' }}
                      >
                        {targetRoom.title}
                      </text>
                    );
                  })()
                )}
              </g>
            </svg>

            {/* Переключение этажей (если нет сайдбара) */}
            {!showRoomList && navData.floors.length > 1 && (
              <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 4 }}>
                {navData.floors
                  .slice()
                  .sort((a, b) => a.level - b.level)
                  .map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setActiveFloorId(f.id)}
                      style={floorBtnStyle(f.id === activeFloorId)}
                    >
                      {f.name}
                    </button>
                  ))}
              </div>
            )}

            {/* Инфо маршрута */}
            {routeState.result?.result && (
              <div style={routeInfoStyle}>
                <span>&#x1F6B6; {Math.round(routeState.result.result.total)} у.е.</span>
                {(routeState.result.segmentsByFloor?.length ?? 0) > 1 && (
                  <span style={{ marginLeft: 8, color: '#aaa' }}>
                    {routeState.result.segmentsByFloor!.length} этажа
                  </span>
                )}
                <button onClick={clearRoute} style={{ ...clearBtnStyle, marginLeft: 12 }}>✕</button>
              </div>
            )}
            {routeState.targetRoomId && !routeState.result?.result && (
              <div style={{ ...routeInfoStyle, color: '#e07a7a' }}>
                Маршрут не найден. Проверьте разметку коридоров.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ── Стили ────────────────────────────────────────────────────────────────────
function emptyStyle(w: number, h: number): React.CSSProperties {
  return {
    width: w, height: h,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: '#0d1b2a', color: '#7ec8e3',
    textAlign: 'center',
  };
}

const clearBtnStyle: React.CSSProperties = {
  marginTop: 6, fontSize: 11, color: '#e07a7a',
  background: 'transparent', border: 'none',
  cursor: 'pointer', padding: 0,
};

const searchInputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: '#1a2e40', border: '1px solid #2a4a60',
  borderRadius: 4, padding: '6px 10px',
  color: '#e0e0e0', fontSize: 13, outline: 'none',
};

function floorBtnStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 11, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
    background: active ? '#1a6a9a' : '#1a2e40',
    border: active ? '1px solid #2a8ac0' : '1px solid #2a4a60',
    color: active ? '#fff' : '#aaa',
  };
}

function roomItemStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 14px', cursor: 'pointer',
    background: active ? '#1a3a52' : 'transparent',
    borderLeft: active ? `3px solid #e74c3c` : '3px solid transparent',
    borderBottom: '1px solid #141e2a',
    transition: 'background 0.1s',
  };
}

const routeInfoStyle: React.CSSProperties = {
  position: 'absolute', bottom: 14, left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(13,27,42,0.9)', border: '1px solid #1e3a50',
  borderRadius: 6, padding: '6px 14px',
  color: '#e0e0e0', fontSize: 13,
  display: 'flex', alignItems: 'center',
  backdropFilter: 'blur(4px)',
};

export default NavigationRuntime;
