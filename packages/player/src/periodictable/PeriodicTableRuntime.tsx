import React from 'react';
import type { PeriodicTableWidgetProperties } from '@kiosk/shared';

interface Props {
  properties: PeriodicTableWidgetProperties;
}

const PeriodicTableRuntime: React.FC<Props> = ({ properties }) => (
  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
    <h1>{properties.title ?? 'Таблица Менделеева'}</h1>
  </div>
);

export default PeriodicTableRuntime;
