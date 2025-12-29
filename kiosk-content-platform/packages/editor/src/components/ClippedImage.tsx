import React, { useEffect, useState, useRef } from 'react';
import { Image as KonvaImage, Group, Star, RegularPolygon, Circle, Ellipse, Line } from 'react-konva';
import { Widget } from '../types';

interface ClippedImageProps {
  widget: Widget;
  image: HTMLImageElement | null;
}

const ClippedImage: React.FC<ClippedImageProps> = ({ widget, image }) => {
  const imageRef = useRef<any>(null);
  
  const {
    clipShape = 'rectangle',
    cornerRadius = 0,
    opacity = 1
  } = widget.properties;

  useEffect(() => {
    if (!imageRef.current || !image) return;

    const node = imageRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    canvas.width = widget.width;
    canvas.height = widget.height;

    // Создаём маску в зависимости от формы
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    const centerX = widget.width / 2;
    const centerY = widget.height / 2;
    const radius = Math.min(widget.width, widget.height) / 2;

    switch (clipShape) {
      case 'circle':
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.closePath();
        break;

      case 'ellipse':
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, widget.width / 2, widget.height / 2, 0, 0, Math.PI * 2);
        ctx.closePath();
        break;

      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - radius);
        ctx.lineTo(centerX + radius * Math.cos(Math.PI / 6), centerY + radius * Math.sin(Math.PI / 6));
        ctx.lineTo(centerX - radius * Math.cos(Math.PI / 6), centerY + radius * Math.sin(Math.PI / 6));
        ctx.closePath();
        break;

      case 'diamond':
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - radius);
        ctx.lineTo(centerX + radius, centerY);
        ctx.lineTo(centerX, centerY + radius);
        ctx.lineTo(centerX - radius, centerY);
        ctx.closePath();
        break;

      case 'pentagon':
        drawPolygon(ctx, centerX, centerY, radius, 5);
        break;

      case 'hexagon':
        drawPolygon(ctx, centerX, centerY, radius, 6);
        break;

      case 'octagon':
        drawPolygon(ctx, centerX, centerY, radius, 8);
        break;

      case 'rounded-rectangle':
        drawRoundedRect(ctx, 0, 0, widget.width, widget.height, cornerRadius || 20);
        break;

      case 'rectangle':
      default:
        ctx.rect(0, 0, widget.width, widget.height);
        break;
    }

    ctx.clip();

    // Рисуем изображение с сохранением пропорций
    const imgAspect = image.width / image.height;
    const widgetAspect = widget.width / widget.height;
    
    let drawWidth, drawHeight, drawX, drawY;
    
    if (imgAspect > widgetAspect) {
      // Изображение шире
      drawHeight = widget.height;
      drawWidth = image.width * (widget.height / image.height);
      drawX = (widget.width - drawWidth) / 2;
      drawY = 0;
    } else {
      // Изображение выше
      drawWidth = widget.width;
      drawHeight = image.height * (widget.width / image.width);
      drawX = 0;
      drawY = (widget.height - drawHeight) / 2;
    }

    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();

    // Применяем canvas как изображение
    const clippedImage = new window.Image();
    clippedImage.src = canvas.toDataURL();
    
    clippedImage.onload = () => {
      if (node) {
        node.image(clippedImage);
        node.getLayer()?.batchDraw();
      }
    };

  }, [image, widget.width, widget.height, clipShape, cornerRadius]);

  if (!image) {
    return null;
  }

  return (
    <KonvaImage
      ref={imageRef}
      width={widget.width}
      height={widget.height}
      opacity={opacity}
      listening={false}
    />
  );
};

// Вспомогательные функции
function drawPolygon(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, sides: number) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (i * 2 * Math.PI / sides) - Math.PI / 2;
    const px = x + radius * Math.cos(angle);
    const py = y + radius * Math.sin(angle);
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export default ClippedImage;
