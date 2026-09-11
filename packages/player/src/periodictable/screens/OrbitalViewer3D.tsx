// packages/player/src/periodictable/screens/OrbitalViewer3D.tsx
// Подключается СТАТИЧЕСКИ из ElementDetailCard.tsx — не React.lazy/import().
// Изначально был ленивым (чтобы Three.js не входил в основной бандл), но
// живая проверка на реальном .exe нашла: динамический импорт ломает
// загрузку главного бандла целиком (см. подробный комментарий в
// ElementDetailCard.tsx — конфликт с тем, как этот плеер грузит скрипты
// через `file://`). Плеер — устанавливаемое приложение, не веб-страница:
// разовый рост инсталлятора — приемлемая цена за то, чтобы не трогать
// общий для всех виджетов workaround.
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
// examples/jsm — часть пакета three, тот же паттерн подключения, что в
// официальной документации/большинстве интеграций (не отдельный npm-пакет).
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { PeriodicElement } from '../model/schema.ts';
import { parseElectronConfiguration } from '../orbitalModel.ts';
import { buildAtomOrbitals, orbitalGroupColor } from '../orbitalGeometry.ts';

interface Props {
  element: PeriodicElement;
}

const OrbitalViewer3D: React.FC<Props> = ({ element }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const parsed = parseElectronConfiguration(element.electronConfiguration);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || parsed.valenceGroups.length === 0) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1220);

    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 2, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    // min/maxDistance выставляются ниже, после построения атома — по его
    // реальному размеру (см. комментарий у fitDistance).

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(4, 6, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.4);
    rim.position.set(-4, -2, -5);
    scene.add(rim);

    // Ядро — простая точка-ориентир в центре, не физически точная модель
    // ядра (протоны/нейтроны не визуализируются, не задача этого вида).
    const nucleus = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xffca28, emissive: 0x442a00, roughness: 0.4 })
    );
    scene.add(nucleus);

    const atom = buildAtomOrbitals(parsed.valenceGroups);
    scene.add(atom);

    // Камера кадрируется по РЕАЛЬНОМУ размеру построенной геометрии, а не
    // по фиксированной позиции: радиус орбиталей растёт с номером оболочки
    // (shellScale в orbitalGeometry.ts), и для тяжёлых элементов с
    // валентными группами на n=6-7 (например Og) фиксированная камера
    // обрезала бы атом по краям экрана — живая проверка на Церии (n=4-6)
    // уже показала обрезание при жёстко заданной позиции.
    const boundingSphere = new THREE.Box3().setFromObject(atom).getBoundingSphere(new THREE.Sphere());
    const radius = Math.max(boundingSphere.radius, 1);
    const fitDistance = (radius / Math.sin((camera.fov * Math.PI) / 180 / 2)) * 1.35;
    camera.position.set(0, radius * 0.4, fitDistance);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.minDistance = radius * 0.6;
    controls.maxDistance = fitDistance * 3;
    controls.update();

    let frameId = 0;
    const animate = () => {
      atom.rotation.y += 0.0015;
      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

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

  if (parsed.valenceGroups.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#78909c' }}>
        3D-модель для этого элемента построить не удалось — не распознана электронная конфигурация.
      </div>
    );
  }

  return (
    <div>
      <div
        ref={containerRef}
        style={{ width: '100%', height: 320, borderRadius: 10, overflow: 'hidden', touchAction: 'none' }}
        aria-label={`3D-модель орбиталей элемента ${element.nameRu}`}
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, fontSize: 13, color: '#607d8b' }}>
        {parsed.coreLabel && <span>Остов: [{parsed.coreLabel}]</span>}
        {parsed.valenceGroups.map((g) => (
          <span
            key={`${g.n}${g.subshell}`}
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
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: orbitalGroupColor(g.subshell) }} />
            {g.n}
            {g.subshell}
            {g.electronCount}
          </span>
        ))}
      </div>
      <p style={{ fontSize: 12, color: '#90a4ae', marginTop: 8 }}>
        Показаны валентные орбитали (за скобками остова инертного газа). Формы приближённые, f-орбитали упрощены.
      </p>
    </div>
  );
};

export default OrbitalViewer3D;
