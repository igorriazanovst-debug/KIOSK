// Ловит сбой отрисовки внутри виджета: вместо белого экрана на единственном
// полноэкранном виджете показываем сообщение и кнопку «Назад».
import React from 'react';

interface Props {
  children: React.ReactNode;
  onReset?: () => void;
  label?: string;
}

interface State {
  failed: boolean;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.error('[eumk] ошибка отрисовки:', error);
  }

  render(): React.ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="eumk-note bad" role="alert">
        <b>{this.props.label ?? 'Что-то пошло не так.'}</b>
        {this.props.onReset && (
          <div style={{ marginTop: 8 }}>
            <button type="button" className="eumk-btn" onClick={() => { this.setState({ failed: false }); this.props.onReset?.(); }}>Назад</button>
          </div>
        )}
      </div>
    );
  }
}
