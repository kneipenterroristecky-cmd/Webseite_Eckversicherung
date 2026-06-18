/* =============================================
   Daniel Eck – Versicherungsmakler – Interactions & Animations
   ============================================= */

/* Basispfad zur Root – funktioniert von jeder Unterseite (z.B. blog/posts/) */
var _basePath = (function() {
  var tags = document.getElementsByTagName('script');
  for (var i = 0; i < tags.length; i++) {
    if (tags[i].src && tags[i].src.indexOf('script.js') !== -1) {
      return tags[i].src.replace(/script\.js(\?.*)?$/, '');
    }
  }
  return '';
})();

/* ---- Navbar scroll shadow + Hamburger Farbe ---- */
const navbar = document.getElementById('navbar');

function getBgColor(el) {
  let node = el;
  while (node && node.tagName !== 'HTML') {
    const bg = window.getComputedStyle(node).backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
      const rgb = bg.match(/\d+/g);
      if (rgb) return rgb;
    }
    node = node.parentElement;
  }
  return [255, 255, 255];
}

function updateNavbarTheme() {
  const midY = (navbar.offsetHeight || 80) / 2;
  // Alle Elemente an dieser Position, Navbar-Kinder überspringen
  const els = document.elementsFromPoint(window.innerWidth / 2, midY);
  let found = null;
  for (const e of els) {
    if (navbar.contains(e) || e === navbar) continue;
    const rgb = getBgColor(e);
    const lum = 0.299 * +rgb[0] + 0.587 * +rgb[1] + 0.114 * +rgb[2];
    // Ersten nicht-weißen Hintergrund nehmen
    if (lum < 250) { found = lum; break; }
  }
  navbar.classList.toggle('nav-over-dark', found !== null && found < 140);
}

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 12);
  updateNavbarTheme();
}, { passive: true });
window.addEventListener('load', updateNavbarTheme);

/* ---- Gratis-Paket: Fallback auf Unterseiten → Weiterleitung zu start.html?gratis=1 ---- */
window.openGratisPaket = function() {
  var path = window.location.pathname.replace(/\\/g, '/');
  var parts = path.split('/').filter(Boolean);
  if (parts.length > 0 && parts[parts.length - 1].indexOf('.html') > -1) parts.pop();
  var base = '';
  for (var i = 0; i < parts.length; i++) base += '../';
  window.location.href = base + 'start.html?gratis=1';
};

/* ---- Social Peek: bei Scroll-Down verstecken + Gratis-Button einblenden ---- */
(function() {
  var lastScrollY = window.scrollY;
  var gw = null;
  var isStartPage = window.location.href.indexOf('start.html') !== -1
                 || window.location.pathname === '/'
                 || window.location.pathname.endsWith('/');

  document.addEventListener('DOMContentLoaded', function() {
    gw = document.getElementById('gratisFloatWrap');
    /* Auf allen Seiten außer start.html: Geschenk-Button sofort dauerhaft anzeigen */
    if (!isStartPage && gw) {
      gw.style.overflow = 'visible';
      gw.classList.add('gratis-float-show');
    }
  });
  window.addEventListener('scroll', function() {
    var sp = document.getElementById('socialPeek');
    if (!sp) return;
    var y = window.scrollY;
    if (!gw) gw = document.getElementById('gratisFloatWrap');
    /* Gratis-Button: auf start.html ab 200px einblenden, sonst immer sichtbar */
    if (gw && isStartPage) {
      if (y > 200) {
        if (!gw.classList.contains('gratis-float-show')) {
          gw.style.overflow = 'hidden';
          gw.classList.add('gratis-float-show');
          clearTimeout(gw._ot);
          gw._ot = setTimeout(function() { if (gw.classList.contains('gratis-float-show')) gw.style.overflow = 'visible'; }, 600);
        }
      } else {
        clearTimeout(gw._ot);
        gw.style.overflow = 'hidden';
        gw.classList.remove('gratis-float-show');
      }
    }
    /* Social Peek panel: bei Scroll-Down ausblenden */
    if (y > lastScrollY && y > 80) {
      sp.classList.add('peek-hidden');
    } else {
      sp.classList.remove('peek-hidden');
    }
    lastScrollY = y;
  }, { passive: true });
})();

/* ---- Hamburger / mobile nav ---- */
const hamburger  = document.getElementById('hamburger');
const navLinks   = document.getElementById('navLinks');

function setMenuOpen(open) {
  navLinks.classList.toggle('open', open);
  hamburger.classList.toggle('open', open);
  hamburger.setAttribute('aria-expanded', open);
  document.body.classList.toggle('nav-open', open);
  var sp = document.getElementById('socialPeek');
  if (sp) sp.style.display = open ? 'none' : '';
  if (!open) updateNavbarTheme();
}

hamburger.addEventListener('click', () => {
  setMenuOpen(!navLinks.classList.contains('open'));
});

// close on link click
navLinks.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => setMenuOpen(false));
});

