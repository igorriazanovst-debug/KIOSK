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

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    const w = widget.width;
    const h = widget.height;
    const centerX = w / 2;
    const centerY = h / 2;
    const radius = Math.min(w, h) / 2;

    // Вычисление точек полигона — совпадает с CSS clip-path из PreviewPage/Player
    const drawShapePath = () => {
      const polygonPath = (sides: number, startAngle: number = -Math.PI / 2) => {
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
          const angle = startAngle + (2 * Math.PI * i) / sides;
          const px = centerX + radius * Math.cos(angle);
          const py = centerY + radius * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      };

      switch (clipShape) {
        case 'circle':
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.closePath();
          break;

        case 'ellipse':
          ctx.beginPath();
          ctx.ellipse(centerX, centerY, w / 2, h / 2, 0, 0, Math.PI * 2);
          ctx.closePath();
          break;

        case 'triangle': {
          const angles = [-Math.PI / 2, Math.PI / 6, 5 * Math.PI / 6];
          ctx.beginPath();
          angles.forEach((a, i) => {
            const px = centerX + radius * Math.cos(a);
            const py = centerY + radius * Math.sin(a);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.closePath();
          break;
        }

        case 'diamond':
          ctx.beginPath();
          ctx.moveTo(centerX, 0);
          ctx.lineTo(w, centerY);
          ctx.lineTo(centerX, h);
          ctx.lineTo(0, centerY);
          ctx.closePath();
          break;

        case 'pentagon':
          polygonPath(5);
          break;

        case 'hexagon':
          polygonPath(6);
          break;

        case 'octagon':
          polygonPath(8);
          break;

        case 'star': {
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const angle = (i * Math.PI / 5) - Math.PI / 2;
            const r = i % 2 === 0 ? radius : radius * 0.5;
            const x = centerX + r * Math.cos(angle);
            const y = centerY + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          break;
        }

        case 'rounded-rectangle':
          drawRoundedRect(ctx, 0, 0, w, h, cornerRadius);
          break;

        default:
          ctx.rect(0, 0, w, h);
          break;
      }
    };

    drawShapePath();
    ctx.clip();

    // Рисуем изображение (cover mode)
    const imgRatio = image.width / image.height;
    const widgetRatio = w / h;

    let sx = 0, sy = 0, sw = image.width, sh = image.height;
    let dx = 0, dy = 0, dw = w, dh = h;

    if (imgRatio > widgetRatio) {
      sw = image.height * widgetRatio;
      sx = (image.width - sw) / 2;
    } else {
      sh = image.width / widgetRatio;
      sy = (image.height - sh) / 2;
    }

    ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
    ctx.restore();

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
      image={undefined}
      width={widget.width}
      height={widget.height}
      opacity={opacity}
      listening={false}
    />
  );
};

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
