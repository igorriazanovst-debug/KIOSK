const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Получить текущий проект
  getProject: () => ipcRenderer.invoke('get-project'),
  
  // Открыть проект из файла
  openProject: () => ipcRenderer.invoke('open-project'),
  
  // Переключить полноэкранный режим
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  
  // Закрыть приложение
  closeApp: () => ipcRenderer.invoke('close-app'),
  
  // Слушать события из main процесса
  onLoadProject: (callback) => {
    ipcRenderer.on('load-project', (event, project) => callback(project));
  },

  // Проверить нужна ли активация (при монтировании компонента)
  checkActivationNeeded: () => ipcRenderer.invoke('check-activation-needed'),

  // Активация плеера по email + password
  activateWithCredentials: (email, password) => ipcRenderer.invoke('activate-with-credentials', email, password),

  // Показ экрана активации (слушатель)
  onShowActivation: (callback) => {
    ipcRenderer.on('show-activation', (event, data) => callback(data));
  },

  // Доступно обновление (слушатель)
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (event, data) => callback(data));
  },

  // Обновление применено (слушатель)
  onUpdateApplied: (callback) => {
    ipcRenderer.on('update-applied', (event, data) => callback(data));
  },

  // Проверка пароля для подтверждения обновления
  verifyUpdatePassword: (password) => ipcRenderer.invoke('verify-update-password', password),

  // Применить обновление
  applyUpdate: () => ipcRenderer.invoke('apply-update')
});

// Локальное хранилище проектов «Хронолинии» — отдельный namespace, не
// смешивается с electronAPI. Используется только виджетом chronoline.
contextBridge.exposeInMainWorld('chronoAPI', {
  listProjects: () => ipcRenderer.invoke('chrono:list-projects'),
  createProject: (name) => ipcRenderer.invoke('chrono:create-project', name),
  renameProject: (projectId, newName) => ipcRenderer.invoke('chrono:rename-project', projectId, newName),
  deleteProject: (projectId) => ipcRenderer.invoke('chrono:delete-project', projectId),
  loadProjectData: (projectId) => ipcRenderer.invoke('chrono:load-project-data', projectId),
  saveProjectData: (projectId, data) => ipcRenderer.invoke('chrono:save-project-data', projectId, data),
  getAuthStatus: () => ipcRenderer.invoke('chrono:auth-status'),
  verifyPassword: (password) => ipcRenderer.invoke('chrono:auth-verify-password', password),
  changePassword: (newPassword, currentPassword) =>
    ipcRenderer.invoke('chrono:auth-change-password', newPassword, currentPassword),
  lockEditing: () => ipcRenderer.invoke('chrono:auth-lock'),
  getResetChallenge: () => ipcRenderer.invoke('chrono:reset-challenge'),
  resetWithCode: (code, newPassword) => ipcRenderer.invoke('chrono:reset-with-code', code, newPassword),
  pickMediaFile: () => ipcRenderer.invoke('chrono:pick-media-file'),
  importMedia: (projectId, sourceFilePath) => ipcRenderer.invoke('chrono:import-media', projectId, sourceFilePath),
  exportProject: (projectId) => ipcRenderer.invoke('chrono:export-project', projectId),
  importProject: () => ipcRenderer.invoke('chrono:import-project'),
  deleteMedia: (projectId, media) => ipcRenderer.invoke('chrono:delete-media', projectId, media)
});

// Встроенный сервер и локальное хранилище презентаций «Конструктора
// природных сообществ» (Тип 5) — отдельный namespace, используется только
// виджетом naturalcommunities.
contextBridge.exposeInMainWorld('natcomAPI', {
  getServerInfo: () => ipcRenderer.invoke('natcom:get-server-info'),
  getContext: () => ipcRenderer.invoke('natcom:get-context'),
  setActiveProject: (projectId) => ipcRenderer.invoke('natcom:set-active-project', projectId),
  getLibrary: () => ipcRenderer.invoke('natcom:get-library'),
  listProjects: () => ipcRenderer.invoke('natcom:list-projects'),
  createProject: (params) => ipcRenderer.invoke('natcom:create-project', params),
  loadProject: (projectId) => ipcRenderer.invoke('natcom:load-project', projectId),
  saveProject: (projectId, data) => ipcRenderer.invoke('natcom:save-project', projectId, data),
  deleteProject: (projectId) => ipcRenderer.invoke('natcom:delete-project', projectId),
  exportProject: (projectId) => ipcRenderer.invoke('natcom:export-project', projectId),
  importProject: (context) => ipcRenderer.invoke('natcom:import-project', context),
  listTemplates: () => ipcRenderer.invoke('natcom:list-templates'),
  useTemplate: (templateId, context) => ipcRenderer.invoke('natcom:use-template', templateId, context)
});

// Пользовательские данные (прогресс/настройки) виджета «Матемашка» —
// отдельный namespace, не смешивается с остальными API.
contextBridge.exposeInMainWorld('mathmachineAPI', {
  loadUserData: () => ipcRenderer.invoke('mathmachine:load-user-data'),
  saveUserData: (data) => ipcRenderer.invoke('mathmachine:save-user-data', data)
});

