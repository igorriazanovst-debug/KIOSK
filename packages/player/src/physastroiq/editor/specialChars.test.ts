// packages/player/src/physastroiq/editor/specialChars.test.ts
// FR-015 ТЗ 11 (строка 336). Проверяется не механика вставки (она общая с
// РусIQ и покрыта там), а СОСТАВ набора: копия приехала от «БиоIQ» с
// биологическим набором, и подмена его физико-астрономическим —
// содержательная правка, которую легко откатить обратным копированием, не
// заметив.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PHYSASTROIQ_SPECIAL_CHARS } from './specialChars.ts';

test('есть знаки, без которых не записать школьную формулу по физике', () => {
  // T = 2π√(l/g), Δt, λ, ω, сопротивление в Ω.
  for (const ch of ['√', 'π', 'Δ', 'λ', 'ω', 'Ω']) {
    assert.ok(PHYSASTROIQ_SPECIAL_CHARS.includes(ch), `нет знака ${ch}`);
  }
});

test('есть α, β и γ — три вида радиоактивного излучения', () => {
  for (const ch of ['α', 'β', 'γ']) {
    assert.ok(PHYSASTROIQ_SPECIAL_CHARS.includes(ch), `нет ${ch}-излучения`);
  }
});

test('точка умножения есть отдельно от косого креста', () => {
  // В единицах пишут Н·м и кг·м/с, а не Н×м. Панель не должна подсказывать
  // неверную запись, поэтому нужны оба знака, каждый для своего случая.
  assert.ok(PHYSASTROIQ_SPECIAL_CHARS.includes('·'), 'нет точки — не набрать Н·м');
  assert.ok(PHYSASTROIQ_SPECIAL_CHARS.includes('×'), 'нет креста — не набрать 3×10⁸');
});

test('есть астрономические знаки Солнца, Луны и Земли', () => {
  // Массы и радиусы планет школьник сравнивает как M⊕ и R⊕, звёзды — как M☉.
  for (const ch of ['☉', '☾', '⊕']) {
    assert.ok(PHYSASTROIQ_SPECIAL_CHARS.includes(ch), `нет знака ${ch}`);
  }
});

test('есть угловые минуты и секунды — координаты на карте звёздного неба', () => {
  // Видимый диаметр Луны — около 31′, склонение записывается в ° ′ ″.
  assert.ok(PHYSASTROIQ_SPECIAL_CHARS.includes('′'));
  assert.ok(PHYSASTROIQ_SPECIAL_CHARS.includes('″'));
  assert.ok(PHYSASTROIQ_SPECIAL_CHARS.includes('°'));
});

test('индексы, степени и знаки заряда СОХРАНЕНЫ при смене предмета', () => {
  // v₀, t₁, R₂ — индексы величин; 3·10⁸ и 9,8 м/с² — степени; 10⁻¹⁹ Кл — знак
  // степени. Всё это нужно физике не меньше, чем прежнему предмету.
  for (const ch of ['₀', '₁', '₂']) {
    assert.ok(PHYSASTROIQ_SPECIAL_CHARS.includes(ch), `нет подстрочного ${ch}`);
  }
  for (const ch of ['²', '³', '⁸']) {
    assert.ok(PHYSASTROIQ_SPECIAL_CHARS.includes(ch), `нет надстрочного ${ch}`);
  }
  for (const ch of ['⁺', '⁻']) {
    assert.ok(PHYSASTROIQ_SPECIAL_CHARS.includes(ch), `нет знака ${ch}`);
  }
  assert.ok(PHYSASTROIQ_SPECIAL_CHARS.includes('→'), 'нет стрелки — нечем обозначить вектор');
});

test('биологических знаков от Типа 10 в наборе не осталось', () => {
  // ♀/♂ — наследование, сцепленное с полом; ‰ — солёность среды. В курсе
  // физики и астрономии ни один из них не нужен, и их присутствие означало бы,
  // что набор не заменён, а лишь дополнен.
  for (const ch of ['♀', '♂', '‰']) {
    assert.ok(!PHYSASTROIQ_SPECIAL_CHARS.includes(ch), `в наборе остался биологический знак ${ch}`);
  }
});

test('греческие буквы взяты выборочно, а не алфавитом', () => {
  // Осознанное ограничение. Отдельно: ν (ню) не добавлена намеренно — рядом с
  // латинской v в одной формуле она неотличима и ведёт к неверному ответу.
  for (const ch of ['ξ', 'ψ', 'ζ', 'η', 'θ', 'ν']) {
    assert.ok(!PHYSASTROIQ_SPECIAL_CHARS.includes(ch), `в наборе лишняя греческая буква ${ch}`);
  }
});

test('дубликатов в наборе нет', () => {
  // Две одинаковые кнопки подряд выглядят как ошибка вёрстки, и найти их
  // глазами среди полусотни символов трудно.
  assert.equal(new Set(PHYSASTROIQ_SPECIAL_CHARS).size, PHYSASTROIQ_SPECIAL_CHARS.length);
});
