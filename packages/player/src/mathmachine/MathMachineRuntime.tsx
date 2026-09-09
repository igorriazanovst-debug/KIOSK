import React, { useEffect, useState } from 'react';
import type { MathMachineWidgetProperties, MathMachineContent, MathMachineUserData, GroupProgress } from '@kiosk/shared';
import { MATHMACHINE_USERDATA_SCHEMA_VERSION } from '@kiosk/shared';
import CatalogScreen from './CatalogScreen';
import LabScreen from './LabScreen';
import { loadUserData, saveUserData } from './userDataStorage';
import pilotContentJson from './content/pilotContent.json';

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
    <div style={{ width: '100%', height: '100%', background: '#fffdf5', overflow: 'auto' }}>
      <div style={topBarStyle}>
        <span>{properties.title}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setScreen('catalog')}>Задания</button>
          <button onClick={() => setScreen('lab')}>Лаборатория</button>
          <button onClick={() => setUserData((prev) => ({ ...prev, soundOn: !prev.soundOn }))}>
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

const topBarStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 24px', fontSize: 14, color: '#555', borderBottom: '1px solid #eee' };

export default MathMachineRuntime;