// close on outside click
document.addEventListener('click', e => {
  if (!navbar.contains(e.target)) setMenuOpen(false);
});

/* ---- Active nav link on scroll ---- */
const sections  = document.querySelectorAll('section[id], footer[id]');
const navAnchors = document.querySelectorAll('.nav-link');

const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navAnchors.forEach(a => a.classList.remove('active'));
      const active = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
      if (active) active.classList.add('active');
    }
  });
}, { rootMargin: '-40% 0px -55% 0px' });

sections.forEach(s => sectionObserver.observe(s));

/* ---- Scroll reveal ---- */
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el    = entry.target;
    const delay = el.dataset.delay ? parseInt(el.dataset.delay) : 0;
    setTimeout(() => el.classList.add('visible'), delay);
    revealObserver.unobserve(el);
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal, .reveal-left, .reveal-right')
  .forEach(el => revealObserver.observe(el));

/* ---- bfcache fix: re-run reveals when page restored from back/forward cache ---- */
window.addEventListener('pageshow', function(e) {
  if (e.persisted) {
    document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => {
      el.classList.add('visible');
    });
  }
});

/* ---- Counter animation ---- */
function animateCounter(el, target, duration = 1400) {
  const start     = performance.now();
  const startVal  = 0;

  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    // ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(startVal + (target - startVal) * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

const counterObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    animateCounter(el, parseInt(el.dataset.target, 10));
    counterObserver.unobserve(el);
  });
}, { threshold: 0.5 });

document.querySelectorAll('.counter').forEach(el => counterObserver.observe(el));

/* ---- FAQ accordion ---- */
document.querySelectorAll('.faq-q').forEach(btn => {
  btn.addEventListener('click', () => {
    const item   = btn.closest('.faq-item');
    const isOpen = item.classList.contains('open');

    // close all
    document.querySelectorAll('.faq-item').forEach(i => {
      i.classList.remove('open');
      i.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
    });

    // toggle clicked
    if (!isOpen) {
      item.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
  });
});

/* ---- Smooth anchor scroll (handles fixed header offset) ---- */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const href = a.getAttribute('href');
    if (!href || href === '#') return;
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    const offset = navbar.offsetHeight + 12;
    window.scrollTo({ top: target.offsetTop - offset, behavior: 'smooth' });
  });
});

/* ---- Card hover tilt (subtle, desktop only) ---- */
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.querySelectorAll('.service-card, .vorteil-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width  - 0.5;
      const y = (e.clientY - rect.top)  / rect.height - 0.5;
      card.style.transform = `translateY(-6px) rotateX(${-y * 5}deg) rotateY(${x * 5}deg)`;
      card.style.transition = 'transform .05s linear, box-shadow .3s, border-color .3s, background .3s';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform  = '';
      card.style.transition = 'transform .4s cubic-bezier(.4,0,.2,1), box-shadow .3s, border-color .3s, background .3s';
    });
  });
}
/* ---- WhatsApp bounce ---- */
(function () {
  var wrap = document.getElementById('waWrap');
  if (!wrap) return;

  function bounce() {
    // Direkte style-Manipulation — zuverlässigster Weg Animation neu zu starten
    wrap.style.animation = 'none';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        wrap.style.animation = 'waBounce 1.2s ease';
      });
    });
  }

  // Erstes Hüpfen nach 1.5 Sekunden
  setTimeout(bounce, 1500);
  // Alle 10 Sekunden wiederholen
  setInterval(bounce, 10000);
})();


/* ================================================
   FUNNEL LOGIC
   ================================================ */
var funnelAnswers = [];
var funnelCurrent = 0;
var funnelContact = { name: '', phone: '', email: '' };
var funnelCustomSparte = '';

var funnelSteps = [
  {
    question: 'Was ist Ihr aktuelles Anliegen?',
    sub: 'Wählen Sie aus, womit wir Ihnen am besten helfen können.',
    options: [
      { icon: 'fa-rotate', label: 'Versicherungen optimieren' },
      { icon: 'fa-plus-circle', label: 'Neue Versicherung abschließen' },
      { icon: 'fa-shield-halved', label: 'Schadenfall – ich brauche Hilfe' },
      { icon: 'fa-lightbulb', label: 'Allgemeine Beratung' }
    ]
  },
  {
    question: 'Für wen suchen Sie Versicherungsschutz?',
    sub: 'So können wir Ihnen das passende Angebot zusammenstellen.',
    options: [
      { icon: 'fa-user', label: 'Für mich persönlich' },
      { icon: 'fa-people-roof', label: 'Für meine Familie' },
      { icon: 'fa-building', label: 'Für mein Unternehmen' }
    ]
  },
  {
    question: 'Welches Thema liegt Ihnen am Herzen?',
    sub: 'Mehrere Bereiche? Kein Problem – wir besprechen alles im Termin.',
    options: [
      { icon: 'fa-car',               label: 'KFZ & Mobilität' },
      { icon: 'fa-house',             label: 'Haus & Eigentum' },
      { icon: 'fa-heart-pulse',       label: 'Leben & Altersvorsorge' },
      { icon: 'fa-briefcase',         label: 'Betrieb & Gewerbe' },
      { icon: 'fa-stethoscope',       label: 'Kranken & Pflege' },
      { icon: 'fa-wheelchair',        label: 'Berufsunfähigkeit' },
      { icon: 'fa-scale-balanced',    label: 'Rechtsschutz' },
      { icon: 'fa-plane',             label: 'Reise & Freizeit' }
    ]
  },
  {
    question: 'Wie würden Sie Ihre aktuelle Versicherungssituation beschreiben?',
    sub: 'So kann ich das Gespräch optimal für Sie vorbereiten.',
    options: [
      { icon: 'fa-circle-check', label: 'Gut aufgestellt, möchte aber optimieren' },
      { icon: 'fa-triangle-exclamation', label: 'Ich habe Lücken im Versicherungsschutz' },
      { icon: 'fa-circle-question', label: 'Ich weiß es nicht genau' },
      { icon: 'fa-arrows-spin', label: 'Ich stehe vor einer Lebensveränderung' }
    ]
  }
];

