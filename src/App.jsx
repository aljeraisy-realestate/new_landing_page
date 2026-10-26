import { useEffect, useRef, useState } from 'react';
import { content, screens } from './content.js';
import { applyPreferences, initialLanguage, initialTheme, pageHref, routePath, savePreference } from './preferences.js';
import { pageContent } from './pages-content.js';
import SitePage from './SitePages.jsx';
import DownloadSection from './DownloadSection.jsx';
import MobilePreview from './MobilePreview.jsx';
import SecuritySection from './SecuritySection.jsx';
import { Brand, Icon } from './ui.jsx';

function Phone({ id, label, language, className = '', eager = false, onOpen, openLabel }) {
  const screen = screens.find((item) => item.id === id) || screens[0];
  return <div className={`phone ${className}`}>
    <div className="phone-scroll" tabIndex={onOpen ? -1 : 0} aria-label={label}>
      {screen.kind === 'illustration' ? <MobilePreview id={screen.id} language={language} /> : <img src={screen.file} alt={label} width="390" loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'} draggable="false" />}
    </div>
    {onOpen && <button className="phone-open" onClick={() => onOpen(id)} aria-label={`${openLabel}: ${label}`}><Icon name="diagonal" /></button>}
  </div>;
}

function ScreenDialog({ selected, onClose, copy, language }) {
  const dialog = useRef(null);
  const scroll = useRef(null);
  const screen = screens.find((item) => item.id === selected);

  useEffect(() => {
    const element = dialog.current;
    if (!selected || !element) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!element.open) element.showModal();
    scroll.current?.scrollTo({ top: 0 });
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [selected]);

  return <dialog ref={dialog} className="screen-dialog" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} aria-labelledby="preview-title" aria-describedby="preview-hint">
    {screen && <div className="dialog-inner">
      <div className="dialog-top"><h2 id="preview-title">{copy.screenNames[screen.id]}</h2><button className="round-button" onClick={onClose} autoFocus aria-label={copy.close}><Icon name="close" /></button></div>
      <p id="preview-hint">{copy.previewHint}</p>
      <div ref={scroll} className="dialog-scroll" tabIndex="0">{screen.kind === 'illustration' ? <MobilePreview id={screen.id} language={language} /> : <img src={screen.file} alt={copy.screenNames[screen.id]} width="390" />}</div>
      <p className="dialog-reference">{screen.kind === 'illustration' ? copy.illustratedReference : copy.reference}</p>
    </div>}
  </dialog>;
}

