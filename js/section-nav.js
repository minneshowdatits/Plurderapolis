/* Plurderapolis section navigator.
   Adds a hamburger "Sections" dropdown to every guide page. The menu lists the
   page's own sections (collapsible details blocks and h2 headings) and jumps
   straight to the one you tap, opening it first when it starts collapsed.
   Pages with a lot of sections (8+) also get a section search box that matches
   the homepage search behavior: multi-word matching with harm reduction
   synonyms. Sections are auto-discovered, so no per-page configuration. */
(function () {
  'use strict';

  /* Skip pages that already ship their own section navigation. */
  if (document.querySelector('.jump-chips')) return;
  if (document.querySelector('#hamburgerNav')) return;
  if (document.querySelector('ul.nav-links a[href^="#"]')) return;

  /* ---------- synonyms (mirrors the homepage search) ---------- */
  var SEARCH_SYNONYMS = {
    narcan: ['naloxone'], naloxone: ['narcan'],
    molly: ['mdma', 'ecstasy'], mdma: ['molly', 'ecstasy'], ecstasy: ['molly', 'mdma'],
    weed: ['cannabis', 'marijuana', 'thc'], cannabis: ['weed', 'marijuana', 'thc'],
    marijuana: ['weed', 'cannabis', 'thc'], thc: ['weed', 'cannabis'],
    coke: ['cocaine'], cocaine: ['coke'],
    ket: ['ketamine'], ketamine: ['ket'],
    acid: ['lsd'], lsd: ['acid'],
    shrooms: ['psilocybin', 'mushrooms'], psilocybin: ['shrooms', 'mushrooms'], mushrooms: ['shrooms', 'psilocybin'],
    spiked: ['spiking'], spiking: ['spiked'], roofied: ['spiking', 'roofie'], roofie: ['spiking'],
    od: ['overdose'], overdose: ['od'], overamping: ['overdose'],
    '911': ['emergency'], emergency: ['911'],
    uber: ['rideshare', 'lyft'], lyft: ['rideshare', 'uber'], rideshare: ['uber', 'lyft', 'taxi'], taxi: ['rideshare'],
    cops: ['police'], police: ['cops'],
    sti: ['std'], std: ['sti'],
    xanax: ['benzos'], benzos: ['xanax', 'benzodiazepines'], benzodiazepines: ['xanax', 'benzos'],
    adderall: ['adhd'], vyvanse: ['adhd'], adhd: ['adderall', 'vyvanse'],
    tranq: ['xylazine', 'medetomidine'], xylazine: ['tranq', 'medetomidine'], medetomidine: ['tranq', 'xylazine'],
    fent: ['fentanyl'], fentanyl: ['fent'],
    opioids: ['opioid'], opioid: ['opioids'],
    depressed: ['depression'], depression: ['depressed'],
    anxious: ['anxiety'], anxiety: ['anxious'],
    water: ['hydration'], hydration: ['water', 'electrolytes'],
    sobriety: ['sober'], sober: ['sobriety'],
    boundaries: ['consent'], consent: ['boundaries'],
    sharing: ['share'], mixing: ['mix'], testing: ['test'], drinking: ['drink'],
    smoking: ['smoke'], using: ['use'], overdosing: ['overdose'], snorting: ['snort']
  };

  function escRx(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function tokenHits(token, text) {
    if (token.length <= 3) {
      try { return new RegExp('\\b' + escRx(token)).test(text); }
      catch (e) { return text.indexOf(token) > -1; }
    }
    return text.indexOf(token) > -1;
  }
  function expandQuery(raw) {
    var q = String(raw || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ').trim();
    if (!q) return [];
    var groups = [];
    q.split(' ').forEach(function (t) {
      if (t.length < 2) return;
      var alts = [t];
      (SEARCH_SYNONYMS[t] || []).forEach(function (a) { if (alts.indexOf(a) < 0) alts.push(a); });
      var dup = false;
      groups.forEach(function (g) { if (g[0] === t) dup = true; });
      if (!dup) groups.push(alts);
    });
    return groups;
  }
  function scoreEntry(sec, groups) {
    var score = 0;
    for (var i = 0; i < groups.length; i++) {
      var alts = groups[i], best = 0;
      for (var j = 0; j < alts.length; j++) {
        var t = alts[j];
        if (tokenHits(t, sec._t)) { best = 6; break; }
        if (tokenHits(t, sec._b)) best = Math.max(best, 2);
      }
      if (!best) return -1;
      score += best;
    }
    return score;
  }
  function highlightTerms(text, flat) {
    var h = escHtml(text);
    flat.slice().sort(function (a, b) { return b.length - a.length; }).forEach(function (t) {
      if (t.length < 2) return;
      var rx = t.length <= 3
        ? new RegExp('(\\b' + escRx(t) + ')', 'gi')
        : new RegExp('(' + escRx(t) + ')', 'gi');
      h = h.replace(rx, '<mark>$1</mark>');
    });
    return h;
  }

  /* ---------- section discovery ---------- */
  function slugify(t) {
    var s = t.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim()
      .replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
      .substring(0, 48).replace(/-$/g, '');
    if (!s) s = 'section';
    if (/^[0-9]/.test(s)) s = 'sec-' + s;
    return s;
  }
  function cleanLabel(t) { return String(t || '').replace(/\s+/g, ' ').trim(); }

  var sections = [];
  var usedIds = {};
  /* Body text lets the search match what a section is about, not just its title. */
  function bodyFor(el, isDetails) {
    var txt;
    if (isDetails) {
      var sum = el.querySelector(':scope > summary');
      txt = el.textContent;
      if (sum) txt = txt.replace(sum.textContent, ' ');
    } else {
      /* The h2 often sits inside a header wrapper next to toggle icons;
         walk siblings, skipping empty nodes, and climb a level whenever
         the siblings run out, until the next section begins. */
      var parts = [], guard = 0, climbed = 0;
      var start = el, node = el.nextElementSibling;
      while (guard++ < 120) {
        if (!node) {
          if (climbed++ >= 6 || !start.parentElement) break;
          start = start.parentElement;
          if (/^(HEADER|FOOTER|NAV|BODY|HTML|MAIN)$/.test(start.tagName)) break;
          node = start.nextElementSibling;
          continue;
        }
        if (node.matches(SKIP_SEL)) { node = node.nextElementSibling; continue; }
        var t = node.tagName.toLowerCase();
        if (t === 'script' || t === 'style' || t === 'noscript') { node = node.nextElementSibling; continue; }
        if (t === 'details' || node.querySelector('h2')) break;
        var nt = cleanLabel(node.textContent);
        if (nt) parts.push(nt);
        node = node.nextElementSibling;
      }
      txt = parts.join(' ');
    }
    return cleanLabel(txt).toLowerCase().substring(0, 1200);
  }
  function addSection(el, label, isDetails) {
    label = cleanLabel(label);
    if (label.length < 2) return;
    if (!el.id) {
      var base = slugify(label), s = base, i = 2;
      while (usedIds[s] || document.getElementById(s)) { s = base + '-' + (i++); }
      el.id = s;
    }
    if (usedIds[el.id]) return;
    usedIds[el.id] = 1;
    el.classList.add('sn-sec');
    var lt = label.toLowerCase();
    sections.push({ id: el.id, el: el, label: label, _t: lt, _b: bodyFor(el, isDetails) });
  }

  var SKIP_SEL = 'header, footer, nav, .modal, .send-modal, [role="dialog"], .drawer, .sn-panel, .mobile-nav, .hamburger-nav, #hamburgerNav';
  Array.prototype.forEach.call(document.querySelectorAll('details, h2'), function (node) {
    if (node.closest(SKIP_SEL)) return;
    var tag = node.tagName.toLowerCase();
    if (tag === 'details') {
      var sum = node.querySelector(':scope > summary');
      if (!sum) return;
      addSection(node, sum.textContent, true);
    } else {
      if (node.closest('details')) return;
      addSection(node, node.textContent, false);
    }
  });

  if (sections.length < 3) return;

  var SEARCH_THRESHOLD = 8;
  var withSearch = sections.length >= SEARCH_THRESHOLD;

  /* ---------- styles ---------- */
  var css = [
    '.sn-sec{scroll-margin-top:92px}',
    '.sn-toggle{display:inline-flex;align-items:center;gap:.5rem;margin-left:auto;',
    ' font-family:Montserrat,Roboto,sans-serif;font-size:.8rem;font-weight:700;color:#ffd7ef;',
    ' background:rgba(255,105,180,.12);border:1px solid rgba(255,105,180,.45);border-radius:999px;',
    ' padding:.45rem .85rem;cursor:pointer;white-space:nowrap;flex-shrink:0}',
    '.sn-toggle:hover{background:rgba(255,105,180,.28);color:#fff}',
    '.sn-toggle .sn-bars{display:inline-flex;flex-direction:column;gap:3px}',
    '.sn-toggle .sn-bars span{display:block;width:16px;height:2px;background:#ff69b4;border-radius:2px}',
    '.sn-panel{position:fixed;top:70px;right:12px;width:min(360px,94vw);max-height:72vh;',
    ' display:flex;flex-direction:column;background:#1c0e33;border:1px solid rgba(255,105,180,.4);',
    ' border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.6);z-index:1600;overflow:hidden;',
    ' font-family:Montserrat,Roboto,sans-serif}',
    '.sn-panel[hidden]{display:none}',
    '.sn-head{display:flex;align-items:center;justify-content:space-between;',
    ' padding:.7rem .95rem;border-bottom:1px solid rgba(255,105,180,.22)}',
    '.sn-head strong{color:#fff;font-size:.85rem;letter-spacing:.04em}',
    '.sn-count{color:#b8b8d0;font-size:.72rem;margin-left:.5rem;font-weight:400}',
    '.sn-close{background:none;border:none;color:#b8b8d0;font-size:1.1rem;cursor:pointer;line-height:1;padding:.2rem}',
    '.sn-close:hover{color:#fff}',
    '.sn-search{padding:.6rem .8rem;border-bottom:1px solid rgba(255,105,180,.22)}',
    '.sn-search input{width:100%;box-sizing:border-box;background:#12071f;color:#f5f0ff;',
    ' border:1px solid rgba(255,105,180,.35);border-radius:10px;padding:.55rem .7rem;font-size:.85rem}',
    '.sn-search input::placeholder{color:#8a8aa3}',
    '.sn-search input:focus{outline:none;border-color:#ff69b4}',
    '.sn-list{list-style:none;margin:0;padding:.4rem;overflow-y:auto}',
    '.sn-list a{display:block;color:#f5f0ff;text-decoration:none;font-size:.86rem;',
    ' padding:.55rem .7rem;border-radius:9px;line-height:1.35}',
    '.sn-list a:hover{background:rgba(255,105,180,.16)}',
    '.sn-list a mark{background:rgba(255,105,180,.45);color:#fff;border-radius:3px;padding:0 1px}',
    '.sn-empty{padding:1rem;color:#b8b8d0;font-size:.84rem;text-align:center}',
    '@media (max-width:640px){.sn-toggle{padding:.45rem .6rem}.sn-toggle .sn-label{display:none}}'
  ].join('\n');
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------- toggle button ---------- */
  var header = document.querySelector('header.ph-bar') || document.querySelector('header');
  var toggle = document.createElement('button');
  toggle.className = 'sn-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Jump to a section on this page');
  toggle.innerHTML = '<span class="sn-bars" aria-hidden="true"><span></span><span></span><span></span></span><span class="sn-label">Sections</span>';
  if (header) {
    header.appendChild(toggle);
  } else {
    toggle.style.cssText += ';position:fixed;bottom:18px;right:18px;z-index:1600;box-shadow:0 8px 24px rgba(0,0,0,.5)';
    document.body.appendChild(toggle);
  }

  /* ---------- panel ---------- */
  var panel = document.createElement('div');
  panel.className = 'sn-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Sections on this page');

  var head = document.createElement('div');
  head.className = 'sn-head';
  var titleWrap = document.createElement('div');
  var title = document.createElement('strong');
  title.textContent = 'On this page';
  var count = document.createElement('span');
  count.className = 'sn-count';
  titleWrap.appendChild(title);
  titleWrap.appendChild(count);
  var closeBtn = document.createElement('button');
  closeBtn.className = 'sn-close';
  closeBtn.setAttribute('aria-label', 'Close sections menu');
  closeBtn.textContent = '×';
  head.appendChild(titleWrap);
  head.appendChild(closeBtn);
  panel.appendChild(head);

  var searchInput = null;
  if (withSearch) {
    var sWrap = document.createElement('div');
    sWrap.className = 'sn-search';
    searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.placeholder = 'Search sections…';
    searchInput.setAttribute('aria-label', 'Search sections on this page');
    sWrap.appendChild(searchInput);
    panel.appendChild(sWrap);
  }

  var list = document.createElement('ul');
  list.className = 'sn-list';
  panel.appendChild(list);
  document.body.appendChild(panel);

  function renderList(query) {
    list.innerHTML = '';
    var groups = expandQuery(query);
    var flat = [];
    groups.forEach(function (g) { g.forEach(function (t) { if (flat.indexOf(t) < 0) flat.push(t); }); });
    var items = sections.map(function (s) {
      return { s: s, score: groups.length ? scoreEntry(s, groups) : 0 };
    }).filter(function (x) { return x.score >= 0; });
    items.sort(function (a, b) { return b.score - a.score; });
    count.textContent = groups.length
      ? items.length + (items.length === 1 ? ' match' : ' matches')
      : sections.length + ' sections';
    if (!items.length) {
      var empty = document.createElement('li');
      empty.className = 'sn-empty';
      empty.textContent = 'No sections match. Try fewer words.';
      list.appendChild(empty);
      return;
    }
    items.forEach(function (x) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + x.s.id;
      a.innerHTML = groups.length ? highlightTerms(x.s.label, flat) : escHtml(x.s.label);
      a.addEventListener('click', function (ev) { goToSection(x.s, ev); });
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  function openPanel() {
    if (header) {
      var r = header.getBoundingClientRect();
      panel.style.top = Math.max(8, r.bottom + 8) + 'px';
    }
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    if (searchInput) { renderList(searchInput.value); searchInput.focus(); }
    else renderList('');
  }
  function closePanel() {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  }
  toggle.addEventListener('click', function (ev) {
    ev.stopPropagation();
    panel.hidden ? openPanel() : closePanel();
  });
  closeBtn.addEventListener('click', closePanel);
  document.addEventListener('click', function (ev) {
    if (!panel.hidden && !panel.contains(ev.target) && ev.target !== toggle && !toggle.contains(ev.target)) closePanel();
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && !panel.hidden) closePanel();
  });
  if (searchInput) {
    searchInput.addEventListener('input', function () { renderList(searchInput.value); });
  }

  /* ---------- jumping ---------- */
  function openAncestors(el) {
    var d = el.tagName.toLowerCase() === 'details' ? el : el.closest('details');
    while (d) { d.open = true; d = d.parentElement ? d.parentElement.closest('details') : null; }
  }
  function goToSection(sec, ev) {
    if (ev) ev.preventDefault();
    closePanel();
    openAncestors(sec.el);
    if (history.replaceState) {
      try { history.replaceState(null, '', '#' + sec.id); } catch (e) {}
    }
    sec.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function jumpToHash(smooth) {
    var id = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    openAncestors(el);
    el.classList.add('sn-sec');
    el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  }

  /* Deep links from elsewhere (and the browser back button) open collapsed sections first. */
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest ? ev.target.closest('a[href^="#"]') : null;
    if (!a || a.closest('.sn-panel')) return;
    var id = decodeURIComponent(a.getAttribute('href').slice(1));
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    var closed = el.closest('details:not([open])');
    if (closed) {
      ev.preventDefault();
      openAncestors(el);
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (history.replaceState) { try { history.replaceState(null, '', '#' + id); } catch (e) {} }
    }
  });
  window.addEventListener('hashchange', function () { jumpToHash(true); });

  renderList('');
  if (location.hash) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { jumpToHash(false); });
    } else {
      setTimeout(function () { jumpToHash(false); }, 60);
    }
  }
})();
