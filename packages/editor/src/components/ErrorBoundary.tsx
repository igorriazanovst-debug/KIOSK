import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#1e1e1e',
          color: '#ff6b6b',
          fontFamily: 'Arial, sans-serif',
          padding: '20px'
        }}>
          <div style={{ textAlign: 'center', maxWidth: '700px' }}>
            <h1>❌ Ошибка в редакторе</h1>
            <p style={{ color: '#cccccc', marginBottom: '20px' }}>
              Что-то пошло не так. Проверьте консоль браузера (F12) для деталей.
            </p>
            
            {this.state.error && (
              <div style={{
                textAlign: 'left',
                background: '#2a2a2a',
                padding: '15px',
                borderRadius: '5px',
                marginBottom: '20px',
                overflow: 'auto'
              }}>
                <div style={{ color: '#ff6b6b', marginBottom: '10px', fontWeight: 'bold' }}>
                  {this.state.error.toString()}
                </div>
                {this.state.errorInfo && (
                  <pre style={{
                    fontSize: '12px',
                    color: '#888',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '10px 20px',
                  background: '#4a90e2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Перезагрузить страницу
              </button>
              
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                style={{
                  padding: '10px 20px',
                  background: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Сбросить и перезагрузить
              </button>
            </div>

            <div style={{
              marginTop: '20px',
              padding: '15px',
              background: '#2a2a2a',
              borderRadius: '5px',
              textAlign: 'left',
              color: '#cccccc',
              fontSize: '13px'
            }}>
              <strong>Возможные причины:</strong>
              <ul style={{ marginTop: '10px', marginBottom: 0 }}>
                <li>Не установлены зависимости - выполните <code>npm install</code></li>
                <li>Несовместимая версия Node.js - требуется v18.0+</li>
                <li>Проблемы с импортами модулей</li>
                <li>Поврежденный кэш браузера - попробуйте "Сбросить и перезагрузить"</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