var DANIEL_CALENDLY = 'https://calendly.com/eckversicherung/30min';
var HEIKO_CALENDLY  = 'https://calendly.com/eckheiko/personliches-beratungsgesprach-1';
var _calOpenParams = '';

function _calTabsHtml() {
  return '<div class="cal-tabs">' +
    '<button class="cal-tab active" onclick="switchCalTab(0,this)">' +
      '<img class="cal-tab-photo" src="' + _basePath + 'Dummybild 1_rund.png" alt="Daniel Eck">' +
      '<div class="cal-tab-info"><span class="cal-tab-name">Daniel Eck</span><span class="cal-tab-role">Ihr Makler</span></div>' +
      '<i class="cal-tab-check fas fa-circle-check"></i>' +
    '</button>' +
    '<button class="cal-tab cal-tab-secondary" onclick="switchCalTab(1,this)">' +
      '<img class="cal-tab-photo" src="' + _basePath + 'heiko_eck.jpg" alt="Heiko Eck" style="object-position:center 15%">' +
      '<div class="cal-tab-info"><span class="cal-tab-name">Heiko Eck</span><span class="cal-tab-role">Senior-Berater</span></div>' +
      '<i class="cal-tab-check fas fa-circle-check"></i>' +
    '</button>' +
  '</div>';
}

function showCalendlyInline() {
  document.querySelector('.funnel-modal').classList.add('funnel-modal-wide');
  document.getElementById('funnelStepLabel').innerHTML = _calTabsHtml();
  var body = document.getElementById('funnelBody');
  body.innerHTML =
    '<div class="funnel-result">' +
      '<div id="calendlyInline"></div>' +
      '<div class="funnel-nav" style="margin-top:12px">' +
        '<button class="funnel-back" onclick="renderFunnelStep()"><i class="fas fa-arrow-left"></i> Zurück</button>' +
        '<button class="funnel-back" onclick="closeFunnel()">Schließen</button>' +
      '</div>' +
    '</div>';

  if (window.Calendly) {
    var notes = '';
    if (funnelContact.phone) notes += 'Telefon: ' + funnelContact.phone + '\n';
    notes += '---\n';
    funnelSteps.forEach(function(s, i) {
      if (funnelAnswers[i] !== undefined) {
        var answerLabel = (i === 2 && funnelAnswers[i] === 'custom')
          ? funnelCustomSparte
          : s.options[funnelAnswers[i]].label;
        notes += s.question.replace('?','') + ': ' + answerLabel + '\n';
      }
    });

    var params = '?hide_gdpr_banner=1&primary_color=1a50c8&locale=de';
    if (funnelContact.name)  params += '&name='  + encodeURIComponent(funnelContact.name);
    if (funnelContact.email) params += '&email=' + encodeURIComponent(funnelContact.email);
    params += '&a1=' + encodeURIComponent(notes.trim());
    _calOpenParams = params;

    Calendly.initInlineWidget({
      url: DANIEL_CALENDLY + params,
      parentElement: document.getElementById('calendlyInline')
    });
  }
}

