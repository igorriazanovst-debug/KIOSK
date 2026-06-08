import React from 'react';
import { useEditorStore } from '../stores/editorStore';

const ProjectLoadingOverlay: React.FC = () => {
  const stage = useEditorStore((s: any) => s.loadingStage as string | null);
  const cancel = useEditorStore((s: any) => s.cancelLoadProject as () => void);
  const dismiss = useEditorStore((s: any) => s.dismissLoading as (() => void) | undefined);
  if (!stage) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(10,14,22,0.92)',
      zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
    }}>
      <div style={{
        background: '#1f2533', border: '1px solid #33405a', padding: '24px 28px',
        borderRadius: 10, minWidth: 420, maxWidth: 540, color: '#e6ecf5',
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Внимание</div>
        <div style={{ fontSize: 13, color: '#cbd5e1', marginBottom: 18, lineHeight: 1.5 }}>{stage}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={cancel} style={{
            flex: 1, padding: '10px 12px', background: '#3a2533',
            border: '1px solid #6b3344', borderRadius: 6, color: '#f87171',
            fontWeight: 600, cursor: 'pointer', fontSize: 13,
          }}>Прервать (reload)</button>
          {dismiss && (
            <button onClick={dismiss} style={{
              flex: 1, padding: '10px 12px', background: '#1e3a52',
              border: '1px solid #2c5a82', borderRadius: 6, color: '#7dd3fc',
              fontWeight: 600, cursor: 'pointer', fontSize: 13,
            }}>Скрыть</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectLoadingOverlay;
