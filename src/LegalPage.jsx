import { useEffect, useRef, useState } from 'react';
import { pageContent } from './pages-content.js';
import { activeLegalSection } from './legal-scroll.js';

export default function LegalPage({ page, language, Icon, children }) {
  const c = pageContent[language];
  const sections = page === 'privacy' ? c.privacySections : c.termsSections;
  const layout = useRef(null);
  const article = useRef(null);
  const sidebar = useRef(null);
  const navigation = useRef(null);
  const [active, setActive] = useState('legal-0');

  useEffect(() => {
    const header = document.querySelector('.header');
    const elements = [...article.current.querySelectorAll('section[id]')];
    let frame = 0;
    let current = null;
    let disposed = false;

    const update = () => {
      frame = 0;
      const headerHeight = header?.getBoundingClientRect().height || 0;
      const mobile = window.matchMedia('(max-width: 760px)').matches;
      const contentsHeight = mobile ? sidebar.current.getBoundingClientRect().height : 0;
      layout.current.style.setProperty('--legal-header-height', `${headerHeight}px`);
      layout.current.style.setProperty('--legal-toc-height', `${contentsHeight}px`);
      layout.current.style.setProperty('--legal-scroll-padding', window.getComputedStyle(document.documentElement).scrollPaddingTop);
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      const id = activeLegalSection(elements.map((element) => ({ id: element.id, top: element.getBoundingClientRect().top })), headerHeight + contentsHeight + 24, atBottom);
      if (!id || id === current) return;
      current = id;
      setActive(id);

      // Scroll only the contents list; never move the document or keyboard focus.
      const nav = navigation.current;
      const link = nav.querySelector(`a[href="#${id}"]`);
      const item = link.getBoundingClientRect();
      const bounds = nav.getBoundingClientRect();
      if (mobile) {
        const left = item.left < bounds.left ? item.left - bounds.left - 8 : item.right > bounds.right ? item.right - bounds.right + 8 : 0;
        if (left) nav.scrollBy({ left, behavior: 'instant' });
      } else {
        const top = item.top < bounds.top ? item.top - bounds.top - 8 : item.bottom > bounds.bottom ? item.bottom - bounds.bottom + 8 : 0;
        if (top) nav.scrollBy({ top, behavior: 'instant' });
      }
    };
    const schedule = () => { if (!disposed && !frame) frame = window.requestAnimationFrame(update); };
    const observer = new ResizeObserver(schedule);
    observer.observe(article.current);
    observer.observe(sidebar.current);
    if (header) observer.observe(header);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('hashchange', schedule);
    document.fonts?.ready.then(schedule);
    schedule();
    return () => {
      disposed = true;
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('hashchange', schedule);
    };
  }, [page, language, sections]);

  return <>{children}
    <div ref={layout} className="shell legal-layout section-space">
      <aside ref={sidebar}><h2>{c.contents}</h2><nav ref={navigation} aria-label={c.contents}>
        {sections.map(([title], index) => <a key={title} href={`#legal-${index}`} aria-current={active === `legal-${index}` ? 'location' : undefined}>{title}</a>)}
      </nav></aside>
      <article ref={article} className="legal-article">
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