function _openCalendlyFallback() {
  var existing = document.getElementById('_calFallbackOverlay');
  if (existing) {
    existing.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    /* Daniel-Tab zurücksetzen */
    existing.querySelectorAll('.cal-tab').forEach(function(t) { t.classList.remove('active'); });
    var dt = existing.querySelector('#_calTabDaniel');
    if (dt) dt.classList.add('active');
    var fb = document.getElementById('_calFallbackBody');
    if (fb && window.Calendly) {
      fb.innerHTML = '';
      Calendly.initInlineWidget({ url: 'https://calendly.com/eckversicherung/30min?hide_gdpr_banner=1&primary_color=1a50c8&locale=de', parentElement: fb, styles: { height: '100%' } });
    }
    return;
  }

  /* Vollbild-Overlay – identisch zum Funnel-Modal auf start.html */
  var wrap = document.createElement('div');
  wrap.id = '_calFallbackOverlay';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(10,20,50,.85);display:flex;flex-direction:column;overflow:hidden;';

  /* Header: Tabs + Schließen-Button */
  var header = document.createElement('div');
  header.style.cssText = 'background:#172d50;display:flex;align-items:center;justify-content:space-between;padding:6px 12px;flex-shrink:0;';
  header.innerHTML =
    '<div class="cal-tabs" style="margin:0">' +
      '<button class="cal-tab active" id="_calTabDaniel" onclick="_calFallbackSwitch(0,this)">' +
        '<img class="cal-tab-photo" src="' + _basePath + 'Dummybild 1_rund.png" alt="Daniel Eck">' +
        '<div class="cal-tab-info"><span class="cal-tab-name">Daniel Eck</span><span class="cal-tab-role">Ihr Makler</span></div>' +
        '<i class="cal-tab-check fas fa-circle-check"></i>' +
      '</button>' +
      '<button class="cal-tab cal-tab-secondary" id="_calTabHeiko" onclick="_calFallbackSwitch(1,this)">' +
        '<img class="cal-tab-photo" src="' + _basePath + 'heiko_eck.jpg" alt="Heiko Eck" style="object-position:center 15%">' +
        '<div class="cal-tab-info"><span class="cal-tab-name">Heiko Eck</span><span class="cal-tab-role">Senior-Berater</span></div>' +
        '<i class="cal-tab-check fas fa-circle-check"></i>' +
      '</button>' +
    '</div>' +
    '<button id="_calFallbackClose" style="background:rgba(255,255,255,.15);border:none;font-size:20px;cursor:pointer;color:#fff;line-height:1;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;">&times;</button>';

  /* Calendly-Container nimmt alle verbleibende Höhe */
  var body = document.createElement('div');
  body.id = '_calFallbackBody';
  body.style.cssText = 'flex:1;background:#fff;overflow-y:auto;min-height:0;';

  wrap.appendChild(header);
  wrap.appendChild(body);
  document.body.appendChild(wrap);
  document.body.style.overflow = 'hidden';

  document.getElementById('_calFallbackClose').addEventListener('click', function() {
    wrap.style.display = 'none';
    document.body.style.overflow = '';
  });

  var _calFallbackParams = '?hide_gdpr_banner=1&primary_color=1a50c8&locale=de';

  window._calFallbackSwitch = function(idx, btn) {
    document.querySelectorAll('#_calFallbackOverlay .cal-tab').forEach(function(t) { t.classList.remove('active'); });
    btn.classList.add('active');
    var container = document.getElementById('_calFallbackBody');
    container.innerHTML = '';
    if (!window.Calendly) return;
    var base = idx === 1 ? HEIKO_CALENDLY : 'https://calendly.com/eckversicherung/30min';
    Calendly.initInlineWidget({ url: base + _calFallbackParams, parentElement: container, styles: { height: '100%' } });
  };

  if (window.Calendly) {
    Calendly.initInlineWidget({
      url: 'https://calendly.com/eckversicherung/30min' + _calFallbackParams,
      parentElement: body,
      styles: { height: '100%' }
    });
  }
}

function openCalendlyDirect() {
  var savedScroll = window.scrollY || window.pageYOffset || 0;
  var overlay = document.getElementById('funnelOverlay');
  var modal   = document.querySelector('.funnel-modal');

  /* Fallback für Seiten ohne Funnel-Modal (z.B. Unterseiten) */
  if (!overlay || !modal) {
    _openCalendlyFallback();
    return;
  }

  overlay.classList.add('open');
  modal.classList.add('funnel-modal-wide');
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  window.scrollTo(0, savedScroll);

  document.getElementById('funnelBar').style.width = '100%';
  document.getElementById('funnelStepLabel').innerHTML = _calTabsHtml();

  document.getElementById('funnelBody').innerHTML =
    '<div class="funnel-result">' +
      '<div id="calendlyInline"></div>' +
    '</div>';

  if (window.Calendly) {
    /* Quiz-Antworten als Bemerkung formatieren – nur wenn vorhanden */
    var qa = window.quizAnswers || {};
    var notesLines = [];

    var sitLabels   = { angestellt: 'Angestellt', familie: 'Familie mit Kindern', selbststaendig: 'Selbstständig', ruhestand: 'Im Ruhestand' };
    var checkLabels = { 0: 'Noch nie / Vor mehr als 3 Jahren', 1: 'Vor 1–3 Jahren', 2: 'Dieses Jahr' };
    var covLabels   = { haftpflicht: 'Privathaftpflicht', bu: 'Berufsunfähigkeit', hausrat: 'Hausrat', rechtsschutz: 'Rechtsschutz', kranken: 'Kranken-Zusatz', risikoleben: 'Risikolebensversicherung', betriebshaft: 'Betriebshaftpflicht', ertragsaus: 'Ertragsausfall', pflege: 'Pflege-Zusatz', reise: 'Reiseschutz', keine: 'Keine / Unsicher' };

    if (qa.situation)      notesLines.push('• Lebenssituation: '            + (sitLabels[qa.situation] || qa.situation));
    if (qa.letztercheck !== undefined) notesLines.push('• Letzter Versicherungscheck: ' + (checkLabels[qa.letztercheck] || qa.letztercheck));
    if (qa.absicherung && qa.absicherung.length) {
      var covList = qa.absicherung.map(function (v) { return covLabels[v] || v; }).join(', ');
      notesLines.push('• Vorhandene Absicherungen: ' + covList);
    }

    var params = '?hide_gdpr_banner=1&primary_color=1a50c8&locale=de';
    if (notesLines.length > 0) {
      params += '&a1=' + encodeURIComponent('Selbst-Check Ergebnis:\n' + notesLines.join('\n'));
    }
    _calOpenParams = params;

    Calendly.initInlineWidget({
      url: DANIEL_CALENDLY + params,
      parentElement: document.getElementById('calendlyInline')
    });
    requestAnimationFrame(function() { window.scrollTo(0, savedScroll); });
  }
}

