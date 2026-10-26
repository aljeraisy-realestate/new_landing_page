import { cities, normalizePhone, reviewStatuses } from './courier.js';

export const courierPageSizes = [20, 50, 100];
export const courierSortFields = ['id', 'name', 'phone', 'city', 'phone_type', 'created_at', 'status'];
export const canonicalCity = (value) => cities.find((labels) => labels.some((label) => label.toLowerCase() === value.toLowerCase()))?.[0] || value;
export const cityAliases = (value) => cities.find(([id]) => id === canonicalCity(value))?.map((label) => label.toLowerCase()) || [value.toLowerCase()];

export function normalizeCourierFilters({ search = '', status = '', city = '', phone = '', phoneType = '', sortBy = 'created_at', sortDirection = 'desc', page = 1, pageSize = 20 } = {}) {
  const invalid = () => { throw new Error('invalid_filters'); };
  if ([search, status, city, phone, phoneType, sortBy, sortDirection].some((value) => typeof value !== 'string')) invalid();
  search = search.trim(); city = city.normalize('NFC').trim(); phone = phone.trim();
  page = Number(page); pageSize = Number(pageSize);
  if (search.length > 100 || city.length > 80 || phone.length > 24 || (status && !reviewStatuses.includes(status)) || (phoneType && !['iphone', 'android'].includes(phoneType)) || !courierSortFields.includes(sortBy) || !['asc', 'desc'].includes(sortDirection) || !Number.isInteger(page) || page < 1 || page > 100000 || !courierPageSizes.includes(pageSize)) invalid();
  if (phone) {
    const full = normalizePhone(phone);
    const digits = phone.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776));
    if (!/^\+?[\d\s()\-\u200e\u200f]+$/.test(digits)) invalid();
    const compact = digits.replace(/[\s()\-\u200e\u200f]/g, '');
    phone = full || compact.replace(/^(?:\+966|00966)/, '0');
    if (!/^\d{1,10}$/.test(phone)) invalid();
  }
  return { search, status, city: canonicalCity(city), phone, phoneType, sortBy, sortDirection, page, pageSize };
}
