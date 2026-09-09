import React, { useEffect, useState } from 'react';
import type { MathMachineWidgetProperties, MathMachineContent, MathMachineUserData, GroupProgress } from '@kiosk/shared';
import { MATHMACHINE_USERDATA_SCHEMA_VERSION } from '@kiosk/shared';
import CatalogScreen from './CatalogScreen';
import LabScreen from './LabScreen';
import { loadUserData, saveUserData } from './userDataStorage';
import pilotContentJson from './content/pilotContent.json';
import { COLOR, FONT, NOTEBOOK_GRID_BACKGROUND } from './theme';

interface Props {
  properties: MathMachineWidgetProperties;
}

type Screen = 'catalog' | 'lab';

const INITIAL_USER_DATA: MathMachineUserData = { schemaVersion: MATHMACHINE_USERDATA_SCHEMA_VERSION, progress: {}, soundOn: true };

const MathMachineRuntime: React.FC<Props> = ({ properties }) => {
  const content = pilotContentJson as unknown as MathMachineContent;
  const [userData, setUserData] = useState<MathMachineUserData>(INITIAL_USER_DATA);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState<Screen>('catalog');

  useEffect(() => {
    let cancelled = false;
    loadUserData().then((data) => {
      if (!cancelled) {
        setUserData(data);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return; // не перезаписывать сохранённый прогресс дефолтом до завершения первой загрузки
    saveUserData(userData);
  }, [userData, loaded]);

  function handleProgressChange(groupId: string, groupProgress: GroupProgress) {
    setUserData((prev) => ({ ...prev, progress: { ...prev.progress, [groupId]: groupProgress } }));
  }

  return (
    <div style={{ ...NOTEBOOK_GRID_BACKGROUND, width: '100%', height: '100%', overflow: 'auto', fontFamily: FONT.ui, color: COLOR.text }}>
      <div style={topBarStyle}>
        <span style={logoStyle}>{properties.title}</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setScreen('catalog')} style={navButtonStyle(screen === 'catalog')}>Задания</button>
          <button onClick={() => setScreen('lab')} style={navButtonStyle(screen === 'lab')}>Лаборатория</button>
          <button
            onClick={() => setUserData((prev) => ({ ...prev, soundOn: !prev.soundOn }))}
            style={soundButtonStyle}
          >
            {userData.soundOn ? '🔊 Звук вкл' : '🔇 Звук выкл'}
          </button>
        </div>
      </div>

      {screen === 'catalog' && (
        <CatalogScreen
          content={content}
          progress={userData.progress}
          soundOn={userData.soundOn}
          onProgressChange={handleProgressChange}
        />
      )}
      {screen === 'lab' && <LabScreen onExit={() => setScreen('catalog')} />}
    </div>
  );
};

const topBarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 28px',
  background: COLOR.surface,
  borderBottom: `3px solid ${COLOR.indigo}`,
  boxShadow: '0 2px 6px rgba(58, 51, 43, 0.08)',
};
const logoStyle: React.CSSProperties = { fontFamily: FONT.display, fontSize: 26, color: COLOR.indigo };
function navButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: '9px 18px',
    fontFamily: FONT.ui,
    fontSize: 15,
    fontWeight: 700,
    borderRadius: 10,
    border: active ? `2px solid ${COLOR.indigo}` : '2px solid transparent',
    background: active ? COLOR.indigoLight : 'transparent',
    color: active ? COLOR.indigoDark : COLOR.textMuted,
    cursor: 'pointer',
  };
}
const soundButtonStyle: React.CSSProperties = {
  padding: '9px 16px',
  fontFamily: FONT.ui,
  fontSize: 14,
  fontWeight: 700,
  borderRadius: 10,
  border: `2px solid ${COLOR.border}`,
  background: COLOR.surface,
  color: COLOR.textMuted,
  cursor: 'pointer',
};

export default MathMachineRuntime;