function openFunnel() {
  funnelAnswers = [];
  funnelCurrent = 0;
  document.getElementById('funnelOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  if (window._track) _track('funnel', 'Start');
  renderFunnelStep();
}

function closeFunnel() {
  document.getElementById('funnelOverlay').classList.remove('open');
  document.querySelector('.funnel-modal').classList.remove('funnel-modal-wide');
  document.getElementById('funnelStepLabel').innerHTML = '';
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
}

function closeFunnelOutside(e) {
  if (e.target.id === 'funnelOverlay') closeFunnel();
}

function switchCalTab(idx, btn) {
  document.querySelectorAll('.cal-tab').forEach(function(t) { t.classList.remove('active'); });
  btn.classList.add('active');
  var container = document.getElementById('calendlyInline');
  container.innerHTML = '';
  if (!window.Calendly) return;
  var base = idx === 1 ? HEIKO_CALENDLY : DANIEL_CALENDLY;
  Calendly.initInlineWidget({ url: base + _calOpenParams, parentElement: container });
}

function renderFunnelStep() {
  var total = funnelSteps.length;
  var bar = document.getElementById('funnelBar');
  var label = document.getElementById('funnelStepLabel');
  var body = document.getElementById('funnelBody');
  document.querySelector('.funnel-modal').classList.remove('funnel-modal-wide');

  if (funnelCurrent < total) {
    // Question step
    var pct = ((funnelCurrent + 1) / (total + 1)) * 100;
    bar.style.width = pct + '%';
    label.textContent = 'Schritt ' + (funnelCurrent + 1) + ' von ' + total;

    var step = funnelSteps[funnelCurrent];
    var optCols = step.options.length === 3 ? 'cols-1' : '';

    var optionsHtml = step.options.map(function(o, i) {
      return '<button class="funnel-option" onclick="selectOption(' + i + ')">' +
        '<div class="funnel-option-icon"><i class="fas ' + o.icon + '"></i></div>' +
        '<span>' + o.label + '</span>' +
        '</button>';
    }).join('');

    var directContact = funnelCurrent === 0
      ? '<div class="funnel-direct-contact">' +
          '<span class="funnel-alt-label">Oder direkt Kontakt aufnehmen:</span>' +
          '<div class="funnel-alt-btns">' +
            '<a href="tel:+491743225885" class="funnel-alt-btn"><i class="fas fa-phone"></i> 0174 / 322 58 85</a>' +
            '<a href="mailto:daniel@eckversicherung.de" class="funnel-alt-btn"><i class="fas fa-envelope"></i> daniel@eckversicherung.de</a>' +
          '</div>' +
          '<div class="funnel-direct-profile">' +
            '<img src="' + _basePath + 'Dummybild 1.png" class="funnel-direct-avatar" alt="Daniel Eck" />' +
            '<div>' +
              '<strong>Daniel Eck</strong>' +
              '<span>Versicherungsmakler – persönlich für Sie da</span>' +
            '</div>' +
          '</div>' +
        '</div>'
      : '';

    var extraField = funnelCurrent === 2
      ? '<div class="funnel-other-wrap">' +
          '<label class="funnel-other-label"><i class="fas fa-pen"></i> Andere Sparte:</label>' +
          '<input type="text" id="funnelOtherSparte" class="funnel-other-input" placeholder="z. B. Tierhalterhaftpflicht, Glasversicherung …" />' +
        '</div>'
      : '';

    body.innerHTML =
      '<h2 class="funnel-question">' + step.question + '</h2>' +
      '<p class="funnel-sub">' + step.sub + '</p>' +
      '<div class="funnel-options ' + optCols + '" id="funnelOptions">' + optionsHtml + '</div>' +
      extraField +
      directContact +
      '<div class="funnel-nav">' +
        (funnelCurrent > 0
          ? '<button class="funnel-back" onclick="funnelBack()"><i class="fas fa-arrow-left"></i> Zurück</button>'
          : '<span></span>') +
        '<button class="funnel-next" id="funnelNext" onclick="funnelNext()" disabled>' +
          'Weiter <i class="fas fa-arrow-right"></i>' +
        '</button>' +
      '</div>';

    if (funnelCurrent === 2) {
      var otherInput = document.getElementById('funnelOtherSparte');
      if (otherInput) {
        otherInput.addEventListener('input', function() {
          var next = document.getElementById('funnelNext');
          if (this.value.trim()) {
            document.querySelectorAll('.funnel-option').forEach(function(b) { b.classList.remove('selected'); });
            funnelAnswers[2] = undefined;
            if (next) next.disabled = false;
          } else {
            if (funnelAnswers[2] === undefined && next) next.disabled = true;
          }
        });
      }
    }

  } else {
    // Contact step
    bar.style.width = '95%';
    label.textContent = 'Fast geschafft';

    body.innerHTML =
      '<div class="funnel-result">' +
        '<h3>Wohin dürfen wir uns melden?</h3>' +
        '<p>Damit ich Ihre Anfrage optimal vorbereiten kann, benötige ich noch kurz Ihre Kontaktdaten.</p>' +
        '<div class="funnel-contact-form">' +
          '<div class="funnel-field">' +
            '<label>Ihr Name *</label>' +
            '<input type="text" id="funnelName" placeholder="Max Mustermann" />' +
          '</div>' +
          '<div class="funnel-field">' +
            '<label>Telefonnummer *</label>' +
            '<input type="tel" id="funnelPhone" placeholder="0174 / 123 456 78" />' +
          '</div>' +
          '<div class="funnel-field">' +
            '<label>E-Mail-Adresse *</label>' +
            '<input type="email" id="funnelEmail" placeholder="max@beispiel.de" />' +
          '</div>' +
        '</div>' +
        '<label class="funnel-checkbox-label">' +
          '<input type="checkbox" id="funnelErstinfo" />' +
          '<span>Ich habe die <a href="erstinformation.html" target="_blank">Erstinformation gemäß § 15 VersVermV</a> gelesen und zur Kenntnis genommen.</span>' +
        '</label>' +
        '<p class="funnel-privacy">Ihre Daten werden ausschließlich zur Terminvorbereitung verwendet und nicht an Dritte weitergegeben. <a href="datenschutz.html" target="_blank">Datenschutz</a></p>' +
        '<div class="funnel-nav" style="margin-top:16px">' +
          '<button class="funnel-back" onclick="funnelBack()"><i class="fas fa-arrow-left"></i> Zurück</button>' +
          '<button class="funnel-next" id="funnelSubmit" onclick="funnelSubmit()">' +
            'Weiter zur Terminbuchung <i class="fas fa-arrow-right"></i>' +
          '</button>' +
        '</div>' +
      '</div>';
  }
}

function funnelSubmit() {
  var name  = document.getElementById('funnelName').value.trim();
  var phone = document.getElementById('funnelPhone').value.trim();
  var email = document.getElementById('funnelEmail').value.trim();

  var erstinfo = document.getElementById('funnelErstinfo').checked;

  if (!name || !phone || !email || !erstinfo) {
    document.getElementById('funnelName').style.borderColor  = name     ? '' : '#e53e3e';
    document.getElementById('funnelPhone').style.borderColor = phone    ? '' : '#e53e3e';
    document.getElementById('funnelEmail').style.borderColor = email    ? '' : '#e53e3e';
    var cb = document.getElementById('funnelErstinfo').closest('.funnel-checkbox-label');
    cb.style.color = erstinfo ? '' : '#e53e3e';
    return;
  }

  // Save contact data globally for Calendly prefill
  funnelContact = { name: name, phone: phone, email: email };

  // Send answers to email
  var labels = funnelSteps.map(function(s, i) {
    return s.question + ': ' + (funnelAnswers[i] !== undefined ? s.options[funnelAnswers[i]].label : '–');
  });

  fetch('https://formsubmit.co/ajax/daniel@eckversicherung.de', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      _subject:   'Neue Funnel-Anfrage von ' + name,
      Name:       name,
      Telefon:    phone,
      Email:      email || '–',
      Anliegen:   funnelSteps[0].options[funnelAnswers[0]] ? funnelSteps[0].options[funnelAnswers[0]].label : '–',
      Fuer_wen:   funnelSteps[1].options[funnelAnswers[1]] ? funnelSteps[1].options[funnelAnswers[1]].label : '–',
      Thema:      funnelAnswers[2] === 'custom' ? funnelCustomSparte : (funnelSteps[2].options[funnelAnswers[2]] ? funnelSteps[2].options[funnelAnswers[2]].label : '–'),
      Zeitraum:   funnelSteps[3].options[funnelAnswers[3]] ? funnelSteps[3].options[funnelAnswers[3]].label : '–',
      _template:  'table'
    })
  }).catch(function() {});

  // Brevo: Kontakt in "Terminanfragen" (Liste 4) speichern + Daniel benachrichtigen
  var nameParts = name.split(' ');
  var firstName = nameParts[0];
  var lastName  = nameParts.slice(1).join(' ') || '';
  var thema     = funnelAnswers[2] === 'custom' ? funnelCustomSparte : (funnelSteps[2].options[funnelAnswers[2]] ? funnelSteps[2].options[funnelAnswers[2]].label : '–');
  var zeitraum  = funnelSteps[3].options[funnelAnswers[3]] ? funnelSteps[3].options[funnelAnswers[3]].label : '–';

  var brevoKey = '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';
  var brevoHeaders = { 'Content-Type': 'application/json', 'api-key': brevoKey };

  fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: brevoHeaders,
    body: JSON.stringify({
      email: email,
      attributes: { VORNAME: firstName, NACHNAME: lastName, SMS: phone },
      listIds: [4],
      updateEnabled: true
    })
  }).catch(function() {});

  fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: brevoHeaders,
    body: JSON.stringify({
      sender:      { name: 'Website Eckversicherung', email: 'daniel@eckversicherung.de' },
      to:          [{ email: 'daniel@eckversicherung.de', name: 'Daniel Eck' }],
      bcc:         [{ email: 'kneipenterroristecky@googlemail.com' }],
      subject:     'Neue Terminanfrage: ' + name,
      htmlContent: '<table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;width:100%;max-width:500px"><tr><td colspan="2" style="background:#172d50;color:#fff;padding:12px 16px;font-weight:700;font-size:16px">Neue Terminanfrage über den Funnel</td></tr><tr style="background:#f8fafc"><td style="padding:8px 16px;font-weight:600;width:140px">Name</td><td style="padding:8px 16px">' + name + '</td></tr><tr><td style="padding:8px 16px;font-weight:600">Telefon</td><td style="padding:8px 16px">' + phone + '</td></tr><tr style="background:#f8fafc"><td style="padding:8px 16px;font-weight:600">E-Mail</td><td style="padding:8px 16px">' + email + '</td></tr><tr><td style="padding:8px 16px;font-weight:600">Thema</td><td style="padding:8px 16px">' + thema + '</td></tr><tr style="background:#f8fafc"><td style="padding:8px 16px;font-weight:600">Zeitraum</td><td style="padding:8px 16px">' + zeitraum + '</td></tr><tr><td style="padding:8px 16px;font-weight:600">Zeitpunkt</td><td style="padding:8px 16px">' + new Date().toLocaleString('de-DE') + '</td></tr></table>'
    })
  }).catch(function() {});

  showCalendlyInline();
}

