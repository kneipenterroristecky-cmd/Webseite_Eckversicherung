/* =============================================
   Daniel Eck – Versicherungsmakler – Interactions & Animations
   ============================================= */

/* ---- Social Peek Animation ---- */
document.addEventListener('DOMContentLoaded', function () {
  var peek = document.getElementById('socialPeek');
  if (!peek) return;
  setTimeout(function () { peek.classList.add('sp-in'); }, 500);
  setTimeout(function () { peek.classList.remove('sp-in'); }, 3200);
});

/* ---- Navbar scroll shadow ---- */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 12);
}, { passive: true });

/* ---- Hamburger / mobile nav ---- */
const hamburger  = document.getElementById('hamburger');
const navLinks   = document.getElementById('navLinks');

hamburger.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  hamburger.classList.toggle('open', open);
  hamburger.setAttribute('aria-expanded', open);
});

// close on link click
navLinks.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    navLinks.classList.remove('open');
    hamburger.classList.remove('open');
  });
});

// close on outside click
document.addEventListener('click', e => {
  if (!navbar.contains(e.target)) {
    navLinks.classList.remove('open');
    hamburger.classList.remove('open');
  }
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
    const target = document.querySelector(a.getAttribute('href'));
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

function showCalendlyInline() {
  document.querySelector('.funnel-modal').classList.add('funnel-modal-wide');
  var body = document.getElementById('funnelBody');
  body.innerHTML =
    '<div class="funnel-result">' +
      '<h3>Wählen Sie Ihren Wunschtermin</h3>' +
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

    Calendly.initInlineWidget({
      url: 'https://calendly.com/eckversicherung/30min' + params,
      parentElement: document.getElementById('calendlyInline')
    });
  }
}

function openCalendlyDirect() {
  var overlay = document.getElementById('funnelOverlay');
  var modal   = document.querySelector('.funnel-modal');
  overlay.classList.add('open');
  modal.classList.add('funnel-modal-wide');
  document.body.style.overflow = 'hidden';

  document.getElementById('funnelBar').style.width = '100%';
  document.getElementById('funnelStepLabel').textContent = 'Wählen Sie Ihren Wunschtermin';

  document.getElementById('funnelBody').innerHTML =
    '<div class="funnel-result">' +
      '<h3>Jetzt Termin buchen</h3>' +
      '<p>Wählen Sie einen freien Slot – kostenlos &amp; unverbindlich.</p>' +
      '<div id="calendlyInline"></div>' +
    '</div>';

  if (window.Calendly) {
    /* Quiz-Antworten als Bemerkung formatieren */
    var notes = 'Selbst-Check Ergebnis:\n';
    var qa = window.quizAnswers || {};

    var sitLabels   = { angestellt: 'Angestellt', familie: 'Familie mit Kindern', selbststaendig: 'Selbstständig', ruhestand: 'Im Ruhestand' };
    var checkLabels = { 0: 'Noch nie / Vor mehr als 3 Jahren', 1: 'Vor 1–3 Jahren', 2: 'Dieses Jahr' };
    var covLabels   = { haftpflicht: 'Privathaftpflicht', bu: 'Berufsunfähigkeit', hausrat: 'Hausrat', rechtsschutz: 'Rechtsschutz', kranken: 'Kranken-Zusatz', risikoleben: 'Risikolebensversicherung', betriebshaft: 'Betriebshaftpflicht', ertragsaus: 'Ertragsausfall', pflege: 'Pflege-Zusatz', reise: 'Reiseschutz', keine: 'Keine / Unsicher' };

    if (qa.situation)      notes += '• Lebenssituation: '            + (sitLabels[qa.situation] || qa.situation) + '\n';
    if (qa.letztercheck !== undefined) notes += '• Letzter Versicherungscheck: ' + (checkLabels[qa.letztercheck] || qa.letztercheck) + '\n';
    if (qa.absicherung && qa.absicherung.length) {
      var covList = qa.absicherung.map(function (v) { return covLabels[v] || v; }).join(', ');
      notes += '• Vorhandene Absicherungen: ' + covList;
    }

    var params = '?hide_gdpr_banner=1&primary_color=1a50c8&locale=de';
    params += '&a1=' + encodeURIComponent(notes.trim());

    Calendly.initInlineWidget({
      url: 'https://calendly.com/eckversicherung/30min' + params,
      parentElement: document.getElementById('calendlyInline')
    });
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
  document.body.style.overflow = '';
}

function closeFunnelOutside(e) {
  if (e.target.id === 'funnelOverlay') closeFunnel();
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
            '<img src="Dummybild 1.png" class="funnel-direct-avatar" alt="Daniel Eck" />' +
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
  }).catch(function() {}); // silent fail — booking still proceeds

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
