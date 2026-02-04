import { jsx as _jsx } from "react/jsx-runtime";
import Editor from './components/Editor';
import EditorSimple from './components/EditorSimple';
import ErrorBoundary from './components/ErrorBoundary';
function App() {
    // Проверяем URL параметр для выбора версии
    const useSimple = new URLSearchParams(window.location.search).get('simple') === 'true';
    // Или используйте переменную окружения
    const isDev = import.meta.env.DEV;
    return (_jsx(ErrorBoundary, { children: useSimple ? _jsx(EditorSimple, {}) : _jsx(Editor, {}) }));
}
export default App;