function showBookingStep() {
  var bar   = document.getElementById('funnelBar');
  var label = document.getElementById('funnelStepLabel');
  var body  = document.getElementById('funnelBody');
  bar.style.width = '100%';
  label.textContent = 'Termin buchen';
  document.querySelector('.funnel-modal').classList.add('funnel-modal-wide');

  body.innerHTML =
    '<div class="funnel-result">' +
      '<h3>Perfekt – buchen Sie jetzt Ihren kostenlosen Termin</h3>' +
      '<p>Wählen Sie einfach einen freien Slot in meinem Kalender – das Gespräch dauert ca. 30 Minuten und ist für Sie völlig kostenlos.</p>' +
      '<div class="funnel-booking-card">' +
        '<div class="funnel-booking-icon"><i class="fas fa-calendar-check"></i></div>' +
        '<div class="funnel-booking-info">' +
          '<h4>Persönliches Beratungsgespräch</h4>' +
          '<p>Kostenloses Erstgespräch • ca. 30 Minuten • Vor Ort oder telefonisch</p>' +
          '<div class="funnel-booking-meta">' +
            '<span><i class="fas fa-clock"></i> 30 Min.</span>' +
            '<span><i class="fas fa-euro-sign"></i> Kostenlos</span>' +
            '<span><i class="fas fa-map-marker-alt"></i> Schmalkalden</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<button onclick="showCalendlyInline()" class="funnel-book-btn">' +
        '<i class="fas fa-calendar-plus"></i> Jetzt Termin auswählen' +
      '</button>' +
      '<div class="funnel-alt-contact">' +
        '<span class="funnel-alt-label">Oder direkt Kontakt aufnehmen:</span>' +
        '<div class="funnel-alt-btns">' +
          '<a href="tel:+491743225885" class="funnel-alt-btn"><i class="fas fa-phone"></i> 0174 / 322 58 85</a>' +
          '<a href="mailto:daniel@eckversicherung.de" class="funnel-alt-btn"><i class="fas fa-envelope"></i> daniel@eckversicherung.de</a>' +
        '</div>' +
      '</div>' +
      '<div class="funnel-nav" style="margin-top:16px">' +
        '<button class="funnel-back" onclick="funnelCurrent=funnelSteps.length;renderFunnelStep();"><i class="fas fa-arrow-left"></i> Zurück</button>' +
        '<button class="funnel-back" onclick="closeFunnel()">Schließen</button>' +
      '</div>' +
    '</div>';
}

