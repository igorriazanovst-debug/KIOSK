// packages/editor-web/src/components/NavigationPropertiesSection.tsx
// Шаг 4: привязка терминалов к устройствам + управление transitions

import React, { useEffect, useState } from 'react';
import type { Widget } from '../types';
import type { NavigationData } from '../utils/navigation/types';
import {
  NAVIGATION_DEFAULT_PROPS,
  NAVIGATION_WIDGET_TYPE,
  NavigationWidgetProperties,
} from '../utils/navigation/widgetType';
import NavigationEditorModal from './NavigationEditorModal';

interface Device {
  id: string;
  name: string;
  deviceId?: string;
}

interface Props {
  widget: Widget;
  onPropertiesChange: (key: string, value: any) => void;
  onUpdateWidget: (updates: Partial<Widget>) => void;
}

const NavigationPropertiesSection: React.FC<Props> = ({
  widget,
  onPropertiesChange,
  onUpdateWidget,
}) => {
  if (widget.type !== NAVIGATION_WIDGET_TYPE) return null;

  const [showEditor, setShowEditor] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);

  useEffect(() => {
    fetch('/api/admin/devices?limit=200')
      .then((r) => r.json())
      .then((json) => {
        const list: Device[] = json?.data ?? json ?? [];
        setDevices(Array.isArray(list) ? list : []);
      })
      .catch(() => setDevices([]));
  }, []);

  const props = widget.properties as Partial<NavigationWidgetProperties>;
  const navData: NavigationData =
    (props.navData as NavigationData) || NAVIGATION_DEFAULT_PROPS.navData;

  const activeFloorId = props.activeFloorId ?? null;
  const activeFloor =
    navData.floors.find((f) => f.id === activeFloorId) || navData.floors[0] || null;

  const allTerminals = navData.floors.flatMap((f) =>
    f.terminals.map((t) => ({ ...t, floorId: f.id, floorName: f.name })),
  );

  function handleSaveEditor(newData: NavigationData, newActiveFloorId: string | null) {
    onUpdateWidget({
      properties: {
        ...widget.properties,
        navData: newData,
        activeFloorId: newActiveFloorId,
      },
    });
  }

  /** Обновить deviceId терминала в navData */
  function setTerminalDevice(terminalId: string, deviceId: string) {
    const newData: NavigationData = {
      ...navData,
      floors: navData.floors.map((f) => ({
        ...f,
        terminals: f.terminals.map((t) =>
          t.id === terminalId ? { ...t, deviceId: deviceId || undefined } : t,
        ),
      })),
    };
    onUpdateWidget({ properties: { ...widget.properties, navData: newData } });
  }

  return (
    <>
      <div className="property-section">
        <h4>&#x1F9ED; Навигация</h4>

        <div className="property-field">
          <label>Заголовок виджета</label>
          <input
            type="text"
            value={props.title || ''}
            placeholder="Навигация по зданию"
            onChange={(e) => onPropertiesChange('title', e.target.value)}
          />
        </div>

        <div className="property-field">
          <label>Этажей: {navData.floors.length}</label>
          {navData.floors.length > 0 && (
            <select
              value={activeFloorId || ''}
              onChange={(e) => onPropertiesChange('activeFloorId', e.target.value || null)}
            >
              {navData.floors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} (ур. {f.level})
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          type="button"
          className="btn-primary"
          style={{ width: '100%', padding: '8px', marginBottom: 8 }}
          onClick={() => setShowEditor(true)}
        >
          &#x1F4D0; Открыть редактор плана
        </button>

        {activeFloor && (
          <div
            style={{
              fontSize: 11,
              color: '#aaa',
              background: '#1a1a1a',
              padding: 8,
              borderRadius: 4,
              border: '1px solid #333',
              marginBottom: 8,
            }}
          >
            План: {activeFloor.svgContent ? '&#x2713; загружен' : '&#x2717; не загружен'}
            <br />
            Помещений: {activeFloor.rooms.length}
            <br />
            Терминалов: {activeFloor.terminals.length}
          </div>
        )}

        {/* Терминал «Вы здесь» */}
        <div className="property-field">
          <label>«Вы здесь» — терминал</label>
          <select
            value={props.currentTerminalId || ''}
            onChange={(e) => onPropertiesChange('currentTerminalId', e.target.value || null)}
            disabled={allTerminals.length === 0}
          >
            <option value="">— не выбран —</option>
            {navData.floors.map((f) =>
              f.terminals.length > 0 ? (
                <optgroup key={f.id} label={f.name}>
                  {f.terminals.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label || t.id}
                      {t.deviceId ? ` [${devices.find((d) => d.id === t.deviceId)?.name || t.deviceId}]` : ''}
                    </option>
                  ))}
                </optgroup>
              ) : null,
            )}
          </select>
        </div>

        {/* Привязка терминалов к устройствам */}
        {allTerminals.length > 0 && (
          <>
            <h4 style={{ marginTop: 16, fontSize: 12 }}>Привязка терминалов к устройствам</h4>
            <div
              style={{
                fontSize: 11,
                color: '#888',
                marginBottom: 6,
              }}
            >
              Устройство определяет, какой терминал считается «текущим» при автоопределении.
            </div>
            {allTerminals.map((t) => (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 4,
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    flex: '0 0 auto',
                    minWidth: 80,
                    color: '#ccc',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={`${t.floorName} / ${t.label || t.id}`}
                >
                  {t.label || t.id}
                  <span style={{ color: '#666', fontSize: 10 }}> ({t.floorName})</span>
                </span>
                <select
                  value={t.deviceId || ''}
                  onChange={(e) => setTerminalDevice(t.id, e.target.value)}
                  style={{ flex: 1, fontSize: 11, padding: '2px 4px' }}
                >
                  <option value="">— не привязан —</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </>
        )}

        <h4 style={{ marginTop: 16, fontSize: 12 }}>Внешний вид маршрута</h4>

        <div className="property-row">
          <div className="property-field">
            <label>Цвет линии</label>
            <input
              type="color"
              value={props.routeColor || NAVIGATION_DEFAULT_PROPS.routeColor}
              onChange={(e) => onPropertiesChange('routeColor', e.target.value)}
            />
          </div>
          <div className="property-field">
            <label>Толщина</label>
            <input
              type="number"
              min={1}
              max={32}
              value={props.routeWidth ?? NAVIGATION_DEFAULT_PROPS.routeWidth}
              onChange={(e) => onPropertiesChange('routeWidth', Number(e.target.value) || 1)}
            />
          </div>
        </div>

        <div className="property-field">
          <label>Цвет «Вы здесь»</label>
          <input
            type="color"
            value={props.youAreHereColor || NAVIGATION_DEFAULT_PROPS.youAreHereColor}
            onChange={(e) => onPropertiesChange('youAreHereColor', e.target.value)}
          />
        </div>

        <h4 style={{ marginTop: 16, fontSize: 12 }}>Параметры графа</h4>

        <div className="property-field">
          <label>Радиус слияния узлов (snap)</label>
          <input
            type="number"
            min={10}
            max={2000}
            value={props.graphSnap ?? NAVIGATION_DEFAULT_PROPS.graphSnap}
            onChange={(e) => onPropertiesChange('graphSnap', Number(e.target.value) || 300)}
          />
        </div>

        <h4 style={{ marginTop: 16, fontSize: 12 }}>UI в рантайме</h4>

        <div className="property-field">
          <label>
            <input
              type="checkbox"
              checked={props.showRoomList !== false}
              onChange={(e) => onPropertiesChange('showRoomList', e.target.checked)}
              style={{ width: 'auto', marginRight: 6 }}
            />
            Показывать список помещений
          </label>
        </div>

        <div className="property-field">
          <label>
            <input
              type="checkbox"
              checked={props.showSearch !== false}
              onChange={(e) => onPropertiesChange('showSearch', e.target.checked)}
              style={{ width: 'auto', marginRight: 6 }}
            />
            Показывать строку поиска
          </label>
        </div>
      </div>

      {showEditor && (
        <NavigationEditorModal
          navData={navData}
          initialActiveFloorId={activeFloorId}
          onSave={handleSaveEditor}
          onClose={() => setShowEditor(false)}
        />
      )}
    </>
  );
};

export default NavigationPropertiesSection;
