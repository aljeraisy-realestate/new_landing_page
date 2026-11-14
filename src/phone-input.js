import { normalizePhone } from '../shared/courier.js';

export const phoneInputValue = (value) => normalizePhone(value) || value.replace(/[^0-9٠-٩۰-۹]/g, '').slice(0, 10);

export function phoneKeyDown(event) {
  if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
  const input = event.currentTarget;
  const selected = (input.selectionEnd ?? 0) - (input.selectionStart ?? 0);
  if (!/^[0-9٠-٩۰-۹]$/.test(event.key) || input.value.length - selected >= 10) event.preventDefault();
}