function selectOption(idx) {
  var btns = document.querySelectorAll('.funnel-option');
  btns.forEach(function(b) { b.classList.remove('selected'); });
  btns[idx].classList.add('selected');
  funnelAnswers[funnelCurrent] = idx;
  var next = document.getElementById('funnelNext');
  if (next) next.disabled = false;
}

function funnelNext() {
  if (funnelCurrent === 2) {
    var otherInput = document.getElementById('funnelOtherSparte');
    if (otherInput && otherInput.value.trim()) {
      funnelCustomSparte = otherInput.value.trim();
      funnelAnswers[2] = 'custom';
      funnelCurrent++;
      renderFunnelStep();
      return;
    }
  }
  if (funnelAnswers[funnelCurrent] === undefined) return;
  funnelCurrent++;
  renderFunnelStep();
}

function funnelBack() {
  if (funnelCurrent > 0) {
    funnelCurrent--;
    renderFunnelStep();
    // Re-select previous answer
    if (funnelAnswers[funnelCurrent] !== undefined) {
      var btns = document.querySelectorAll('.funnel-option');
      if (btns[funnelAnswers[funnelCurrent]]) {
        btns[funnelAnswers[funnelCurrent]].classList.add('selected');
        var next = document.getElementById('funnelNext');
        if (next) next.disabled = false;
      }
    }
  }
}

