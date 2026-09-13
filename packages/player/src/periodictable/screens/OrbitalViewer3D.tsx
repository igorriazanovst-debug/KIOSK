// packages/player/src/periodictable/screens/OrbitalViewer3D.tsx
// Подключается СТАТИЧЕСКИ из ElementDetailCard.tsx — не React.lazy/import().
// Изначально был ленивым (чтобы Three.js не входил в основной бандл), но
// живая проверка на реальном .exe нашла: динамический импорт ломает
// загрузку главного бандла целиком (см. подробный комментарий в
// ElementDetailCard.tsx — конфликт с тем, как этот плеер грузит скрипты
// через `file://`). Плеер — устанавливаемое приложение, не веб-страница:
// разовый рост инсталлятора — приемлемая цена за то, чтобы не трогать
// общий для всех виджетов workaround.
//
// Модель — кольца-оболочки (см. shellGeometry.ts), не лепестковые формы
// s/p/d/f: смена по прямому замечанию пользователя ("в источнике будто
// по-другому и более понятно построено") — сверка с реальным открытым
// кодом источника (github.com/zhilips/zperiod) показала, что там при
// обычном просмотре элемента тоже просто кольца, не облака орбиталей.
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
// examples/jsm — часть пакета three, тот же паттерн подключения, что в
// официальной документации/большинстве интеграций (не отдельный npm-пакет).
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { PeriodicElement } from '../model/schema.ts';
import { computeShellOccupancy } from '../shellModel.ts';
import { buildShellVisualization } from '../shellGeometry.ts';
import { buildNucleus } from '../nucleusGeometry.ts';

interface Props {
  element: PeriodicElement;
}

const OrbitalViewer3D: React.FC<Props> = ({ element }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const resetViewRef = useRef<() => void>(() => {});
  const [rotating, setRotating] = useState(true);
  const shells = computeShellOccupancy(element.electronConfiguration);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || shells.length === 0) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1220);

    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 0.8);
    key.position.set(4, 6, 5);
    scene.add(key);

    const { group: atom, electrons } = buildShellVisualization(shells);

    // Ядро — кластер протонов/нейтронов (см. nucleusGeometry.ts), не одна
    // маленькая точка: раньше центр практически не читался на экране.
    // Добавляется В ГРУППУ АТОМА (не отдельно в сцену), чтобы вращаться
    // вместе с оболочками одним связным объектом.
    const { group: nucleusGroup } = buildNucleus(element.atomicNumber, element.atomicMass);
    atom.add(nucleusGroup);

    scene.add(atom);

    // Кольца лежат в одной плоскости (см. shellGeometry.ts) — камера
    // ставится с наклоном сразу, иначе при первом взгляде "сверху" плоская
    // модель читалась бы как один круг, а не как 3D-объект.
    const boundingSphere = new THREE.Box3().setFromObject(atom).getBoundingSphere(new THREE.Sphere());
    const radius = Math.max(boundingSphere.radius, 1);
    const fitDistance = (radius / Math.sin((camera.fov * Math.PI) / 180 / 2)) * 1.5;
    camera.position.set(0, radius * 0.85, fitDistance);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.minDistance = radius * 0.6;
    controls.maxDistance = fitDistance * 3;
    controls.update();

    const initialCameraPos = camera.position.clone();
    const initialTarget = controls.target.clone();

    // Автовращение ТОЛЬКО пока пользователь не тронул вид сам — иначе
    // собственное вращение атома и ручной поворот камеры мешают друг
    // другу и не дают "поймать" ракурс.
    let autoRotate = true;
    controls.addEventListener('start', () => {
      autoRotate = false;
      setRotating(false);
    });

    // «Сбросить вид» — возврат к исходному кадрированию И включение
    // автовращения обратно, а не просто прыжок камеры: после ручного
    // вращения нет иного способа вернуть автообзор, кроме как заново
    // открыть карточку.
    resetViewRef.current = () => {
      atom.rotation.y = 0;
      camera.position.copy(initialCameraPos);
      controls.target.copy(initialTarget);
      controls.update();
      autoRotate = true;
      setRotating(true);
    };

    let frameId = 0;
    const animate = (time: number) => {
      if (autoRotate) atom.rotation.y += 0.0015;
      // Электроны бегут по своему кольцу независимо от вращения всей
      // сцены — так даже неподвижный (после ручного поворота) вид
      // остаётся "живым" и явно читается как движение по орбите, а не
      // статичная картинка.
      for (const e of electrons) {
        const a = e.angle + time * 0.001 * e.speed;
        e.mesh.position.set(e.radius * Math.cos(a), 0, e.radius * Math.sin(a));
      }
      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);

    const resizeObserver = new ResizeObserver(() => {
      const { clientWidth, clientHeight } = container;
      if (clientWidth === 0 || clientHeight === 0) return;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
    });
    resizeObserver.observe(container);

    // Обязательная уборка WebGL-ресурсов: виджет живёт на киоске часами/
    // днями без перезапуска — незакрытые GL-контексты при каждом открытии
    // карточки копятся и рано или поздно упрутся в лимит браузера на
    // одновременные WebGL-контексты (типично около 16).
    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [element.atomicNumber]);

  if (shells.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#78909c' }}>
        3D-модель для этого элемента построить не удалось — не распознана электронная конфигурация.
      </div>
    );
  }

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <div
          ref={containerRef}
          style={{ width: '100%', height: 320, borderRadius: 10, overflow: 'hidden', touchAction: 'none' }}
          aria-label={`3D-модель электронных оболочек элемента ${element.nameRu}`}
        />
        {!rotating && (
          <button
            onClick={() => resetViewRef.current()}
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              padding: '6px 12px',
              background: 'rgba(255,255,255,0.9)',
              border: '1px solid #cfd8dc',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13,
              color: '#37474f',
            }}
          >
            ↺ Сбросить вид
          </button>
        )}
      </div>
      <p style={{ fontSize: 12, color: '#90a4ae', marginTop: 8, marginBottom: 0 }}>
        Потяните пальцем или мышью, чтобы повернуть; колесо/щипок — приблизить.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, fontSize: 13, color: '#607d8b' }}>
        {shells.map((s) => (
          <span
            key={s.n}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 8px',
              borderRadius: 6,
              background: '#fafafa',
              border: '1px solid #eceff1',
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#4fc3f7' }} />
            n={s.n}: {s.electronCount} e⁻
          </span>
        ))}
      </div>
      <p style={{ fontSize: 12, color: '#90a4ae', marginTop: 8 }}>
        Каждое кольцо — электронная оболочка, точки на нём — электроны на этой оболочке.
      </p>
    </div>
  );
};

export default OrbitalViewer3D;