// Пользовательские данные (история результатов/настройки) виджета «РусIQ» —
// отдельный namespace, не смешивается с остальными API.
contextBridge.exposeInMainWorld('rusiqAPI', {
  loadUserData: () => ipcRenderer.invoke('rusiq:load-user-data'),
  saveUserData: (data) => ipcRenderer.invoke('rusiq:save-user-data', data),
  listQuizzes: () => ipcRenderer.invoke('rusiq:list-quizzes'),
  loadQuiz: (quizId) => ipcRenderer.invoke('rusiq:load-quiz', quizId),
  saveQuiz: (quiz) => ipcRenderer.invoke('rusiq:save-quiz', quiz),
  deleteQuiz: (quizId) => ipcRenderer.invoke('rusiq:delete-quiz', quizId),
  saveQuizBackground: (quizId, arrayBuffer, mimeType) => ipcRenderer.invoke('rusiq:save-quiz-background', quizId, arrayBuffer, mimeType),
  // FR-015 (Фаза 2b) - картинка к вопросу/ответу/подсказке.
  saveQuizItemImage: (quizId, questionId, kind, arrayBuffer, mimeType) =>
    ipcRenderer.invoke('rusiq:save-quiz-item-image', quizId, questionId, kind, arrayBuffer, mimeType),
  deleteQuizItemImage: (fileName) => ipcRenderer.invoke('rusiq:delete-quiz-item-image', fileName),
  // FR-013/FR-018 (Фаза 2b) - экспорт/импорт файла викторины между
  // проектами KIOSK через уже установленный Плеер (согласованная
  // реинтерпретация ТЗ, см. Тип7_трассировочная_матрица.md).
  exportQuiz: (fileContentJson, suggestedFileName) => ipcRenderer.invoke('rusiq:export-quiz', fileContentJson, suggestedFileName),
  importQuiz: () => ipcRenderer.invoke('rusiq:import-quiz')
});

// Локальное хранилище виджета «Я знаю много слов» (Тип 2) — профили детей,
// настройки занятия и достижения. Отдельный namespace, используется только
// виджетом words.
contextBridge.exposeInMainWorld('wordsAPI', {
  getContext: () => ipcRenderer.invoke('words:get-context'),
  getLibrary: () => ipcRenderer.invoke('words:get-library'),
  listProfiles: () => ipcRenderer.invoke('words:list-profiles'),
  createProfile: (name) => ipcRenderer.invoke('words:create-profile', name),
  deleteProfile: (profileId) => ipcRenderer.invoke('words:delete-profile', profileId),
  getSettings: () => ipcRenderer.invoke('words:get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('words:save-settings', settings),
  getScores: () => ipcRenderer.invoke('words:get-scores'),
  saveScore: (profileId, themeId, tier) => ipcRenderer.invoke('words:save-score', profileId, themeId, tier),

  // Контент педагога (ТЗ строки 55-57)
  listUserWords: () => ipcRenderer.invoke('words:list-user-words'),
  createUserWord: (draft) => ipcRenderer.invoke('words:create-user-word', draft),
  updateUserWord: (id, draft) => ipcRenderer.invoke('words:update-user-word', id, draft),
  deleteUserWord: (id) => ipcRenderer.invoke('words:delete-user-word', id),
  listSets: () => ipcRenderer.invoke('words:list-sets'),
  createSet: (draft) => ipcRenderer.invoke('words:create-set', draft),
  updateSet: (id, draft) => ipcRenderer.invoke('words:update-set', id, draft),
  deleteSet: (id) => ipcRenderer.invoke('words:delete-set', id),
  pickMediaFile: (kind) => ipcRenderer.invoke('words:pick-media-file', kind),
  saveRecording: (bytes) => ipcRenderer.invoke('words:save-recording', bytes),

  // Экспорт и импорт комплекта (ТЗ строка 56). Путь к файлу не пересекает
  // границу: и сохранение, и открытие идут через системный диалог в main.
  exportSet: (setId) => ipcRenderer.invoke('words:export-set', setId),
  importSet: () => ipcRenderer.invoke('words:import-set'),

  // Пароль педагога (ТЗ раздел 3). Наружу только «подошёл или нет»
  checkTeacherPassword: (password) => ipcRenderer.invoke('words:check-teacher-password', password),
  setTeacherPassword: (password) => ipcRenderer.invoke('words:set-teacher-password', password),
  teacherPasswordState: () => ipcRenderer.invoke('words:teacher-password-state'),

  // Свои картинки для поставочных слов (ТЗ строка 42)
  listWordImages: () => ipcRenderer.invoke('words:list-word-images'),
  pickWordImage: (wordId) => ipcRenderer.invoke('words:pick-word-image', wordId),
  clearWordImage: (wordId) => ipcRenderer.invoke('words:clear-word-image', wordId)
});

// Локальное хранилище виджета «АзбукоСлов» (Тип 3) — профили детей, настройки
// занятия и статистика по буквам. Отдельный namespace, используется только
// виджетом alphabet.
contextBridge.exposeInMainWorld('alphabetAPI', {
  getContext: () => ipcRenderer.invoke('alphabet:get-context'),
  getLibrary: () => ipcRenderer.invoke('alphabet:get-library'),
  listProfiles: () => ipcRenderer.invoke('alphabet:list-profiles'),
  createProfile: (name) => ipcRenderer.invoke('alphabet:create-profile', name),
  deleteProfile: (profileId) => ipcRenderer.invoke('alphabet:delete-profile', profileId),
  getSettings: () => ipcRenderer.invoke('alphabet:get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('alphabet:save-settings', settings),
  getStatistics: () => ipcRenderer.invoke('alphabet:get-statistics'),
  saveSession: (profileId, answers) => ipcRenderer.invoke('alphabet:save-session', profileId, answers),
  clearStatistics: (profileId) => ipcRenderer.invoke('alphabet:clear-statistics', profileId),

  // Пароль педагога (ТЗ раздел 3). Наружу только «подошёл или нет»
  checkTeacherPassword: (password) => ipcRenderer.invoke('alphabet:check-teacher-password', password),
  setTeacherPassword: (password) => ipcRenderer.invoke('alphabet:set-teacher-password', password),
  teacherPasswordState: () => ipcRenderer.invoke('alphabet:teacher-password-state')
});
