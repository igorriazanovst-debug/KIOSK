import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEmailAllowedForMathMachine, projectDataHasMathMachineWidget } from './mathmachineAccess';

test('isEmailAllowedForMathMachine allows the designated email, case-insensitively', () => {
  assert.equal(isEmailAllowedForMathMachine('mokretcov.m@poznaikino.ru'), true);
  assert.equal(isEmailAllowedForMathMachine('MOKRETCOV.M@POZNAIKINO.RU'), true);
});

test('isEmailAllowedForMathMachine denies other emails and empty input', () => {
  assert.equal(isEmailAllowedForMathMachine('test@kiosk.local'), false);
  assert.equal(isEmailAllowedForMathMachine(undefined), false);
  assert.equal(isEmailAllowedForMathMachine(null), false);
});

test('projectDataHasMathMachineWidget detects the widget among other widgets', () => {
  assert.equal(
    projectDataHasMathMachineWidget({ widgets: [{ type: 'text' }, { type: 'mathmachine' }] }),
    true,
  );
});

test('projectDataHasMathMachineWidget returns false when absent or malformed', () => {
  assert.equal(projectDataHasMathMachineWidget({ widgets: [{ type: 'text' }] }), false);
  assert.equal(projectDataHasMathMachineWidget(null), false);
  assert.equal(projectDataHasMathMachineWidget({}), false);
});
