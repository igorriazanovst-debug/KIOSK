import React, { useEffect, useState } from 'react';
import './Editor.css';

const EditorSimple: React.FC = () => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
  }, []);

  if (!loaded) {
    return (
      <div className="editor-loading">
        Загрузка редактора...
      </div>
    );
  }

  return (
    <div className="editor">
      <div style={{
        background: '#252526',
        padding: '12px 16px',
        borderBottom: '1px solid #3e3e42',
        color: '#cccccc',
        fontSize: '14px',
        fontWeight: 'bold'
      }}>
        ✅ Kiosk Content Editor - Базовая версия
      </div>
      
      <div className="editor-main">
        <div style={{
          width: '220px',
          background: '#252526',
          borderRight: '1px solid #3e3e42',
          padding: '16px'
        }}>
          <h3 style={{ 
            margin: '0 0 16px 0', 
            fontSize: '13px', 
            color: '#cccccc',
            textTransform: 'uppercase'
          }}>
            Виджеты
          </h3>
          <div style={{ color: '#858585', fontSize: '13px' }}>
            <p>Библиотека виджетов</p>
            <p>будет здесь</p>
          </div>
        </div>

        <div style={{
          flex: 1,
          background: '#1e1e1e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div style={{
            width: '600px',
            background: '#ffffff',
            padding: '40px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            textAlign: 'center'
          }}>
            <h1 style={{ margin: '0 0 16px 0', color: '#2c3e50' }}>
              ✅ Редактор загружен!
            </h1>
            <p style={{ margin: '0 0 24px 0', color: '#7f8c8d' }}>
              Если вы видите это сообщение, значит React работает корректно.
            </p>
            
            <div style={{
              textAlign: 'left',
              background: '#f8f9fa',
              padding: '16px',
              borderRadius: '4px',
              marginBottom: '24px'
            }}>
              <strong style={{ color: '#2c3e50' }}>Следующие шаги:</strong>
              <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px', color: '#7f8c8d' }}>
                <li>Проверьте консоль браузера (F12) на наличие ошибок</li>
                <li>Убедитесь, что все зависимости установлены</li>
                <li>Если видите ошибки - скопируйте их текст</li>
              </ol>
            </div>

            <button
              onClick={() => alert('Кнопка работает!')}
              style={{
                padding: '12px 24px',
                background: '#4a90e2',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              Тест интерактивности
            </button>
          </div>
        </div>

        <div style={{
          width: '280px',
          background: '#252526',
          borderLeft: '1px solid #3e3e42',
          padding: '16px'
        }}>
          <h3 style={{ 
            margin: '0 0 16px 0', 
            fontSize: '13px', 
            color: '#cccccc',
            textTransform: 'uppercase'
          }}>
            Свойства
          </h3>
          <div style={{ color: '#858585', fontSize: '13px' }}>
            <p>Панель свойств</p>
            <p>будет здесь</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorSimple;
