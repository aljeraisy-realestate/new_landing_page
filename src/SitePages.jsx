import { useEffect, useRef, useState } from 'react';
import { cities, pageContent } from './pages-content.js';
import { pageHref } from './preferences.js';
import { normalizePhone } from '../shared/courier.js';

function PageHeading({ title, intro, language, label, Icon }) {
  const c = pageContent[language];
  return <section className="page-hero"><div className="shell">
    <a className="page-back text-link" href={pageHref('/', language)}><Icon name="arrow" />{c.home}</a>
    <p className="eyebrow">{label}</p><h1>{title}</h1><p className="page-lede">{intro}</p>
  </div></section>;
}

function CourierPage({ language, Icon }) {
  const c = pageContent[language];
  const [fields, setFields] = useState({ name: '', phone: '', city: '', cityOther: '', phoneType: '' });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle');
  const form = useRef(null);
  const request = useRef(null);
  const pending = useRef(false);
  const result = useRef(null);
  const ar = language === 'ar';

  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);
  useEffect(() => { if (status === 'success') result.current?.focus(); }, [status]);

  function update(event) {
    const { name, value } = event.target;
    setFields((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    if (status === 'error' || status === 'invalid') setStatus('idle');
  }

  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    const nextErrors = {};
    const name = fields.name.normalize('NFC').trim().replace(/\s+/g, ' ');
    const phone = normalizePhone(fields.phone);
    const cityOther = fields.cityOther.normalize('NFC').trim();
    const validName = /^[\p{L}\p{M} .’'\-]+$/u.test(name) && (name.match(/\p{L}/gu)?.length || 0) >= 2;
    if (!validName || name.length > 100) nextErrors.name = 'invalidName';
    if (!phone) nextErrors.phone = 'invalidPhone';
    if (!cities.some(([id]) => id === fields.city) && fields.city !== 'other') nextErrors.city = 'invalidCity';
    if (fields.city === 'other' && (!/^[\p{L}\p{M}\p{N} .’'\-]{2,80}$/u.test(cityOther) || !/\p{L}/u.test(cityOther))) nextErrors.cityOther = 'invalidCity';
    if (!['iphone', 'android'].includes(fields.phoneType)) nextErrors.phoneType = 'invalidDevice';
    if (!consent) nextErrors.consent = 'invalidConsent';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setStatus('invalid');
      form.current?.elements.namedItem(Object.keys(nextErrors)[0])?.focus();
      return;
    }
    const queryRef = new URLSearchParams(window.location.search).get('ref') || '';
    const ref = /^[\p{L}\p{M}\p{N}_.-]{1,60}$/u.test(queryRef) ? queryRef : '';
    const payload = { name, phone, city: fields.city, cityOther: fields.city === 'other' ? cityOther : '', phoneType: fields.phoneType, ref, locale: language, consent: true };
    pending.current = true;
    setStatus('sending');
    const controller = new AbortController();
    request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch('/api/courier-leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload), credentials: 'same-origin', signal: controller.signal,
      });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('submission_failed');
      const body = await response.json();
      if (body?.ok !== true && !(typeof body?.id === 'string' && body.id.length > 0) && !(typeof body?.id === 'number' && body.id > 0)) throw new Error('unconfirmed_submission');
      if (request.current === controller) setStatus('success');
    } catch {
      if (request.current === controller) setStatus('error');
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) request.current = null;
      pending.current = false;
    }
  }

  const errorFor = (name) => errors[name] ? <span id={`error-${name}`} className="field-error">{c[errors[name]]}</span> : null;
  const fieldProps = (name) => ({ name, value: fields[name], onChange: update, 'aria-invalid': !!errors[name], 'aria-describedby': errors[name] ? `error-${name}` : undefined });

  return <>
    <PageHeading title={c.courierTitle} intro={c.courierIntro} label={c.couriers} language={language} Icon={Icon} />
    <section className="shell application-layout section-space">
      <aside className="application-story"><span className="benefit-icon"><Icon name="gift" /></span><h2>{c.application}</h2><p>{c.formNote}</p><ul className="application-benefits">{c.values.map(([title]) => <li key={title}><Icon name="check" />{title}</li>)}</ul><a className="text-link" href={pageHref('/', language, 'get-giftly')}>{c.download}<Icon name="diagonal" /></a></aside>
      <div className="application-card">
        {status === 'success' ? <div className="application-result" ref={result} tabIndex="-1">
          <span className="benefit-icon"><Icon name="check" /></span>
          <h2>{c.success}</h2><p>{c.successNote}</p>
          <a className="text-link" href={pageHref('/', language)}>{c.home}<Icon name="arrow" /></a>
        </div> : <form ref={form} onSubmit={submit} noValidate aria-busy={status === 'sending'}>
          <h2>{c.application}</h2><p className="form-intro">{c.formNote}</p>
          <fieldset disabled={status === 'sending'}>
            <label className="form-field"><span>{c.name}</span><input {...fieldProps('name')} autoComplete="name" required maxLength="100" placeholder={c.namePlaceholder} />{errorFor('name')}</label>
            <label className="form-field"><span>{c.mobile}</span><input {...fieldProps('phone')} type="tel" inputMode="tel" autoComplete="tel" required maxLength="24" dir="ltr" placeholder="05XXXXXXXX" aria-describedby={`phone-hint${errors.phone ? ' error-phone' : ''}`} />{errorFor('phone')}</label>
            <p id="phone-hint" className="field-hint phone-field-hint">{c.phoneHint}</p>
            <div className="form-row">
              <label className="form-field"><span>{c.city}</span><select {...fieldProps('city')} autoComplete="address-level2" required><option value="">{c.chooseCity}</option>{cities.map(([id, arabic, english]) => <option key={id} value={id}>{ar ? arabic : english}</option>)}<option value="other">{c.otherCity}</option></select>{errorFor('city')}</label>
              <label className="form-field"><span>{c.device}</span><select {...fieldProps('phoneType')} required><option value="">{c.chooseDevice}</option><option value="iphone">{c.iphone}</option><option value="android">{c.android}</option></select>{errorFor('phoneType')}</label>
            </div>
            {fields.city === 'other' && <label className="form-field"><span>{c.cityName}</span><input {...fieldProps('cityOther')} required maxLength="80" autoComplete="address-level2" />{errorFor('cityOther')}</label>}
            <label className="checkbox-field consent-field"><input name="consent" type="checkbox" checked={consent} required aria-invalid={!!errors.consent} aria-describedby={errors.consent ? 'error-consent' : undefined} onChange={(event) => { setConsent(event.target.checked); setErrors((current) => ({ ...current, consent: undefined })); }} /><span>{c.consent}<a href={pageHref('/privacy', language)} target="_blank" rel="noopener noreferrer">{c.privacy}</a>.</span></label>{errorFor('consent')}
            {(status === 'invalid' || status === 'error') && <p className="form-error" role="alert">{status === 'invalid' ? c.invalid : c.submitError}</p>}
            <button className="button form-submit" type="submit">{status === 'sending' ? c.sending : c.submit}<Icon name="diagonal" /></button>
          </fieldset>
        </form>}
      </div>
    </section>
  </>;
}

