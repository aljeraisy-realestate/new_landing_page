import test from 'node:test';
import assert from 'node:assert/strict';
import { phoneKeyDown, phoneInputValue } from '../src/phone-input.js';

test('phone input blocks the eleventh digit and letters while retaining editing controls', () => {
  function blocked(key, options = {}) {
    let prevented = false;
    phoneKeyDown({ key, currentTarget: { value: '0551234567', selectionStart: 10, selectionEnd: 10 }, preventDefault() { prevented = true; }, ...options });
    return prevented;
  }
  assert.equal(blocked('8'), true);
  assert.equal(blocked('٨'), true);
  assert.equal(blocked('a'), true);
  for (const key of ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End']) assert.equal(blocked(key), false);
  assert.equal(blocked('v', { ctrlKey: true }), false);
  assert.equal(blocked('a', { metaKey: true }), false);
  assert.equal(blocked('8', { currentTarget: { value: '0551234567', selectionStart: 2, selectionEnd: 4 } }), false);
  assert.equal(blocked('8', { currentTarget: { value: '055', selectionStart: 3, selectionEnd: 3 } }), false);
});

test('paste and autofill values are reduced to at most ten digits', () => {
  assert.equal(phoneInputValue('05512345678901234'), '0551234567');
  assert.equal(phoneInputValue('055 123-4567abc'), '0551234567');
  assert.equal(phoneInputValue('٠٥٥١٢٣٤٥٦٧٨٩'), '٠٥٥١٢٣٤٥٦٧');
  assert.equal(phoneInputValue(''), '');
});
