import React from 'react';
import { COLOR, FONT, RADIUS, SHADOW } from '../theme';

// Общее обрамление «Мастерская» для инструментов лаборатории (Весы/
// Цепочка/Два отрезка) — выбрано пользователем из мокапа 2026-09-09
// (вариант Б: индиго-шапка, янтарная рамка вокруг холста, кремовая
// подложка). Раньше все три инструмента были на голых HTML-элементах
// без единого визуального языка (см. Тип6_бэклог.md, Эпик 26). Сама
// механика инструментов (Konva-канвас, drag&drop) не меняется — меняется
// только окружающее оформление.

interface Props {
  icon: string;
  title: string;
  onClose: () => void;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  banner?: React.ReactNode;
}

const ToolShell: React.FC<Props> = ({ icon, title, onClose, sidebar, children, actions, banner }) => (
  <div style={outerStyle}>
    <div style={shellStyle}>
      <div style={headerBarStyle}>
        <span style={titleStyle}>{icon} {title}</span>
        <button onClick={onClose} style={exitButtonStyle}>Выйти</button>
      </div>
      <div style={bodyStyle}>
        {sidebar && <div style={sidebarStyle}>{sidebar}</div>}
        <div style={mainStyle}>
          <div style={frameStyle}>{children}</div>
          {actions && <div style={actionsRowStyle}>{actions}</div>}
        </div>
      </div>
    </div>
    {banner && <div style={{ marginTop: 16, maxWidth: 780 }}>{banner}</div>}
  </div>
);

export function toolTabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '10px 8px',
    borderRadius: RADIUS.sm,
    textAlign: 'center',
    fontFamily: FONT.ui,
    fontWeight: 800,
    fontSize: 13,
    border: 'none',
    cursor: 'pointer',
    background: active ? COLOR.indigo : 'transparent',
    color: active ? '#fff' : COLOR.indigoDark,
  };
}

export const toolPrimaryButtonStyle: React.CSSProperties = {
  padding: '12px 26px',
  borderRadius: RADIUS.md,
  border: 'none',
  background: COLOR.amber,
  color: COLOR.text,
  fontFamily: FONT.ui,
  fontWeight: 800,
  fontSize: 15,
  cursor: 'pointer',
  boxShadow: SHADOW.card,
};

export const toolSecondaryButtonStyle: React.CSSProperties = {
  padding: '12px 22px',
  borderRadius: RADIUS.md,
  border: `2px solid ${COLOR.border}`,
  background: COLOR.surface,
  color: COLOR.text,
  fontFamily: FONT.ui,
  fontWeight: 700,
  fontSize: 15,
  cursor: 'pointer',
};

export function toolToggleButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 14px',
    borderRadius: RADIUS.sm,
    border: active ? `2px solid ${COLOR.mint}` : `2px solid ${COLOR.border}`,
    background: active ? COLOR.mintLight : COLOR.surface,
    color: active ? COLOR.mintDark : COLOR.text,
    fontFamily: FONT.ui,
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
  };
}

const outerStyle: React.CSSProperties = {
  padding: 24,
  background: COLOR.cream,
  minHeight: '100%',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  fontFamily: FONT.ui,
  color: COLOR.text,
};

const shellStyle: React.CSSProperties = {
  background: COLOR.surface,
  borderRadius: RADIUS.lg,
  overflow: 'hidden',
  boxShadow: SHADOW.card,
  border: `1px solid ${COLOR.border}`,
  maxWidth: 780,
  width: '100%',
};

const headerBarStyle: React.CSSProperties = {
  background: COLOR.indigo,
  color: '#fff',
  padding: '14px 22px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const titleStyle: React.CSSProperties = { fontFamily: FONT.display, fontSize: 22 };

const exitButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: RADIUS.sm,
  border: '2px solid rgba(255,255,255,0.45)',
  background: 'rgba(255,255,255,0.15)',
  color: '#fff',
  fontFamily: FONT.ui,
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};

const bodyStyle: React.CSSProperties = { display: 'flex' };

const sidebarStyle: React.CSSProperties = {
  width: 110,
  background: COLOR.indigoLight,
  padding: '16px 8px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const mainStyle: React.CSSProperties = { flex: 1, padding: 18 };

const frameStyle: React.CSSProperties = {
  border: `4px solid ${COLOR.amber}`,
  borderRadius: RADIUS.md,
  padding: 12,
  background: COLOR.cream,
};

const actionsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  marginTop: 16,
};

export default ToolShell;
