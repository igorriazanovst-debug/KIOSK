import { Project } from '../types';

// Сохранение проекта в файл
export const saveProjectToFile = (project: Project) => {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.name}.kiosk.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Загрузка проекта из файла
export const loadProjectFromFile = (): Promise<Project> => {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.kiosk.json,.json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }

      try {
        const text = await file.text();
        const project = JSON.parse(text) as Project;
        
        // Валидация проекта
        if (!project.version || !project.canvas || !Array.isArray(project.widgets)) {
          throw new Error('Invalid project format');
        }
        
        resolve(project);
      } catch (error) {
        reject(error);
      }
    };

    input.click();
  });
};

// Экспорт проекта в различные форматы
export const exportProject = {
  // Экспорт в JSON
  toJSON: (project: Project): string => {
    return JSON.stringify(project, null, 2);
  },

  // Экспорт в HTML (для runtime)
  toHTML: (project: Project): string => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.name}</title>
  <style>
    body { margin: 0; padding: 0; overflow: hidden; }
    #kiosk-container { 
      width: ${project.canvas.width}px; 
      height: ${project.canvas.height}px;
      background-color: ${project.canvas.backgroundColor || '#ffffff'};
      position: relative;
    }
  </style>
</head>
<body>
  <div id="kiosk-container"></div>
  <script>
    window.KIOSK_PROJECT = ${JSON.stringify(project)};
  </script>
  <script src="./runtime.js"></script>
</body>
</html>`;
  }
};

// Валидация проекта
export const validateProject = (project: any): project is Project => {
  if (!project || typeof project !== 'object') return false;
  if (!project.version || typeof project.version !== 'string') return false;
  if (!project.canvas || typeof project.canvas !== 'object') return false;
  if (typeof project.canvas.width !== 'number' || typeof project.canvas.height !== 'number') return false;
  if (!Array.isArray(project.widgets)) return false;
  
  return true;
};

// Создание превью проекта (для списка проектов)
export const createProjectThumbnail = async (project: Project): Promise<string> => {
  // В будущем можно реализовать рендер canvas в base64
  return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect width="200" height="150" fill="%23f0f0f0"/><text x="50%" y="50%" text-anchor="middle" fill="%23666">Preview</text></svg>';
};

// Миграция проекта между версиями
export const migrateProject = (project: any): Project => {
  // Пока просто возвращаем как есть
  // В будущем здесь будет логика миграции между версиями
  return project;
};
