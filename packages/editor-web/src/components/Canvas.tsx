import React, { useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Transformer, Image as KonvaImage, Text, Group } from 'react-konva';
import { useEditorStore } from '../stores/editorStore';
import ImageWidget from './ImageWidget';
import ButtonWidget from './ButtonWidget';
import TextWidget from './TextWidget';
import VideoWidget from './VideoWidget';
import ShapeWidget from './ShapeWidget';
import MenuWidget from './MenuWidget';
import './Canvas.css';
import TextEditorOverlay from './TextEditorOverlay';

// Цвета для fallback отображения (если специальный компонент не используется)
const WIDGET_COLORS: Record<string, string> = {
  shape: '#4a90e2',
  rectangle: '#4a90e2',  // Для обратной совместимости
  button: '#2ecc71',
  text: '#e74c3c',
  image: '#9b59b6',
  video: '#f39c12'
};

const Canvas: React.FC = () => {
  const { 
    project, 
    selectedWidgetIds, 
    selectWidget, 
    clearSelection,
    updateWidget,
    zoom,
    gridEnabled,
    snapToGrid,
    gridSize,
    gridLineWidth,
    gridColor,
    pendingWidget,
    addWidgetAtPosition,
    clearPendingWidget
  } = useEditorStore();

  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  const [editingWidget, setEditingWidget] = React.useState<{id: string; x: number; y: number; width: number; height: number; html: string} | null>(null);

  // Функция привязки к сетке
  const snapToGridValue = (value: number): number => {
    if (!snapToGrid) return value;
    return Math.round(value / gridSize) * gridSize;
  };

  // Функция для привязки во время перетаскивания
  const dragBoundFunc = (pos: { x: number; y: number }) => {
    return {
      x: snapToGridValue(pos.x),
      y: snapToGridValue(pos.y)
    };
  };

  useEffect(() => {
    if (!transformerRef.current || !project) return;

    const stage = stageRef.current;
    
    // Находим выбранные виджеты и фильтруем заблокированные
    const selectedNodes = selectedWidgetIds
      .map(id => {
        const widget = project.widgets.find(w => w.id === id);
        // Игнорируем заблокированные виджеты
        if (widget?.locked) return null;
        return stage.findOne(`#${id}`);
      })
      .filter(Boolean);

    transformerRef.current.nodes(selectedNodes);
    transformerRef.current.getLayer().batchDraw();
  }, [selectedWidgetIds, project]);

  if (!project) return null;

  const handleStageClick = (e: any) => {
    // Если есть ожидающий виджет - добавляем его в точку клика
    if (pendingWidget) {
      const stage = e.target.getStage();
      const pointerPosition = stage.getPointerPosition();
      
      if (pointerPosition) {
        addWidgetAtPosition(pointerPosition.x, pointerPosition.y);
      }
      return;
    }

    // Если клик по Stage или по фоновому прямоугольнику - снять выделение
    const clickedOnEmpty = e.target === e.target.getStage() || 
                          e.target.attrs.id === 'canvas-background';
    
    if (clickedOnEmpty) {
      clearSelection();
    }
  };

  const handleWidgetClick = (id: string, e: any) => {
    e.cancelBubble = true;
    const isMultiSelect = e.evt.ctrlKey || e.evt.metaKey;
    selectWidget(id, isMultiSelect);
  };

  const handleTextDblClick = (widget: any, e: any) => {
    e.cancelBubble = true;
    // Use htmlContent if exists, otherwise wrap plain text in <p>
    const html = widget.properties.htmlContent
      || (widget.properties.text ? `<p>${widget.properties.text}</p>` : '<p></p>');
    setEditingWidget({ id: widget.id, x: widget.x, y: widget.y, width: widget.width, height: widget.height, html });
  };

  const handleEditorClose = (html: string) => {
    if (!editingWidget) return;
    // strip empty paragraph
    const clean = html === '<p></p>' ? '' : html;
    const currentWidget = project?.widgets.find(w => w.id === editingWidget.id);
    if (currentWidget) {
      updateWidget(editingWidget.id, {
        properties: { ...currentWidget.properties, htmlContent: clean }
      });
    }
    setEditingWidget(null);
  };

  const handleDragEnd = (id: string, e: any) => {
    const x = snapToGridValue(e.target.x());
    const y = snapToGridValue(e.target.y());

    updateWidget(id, { x, y });
  };

  const handleTransformEnd = (id: string, e: any) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Сбрасываем scale и применяем его к размерам
    node.scaleX(1);
    node.scaleY(1);

    // Для Group нужно получить width/height из attrs
    const nodeWidth = node.width ? node.width() : node.attrs.width || 100;
    const nodeHeight = node.height ? node.height() : node.attrs.height || 100;

    let width = Math.max(10, nodeWidth * scaleX);
    let height = Math.max(10, nodeHeight * scaleY);
    let x = node.x();
    let y = node.y();

    // Привязка к сетке
    if (snapToGrid) {
      width = snapToGridValue(width);
      height = snapToGridValue(height);
      x = snapToGridValue(x);
      y = snapToGridValue(y);
    }

    updateWidget(id, {
      x,
      y,
      width,
      height,
      rotation: node.rotation()
    });
  };

  // Рендерим сетку
  const renderGrid = () => {
    if (!gridEnabled) return null;

    const lines = [];
    const { width, height } = project.canvas;

    // Вертикальные линии
    for (let i = 0; i <= width / gridSize; i++) {
      lines.push(
        <Rect
          key={`v-${i}`}
          x={i * gridSize}
          y={0}
          width={gridLineWidth}
          height={height}
          fill={gridColor}
        />
      );
    }

    // Горизонтальные линии
    for (let i = 0; i <= height / gridSize; i++) {
      lines.push(
        <Rect
          key={`h-${i}`}
          x={0}
          y={i * gridSize}
          width={width}
          height={gridLineWidth}
          fill={gridColor}
        />
      );
    }

    return lines;
  };

  return (
    <div className="canvas-container">
      <div className="canvas-scroll">
        <div 
          className="canvas-wrapper"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            cursor: pendingWidget ? 'crosshair' : 'default'
          }}
        >
          <Stage
            ref={stageRef}
            width={project.canvas.width}
            height={project.canvas.height}
            onClick={handleStageClick}
            onTap={handleStageClick}
          >
            <Layer>
              {/* Фон холста */}
              <Rect
                id="canvas-background"
                x={0}
                y={0}
                width={project.canvas.width}
                height={project.canvas.height}
                fill={project.canvas.backgroundColor || '#ffffff'}
              />
              
              {/* Сетка */}
              {renderGrid()}

              {/* Виджеты */}
              {project.widgets
                .slice()
                .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
                .map(widget => {
                const isLocked = widget.locked || false;
                const isWidgetVisible = (widget as any).visible !== false;
                
                // Для изображений используем ImageWidget
                if (widget.type === 'image') {
                  return (
                    <React.Fragment key={widget.id}>
                      <ImageWidget
                        widget={widget}
                        isSelected={selectedWidgetIds.includes(widget.id)}
                        onSelect={(e) => handleWidgetClick(widget.id, e)}
                        onDragEnd={(e) => handleDragEnd(widget.id, e)}
                        onTransformEnd={(e) => handleTransformEnd(widget.id, e)}
                        dragBoundFunc={snapToGrid ? dragBoundFunc : undefined}
                      />
                      {/* Иконка замка */}
                      {isLocked && (
                        <Text
                          x={widget.x + 5}
                          y={widget.y + 5}
                          text="🔒"
                          fontSize={16}
                          listening={false}
                        />
                      )}
                      {/* Иконка скрытости */}
                      {!isWidgetVisible && (
                        <Text
                          x={widget.x + widget.width - 24}
                          y={widget.y + 5}
                          text="👁️"
                          fontSize={16}
                          listening={false}
                          opacity={0.5}
                        />
                      )}
                    </React.Fragment>
                  );
                }

                // Для кнопок используем ButtonWidget
                if (widget.type === 'button') {
                  return (
                    <React.Fragment key={widget.id}>
                      <ButtonWidget
                        widget={widget}
                        isSelected={selectedWidgetIds.includes(widget.id)}
                        onSelect={(e) => handleWidgetClick(widget.id, e)}
                        onDragEnd={(e) => handleDragEnd(widget.id, e)}
                        onTransformEnd={(e) => handleTransformEnd(widget.id, e)}
                        dragBoundFunc={snapToGrid ? dragBoundFunc : undefined}
                      />
                      {/* Иконка замка */}
                      {isLocked && (
                        <Text
                          x={widget.x + 5}
                          y={widget.y + 5}
                          text="🔒"
                          fontSize={16}
                          listening={false}
                        />
                      )}
                    </React.Fragment>
                  );
                }

                // Для текста используем TextWidget
                if (widget.type === 'text') {
                  return (
                    <React.Fragment key={widget.id}>
                      <TextWidget
                        widget={widget}
                        isSelected={selectedWidgetIds.includes(widget.id)}
                        onSelect={(e) => handleWidgetClick(widget.id, e)}
                        onDblClick={(e) => handleTextDblClick(widget, e)}
                        onDragEnd={(e) => handleDragEnd(widget.id, e)}
                        onTransformEnd={(e) => handleTransformEnd(widget.id, e)}
                        dragBoundFunc={snapToGrid ? dragBoundFunc : undefined}
                      />
                      {/* Иконка замка */}
                      {isLocked && (
                        <Text
                          x={widget.x + 5}
                          y={widget.y + 5}
                          text="🔒"
                          fontSize={16}
                          listening={false}
                        />
                      )}
                    </React.Fragment>
                  );
                }

                // Для видео используем VideoWidget
                if (widget.type === 'video') {
                  return (
                    <React.Fragment key={widget.id}>
                      <VideoWidget
                        widget={widget}
                        isSelected={selectedWidgetIds.includes(widget.id)}
                        onSelect={(e) => handleWidgetClick(widget.id, e)}
                        onDragEnd={(e) => handleDragEnd(widget.id, e)}
                        onTransformEnd={(e) => handleTransformEnd(widget.id, e)}
                        dragBoundFunc={snapToGrid ? dragBoundFunc : undefined}
                      />
                      {/* Иконка замка */}
                      {isLocked && (
                        <Text
                          x={widget.x + 5}
                          y={widget.y + 5}
                          text="🔒"
                          fontSize={16}
                          listening={false}
                        />
                      )}
                    </React.Fragment>
                  );
                }

                // Для фигур используем ShapeWidget
                if (widget.type === 'shape' || widget.type === 'rectangle') {
                  return (
                    <React.Fragment key={widget.id}>
                      <ShapeWidget
                        widget={widget}
                        isSelected={selectedWidgetIds.includes(widget.id)}
                        onSelect={(e) => handleWidgetClick(widget.id, e)}
                        onDragEnd={(e) => handleDragEnd(widget.id, e)}
                        onTransformEnd={(e) => handleTransformEnd(widget.id, e)}
                        dragBoundFunc={snapToGrid ? dragBoundFunc : undefined}
                      />
                      {/* Иконка замка */}
                      {isLocked && (
                        <Text
                          x={widget.x + 5}
                          y={widget.y + 5}
                          text="🔒"
                          fontSize={16}
                          listening={false}
                        />
                      )}
                    </React.Fragment>
                  );
                }

                // Для меню используем MenuWidget
                if (widget.type === 'menu') {
                  return (
                    <React.Fragment key={widget.id}>
                      <MenuWidget
                        widget={widget}
                        isSelected={selectedWidgetIds.includes(widget.id)}
                        onSelect={(e) => handleWidgetClick(widget.id, e)}
                        onDragEnd={(e) => handleDragEnd(widget.id, e)}
                        onTransformEnd={(e) => handleTransformEnd(widget.id, e)}
                        dragBoundFunc={snapToGrid ? dragBoundFunc : undefined}
                      />
                      {/* Иконка замка */}
                      {isLocked && (
                        <Text
                          x={widget.x + 5}
                          y={widget.y + 5}
                          text="🔒"
                          fontSize={16}
                          listening={false}
                        />
                      )}
                    </React.Fragment>
                  );
                }

                // Для остальных типов - обычный Rect (fallback)
                return (
                  <React.Fragment key={widget.id}>
                    <Rect
                      id={widget.id}
                      x={widget.x}
                      y={widget.y}
                      width={widget.width}
                      height={widget.height}
                      rotation={widget.rotation || 0}
                      fill={WIDGET_COLORS[widget.type] || '#4a90e2'}
                      stroke={selectedWidgetIds.includes(widget.id) ? '#007acc' : undefined}
                      strokeWidth={selectedWidgetIds.includes(widget.id) ? 2 : 0}
                      opacity={isLocked ? 0.6 : 1}
                      draggable={!isLocked}
                      onClick={(e) => handleWidgetClick(widget.id, e)}
                      onTap={(e) => handleWidgetClick(widget.id, e)}
                      onDragEnd={(e) => handleDragEnd(widget.id, e)}
                      onTransformEnd={(e) => handleTransformEnd(widget.id, e)}
                    />
                    {/* Иконка замка для заблокированных виджетов */}
                    {isLocked && (
                      <Text
                        x={widget.x + 5}
                        y={widget.y + 5}
                        text="🔒"
                        fontSize={16}
                        listening={false}
                      />
                    )}
                  </React.Fragment>
                );
              })}

              {/* Transformer для трансформации выделенных виджетов */}
              <Transformer
                ref={transformerRef}
                boundBoxFunc={(oldBox, newBox) => {
                  // Минимальный размер 10x10
                  if (newBox.width < 10 || newBox.height < 10) {
                    return oldBox;
                  }
                  return newBox;
                }}
              />
            </Layer>
          </Stage>

          {/* Rich text overlay */}
          {editingWidget && (
            <TextEditorOverlay
              widgetId={editingWidget.id}
              x={editingWidget.x}
              y={editingWidget.y}
              width={editingWidget.width}
              height={editingWidget.height}
              zoom={zoom}
              initialHtml={editingWidget.html}
              onClose={handleEditorClose}
            />
          )}
        </div>
      </div>

      <div className="canvas-info">
        <span>
          {project.canvas.width} × {project.canvas.height} px
        </span>
        {selectedWidgetIds.length > 0 && (
          <span>
            Выбрано: {selectedWidgetIds.length}
          </span>
        )}
      </div>
    </div>
  );
};

export default Canvas;
