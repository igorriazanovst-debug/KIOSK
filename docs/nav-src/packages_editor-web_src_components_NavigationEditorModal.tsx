// packages/editor-web/src/components/NavigationEditorModal.tsx
// Шаг 3b hotfix-3: overlay без перехвата событий, pan через ref, заголовок из title

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NAV_DATA_VERSION } from '../utils/navigation/widgetType';
import type {
  Corridor,
  FloorData,
  NavigationData,
  Point,
  Room,
  ServicePoint,
  Terminal,
} from '../utils/navigation/types';
import './NavigationEditorModal.css';

type Tool =
  | 'pan'
  | 'corridor'
  | 'room'
  | 'rect'
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

function snapAngle(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return to;
  const angle = Math.atan2(dy, dx);
  const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  return { x: from.x + len * Math.cos(snapped), y: from.y + len * Math.sin(snapped) };
}

const NavigationEditorModal: React.FC<NavigationEditorModalProps> = ({
  navData: initialData,
  onSave,
  onClose,
  initialActiveFloorId,
}) => {
  const [navData, setNavData] = useState<NavigationData>(() =>
    JSON.parse(JSON.stringify(initialData)),
  );
  const [activeFloorId, setActiveFloorId] = useState<string | null>(
    initialActiveFloorId ?? initialData.floors[0]?.id ?? null,
  );
  const [tool, setTool] = useState<Tool>('pan');
  const [planError, setPlanError] = useState<string>('');

  const stageRef = useRef<HTMLDivElement | null>(null);
  const svgHostRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef({ x: 0, y: 0 });

  // Промежуточные точки рисования
  const [drawPoints, setDrawPoints] = useState<Point[]>([]);
  const drawPointsRef = useRef<Point[]>([]);
  const [cursorPt, setCursorPt] = useState<Point | null>(null);
  const rectStartRef = useRef<Point | null>(null);
  const [rectEnd, setRectEnd] = useState<Point | null>(null);

  // Pan через ref — синхронно
  const isPanningRef = useRef(false);
  const panStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  // Флаг: было ли реальное перемещение во время mousedown-mouseup
  const didPanRef = useRef(false);

  const [selectedCorridorId, setSelectedCorridorId] = useState<string | null>(null);

  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { drawPointsRef.current = drawPoints; }, [drawPoints]);

  const activeFloor = navData.floors.find((f) => f.id === activeFloorId) ?? null;

  // Парсинг viewBox после вставки SVG
  useEffect(() => {
    setPlanError('');
    if (!activeFloor?.svgContent || !svgHostRef.current) return;
    // Дождёмся рендера
    requestAnimationFrame(() => {
      const svg = svgHostRef.current?.querySelector('svg');
      if (!svg) { setPlanError('SVG не распознан'); return; }
      const vb = svg.getAttribute('viewBox');
      let width = activeFloor.viewBox.width;
      let height = activeFloor.viewBox.height;
      if (vb) {
        const parts = vb.split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
          width = parts[2]; height = parts[3];
        }
      } else {
        const w = svg.getAttribute('width'); const h = svg.getAttribute('height');
        if (w) width = parseFloat(w); if (h) height = parseFloat(h);
      }
      if (width !== activeFloor.viewBox.width || height !== activeFloor.viewBox.height) {
        patchFloor(activeFloor.id, { viewBox: { width, height } });
      }
      fitToStage(width, height);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFloor?.svgContent]);

  // Сброс при смене инструмента/этажа
  useEffect(() => {
    setDrawPoints([]);
    drawPointsRef.current = [];
    setCursorPt(null);
    setRectEnd(null);
    rectStartRef.current = null;
    setSelectedCorridorId(null);
  }, [tool, activeFloorId]);

  // Клавиатура
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Enter') {
        if (tool === 'corridor') commitCorridor();
        if (tool === 'room') commitRoom();
      }
      if (e.key === 'Escape') {
        setDrawPoints([]);
        drawPointsRef.current = [];
        setCursorPt(null);
        rectStartRef.current = null;
        setRectEnd(null);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && tool === 'pan' && selectedCorridorId) {
        deleteCorridor(selectedCorridorId);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, selectedCorridorId]);

  // ── Helpers ──────────────────────────────────────────────────────────
  function patchNav(patch: Partial<NavigationData>) {
    setNavData((prev) => ({ ...prev, ...patch }));
  }
  function patchFloor(floorId: string, patch: Partial<FloorData>) {
    setNavData((prev) => ({
      ...prev,
      floors: prev.floors.map((f) => (f.id === floorId ? { ...f, ...patch } : f)),
    }));
  }

  function toFloorCoords(clientX: number, clientY: number): Point {
    const rect = stageRef.current!.getBoundingClientRect();
    const p = panRef.current;
    const z = zoomRef.current;
    return {
      x: (clientX - rect.left - p.x) / z,
      y: (clientY - rect.top - p.y) / z,
    };
  }

  // ── Commit ───────────────────────────────────────────────────────────
  function commitCorridor(pts?: Point[]) {
    const points = pts ?? drawPointsRef.current;
    if (!activeFloorId || points.length < 2) {
      setDrawPoints([]); drawPointsRef.current = [];
      return;
    }
    const corridor: Corridor = { id: genId('cor'), points: [...points] };
    setNavData((prev) => ({
      ...prev,
      floors: prev.floors.map((f) =>
        f.id === activeFloorId ? { ...f, corridors: [...f.corridors, corridor] } : f,
      ),
    }));
    setDrawPoints([]); drawPointsRef.current = [];
    setCursorPt(null);
  }

  function commitRoom(extraPoints?: Point[]) {
    const pts = extraPoints ?? drawPointsRef.current;
    if (!activeFloorId || pts.length < 3) {
      setDrawPoints([]); drawPointsRef.current = [];
      return;
    }
  const title = window.prompt('Название помещения (можно оставить пустым):') ?? '';
    const room: Room = { id: genId('room'), title, polygon: [...pts] };
    setNavData((prev) => ({
      ...prev,
      floors: prev.floors.map((f) =>
        f.id === activeFloorId ? { ...f, rooms: [...f.rooms, room] } : f,
      ),
    }));
    setDrawPoints([]); drawPointsRef.current = [];
    setCursorPt(null);
  }

  function deleteCorridor(id: string) {
    if (!activeFloorId) return;
    setNavData((prev) => ({
      ...prev,
      floors: prev.floors.map((f) =>
        f.id === activeFloorId ? { ...f, corridors: f.corridors.filter((c) => c.id !== id) } : f,
      ),
    }));
    setSelectedCorridorId(null);
  }
  function deleteRoom(id: string) {
    if (!activeFloorId || !window.confirm('Удалить помещение?')) return;
    setNavData((prev) => ({
      ...prev,
      floors: prev.floors.map((f) =>
        f.id === activeFloorId ? { ...f, rooms: f.rooms.filter((r) => r.id !== id) } : f,
      ),
    }));
  }
  function deleteService(id: string) {
    if (!activeFloorId || !window.confirm('Удалить объект?')) return;
    setNavData((prev) => ({
      ...prev,
      floors: prev.floors.map((f) =>
        f.id === activeFloorId ? { ...f, service: f.service.filter((s) => s.id !== id) } : f,
      ),
    }));
  }
  function deleteTerminal(id: string) {
    if (!activeFloorId || !window.confirm('Удалить терминал?')) return;
    setNavData((prev) => ({
      ...prev,
      floors: prev.floors.map((f) =>
        f.id === activeFloorId ? { ...f, terminals: f.terminals.filter((t) => t.id !== id) } : f,
      ),
    }));
  }

  // ── Stage events — все на div-stage, overlay pointerEvents:none ──────
  function onStageMouseDown(e: React.MouseEvent) {
    if (e.button === 1 || e.button === 2 || tool === 'pan') {
      e.preventDefault();
      isPanningRef.current = true;
      didPanRef.current = false;
      panStart.current = { x: e.clientX, y: e.clientY, px: panRef.current.x, py: panRef.current.y };
      return;
    }
    if (tool === 'rect' && e.button === 0 && activeFloor) {
      const pt = toFloorCoords(e.clientX, e.clientY);
      rectStartRef.current = pt;
      setRectEnd(pt);
    }
  }

  function onStageMouseMove(e: React.MouseEvent) {
    if (isPanningRef.current && panStart.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didPanRef.current = true;
      const newPan = { x: panStart.current.px + dx, y: panStart.current.py + dy };
      panRef.current = newPan;
      setPan(newPan);
      return;
    }
    if ((tool === 'corridor' || tool === 'room') && drawPointsRef.current.length > 0) {
      const pt = toFloorCoords(e.clientX, e.clientY);
      const snapped =
        tool === 'corridor' && e.shiftKey && drawPointsRef.current.length > 0
          ? snapAngle(drawPointsRef.current[drawPointsRef.current.length - 1], pt)
          : pt;
      setCursorPt(snapped);
    }
    if (tool === 'rect' && rectStartRef.current) {
      setRectEnd(toFloorCoords(e.clientX, e.clientY));
    }
  }

  function onStageMouseUp(e: React.MouseEvent) {
    if (tool === 'rect' && rectStartRef.current && rectEnd && activeFloor) {
      const s = rectStartRef.current;
      if (Math.abs(rectEnd.x - s.x) > 10 && Math.abs(rectEnd.y - s.y) > 10) {
        const x0 = Math.min(s.x, rectEnd.x); const y0 = Math.min(s.y, rectEnd.y);
        const x1 = Math.max(s.x, rectEnd.x); const y1 = Math.max(s.y, rectEnd.y);
        commitRoom([{ x:x0,y:y0 },{ x:x1,y:y0 },{ x:x1,y:y1 },{ x:x0,y:y1 }]);
      }
      rectStartRef.current = null;
      setRectEnd(null);
    }
    isPanningRef.current = false;
    panStart.current = null;
  }

  function onStageClick(e: React.MouseEvent) {
    if (e.button !== 0) return;
    // Если был pan — игнорируем клик
    if (didPanRef.current) { didPanRef.current = false; return; }
    if (!activeFloor) return;

    const pt = toFloorCoords(e.clientX, e.clientY);

    if (tool === 'pan') {
      setSelectedCorridorId(null);
      return;
    }

    if (tool === 'corridor') {
      const prev = drawPointsRef.current;
      const snapped = prev.length > 0 && e.shiftKey ? snapAngle(prev[prev.length - 1], pt) : pt;
      const next = [...prev, snapped];
      drawPointsRef.current = next;
      setDrawPoints(next);
      return;
    }

    if (tool === 'room') {
      const next = [...drawPointsRef.current, pt];
      drawPointsRef.current = next;
      setDrawPoints(next);
      return;
    }

    if (tool === 'poi') {
      const room = nearestRoom(activeFloor, pt);
      if (!room) { alert('Нет помещений. Сначала нарисуйте контур.'); return; }
      setNavData((prev) => ({
        ...prev,
        floors: prev.floors.map((f) =>
          f.id === activeFloorId
            ? { ...f, rooms: f.rooms.map((r) => r.id === room.id ? { ...r, poi: { x:pt.x, y:pt.y } } : r) }
            : f,
        ),
      }));
      return;
    }

    if (tool === 'entry') {
      const room = nearestRoom(activeFloor, pt);
      if (!room) { alert('Нет помещений.'); return; }
      setNavData((prev) => ({
        ...prev,
        floors: prev.floors.map((f) =>
          f.id === activeFloorId
            ? { ...f, rooms: f.rooms.map((r) => r.id === room.id ? { ...r, entry: { x:pt.x, y:pt.y } } : r) }
            : f,
        ),
      }));
      return;
    }

    if (tool === 'stairs' || tool === 'elevator') {
      const label = window.prompt(`Метка (${tool === 'stairs' ? 'лестница' : 'лифт'}):`) ?? '';
      const sp: ServicePoint = { id: genId('sp'), kind: tool, x: pt.x, y: pt.y, label };
      setNavData((prev) => ({
        ...prev,
        floors: prev.floors.map((f) =>
          f.id === activeFloorId ? { ...f, service: [...f.service, sp] } : f,
        ),
      }));
      return;
    }

    if (tool === 'terminal') {
      const idx = (activeFloor?.terminals.length ?? 0) + 1;
      const label = window.prompt('Метка терминала:') ?? `T${idx}`;
      const terminal: Terminal = { id: genId('term'), label, x: pt.x, y: pt.y };
      setNavData((prev) => ({
        ...prev,
        floors: prev.floors.map((f) =>
          f.id === activeFloorId ? { ...f, terminals: [...f.terminals, terminal] } : f,
        ),
      }));
      return;
    }
  }

  function onStageDblClick(e: React.MouseEvent) {
    e.preventDefault();
    if (tool === 'corridor') commitCorridor();
    if (tool === 'room') commitRoom();
  }

  function onStageWheel(e: React.WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.05, Math.min(20, zoomRef.current * factor));
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) { setZoom(newZoom); zoomRef.current = newZoom; return; }
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
    const sx = (mx - panRef.current.x) / zoomRef.current;
    const sy = (my - panRef.current.y) / zoomRef.current;
    const newPan = { x: mx - sx * newZoom, y: my - sy * newZoom };
    zoomRef.current = newZoom;
    panRef.current = newPan;
    setZoom(newZoom);
    setPan(newPan);
  }

  function fitToStage(vbWidth: number, vbHeight: number) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || vbWidth === 0 || vbHeight === 0) return;
    const z = Math.min(rect.width / vbWidth, rect.height / vbHeight) * 0.9;
    const newPan = { x: (rect.width - vbWidth * z) / 2, y: (rect.height - vbHeight * z) / 2 };
    zoomRef.current = z; panRef.current = newPan;
    setZoom(z); setPan(newPan);
  }
  function handleFit() { if (activeFloor) fitToStage(activeFloor.viewBox.width, activeFloor.viewBox.height); }
  function handleZoomIn() { const z = Math.min(20, zoomRef.current * 1.2); zoomRef.current = z; setZoom(z); }
  function handleZoomOut() { const z = Math.max(0.05, zoomRef.current / 1.2); zoomRef.current = z; setZoom(z); }

  function nearestRoom(floor: FloorData, pt: Point): Room | null {
    if (floor.rooms.length === 0) return null;
    let nearest = floor.rooms[0]; let minDist = Infinity;
    for (const r of floor.rooms) {
      const cx = r.polygon.reduce((s, p) => s + p.x, 0) / r.polygon.length;
      const cy = r.polygon.reduce((s, p) => s + p.y, 0) / r.polygon.length;
      const d = Math.hypot(pt.x - cx, pt.y - cy);
      if (d < minDist) { minDist = d; nearest = r; }
    }
    return nearest;
  }

  // ── Этажи ────────────────────────────────────────────────────────────
  function addFloor() {
    const id = genId('floor');
    const level = navData.floors.length + 1;
    const floor: FloorData = {
      id, name: `Этаж ${level}`, level,
      svgContent: undefined,
      viewBox: { width: 1000, height: 1000 },
      corridors: [], rooms: [], service: [], terminals: [],
    };
    setNavData((prev) => ({ ...prev, floors: [...prev.floors, floor] }));
    setActiveFloorId(id);
  }
  function removeFloor(floorId: string) {
    if (!window.confirm('Удалить этаж со всей разметкой?')) return;
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

  // ── SVG план ─────────────────────────────────────────────────────────
  function handleUploadPlan(file: File) {
    if (!activeFloor) return;
    const isSvg = file.type.includes('svg') || file.name.toLowerCase().endsWith('.svg');
    if (!isSvg) { alert('Поддерживаются только SVG-файлы'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('SVG слишком большой. Максимум 10 МБ.'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text || !text.includes('<svg')) { alert('Файл не содержит SVG-разметки'); return; }
      patchFloor(activeFloor.id, { svgContent: text });
    };
    reader.onerror = () => alert('Ошибка чтения файла');
    reader.readAsText(file);
  }
  function clearPlan() {
    if (!activeFloor || !window.confirm('Удалить текущий SVG-план этажа?')) return;
    patchFloor(activeFloor.id, { svgContent: undefined });
  }

  function handleSave() { onSave(navData, activeFloorId); onClose(); }
  function handleCancel() {
    if (!window.confirm('Отменить изменения и закрыть редактор?')) return;
    onClose();
  }

  function handleExportJson() {
    const blob = new Blob([JSON.stringify(navData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'navigation.json'; a.click();
    URL.revokeObjectURL(url);
  }
  function handleImportJson(file: File) {
    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text);
        if (!parsed.version || !Array.isArray(parsed.floors)) { alert('Неверный формат JSON'); return; }
        if (!window.confirm('Заменить текущие данные навигации импортом?')) return;
        setNavData(parsed);
        setActiveFloorId(parsed.floors[0]?.id ?? null);
      } catch (e: any) { alert('Ошибка чтения JSON: ' + (e?.message || e)); }
    });
  }



  // ── Transitions ─────────────────────────────────────────────────────────
  function addTransition() {
    if (navData.floors.length < 2) { alert('Нужно минимум 2 этажа.'); return; }
    const f1 = navData.floors[0];
    const f2 = navData.floors[1];
    const sp1 = f1.service[0];
    const sp2 = f2.service[0];
    if (!sp1 || !sp2) { alert('На каждом этаже должна быть хотя бы одна лестница или лифт.'); return; }
    const tr: import('../utils/navigation/types').FloorTransition = {
      id: genId('tr'),
      type: sp1.kind,
      fromFloorId: f1.id,
      fromServiceId: sp1.id,
      toFloorId: f2.id,
      toServiceId: sp2.id,
    };
    patchNav({ transitions: [...navData.transitions, tr] });
  }

  function removeTransition(trId: string) {
    patchNav({ transitions: navData.transitions.filter((t) => t.id !== trId) });
  }

  function patchTransition(trId: string, patch: Partial<import('../utils/navigation/types').FloorTransition>) {
    patchNav({
      transitions: navData.transitions.map((t) => (t.id === trId ? { ...t, ...patch } : t)),
    });
  }

  const hasPlan = !!activeFloor?.svgContent;

  const hintByTool: Record<Tool, string> = {
    pan: 'Просмотр: тяните мышью, колесо — зум. Выбор коридора кликом, Delete — удалить.',
    corridor: 'Кликайте точки оси. Shift — snap 45°. Enter/2×клик — закончить, Esc — отмена.',
    room: 'Кликайте углы контура. Enter/2×клик — замкнуть, Esc — отмена.',
    rect: 'Drag — прямоугольное помещение.',
    poi: 'Клик — ставит POI ближайшему помещению.',
    entry: 'Клик — ставит точку входа ближайшему помещению.',
    stairs: 'Клик — ставит лестницу.',
    elevator: 'Клик — ставит лифт.',
    terminal: 'Клик — ставит терминал.',
  };

  // ── Overlay: pointerEvents:none — все клики идут на stage ────────────
  const renderOverlay = () => {
    if (!activeFloor) return null;
    const vbW = activeFloor.viewBox.width;
    const vbH = activeFloor.viewBox.height;
    return (
      <svg
        className="nav-editor-overlay"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          width: vbW, height: vbH,
          pointerEvents: 'none',       // ← все события идут сквозь overlay на div-stage
          transformOrigin: '0 0',
        }}
        viewBox={`0 0 ${vbW} ${vbH}`}
      >
        {/* Хит-области для коридоров — только в pan-режиме */}
        {tool === 'pan' && activeFloor.corridors.map((cor) => {
          const pts = cor.points.map((p) => `${p.x},${p.y}`).join(' ');
          return (
            <polyline key={`hit_${cor.id}`}
              points={pts} fill="none"
              stroke="transparent" strokeWidth={40}
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onClick={() => setSelectedCorridorId(cor.id)}
            />
          );
        })}

        {/* Коридоры — визуал */}
        {activeFloor.corridors.map((cor) => {
          const pts = cor.points.map((p) => `${p.x},${p.y}`).join(' ');
          const isSel = cor.id === selectedCorridorId;
          return (
            <g key={cor.id} style={{ pointerEvents: 'none' }}>
              <polyline points={pts} fill="none"
                stroke={isSel ? '#ff6b35' : '#4a90e2'} strokeWidth={2 / zoom}
                strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray={isSel ? `${8/zoom} ${4/zoom}` : undefined}
              />
              {cor.points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3/zoom} fill={isSel ? '#ff6b35' : '#4a90e2'} />
              ))}
            </g>
          );
        })}

        {/* Помещения */}
        {activeFloor.rooms.map((room) => {
          const pts = room.polygon.map((p) => `${p.x},${p.y}`).join(' ');
          const cx = room.polygon.reduce((s, p) => s + p.x, 0) / room.polygon.length;
          const cy = room.polygon.reduce((s, p) => s + p.y, 0) / room.polygon.length;
          return (
            <g key={room.id}>
              {tool === 'pan' && (
                <polygon points={pts} fill="transparent" stroke="transparent" strokeWidth={8/zoom}
                  style={{ pointerEvents: 'fill', cursor: 'pointer' }}
                  onClick={() => {
                    if (window.confirm(`Удалить помещение "${room.title || room.id}"?`)) deleteRoom(room.id);
                  }}
                />
              )}
              <polygon points={pts}
                fill="rgba(39,174,96,0.12)" stroke="#27ae60" strokeWidth={1.5/zoom}
                style={{ pointerEvents: 'none' }}
              />
              {room.title && (
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                  fontSize={12/zoom} fill="#27ae60" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {room.title}
                </text>
              )}
              {room.poi && (
                <circle cx={room.poi.x} cy={room.poi.y} r={8/zoom}
                  fill="#e74c3c" stroke="#fff" strokeWidth={1.5/zoom} style={{ pointerEvents: 'none' }} />
              )}
              {room.entry && (
                <rect x={room.entry.x - 6/zoom} y={room.entry.y - 6/zoom}
                  width={12/zoom} height={12/zoom}
                  fill="#f39c12" stroke="#fff" strokeWidth={1.5/zoom} style={{ pointerEvents: 'none' }} />
              )}
            </g>
          );
        })}

        {/* Лестницы/лифты */}
        {activeFloor.service.map((sp) => {
          const isStairs = sp.kind === 'stairs';
          return (
            <g key={sp.id}>
              {tool === 'pan' && (
                <circle cx={sp.x} cy={sp.y} r={18/zoom} fill="transparent"
                  style={{ pointerEvents: 'fill', cursor: 'pointer' }}
                  onClick={() => {
                    if (window.confirm(`Удалить ${isStairs ? 'лестницу' : 'лифт'} "${sp.label || sp.id}"?`)) deleteService(sp.id);
                  }}
                />
              )}
              <circle cx={sp.x} cy={sp.y} r={14/zoom}
                fill={isStairs ? '#9b59b6' : '#1abc9c'} stroke="#fff" strokeWidth={1.5/zoom}
                style={{ pointerEvents: 'none' }}
              />
              <text x={sp.x} y={sp.y} textAnchor="middle" dominantBaseline="middle"
                fontSize={10/zoom} fill="#fff" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                {isStairs ? '\u26a0' : 'L'}
              </text>
              {sp.label && (
                <text x={sp.x} y={sp.y + 18/zoom} textAnchor="middle"
                  fontSize={9/zoom} fill={isStairs ? '#9b59b6' : '#1abc9c'}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {sp.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Терминалы */}
        {activeFloor.terminals.map((term) => (
          <g key={term.id}>
            {tool === 'pan' && (
              <rect x={term.x - 16/zoom} y={term.y - 16/zoom}
                width={32/zoom} height={32/zoom} fill="transparent"
                style={{ pointerEvents: 'fill', cursor: 'pointer' }}
                onClick={() => {
                  if (window.confirm(`Удалить терминал "${term.label}"?`)) deleteTerminal(term.id);
                }}
              />
            )}
            <rect x={term.x - 12/zoom} y={term.y - 12/zoom}
              width={24/zoom} height={24/zoom} rx={3/zoom}
              fill="#2c3e50" stroke="#4a90e2" strokeWidth={1.5/zoom}
              style={{ pointerEvents: 'none' }}
            />
            <text x={term.x} y={term.y} textAnchor="middle" dominantBaseline="middle"
              fontSize={9/zoom} fill="#4a90e2" style={{ pointerEvents: 'none', userSelect: 'none' }}>
              {term.label}
            </text>
          </g>
        ))}

        {/* Предпросмотр коридора */}
        {tool === 'corridor' && drawPoints.length > 0 && (
          <>
            <polyline
              points={[...drawPoints, cursorPt ?? drawPoints[drawPoints.length-1]]
                .map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none" stroke="#4a90e2" strokeWidth={2/zoom}
              strokeDasharray={`${6/zoom} ${3/zoom}`} style={{ pointerEvents: 'none' }}
            />
            {drawPoints.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={4/zoom} fill="#4a90e2" style={{ pointerEvents: 'none' }} />
            ))}
          </>
        )}

        {/* Предпросмотр полигона помещения */}
        {tool === 'room' && drawPoints.length > 0 && (
          <>
            <polygon
              points={[...drawPoints, cursorPt ?? drawPoints[drawPoints.length-1]]
                .map((p) => `${p.x},${p.y}`).join(' ')}
              fill="rgba(39,174,96,0.10)" stroke="#27ae60" strokeWidth={1.5/zoom}
              strokeDasharray={`${6/zoom} ${3/zoom}`} style={{ pointerEvents: 'none' }}
            />
            {drawPoints.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={4/zoom} fill="#27ae60" style={{ pointerEvents: 'none' }} />
            ))}
          </>
        )}

        {/* Предпросмотр rect */}
        {tool === 'rect' && rectStartRef.current && rectEnd && (
          <rect
            x={Math.min(rectStartRef.current.x, rectEnd.x)}
            y={Math.min(rectStartRef.current.y, rectEnd.y)}
            width={Math.abs(rectEnd.x - rectStartRef.current.x)}
            height={Math.abs(rectEnd.y - rectStartRef.current.y)}
            fill="rgba(39,174,96,0.10)" stroke="#27ae60" strokeWidth={1.5/zoom}
            strokeDasharray={`${6/zoom} ${3/zoom}`} style={{ pointerEvents: 'none' }}
          />
        )}
      </svg>
    );
  };

  const title = navData.title || 'Редактор плана навигации';

  return (
    <div className="nav-editor-backdrop" onMouseDown={(e) => e.stopPropagation()}>
      <div className="nav-editor-modal">
        <div className="nav-editor-header">
          <h3 style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:18 }}>&#x1F9ED;</span>
            <input
              type="text"
              value={navData.title || ''}
              placeholder="Название навигации"
              onChange={(e) => patchNav({ title: e.target.value })}
              style={{
                background: 'transparent', border: 'none', borderBottom: '1px solid #555',
                color: '#e0e0e0', fontSize: 16, fontWeight: 600, outline: 'none',
                minWidth: 200, padding: '2px 4px',
              }}
            />
          </h3>
          <div className="actions">
            <button className="sec" onClick={handleExportJson}>Экспорт JSON</button>
            <label className="sec" style={{ background:'#3a3a3a',padding:'6px 12px',borderRadius:4,cursor:'pointer',fontSize:12,color:'#fff' }}>
              Импорт JSON
              <input type="file" accept=".json" style={{ display:'none' }}
                onChange={(e) => { const f=e.target.files?.[0]; if(f) handleImportJson(f); e.target.value=''; }} />
            </label>
            <button className="danger" onClick={handleCancel}>Отмена</button>
            <button onClick={handleSave}>Сохранить</button>
          </div>
        </div>

        <div className="nav-editor-body">
          <div className="nav-editor-side">
            <div className="scroll">
              <h4>Этажи</h4>
              <div className="nav-editor-floors-list">
                {navData.floors.length === 0 && (
                  <div className="nav-editor-info">Этажей нет. Добавьте первый.</div>
                )}
                {navData.floors.map((f) => (
                  <div key={f.id}
                    className={`nav-editor-floor-row ${f.id === activeFloorId ? 'active' : ''}`}
                    onClick={() => setActiveFloorId(f.id)}
                  >
                    <input type="text" value={f.name}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => patchFloor(f.id, { name: e.target.value })}
                      style={{ flex:1,margin:0,padding:'2px 6px',background:'transparent',border:'none',color:'#e0e0e0',fontSize:12 }}
                    />
                    <span style={{ fontSize:10,color:'#888' }}>ур.{f.level}</span>
                    <span className="del" onClick={(e) => { e.stopPropagation(); removeFloor(f.id); }}>&#x2715;</span>
                  </div>
                ))}
              </div>
              <button onClick={addFloor}>+ Добавить этаж</button>

              {activeFloor && (
                <>
                  <h4>План активного этажа</h4>
                  <label>SVG-файл (только .svg)</label>
                  <input type="file" accept=".svg,image/svg+xml"
                    onChange={(e) => { const f=e.target.files?.[0]; if(f) handleUploadPlan(f); e.target.value=''; }} />
                  {hasPlan ? (
                    <>
                      <div className="nav-editor-info" style={{ marginBottom:8 }}>
                        План загружен (inline).<br/>
                        viewBox: {Math.round(activeFloor.viewBox.width)} &times; {Math.round(activeFloor.viewBox.height)}<br/>
                        Размер: {Math.round((activeFloor.svgContent?.length||0)/1024)} КБ
                      </div>
                      <button className="sec" onClick={clearPlan}>Удалить план</button>
                    </>
                  ) : (
                    <div className="nav-editor-info" style={{ marginBottom:8 }}>План не загружен.</div>
                  )}

                  <h4>Инструменты разметки</h4>
                  {(
                    [
                      ['pan',      '&#x270B; Просмотр / выбор'],
                      ['corridor', '&#x1F6E3; Осевая коридора'],
                      ['room',     '&#x2B1B; Контур помещения'],
                      ['rect',     '&#x25AD; Прямоугольник'],
                      ['poi',      '&#x1F4CD; POI помещения'],
                      ['entry',    '&#x1F6AA; Точка входа'],
                      ['stairs',   '&#x1FA9C; Лестница'],
                      ['elevator', '&#x1F6D7; Лифт'],
                      ['terminal', '&#x1F5A5; Терминал'],
                    ] as Array<[Tool, string]>
                  ).map(([t, label]) => (
                    <button key={t}
                      className={`tool ${tool === t ? 'active' : ''}`}
                      onClick={() => setTool(t)}
                      disabled={!hasPlan && t !== 'pan'}
                      title={!hasPlan ? 'Сначала загрузите SVG-план' : ''}
                      dangerouslySetInnerHTML={{ __html: label }}
                    />
                  ))}

                  <h4>Объекты этажа</h4>
                  <div className="nav-editor-info">
                    Коридоров: {activeFloor.corridors.length}<br/>
                    Помещений: {activeFloor.rooms.length}<br/>
                    Лестниц/лифтов: {activeFloor.service.length}<br/>
                    Терминалов: {activeFloor.terminals.length}
                  </div>

                  {activeFloor.corridors.length > 0 && (
                    <>
                      <h4>Коридоры</h4>
                      {activeFloor.corridors.map((cor, i) => (
                        <div key={cor.id} style={{ display:'flex',alignItems:'center',gap:4,marginBottom:2 }}>
                          <span style={{ flex:1,fontSize:11,color:'#aaa' }}>#{i+1} ({cor.points.length} точек)</span>
                          <span className="del" style={{ cursor:'pointer' }}
                            onClick={() => deleteCorridor(cor.id)}>&#x2715;</span>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}

              <h4>Маршрут</h4>
              <label>Штраф за лестницу</label>
              <input type="number" min={0} value={navData.edgeCosts.stairsPenalty}
                onChange={(e) => patchNav({ edgeCosts:{ ...navData.edgeCosts, stairsPenalty:Math.max(0,Number(e.target.value)||0) } })} />
              <label>Штраф за лифт</label>
              <input type="number" min={0} value={navData.edgeCosts.elevatorPenalty}
                onChange={(e) => patchNav({ edgeCosts:{ ...navData.edgeCosts, elevatorPenalty:Math.max(0,Number(e.target.value)||0) } })} />


              <h4>&#x1F504; Переходы между этажами</h4>
              {navData.floors.length < 2 && (
                <div className="nav-editor-info">Нужно минимум 2 этажа.</div>
              )}
              {navData.floors.length >= 2 && (
                <>
                  {navData.transitions.length === 0 && (
                    <div className="nav-editor-info">Переходов нет.</div>
                  )}
                  {navData.transitions.map((tr, idx) => {
                    const ff = navData.floors.find((f) => f.id === tr.fromFloorId);
                    const tf = navData.floors.find((f) => f.id === tr.toFloorId);
                    return (
                      <div key={tr.id} style={{ background:'#1a1a1a', borderRadius:4, padding:6, marginBottom:6, border:'1px solid #333', fontSize:11 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                          <span style={{ color:'#aaa' }}>Переход #{idx+1}</span>
                          <span className="del" style={{ cursor:'pointer' }} onClick={() => removeTransition(tr.id)}>&#x2715;</span>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                          <div>
                            <div style={{ color:'#777', marginBottom:2 }}>Откуда: этаж</div>
                            <select value={tr.fromFloorId} style={{ width:'100%', fontSize:11 }}
                              onChange={(e) => patchTransition(tr.id, { fromFloorId: e.target.value, fromServiceId: navData.floors.find(f=>f.id===e.target.value)?.service[0]?.id || '' })}>
                              {navData.floors.filter(f=>f.id!==tr.toFloorId).map(f=>(
                                <option key={f.id} value={f.id}>{f.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <div style={{ color:'#777', marginBottom:2 }}>Откуда: объект</div>
                            <select value={tr.fromServiceId} style={{ width:'100%', fontSize:11 }}
                              onChange={(e) => patchTransition(tr.id, { fromServiceId: e.target.value })}>
                              <option value="">— выберите —</option>
                              {(ff?.service||[]).map(sp=>(
                                <option key={sp.id} value={sp.id}>{sp.label||sp.kind} ({sp.kind})</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <div style={{ color:'#777', marginBottom:2 }}>Куда: этаж</div>
                            <select value={tr.toFloorId} style={{ width:'100%', fontSize:11 }}
                              onChange={(e) => patchTransition(tr.id, { toFloorId: e.target.value, toServiceId: navData.floors.find(f=>f.id===e.target.value)?.service[0]?.id || '' })}>
                              {navData.floors.filter(f=>f.id!==tr.fromFloorId).map(f=>(
                                <option key={f.id} value={f.id}>{f.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <div style={{ color:'#777', marginBottom:2 }}>Куда: объект</div>
                            <select value={tr.toServiceId} style={{ width:'100%', fontSize:11 }}
                              onChange={(e) => patchTransition(tr.id, { toServiceId: e.target.value })}>
                              <option value="">— выберите —</option>
                              {(tf?.service||[]).map(sp=>(
                                <option key={sp.id} value={sp.id}>{sp.label||sp.kind} ({sp.kind})</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <button onClick={addTransition}>+ Добавить переход</button>
                </>
              )}

              <h4>Версия формата</h4>
              <div className="nav-editor-info">v{navData.version || NAV_DATA_VERSION}</div>
            </div>
          </div>

          {/* Stage */}
          <div
            ref={stageRef}
            className={`nav-editor-stage ${!activeFloor || !hasPlan ? 'empty' : ''}`}
            onMouseDown={onStageMouseDown}
            onMouseMove={onStageMouseMove}
            onMouseUp={onStageMouseUp}
            onClick={onStageClick}
            onDoubleClick={onStageDblClick}
            onMouseLeave={() => {
              isPanningRef.current = false;
              panStart.current = null;
              if (tool === 'rect') { rectStartRef.current = null; setRectEnd(null); }
            }}
            onWheel={onStageWheel}
            onContextMenu={(e) => e.preventDefault()}
            style={{ cursor: isPanningRef.current ? 'grabbing' : tool === 'pan' ? 'grab' : 'crosshair', userSelect: 'none' }}
          >
            {!activeFloor && (
              <div className="placeholder">Добавьте этаж и загрузите SVG-план, чтобы начать разметку.</div>
            )}
            {activeFloor && !hasPlan && (
              <div className="placeholder">Загрузите SVG-план для этажа «{activeFloor.name}».</div>
            )}
            {activeFloor && hasPlan && planError && (
              <div className="placeholder" style={{ color:'#e07a7a' }}>Ошибка: {planError}</div>
            )}
            {activeFloor && hasPlan && (
              <>
                <div
                  ref={svgHostRef}
                  className="nav-editor-svg-host"
                  style={{ transform:`translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin:'0 0' }}
                  dangerouslySetInnerHTML={{ __html: activeFloor.svgContent || '' }}
                />
                {renderOverlay()}
                <div className="nav-editor-hint">{hintByTool[tool]}</div>
                <div className="nav-editor-topbar">
                  <button className="sec" onClick={handleZoomOut}>&#xFF0D;</button>
                  <button className="sec" onClick={handleZoomIn}>&#xFF0B;</button>
                  <button className="sec" onClick={handleFit}>&#x2922; Fit</button>
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
