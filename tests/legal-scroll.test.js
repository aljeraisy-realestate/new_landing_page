import test from 'node:test';
import assert from 'node:assert/strict';
import { activeLegalSection } from '../src/legal-scroll.js';

test('reading indicator follows section starts below the sticky header in both scroll directions', () => {
  const sections = [{ id: 'legal-0', top: -450 }, { id: 'legal-1', top: 118 }, { id: 'legal-2', top: 900 }];
  assert.equal(activeLegalSection(sections, 120), 'legal-1');
  assert.equal(activeLegalSection(sections.map((section) => ({ ...section, top: section.top + 20 })), 120), 'legal-0');
});

test('a long section remains current until the next heading crosses the reading line', () => {
  assert.equal(activeLegalSection([{ id: 'legal-0', top: -2000 }, { id: 'legal-1', top: 600 }], 160), 'legal-0');
});

test('short final sections become current at the end of the page', () => {
  const sections = [{ id: 'legal-0', top: -300 }, { id: 'legal-1', top: 250 }];
  assert.equal(activeLegalSection(sections, 120, true), 'legal-1');
});

test('initial reading position and empty documents are handled safely', () => {
  assert.equal(activeLegalSection([{ id: 'legal-0', top: 800 }], 100), 'legal-0');
  assert.equal(activeLegalSection([], 100), null);
});
