// packages/player/src/periodictable/orbitalModel.contentCoverage.test.ts
// Инвариант против РЕАЛЬНОГО содержимого elements.json (118 элементов), не
// только против ручных примеров выше: каждая строка electronConfiguration
// должна разобраться без единого "потерянного" токена — если появится
// формат, который parseElectronConfiguration молча не распознал (см.
// комментарий "пропускаем, не рушим весь разбор" в orbitalModel.ts), этот
// тест ловит расхождение числом валентных групп, а не тихо рисует
// неполный атом на экране.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseElectronConfiguration } from './orbitalModel.ts';
import elementsJson from './content/elements.json' with { type: 'json' };

test('every element electronConfiguration parses with at least one recognized valence group', () => {
  const failures: string[] = [];
  for (const el of (elementsJson as { elements: { atomicNumber: number; symbol: string; electronConfiguration: string }[] }).elements) {
    const parsed = parseElectronConfiguration(el.electronConfiguration);
    if (parsed.valenceGroups.length === 0) {
      failures.push(`${el.atomicNumber} ${el.symbol}: "${el.electronConfiguration}"`);
    }
  }
  assert.deepEqual(failures, [], `elements with zero parsed valence groups:\n${failures.join('\n')}`);
});

test('every recognized token accounts for the full non-core portion of the string (no silently dropped tokens)', () => {
  const failures: string[] = [];
  for (const el of (elementsJson as { elements: { atomicNumber: number; symbol: string; electronConfiguration: string }[] }).elements) {
    const withoutAnnotation = el.electronConfiguration.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const withoutCore = withoutAnnotation.replace(/^\[\w+\]\s*/, '');
    const expectedTokenCount = withoutCore.split(/\s+/).filter(Boolean).length;
    const parsed = parseElectronConfiguration(el.electronConfiguration);
    if (parsed.valenceGroups.length !== expectedTokenCount) {
      failures.push(
        `${el.atomicNumber} ${el.symbol}: "${el.electronConfiguration}" — expected ${expectedTokenCount} tokens, parsed ${parsed.valenceGroups.length}`
      );
    }
  }
  assert.deepEqual(failures, [], `elements with a token-count mismatch:\n${failures.join('\n')}`);
});
