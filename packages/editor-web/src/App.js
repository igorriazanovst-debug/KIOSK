import { jsx as _jsx } from "react/jsx-runtime";
import Editor from './components/Editor';
import ErrorBoundary from './components/ErrorBoundary';
function App() {
    return (_jsx(ErrorBoundary, { children: _jsx(Editor, {}) }));
}
export default App;