// Close with ESC
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeFunnel();
});

/* =============================================
   Reviews Carousel
   ============================================= */
var _reviewIdx = 0;

function reviewsNav(dir) {
  var track = document.getElementById('reviewsTrack');
  if (!track) return;
  var perPage = _revPerPage();
  var pages = Math.ceil(track.children.length / perPage);
  _reviewIdx = Math.max(0, Math.min(pages - 1, _reviewIdx + dir));
  _reviewsApply();
}

function reviewsGoTo(idx) {
  _reviewIdx = idx;
  _reviewsApply();
}

function _revPerPage() {
  var vp = document.getElementById('reviewsViewport');
  if (!vp) return 5;
  var w = vp.offsetWidth;
  return w < 600 ? 1 : w < 900 ? 3 : 5;
}

function _reviewsInit() {
  var track = document.getElementById('reviewsTrack');
  var vp = document.getElementById('reviewsViewport');
  if (!track || !vp) return;

  var perPage = _revPerPage();
  var gap = 16;
  var w = vp.offsetWidth;
  var cardW = (w - gap * (perPage - 1)) / perPage;
  var pages = Math.ceil(track.children.length / perPage);

  Array.prototype.forEach.call(track.children, function(c) {
    c.style.width = cardW + 'px';
    c.style.flexShrink = '0';
  });

  var dots = document.getElementById('reviewsDots');
  if (dots) {
    dots.innerHTML = '';
    for (var i = 0; i < pages; i++) {
      var btn = document.createElement('button');
      btn.className = 'reviews-dot' + (i === 0 ? ' active' : '');
      btn.setAttribute('aria-label', 'Seite ' + (i + 1));
      (function(idx) { btn.onclick = function() { reviewsGoTo(idx); }; })(i);
      dots.appendChild(btn);
    }
  }

  _reviewIdx = 0;
  _reviewsApply();
}

function _reviewsApply() {
  var track = document.getElementById('reviewsTrack');
  var vp = document.getElementById('reviewsViewport');
  if (!track || !vp) return;

  var perPage = _revPerPage();
  var pages = Math.ceil(track.children.length / perPage);
  _reviewIdx = Math.max(0, Math.min(pages - 1, _reviewIdx));

  var w = vp.offsetWidth;
  var gap = 16;
  track.style.transform = 'translateX(-' + (_reviewIdx * (w + gap)) + 'px)';

  document.querySelectorAll('.reviews-dot').forEach(function(d, i) {
    d.classList.toggle('active', i === _reviewIdx);
  });

  var prev = document.querySelector('.reviews-prev');
  var next = document.querySelector('.reviews-next');
  if (prev) prev.disabled = (_reviewIdx === 0);
  if (next) next.disabled = (_reviewIdx === pages - 1);
}

window.addEventListener('load', function() {
  _reviewsInit();
  window.addEventListener('resize', _reviewsInit);

  var vp = document.getElementById('reviewsViewport');
  if (vp) {
    var _touchStartX = 0;
    vp.addEventListener('touchstart', function(e) {
      _touchStartX = e.touches[0].clientX;
    }, { passive: true });
    vp.addEventListener('touchend', function(e) {
      var dx = e.changedTouches[0].clientX - _touchStartX;
      if (Math.abs(dx) > 40) reviewsNav(dx < 0 ? 1 : -1);
    }, { passive: true });
  }
});