export default function SitePage({ page, language, Icon }) {
  const c = pageContent[language];
  if (page === 'couriers') return <CourierPage language={language} Icon={Icon} />;
  if (page === 'about') return <>
    <PageHeading title={c.aboutTitle} intro={c.aboutIntro} label={c.about} language={language} Icon={Icon} />
    <section className="shell about-layout section-space"><div className="about-question"><Icon name="heart" /><h2>{c.aboutQuestion}</h2><p>{c.aboutStory}</p></div><div className="about-values">{c.values.map(([title, body], index) => <article key={title}><span className="benefit-icon"><Icon name={['gift', 'receipt', 'heart'][index]} /></span><h3>{title}</h3><p>{body}</p></article>)}</div></section>
    <section className="about-contact"><div className="shell"><h2>{c.teamTitle}</h2><div className="contact-details"><div><h3>{c.location}</h3><p>{c.appointment}</p></div><div><h3>{c.hours}</h3><p>{c.hoursDetail}</p></div><div><a href="mailto:info@giftly.sa">info@giftly.sa</a><p>{c.company}</p><p>{c.registration}</p></div></div><a className="button" href={pageHref('/', language, 'get-giftly')}>{c.download}<Icon name="diagonal" /></a></div></section>
  </>;
  if (page === 'privacy' || page === 'terms') {
    const sections = page === 'privacy' ? c.privacySections : c.termsSections;
    return <><PageHeading title={c[page]} intro={c[`${page}Intro`]} label="Giftly" language={language} Icon={Icon} />
      <div className="shell legal-layout section-space">
        <aside><h2>{c.contents}</h2><nav aria-label={c.contents}>{sections.map(([title], index) => <a key={title} href={`#legal-${index}`}>{title}</a>)}</nav></aside>
        <article className="legal-article">
          <p className="legal-updated">{c.updatedLabel}: <time dateTime="2026-10-26">{c.updatedDate}</time></p>
          {sections.map(([title, paragraphs], index) => <section id={`legal-${index}`} key={title} aria-labelledby={`legal-title-${index}`}>
            <h2 id={`legal-title-${index}`}>{title}</h2>
            {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </section>)}
          {page === 'terms' && <p className="legal-note">{c.paymentNote}</p>}
          <div className="legal-contact"><p>{c.contact}<a href="mailto:info@giftly.sa">info@giftly.sa</a></p><p>{c.company} — {c.registration}</p><a className="text-link" href={`https://giftly.sa/${page}`} target="_blank" rel="noopener noreferrer">{c.source}<Icon name="diagonal" /></a></div>
        </article>
      </div>
    </>;
  }
  return <PageHeading title={c.notFound} intro={c.notFoundBody} label="Giftly" language={language} Icon={Icon} />;
}
