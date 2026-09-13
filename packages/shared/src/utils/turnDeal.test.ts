// packages/shared/src/utils/turnDeal.test.ts
//
// Проверяем СВОЙСТВА раздачи, а не конкретную последовательность: раздача
// случайна, и тест на «вышло именно это» ломался бы при любой правке
// генератора, ничего при этом не защищая.
//
// Прогоняем каждое свойство на многих зёрнах. Одно зерно доказывает только,
// что с этим зерном повезло: прежняя раздача, где каждому игроку доставался
// свой независимый список, на отдельных зёрнах тоже выглядела прилично.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { dealTurnTargets, playerIndexForTurn, TurnDealError } from './turnDeal';

type Rng = () => number;

function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pool = (size: number) => Array.from({ length: size }, (_, i) => `w${i}`);

/** Есть ли повтор внутри любого окна такой ширины */
function repeatWithin<T>(items: readonly T[], width: number): boolean {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < Math.min(i + width, items.length); j++) {
      if (items[i] === items[j]) return true;
    }
  }
  return false;
}

describe('раздача заданий по ходам', () => {
  it('отдаёт ровно столько заданий, сколько ходов', () => {
    const dealt = dealTurnTargets(pool(12), { turns: 40, players: 4, rng: seededRng(1) });
    assert.equal(dealt.length, 40);
  });

  it('раздаёт только то, что есть в запасе', () => {
    const source = pool(7);
    const dealt = dealTurnTargets(source, { turns: 30, players: 3, rng: seededRng(2) });
    for (const item of dealt) assert.ok(source.includes(item), `${item} не из запаса`);
  });

  it('в одном круге задания игроков не повторяются', () => {
    // Главное требование: дети за столом не получают одно слово одновременно
    for (let seed = 1; seed <= 200; seed++) {
      for (const players of [2, 3, 4]) {
        const dealt = dealTurnTargets(pool(12), {
          turns: players * 10,
          players,
          rng: seededRng(seed),
        });
        assert.equal(
          repeatWithin(dealt, players),
          false,
          `зерно ${seed}, игроков ${players}: повтор внутри круга`
        );
      }
    }
  });

  it('одному игроку одно задание не выпадает двумя его ходами подряд', () => {
    // Отдельно от круга: ходы одного игрока отстоят ровно на число игроков, и
    // правило, разводящее только соседей по кругу, такой повтор пропускает
    for (let seed = 1; seed <= 200; seed++) {
      for (const players of [2, 3, 4]) {
        const dealt = dealTurnTargets(pool(12), {
          turns: players * 10,
          players,
          rng: seededRng(seed),
        });
        for (let p = 0; p < players; p++) {
          const mine = dealt.filter((_, turn) => playerIndexForTurn(turn, players) === p);
          assert.equal(
            repeatWithin(mine, 2),
            false,
            `зерно ${seed}, игроков ${players}, игрок ${p}: своё задание повторилось подряд`
          );
        }
      }
    }
  });

  it('запас расходуется равномерно — нет «любимых» заданий', () => {
    // Раздача идёт полными перемешанными проходами, поэтому за партию каждое
    // задание использовано одинаковое число раз с точностью до единицы.
    //
    // Проверять здесь РАССТОЯНИЕ между повторами было бы ошибкой: первая
    // редакция теста требовала, чтобы оно было не меньше размера запаса, и
    // упала — потому что требовала того, чего раздача проходами не даёт и
    // дать не обязана. Повтор на стыке двух проходов законен.
    for (let seed = 1; seed <= 100; seed++) {
      const size = 9;
      const turns = 36;
      const dealt = dealTurnTargets(pool(size), { turns, players: 3, rng: seededRng(seed) });
      const counts = new Map<string, number>();
      for (const item of dealt) counts.set(item, (counts.get(item) ?? 0) + 1);
      const used = [...counts.values()];
      assert.ok(
        Math.max(...used) - Math.min(...used) <= 1,
        `зерно ${seed}: разброс использования ${Math.min(...used)}…${Math.max(...used)}`
      );
      assert.equal(counts.size, size, `зерно ${seed}: задействован не весь запас`);
    }
  });

  it('в одиночной игре одно задание не встаёт двумя ходами подряд', () => {
    // Прежнее поведение обоих виджетов — его нельзя потерять
    for (let seed = 1; seed <= 200; seed++) {
      const dealt = dealTurnTargets(pool(5), { turns: 20, players: 1, rng: seededRng(seed) });
      assert.equal(repeatWithin(dealt, 2), false, `зерно ${seed}: повтор подряд`);
    }
  });

  it('запас ровно из одного задания не роняет и не зацикливает раздачу', () => {
    const dealt = dealTurnTargets(['одно'], { turns: 8, players: 2, rng: seededRng(3) });
    assert.deepEqual(dealt, Array(8).fill('одно'));
  });

  it('заданий меньше, чем игроков, — раздача идёт, но повтор в круге допускается', () => {
    // Четырём игрокам не раздать три разных слова. Проверяем, что раздача
    // отдаёт запрошенное и не виснет, а не то, что она совершает чудо
    const dealt = dealTurnTargets(pool(3), { turns: 16, players: 4, rng: seededRng(4) });
    assert.equal(dealt.length, 16);
    assert.equal(new Set(dealt).size, 3);
  });

  it('пустой запас — это ошибка раздачи, а не пустая партия', () => {
    assert.throws(
      () => dealTurnTargets([], { turns: 4, players: 2, rng: seededRng(5) }),
      TurnDealError
    );
  });

  it('ноль игроков и ноль ходов отвергаются', () => {
    assert.throws(() => dealTurnTargets(pool(3), { turns: 4, players: 0, rng: seededRng(6) }), TurnDealError);
    assert.throws(() => dealTurnTargets(pool(3), { turns: 0, players: 2, rng: seededRng(6) }), TurnDealError);
  });

  it('ходы раскладываются по игрокам по кругу', () => {
    assert.equal(playerIndexForTurn(0, 3), 0);
    assert.equal(playerIndexForTurn(1, 3), 1);
    assert.equal(playerIndexForTurn(2, 3), 2);
    assert.equal(playerIndexForTurn(3, 3), 0);
  });

  it('раздача не мутирует переданный запас', () => {
    const source = pool(6);
    const copy = source.slice();
    dealTurnTargets(source, { turns: 12, players: 2, rng: seededRng(7) });
    assert.deepEqual(source, copy);
  });

  it('одно зерно даёт одну и ту же раздачу', () => {
    // Воспроизводимость нужна разбору жалобы «у нас выпало странное»
    const a = dealTurnTargets(pool(10), { turns: 20, players: 2, rng: seededRng(42) });
    const b = dealTurnTargets(pool(10), { turns: 20, players: 2, rng: seededRng(42) });
    assert.deepEqual(a, b);
  });
});
