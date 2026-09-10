import React from 'react';

interface Props {
  properties: unknown;
}

const RusiqRuntime: React.FC<Props> = () => {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', fontSize: 24 }}>
      РусIQ — скоро
    </div>
  );
};

export default RusiqRuntime;
