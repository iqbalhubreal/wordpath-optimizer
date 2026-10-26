(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ----- Hero chain illustration: words cross at a shared letter ----- */
  const chain = [
    { w: 'LEMON', out: 2 },            // M links down to MANGO
    { w: 'MANGO', in: 0, out: 3 },     // G links to GRAPE
    { w: 'GRAPE', in: 0, out: 2 },     // P links to APPLE
    { w: 'APPLE', in: 1, out: 4 },     // E links to ELDER
    { w: 'ELDER', in: 0 }
  ];
  const heroChain = $('#heroChain');
  if (heroChain) {
    let start = 0;
    chain.forEach((item, r) => {
      const row = document.createElement('div');
      row.className = 'chain-row';
      row.style.setProperty('--s', start);
      row.style.setProperty('--r', r);
      [...item.w].forEach((ch, i) => {
        const b = document.createElement('b');
        b.textContent = ch;
        b.style.setProperty('--i', i);
        if (i === item.in || i === item.out) b.className = 'link';
        row.append(b);
      });
      heroChain.append(row);
      if (item.out !== undefined) start = start + item.out - (chain[r + 1].in || 0);
    });
  }

  /* ----- Header scroll state + mobile menu ----- */
  const header = $('#siteHeader');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const menuToggle = $('#menuToggle');
  const nav = $('#mainNav');
  const setMenu = open => {
    nav.classList.toggle('open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  menuToggle.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  nav.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });

  /* ----- Accessible tabs ----- */
  $$('[data-tabs]').forEach(group => {
    const tabs = $$('[role="tab"]', group);
    const select = (tab, focus) => {
      tabs.forEach(t => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', e => {
        const vertical = tab.parentElement.getAttribute('aria-orientation') === 'vertical';
        const next = vertical ? 'ArrowDown' : 'ArrowRight';
        const prev = vertical ? 'ArrowUp' : 'ArrowLeft';
        let j = null;
        if (e.key === next || (!vertical && e.key === 'ArrowDown')) j = (i + 1) % tabs.length;
        else if (e.key === prev || (!vertical && e.key === 'ArrowUp')) j = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = tabs.length - 1;
        if (j !== null) { e.preventDefault(); select(tabs[j], true); }
      });
    });
  });

  /* ----- Reveal on scroll ----- */
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(r => io.observe(r));
  } else reveals.forEach(r => r.classList.add('in'));

  /* ----- Studio overlay: the tool opens only on demand ----- */
  const studio = $('#studio');
  let lastFocus = null;
  const openStudio = () => {
    lastFocus = document.activeElement;
    setMenu(false);
    studio.hidden = false;
    document.body.classList.add('studio-open');
    studio.scrollTop = 0;
    if (location.hash !== '#studio') history.pushState({ studio: true }, '', '#studio');
    const ta = $('#wordInput');
    if (ta) setTimeout(() => ta.focus({ preventScroll: true }), 50);
  };
  const closeStudio = fromPop => {
    if (studio.hidden) return;
    studio.hidden = true;
    document.body.classList.remove('studio-open');
    if (!fromPop && location.hash === '#studio') history.back();
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  };
  $$('[data-open-studio]').forEach(b => b.addEventListener('click', openStudio));
  $$('[data-close-studio]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); closeStudio(); }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !studio.hidden) closeStudio(); });
  window.addEventListener('popstate', () => {
    if (location.hash === '#studio') { if (studio.hidden) openStudio(); } else closeStudio(true);
  });
  if (location.hash === '#studio') openStudio();
})();