export default function App() {
  const [language, setLanguage] = useState(initialLanguage);
  const [theme, setTheme] = useState(initialTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  const [occasion, setOccasion] = useState(0);
  const [step, setStep] = useState(0);
  const [activeScreen, setActiveScreen] = useState('home');
  const [preview, setPreview] = useState(null);
  const copy = content[language];
  const pageCopy = pageContent[language];
  const path = routePath(window.location.pathname);
  const page = ({ '/': 'home', '/about': 'about', '/who-we-are': 'about', '/privacy': 'privacy', '/terms': 'terms', '/rules': 'terms', '/couriers': 'couriers', '/become-courier': 'couriers' })[path] || 'notFound';
  const ar = language === 'ar';
  const navIds = ['how-it-works', 'inside', 'why-giftly'];
  const currentStep = copy.steps[step];
  const workflowButtons = useRef([]);
  const galleryButtons = useRef([]);

  useEffect(() => {
    applyPreferences(language, theme);
    savePreference('giftly_language', language);
    savePreference('giftly_theme', theme);
    document.title = page === 'home' ? copy.title : `${pageCopy[page]} | Giftly`;
    const description = page === 'about' ? pageCopy.aboutIntro : page === 'couriers' ? pageCopy.courierIntro : page === 'home' ? copy.description : pageCopy[`${page}Intro`] || copy.description;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#15111b' : '#68318e');
    const url = new URL(window.location.href);
    url.pathname = pageHref(path, language);
    url.searchParams.delete('lang');
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url);
  }, [language, theme, copy, pageCopy, page, path]);

  useEffect(() => {
    const restoreLanguage = () => setLanguage(initialLanguage());
    window.addEventListener('popstate', restoreLanguage);
    return () => window.removeEventListener('popstate', restoreLanguage);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        document.getElementById('mobile-menu-button')?.focus();
      }
    };
    const closeOnResize = () => { if (window.innerWidth > 760) setMenuOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnResize);
    return () => { window.removeEventListener('keydown', closeOnEscape); window.removeEventListener('resize', closeOnResize); };
  }, [menuOpen]);

  function keyboardSelect(event, index, total, select, refs) {
    let next;
    if (event.key === 'ArrowRight') next = (index + (ar ? -1 : 1) + total) % total;
    if (event.key === 'ArrowLeft') next = (index + (ar ? 1 : -1) + total) % total;
    if (event.key === 'ArrowDown') next = (index + 1) % total;
    if (event.key === 'ArrowUp') next = (index - 1 + total) % total;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = total - 1;
    if (next === undefined) return;
    event.preventDefault();
    select(next);
    refs.current[next]?.focus();
  }

  function switchLanguage() {
    setLanguage(ar ? 'en' : 'ar');
    setMenuOpen(false);
  }

  return <>
    <a className="skip-link" href="#main">{copy.skip}</a>
    <header className="header" id="top">
      <div className="shell nav-bar">
        <div className="nav-identity">
          <button className="menu-button round-button" id="mobile-menu-button" aria-expanded={menuOpen} aria-controls="main-navigation" aria-label={menuOpen ? copy.closeMenu : copy.menu} onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'} /></button>
          <Brand language={language} />
        </div>
        <nav id="main-navigation" className={`navigation${menuOpen ? ' is-open' : ''}`} aria-label={ar ? 'القائمة الرئيسية' : 'Main navigation'}>
          {copy.nav.map((label, index) => <a key={navIds[index]} href={pageHref('/', language, navIds[index])} onClick={() => setMenuOpen(false)}>{label}</a>)}
          <a href={pageHref('/about', language)} aria-current={page === 'about' ? 'page' : undefined}>{pageCopy.about}</a>
          <a className="mobile-download-link" href={pageHref('/', language, 'get-giftly')} onClick={() => setMenuOpen(false)}>{pageCopy.download}</a>
        </nav>
        <div className="nav-actions">
          <a className="button button-small" href={pageHref('/', language, 'get-giftly')}>{pageCopy.download}<Icon name="diagonal" /></a>
          <div className="site-preferences" role="group" aria-label={ar ? 'اللغة والمظهر' : 'Language and appearance'}>
            <button className="language-button" onClick={switchLanguage} lang={ar ? 'en' : 'ar'} dir={ar ? 'ltr' : 'rtl'} aria-label={ar ? 'Switch to English' : 'التبديل إلى العربية'}>{ar ? 'English' : 'العربية'}</button>
            <button className="theme-button round-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-pressed={theme === 'dark'} aria-label={theme === 'dark' ? pageCopy.light : pageCopy.dark} title={theme === 'dark' ? pageCopy.light : pageCopy.dark}><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button>
          </div>
        </div>
      </div>
    </header>

    <main id="main" tabIndex="-1">
      {page === 'home' ? <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <span className="origin"><span className="origin-flower" aria-hidden="true">✳</span>{copy.made}</span>
            <h1 id="hero-title">{copy.hero.map((line) => <span key={line}>{line}</span>)}</h1>
            <p className="hero-intro">{copy.intro}</p>
            <div className="hero-actions"><a className="button" href="#get-giftly">{copy.primary}<Icon name="diagonal" /></a><a className="text-link" href="#how-it-works"><span className="play-circle"><Icon name="play" /></span>{copy.secondary}</a></div>
            <div className="occasion-picker" role="group" aria-label={copy.occasionLabel}>{copy.occasions.map((label, index) => <button key={index} aria-pressed={occasion === index} onClick={() => setOccasion(index)}><Icon name={['gift', 'heart', 'spark'][index]} />{label}</button>)}</div>
            <p className="occasion-idea" aria-live="polite" aria-atomic="true">{copy.ideas[occasion]}</p>
          </div>
          <div className="hero-stage">
            <div className="stage-orbit" aria-hidden="true" />
            <svg className="ribbon-line" viewBox="0 0 550 600" fill="none" aria-hidden="true"><path d="M20 450C-70 300 250 520 355 295S115 44 190 202c75 158 270-82 310 0" stroke="currentColor" strokeWidth="2" strokeDasharray="5 7" /></svg>
            <span className="stage-spark spark-one" aria-hidden="true">✳</span><span className="stage-spark spark-two" aria-hidden="true">✦</span>
            <Phone id="delivered" label={copy.screenNames.delivered} className="hero-phone-back" eager onOpen={setPreview} openLabel={copy.viewScreen} />
            <Phone id="home" label={copy.screenNames.home} className="hero-phone-main" eager onOpen={setPreview} openLabel={copy.viewScreen} />
            <div className="delivery-note"><span className="note-icon"><Icon name="heart" /></span><div><strong>{copy.floating}</strong></div><span className="note-check"><Icon name="check" /></span></div>
            <div className="handwritten hero-handwritten">{copy.note}<svg viewBox="0 0 100 50" fill="none" aria-hidden="true"><path d="M5 5c0 35 65 40 80 15M72 23l15-7 1 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></div>
          </div>
        </div>
      </section>

      <div className="thought-ribbon"><div className="shell ribbon-items">{copy.ribbon.map((item) => <span key={item}><Icon name="spark" />{item}</span>)}</div></div>

      <section className="journey section-space" id="how-it-works" aria-labelledby="journey-title">
        <div className="shell">
          <div className="section-heading journey-heading"><div><p className="eyebrow">{copy.journeyLabel}</p><h2 id="journey-title">{copy.journeyTitle}</h2></div><p>{copy.journeyIntro}</p></div>
          <div className="journey-grid">
            <div className="journey-steps" role="tablist" aria-label={copy.demoLabel} aria-orientation="vertical">
              {copy.steps.map((item, index) => <button key={index} ref={(element) => { workflowButtons.current[index] = element; }} className={`journey-step${step === index ? ' is-active' : ''}`} id={`step-tab-${index}`} role="tab" aria-selected={step === index} aria-controls="journey-panel" tabIndex={step === index ? 0 : -1} onClick={() => setStep(index)} onKeyDown={(event) => keyboardSelect(event, index, copy.steps.length, setStep, workflowButtons)}><span className="step-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><span className="step-text"><strong>{item.title}</strong><span>{item.body}</span></span><Icon name={step === index ? 'arrow' : 'plus'} /></button>)}
            </div>
            <div className="journey-preview-group">
            <div className="journey-display" role="tabpanel" id="journey-panel" aria-labelledby={`step-tab-${step}`} tabIndex="0">
              <span className="journey-counter">{copy.step} <bdi>{String(step + 1).padStart(2, '0')}</bdi> {copy.of} <bdi>{String(copy.steps.length).padStart(2, '0')}</bdi></span>
              <div className="journey-circle" aria-hidden="true" />
              <Phone key={currentStep.screen} id={currentStep.screen} label={copy.screenNames[currentStep.screen]} language={language} className="journey-phone" onOpen={setPreview} openLabel={copy.viewScreen} />
              <div className="journey-message" aria-live="polite"><Icon name={currentStep.icon} /><span>{currentStep.detail}</span></div>
            </div>
            <div className="journey-navigation"><button onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}><Icon name="arrow" />{copy.previousStep}</button><button onClick={() => setStep((current) => Math.min(copy.steps.length - 1, current + 1))} disabled={step === copy.steps.length - 1}>{copy.nextStep}<Icon name="arrow" /></button></div>
            <p className="journey-reference">{screens.find((screen) => screen.id === currentStep.screen)?.kind === 'illustration' ? copy.illustratedReference : copy.reference}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="gallery section-space" id="inside" aria-labelledby="gallery-title">
        <div className="shell">
          <div className="section-heading"><div><p className="eyebrow">{copy.galleryLabel}</p><h2 id="gallery-title">{copy.galleryTitle}</h2></div><p>{copy.galleryIntro}</p></div>
          <div className="gallery-layout">
            <div className="gallery-menu" role="tablist" aria-label={copy.galleryLabel} aria-orientation="vertical">{screens.map((screen, index) => <button key={screen.id} ref={(element) => { galleryButtons.current[index] = element; }} id={`screen-tab-${screen.id}`} role="tab" aria-selected={activeScreen === screen.id} aria-controls="gallery-panel" tabIndex={activeScreen === screen.id ? 0 : -1} onClick={() => setActiveScreen(screen.id)} onKeyDown={(event) => keyboardSelect(event, index, screens.length, (next) => setActiveScreen(screens[next].id), galleryButtons)}><span className="gallery-tab-icon"><Icon name={screen.icon} /></span><span>{copy.screenNames[screen.id]}</span><Icon name="diagonal" /></button>)}</div>
            <div className="gallery-panel" role="tabpanel" id="gallery-panel" aria-labelledby={`screen-tab-${activeScreen}`} tabIndex="0">
              <div className="gallery-phone-wrap"><span className="gallery-star" aria-hidden="true">✳</span><Phone key={activeScreen} id={activeScreen} label={copy.screenNames[activeScreen]} language={language} className="gallery-phone" onOpen={setPreview} openLabel={copy.viewScreen} /></div>
              <div className="gallery-details"><span className="mini-mark" aria-hidden="true"><Icon name="spark" /></span><h3>{copy.screenNames[activeScreen]}</h3><p>{copy.screenBodies[activeScreen]}</p><button className="text-link" onClick={() => setPreview(activeScreen)}>{copy.viewScreen}<Icon name="diagonal" /></button><small>{screens.find((screen) => screen.id === activeScreen)?.kind === 'illustration' ? copy.illustratedReference : copy.reference}</small></div>
            </div>
          </div>
        </div>
      </section>

      <SecuritySection copy={copy} Icon={Icon} />

      <section className="why section-space" id="why-giftly" aria-labelledby="why-title">
        <div className="shell why-layout"><div className="why-intro"><p className="eyebrow">{copy.whyLabel}</p><h2 id="why-title">{copy.whyTitle}</h2><p>{copy.whyIntro}</p><figure className="gift-figure"><img src="/artwork/gifts.png" alt={ar ? 'علب هدايا بشرائط ملوّنة من تصاميم قيڤتلي' : 'Giftly gift boxes with colourful ribbons'} width="300" height="188" loading="lazy" /><figcaption>{copy.giftCaption}</figcaption><span className="gift-sticker" aria-hidden="true"><Icon name="heart" /></span></figure></div><div className="benefits">{copy.benefits.map((benefit) => <article className="benefit" key={benefit.title}><span className="benefit-icon"><Icon name={benefit.icon} /></span><div><h3>{benefit.title}</h3><p>{benefit.body}</p></div></article>)}</div></div>
      </section>

      <section className="courier-section" aria-labelledby="courier-title"><div className="shell"><div className="courier-banner"><div><p className="eyebrow">{copy.courierLabel}</p><h2 id="courier-title">{copy.courierTitle}</h2><p className="courier-body">{copy.courierBody}</p><a className="button" href={pageHref('/couriers', language)}>{pageCopy.couriers}<Icon name="diagonal" /></a></div><div className="courier-visual"><div className="courier-art"><img src="/artwork/courier.png" alt="" width="114" height="145" loading="lazy" /><span aria-hidden="true">✦</span></div><ul>{copy.courierTags.map((tag) => <li key={tag}><Icon name="check" />{tag}</li>)}</ul></div></div></div></section>

      <section className="faq section-space" aria-labelledby="faq-title"><div className="shell faq-grid"><div><p className="eyebrow">{copy.faqLabel}</p><h2 id="faq-title">{copy.faqTitle}</h2></div><div className="faq-list">{copy.faqs.map(([question, answer]) => <details key={question}><summary>{question}<Icon name="plus" /></summary><p>{answer}</p></details>)}</div></div></section>

      <DownloadSection copy={copy} language={language} Icon={Icon} />
      </> : <SitePage page={page} language={language} Icon={Icon} />}
    </main>

    <footer className="footer"><div className="shell">
      <div className="footer-main">
        <div className="footer-identity"><Brand footer language={language} /><p>{copy.footerMade}</p></div>
        <nav aria-label={ar ? 'روابط التذييل' : 'Footer navigation'}>
          {['about', 'couriers', 'privacy', 'terms'].map((target) => <a key={target} href={pageHref(`/${target}`, language)} aria-current={page === target ? 'page' : undefined}>{pageCopy[target]}</a>)}
        </nav>
        <a className="back-top" href="#top" aria-label={copy.back}><Icon name="arrow" /></a>
      </div>
      <div className="footer-bottom">
        <div className="footer-company"><p>{pageCopy.company}</p><p>{pageCopy.registration}</p></div>
        <a className="footer-email" href="mailto:info@giftly.sa"><Icon name="mail" /><bdi>info@giftly.sa</bdi></a>
        <p className="footer-rights"><bdi>© 2026</bdi> {copy.rights}</p>
      </div>
    </div></footer>
    <ScreenDialog selected={preview} onClose={() => setPreview(null)} copy={copy} language={language} />
  </>;
}
