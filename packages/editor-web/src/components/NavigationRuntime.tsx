// packages/editor-web/src/components/NavigationRuntime.tsx
// Шаг 5: runtime-рендер виджета навигации в PreviewPage

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { routeMultiFloor, findFloorByTerminal } from '../utils/navigation/multiFloor';
import type { NavigationData, FloorData, Room, RouteResult, Point } from '../utils/navigation/types';
import type { NavigationWidgetProperties } from '../utils/navigation/widgetType';
import { apiClient } from '../services/api-client';

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
    animFloorDuration = 3000,
    animPauseDuration = 1000,
  } = properties;
  // NAV_ANIM_RUNTIME_INSTALLED

  // ── Определяем стартовый терминал ──────────────────────────────────
  const [terminalId, setTerminalId] = useState<string | null>(null);

  useEffect(() => {
    // Если явно задан currentTerminalId — используем его сразу
    if (currentTerminalId) {
      setTerminalId(currentTerminalId);
      return;
    }
    // API-автоопределение отключено (endpoint не существует)
    // Используем только currentTerminalId из свойств
    setTerminalId(null);
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

  // ── MULTIFLOOR DEBUG ────────────────────────────────────────────────
  // NAV_MULTIFLOOR_DEBUG_INSTALLED
  const [mfDebug, setMfDebug] = useState<string>('');


  function buildRoute(roomId: string) {
    if (!terminalId) {
      setRouteState({ result: null, targetRoomId: roomId });
      const msg = '[DEBUG] terminalId не задан — маршрут не строится';
      setMfDebug(msg);
      console.warn(msg);
      return;
    }
    const outcome = routeMultiFloor(navData, terminalId, roomId, { snap: graphSnap });
    setRouteState({ result: outcome, targetRoomId: roomId });

    // ── DEBUG дамп ───────────────────────────────────────────────────
    const g = outcome.graph;
    const lines: string[] = [];
    lines.push('=== MULTIFLOOR DEBUG ===');
    lines.push(`terminalId: ${terminalId}`);
    lines.push(`roomId: ${roomId}`);
    lines.push(`floors: ${navData.floors.map(f => f.id + '(' + f.name + ')').join(', ')}`);
    lines.push('');
    lines.push('--- graph nodes by floor ---');
    const byFloor: Record<string, number> = {};
    for (const n of g.nodes) {
      const fid = n.meta.floorId || 'unknown';
      byFloor[fid] = (byFloor[fid] || 0) + 1;
    }
    for (const [fid, cnt] of Object.entries(byFloor)) {
      lines.push(`  ${fid}: ${cnt} nodes`);
    }
    lines.push('');
    lines.push('--- terminalNode map ---');
    for (const [tid, nid] of Object.entries(g.terminalNode)) {
      lines.push(`  ${tid} => ${nid}`);
    }
    lines.push('');
    lines.push('--- roomPoiNode map (first 10) ---');
    const poiEntries = Object.entries(g.roomPoiNode).slice(0, 10);
    for (const [rid, nid] of poiEntries) {
      lines.push(`  ${rid} => ${nid}`);
    }
    lines.push('');
    lines.push('--- serviceNode map ---');
    for (const [sid, nid] of Object.entries(g.serviceNode)) {
      lines.push(`  ${sid} => ${nid}`);
    }
    lines.push('');
    lines.push('--- transitions ---');
    for (const tr of navData.transitions || []) {
      const aGid = g.serviceNode[tr.fromServiceId];
      const bGid = g.serviceNode[tr.toServiceId];
      lines.push(`  tr[${tr.id}] type=${tr.type} from=${tr.fromServiceId}(${aGid || 'NOT FOUND'}) to=${tr.toServiceId}(${bGid || 'NOT FOUND'})`);
    }
    lines.push('');
    lines.push('--- route result ---');
    const s = g.terminalNode[terminalId];
    const t = g.roomPoiNode[roomId];
    lines.push(`  start node: ${s || 'NOT FOUND'}`);
    lines.push(`  end node:   ${t || 'NOT FOUND'}`);
    lines.push(`  result: ${outcome.result ? 'OK total=' + Math.round(outcome.result.total) + ' path.len=' + outcome.result.path.length : 'NULL (no path)'}`);
    lines.push('');
    lines.push('--- segmentsByFloor ---');
    for (const seg of outcome.segmentsByFloor || []) {
      lines.push(`  floor=${seg.floorId} coords=${seg.coords.length}`);
    }
    const dbg = lines.join('\n');
    setMfDebug(dbg);
    console.log(dbg);
    // ── END DEBUG ────────────────────────────────────────────────────

    if (outcome.segmentsByFloor && outcome.segmentsByFloor.length > 0) {
      // setActiveFloorId управляет runAnimation через useEffect
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

  // ── Анимация маршрута ────────────────────────────────────────────────
  const [animProgress, setAnimProgress] = useState(1);
  const animFrameRef = useRef<number | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animDurationRef = useRef(animFloorDuration);
  const animPauseRef = useRef(animPauseDuration);
  useEffect(() => { animDurationRef.current = animFloorDuration; }, [animFloorDuration]);
  useEffect(() => { animPauseRef.current = animPauseDuration; }, [animPauseDuration]);

  function polylineLength(coords: Array<{x: number; y: number}>): number {
    let len = 0;
    for (let i = 1; i < coords.length; i++) {
      len += Math.hypot(coords[i].x - coords[i-1].x, coords[i].y - coords[i-1].y);
    }
    return len;
  }

  function trimPolyline(
    coords: Array<{x: number; y: number}>,
    progress: number,
  ): Array<{x: number; y: number}> {
    if (progress <= 0) return [coords[0]];
    if (progress >= 1) return coords;
    const total = polylineLength(coords);
    const target = total * progress;
    let acc = 0;
    const result: Array<{x: number; y: number}> = [coords[0]];
    for (let i = 1; i < coords.length; i++) {
      const segLen = Math.hypot(coords[i].x - coords[i-1].x, coords[i].y - coords[i-1].y);
      if (acc + segLen >= target) {
        const t = (target - acc) / segLen;
        result.push({
          x: coords[i-1].x + (coords[i].x - coords[i-1].x) * t,
          y: coords[i-1].y + (coords[i].y - coords[i-1].y) * t,
        });
        return result;
      }
      acc += segLen;
      result.push(coords[i]);
    }
    return coords;
  }

  const runAnimationRef = useRef<((segs: Array<{floorId: string; coords: Array<{x: number; y: number}>}>, idx: number) => void) | null>(null);

  runAnimationRef.current = function runAnimation(
    segments: Array<{floorId: string; coords: Array<{x: number; y: number}>}>,
    segIndex: number,
  ) {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (animTimerRef.current) clearTimeout(animTimerRef.current);

    const seg = segments[segIndex];
    setActiveFloorId(seg.floorId);
    setAnimProgress(0);

    const duration = animDurationRef.current;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setAnimProgress(progress);
      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        animTimerRef.current = setTimeout(() => {
          runAnimationRef.current!(segments, (segIndex + 1) % segments.length);
        }, animPauseRef.current);
      }
    }
    animFrameRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    const segments = routeState.result?.segmentsByFloor;
    if (!segments || segments.length === 0) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      setAnimProgress(1);
      return;
    }
    runAnimationRef.current!(segments, 0);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeState.result]);

  const animatedSegment = useMemo(() => {
    if (!activeSegment || activeSegment.coords.length < 2) return activeSegment;
    return { ...activeSegment, coords: trimPolyline(activeSegment.coords, animProgress) };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSegment, animProgress]);

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

      {/* ── Сообщение если терминал не определён ── */}
      {!terminalId && (
        <div style={{
          position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(231,76,60,0.85)', color: '#fff', fontSize: 12,
          padding: '6px 14px', borderRadius: 6, zIndex: 10, pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}>
          Терминал «Вы здесь» не задан — маршрут строится от выбранного помещения
        </div>
      )}

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
                    onClick={() => buildRoute(room.id)}
                    style={{ pointerEvents: 'fill', cursor: 'pointer' }}
                  />
                ))}

                {/* Маршрут */}
                {animatedSegment && animatedSegment.coords.length > 1 && (
                  <polyline
                    points={animatedSegment.coords.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke={routeColor}
                    strokeWidth={routeWidth / zoom}
                    strokeLinecap="round"
                    strokeLinejoin="round"
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

            {/* DEBUG панель */}
            {mfDebug && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 999, background: 'rgba(0,0,0,0.92)', padding: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#f39c12', fontSize: 11, fontWeight: 'bold' }}>MULTIFLOOR DEBUG</span>
                  <button onClick={() => setMfDebug('')} style={{ fontSize: 10, background: '#333', color: '#fff', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>✕</button>
                </div>
                <textarea
                  readOnly
                  value={mfDebug}
                  style={{ width: '100%', height: 180, fontSize: 10, fontFamily: 'monospace', background: '#111', color: '#0f0', border: '1px solid #333', resize: 'vertical', boxSizing: 'border-box' }}
                />
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
