export const cities = [
  ['riyadh', 'الرياض', 'Riyadh'], ['jeddah', 'جدة', 'Jeddah'],
  ['mecca', 'مكة المكرمة', 'Mecca'], ['medina', 'المدينة المنورة', 'Medina'],
  ['dammam', 'الدمام', 'Dammam'], ['khobar', 'الخبر', 'Khobar'],
  ['taif', 'الطائف', 'Taif'], ['abha', 'أبها', 'Abha'],
  ['buraidah', 'بريدة', 'Buraidah'], ['tabuk', 'تبوك', 'Tabuk'],
  ['hail', 'حائل', 'Hail'], ['najran', 'نجران', 'Najran'],
  ['jazan', 'جازان', 'Jazan'], ['jubail', 'الجبيل', 'Jubail'],
  ['yanbu', 'ينبع', 'Yanbu'], ['hofuf', 'الهفوف والأحساء', 'Hofuf / Al-Ahsa'],
];

export const reviewStatuses = ['new', 'contacted', 'accepted'];

export function normalizePhone(value) {
  if (typeof value !== 'string' || value.length > 24) return '';
  let phone = value.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[\s()\-\u200e\u200f]/g, '');
  if (phone.startsWith('+966')) phone = `0${phone.slice(4)}`;
  else if (phone.startsWith('00966')) phone = `0${phone.slice(5)}`;
  else if (/^5\d{8}$/.test(phone)) phone = `0${phone}`;
  return /^05\d{8}$/.test(phone) ? phone : '';
}

export function validateCourier(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const allowed = ['name', 'phone', 'city', 'cityOther', 'phoneType', 'ref', 'locale', 'consent'];
  if (Object.keys(value).some((key) => !allowed.includes(key))) return null;
  if (typeof value.name !== 'string' || value.name.length > 100) return null;
  const name = value.name.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (!/^[\p{L}\p{M} .’'\-]+$/u.test(name) || (name.match(/\p{L}/gu)?.length || 0) < 2) return null;
  const phone = normalizePhone(value.phone);
  if (!phone || !['iphone', 'android'].includes(value.phoneType) || !['ar', 'en'].includes(value.locale) || value.consent !== true) return null;
  const knownCity = cities.find(([id]) => id === value.city);
  let cityOther = '';
  if (value.city === 'other') {
    if (typeof value.cityOther !== 'string' || value.cityOther.length > 80) return null;
    cityOther = value.cityOther.normalize('NFC').trim();
    if (!/^[\p{L}\p{M}\p{N} .’'\-]{2,80}$/u.test(cityOther) || !/\p{L}/u.test(cityOther)) return null;
  } else if (!knownCity || (value.cityOther !== undefined && value.cityOther !== '')) return null;
  if (value.ref !== undefined && (typeof value.ref !== 'string' || value.ref.length > 60 || (value.ref && !/^[\p{L}\p{M}\p{N}_.-]+$/u.test(value.ref)))) return null;
  return { name, phone, city: value.city === 'other' ? cityOther : value.city, phoneType: value.phoneType, ref: value.ref || null, locale: value.locale };
}
