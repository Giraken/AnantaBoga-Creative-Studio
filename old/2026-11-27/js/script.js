// Anantaboga Creative Studio: menu, header, work index, player and reel caption.
(() => {
  const head = document.querySelector('.site-head');
  const menuBtn = document.querySelector('.menu-btn');
  const nav = document.getElementById('nav');

  // Header turns solid once the reel is scrolled past the top
  const onScroll = () => head.classList.toggle('is-solid', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('load', onScroll);

  // Mobile menu
  const setMenu = open => {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav.classList.toggle('is-open', open);
    head.classList.toggle('menu-open', open);
  };
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  // ---- Work index ----
  const films = [...document.querySelectorAll('.film')];
  const filterBtns = [...document.querySelectorAll('.filters button')];
  const monitorImg = document.querySelector('.monitor-frame img');
  const monitorBtn = document.querySelector('.monitor-frame');
  const monitorTitle = document.querySelector('.monitor-title');
  const monitorMeta = document.querySelector('.monitor-meta');
  const monitorSlate = document.querySelector('.monitor-slate');
  let current = null;

  // Films without a still yet show a title card (the slate) instead
  const show = film => {
    if (!film || film === current) return;
    current?.classList.remove('is-current');
    current = film;
    film.classList.add('is-current');
    if (!monitorImg) return;
    const still = film.dataset.still;
    monitorBtn.classList.toggle('is-slate', !still);
    if (still) { monitorImg.src = still; monitorImg.alt = 'Still from ' + film.dataset.title; }
    monitorSlate.textContent = film.dataset.title;
    monitorTitle.textContent = film.dataset.title;
    monitorMeta.textContent = film.dataset.meta;
  };

  films.forEach(film => {
    const btn = film.querySelector('button');
    btn.addEventListener('mouseenter', () => show(film));
    btn.addEventListener('focus', () => show(film));
    btn.addEventListener('click', () => openPlayer(film));
  });
  monitorBtn?.addEventListener('click', () => current && openPlayer(current));

  // "View all works" opens the full, filterable film index under the portfolio cards
  const toggle = document.querySelector('[data-toggle-works]');
  const allWorks = document.getElementById('all-works');
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    allWorks.hidden = !open;
    toggle.firstChild.textContent = open ? 'Show fewer works' : 'View all works';
    if (open) allWorks.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Service rows and portfolio cards open their film straight away
  document.querySelectorAll('[data-open]').forEach(link => link.addEventListener('click', e => {
    const film = films.find(f => f.dataset.slug === link.dataset.open);
    if (!film) return;
    e.preventDefault();
    show(film);
    openPlayer(film);
  }));

  filterBtns.forEach(btn => btn.addEventListener('click', () => {
    const type = btn.dataset.filter;
    filterBtns.forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    films.forEach(f => { f.hidden = type !== 'all' && f.dataset.type !== type; });
    show(films.find(f => !f.hidden));
  }));
  show(films[0]);

  // ---- Player: plays the film from Google Drive ----
  const player = document.getElementById('player');
  const frame = player.querySelector('.player-frame');
  const pTitle = player.querySelector('#player-title');
  const pMeta = player.querySelector('.player-meta');
  const pLink = player.querySelector('.player-alt a');
  let opener = null;

  function openPlayer(film) {
    opener = document.activeElement;
    const id = film.dataset.drive;
    pTitle.textContent = film.dataset.title;
    pMeta.textContent = film.dataset.meta;
    pLink.href = `https://drive.google.com/file/d/${id}/view`;
    frame.innerHTML = `<iframe src="https://drive.google.com/file/d/${id}/preview" title="${film.dataset.title.replace(/"/g, '&quot;')}" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
    player.showModal();
  }
  const closePlayer = () => player.close();
  player.querySelector('.player-close').addEventListener('click', closePlayer);
  player.addEventListener('click', e => { if (e.target === player) closePlayer(); });
  player.addEventListener('close', () => { frame.innerHTML = ''; opener?.focus(); });

})();

// In-page links (nav, buttons, footer) scroll smoothly without putting #section in the address bar
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const head = document.querySelector('.site-head, header');
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const id = a.getAttribute('href').slice(1);
    const target = id === 'top' || id === '' ? null : document.getElementById(id);
    if (id && id !== 'top' && !target) return;
    e.preventDefault();
    const offset = target ? Math.max(0, (head?.offsetHeight || 0) - 1) : 0;
    const top = target ? target.getBoundingClientRect().top + window.scrollY - (target.matches('.s') ? 0 : offset) : 0;
    window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
    if (target && a.classList.contains('skip')) { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
  });
})();
