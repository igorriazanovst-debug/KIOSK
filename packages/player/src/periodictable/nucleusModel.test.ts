// packages/player/src/periodictable/nucleusModel.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateNeutronCount,
  computeNucleusComposition,
  fibonacciSpherePoints,
  sampleNucleusParticles,
  MAX_RENDERED_NUCLEONS,
} from './nucleusModel.ts';

test('estimateNeutronCount matches known elements (rounded atomic mass minus proton count)', () => {
  assert.equal(estimateNeutronCount(1, 1.008), 0); // H
  assert.equal(estimateNeutronCount(2, 4.0026), 2); // He
  assert.equal(estimateNeutronCount(6, 12.011), 6); // C
  assert.equal(estimateNeutronCount(26, 55.845), 30); // Fe: round(55.845)=56, 56-26=30
  assert.equal(estimateNeutronCount(92, 238.03), 146); // U
});

test('estimateNeutronCount never goes negative', () => {
  assert.equal(estimateNeutronCount(10, 5), 0);
});

test('computeNucleusComposition sums protons and neutrons into totalNucleons', () => {
  const comp = computeNucleusComposition(26, 55.845);
  assert.equal(comp.protonCount, 26);
  assert.equal(comp.neutronCount, 30);
  assert.equal(comp.totalNucleons, 56);
});

test('fibonacciSpherePoints returns exactly N points, each a unit vector', () => {
  const points = fibonacciSpherePoints(50);
  assert.equal(points.length, 50);
  for (const [x, y, z] of points) {
    const norm = Math.sqrt(x * x + y * y + z * z);
    assert.ok(Math.abs(norm - 1) < 1e-9, `expected unit vector, got norm ${norm}`);
  }
});

test('fibonacciSpherePoints handles zero and one point without throwing', () => {
  assert.deepEqual(fibonacciSpherePoints(0), []);
  assert.equal(fibonacciSpherePoints(1).length, 1);
});

test('sampleNucleusParticles caps at MAX_RENDERED_NUCLEONS for a heavy element (uranium)', () => {
  const comp = computeNucleusComposition(92, 238.03); // 238 total nucleons
  const particles = sampleNucleusParticles(comp);
  assert.equal(particles.length, MAX_RENDERED_NUCLEONS);
});

test('sampleNucleusParticles renders every nucleon for a light element (no capping needed)', () => {
  const comp = computeNucleusComposition(6, 12.011); // 12 total nucleons
  const particles = sampleNucleusParticles(comp);
  assert.equal(particles.length, 12);
});

test('sampleNucleusParticles preserves the real proton:total ratio within rounding, even when capped', () => {
  const comp = computeNucleusComposition(92, 238.03); // real ratio 92/238
  const particles = sampleNucleusParticles(comp);
  const protonCountInSample = particles.filter((p) => p.isProton).length;
  const expected = Math.round(MAX_RENDERED_NUCLEONS * (92 / 238));
  assert.ok(Math.abs(protonCountInSample - expected) <= 1, `expected close to ${expected}, got ${protonCountInSample}`);
});

test('sampleNucleusParticles spreads protons across the sequence, not all bunched at the start', () => {
  const comp = computeNucleusComposition(6, 12.011); // 6 protons, 6 neutrons, 12 total
  const particles = sampleNucleusParticles(comp);
  // With an even 1:1 split, protons and neutrons should alternate, not
  // appear as "6 protons then 6 neutrons" (which sampleNucleusParticles's
  // whole reason for existing is to avoid).
  const firstHalfProtons = particles.slice(0, 6).filter((p) => p.isProton).length;
  assert.notEqual(firstHalfProtons, 6);
});

test('sampleNucleusParticles returns an empty array for a hypothetical zero-nucleon composition', () => {
  assert.deepEqual(sampleNucleusParticles({ protonCount: 0, neutronCount: 0, totalNucleons: 0 }), []);
});
