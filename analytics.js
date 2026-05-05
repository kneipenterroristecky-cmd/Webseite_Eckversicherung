/* ================================================================
   Daniel Eck – Versicherungsmakler – Analytics Tracking
   Nach dem Apps Script Setup hier die URL eintragen:
   ================================================================ */
(function () {
  'use strict';

  var EP = 'https://script.google.com/macros/s/AKfycbzxyEcTAME2BJN30Qtyk2vwt0VsDpbyAg4okkZgKvkaeclAgebU7ljT9YeRbrQT_VI/exec'; // ← Apps Script URL eintragen

  // ── Session-ID (gilt für eine Browser-Sitzung) ─────────────────
  var sid = sessionStorage.getItem('_esid');
  if (!sid) {
    sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    sessionStorage.setItem('_esid', sid);
  }

  // ── Besucher-ID (persistent über Sitzungen hinweg) ─────────────
  var vid = localStorage.getItem('_evid');
  if (!vid) {
    vid = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    localStorage.setItem('_evid', vid);
  }

  // ── Gerät / Browser / OS erkennen ─────────────────────────────
  function dev() {
    var w = window.innerWidth;
    return w < 768 ? 'Mobile' : w < 1024 ? 'Tablet' : 'Desktop';
  }
  function brw() {
    var ua = navigator.userAgent;
    if (/Edg/.test(ua))     return 'Edge';
    if (/OPR/.test(ua))     return 'Opera';
    if (/Chrome/.test(ua))  return 'Chrome';
    if (/Firefox/.test(ua)) return 'Firefox';
    if (/Safari/.test(ua))  return 'Safari';
    return 'Sonstiger';
  }
  function ops() {
    var ua = navigator.userAgent;
    if (/iPhone/.test(ua))  return 'iPhone';
    if (/iPad/.test(ua))    return 'iPad';
    if (/Android/.test(ua)) return 'Android';
    if (/Windows/.test(ua)) return 'Windows';
    if (/Mac/.test(ua))     return 'macOS';
    if (/Linux/.test(ua))   return 'Linux';
    return '–';
  }
  function ref() {
    if (!document.referrer) return 'Direkt';
    try {
      var h = new URL(document.referrer).hostname;
      if (h === location.hostname) return 'Intern';
      if (/google/.test(h))            return 'Google';
      if (/bing/.test(h))              return 'Bing';
      if (/facebook|fb\.com/.test(h))  return 'Facebook';
      if (/instagram/.test(h))         return 'Instagram';
      if (/linkedin/.test(h))          return 'LinkedIn';
      return h;
    } catch (e) { return '–'; }
  }

  // ── Basisdaten ─────────────────────────────────────────────────
  var base = {
    page:    location.pathname || '/',
    ref:     ref(),
    device:  dev(),
    browser: brw(),
    os:      ops(),
    lang:    navigator.language || '',
    sid:     sid,
    vid:     vid,
    country: '',
    city:    ''
  };

  // ── Geo-Lookup (asynchron, blockiert nie) ──────────────────────
  var geoOk = false;
  fetch('https://ipapi.co/json/')
    .then(function (r) { return r.json(); })
    .then(function (g) { base.country = g.country_name || ''; base.city = g.city || ''; })
    .catch(function () {})
    .finally(function () { geoOk = true; });

  // ── Event senden ───────────────────────────────────────────────
  function send(type, extra) {
    if (!EP || EP === 'YOUR_SCRIPT_URL') return;
    var p = Object.assign({}, base, { type: type, extra: extra || '' });
    var qs = Object.keys(p).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(p[k] || '');
    }).join('&');
    // mode: no-cors → kein CORS-Fehler, wir brauchen die Antwort nicht
    fetch(EP + '?' + qs, { mode: 'no-cors' }).catch(function () {});
  }

  // ── Pageview: nach Geo-Daten oder spätestens nach 2 s ──────────
  var pvSent = false;
  function pv() { if (!pvSent) { pvSent = true; send('pageview'); } }
  setTimeout(pv, 2000);
  var gi = setInterval(function () { if (geoOk) { clearInterval(gi); pv(); } }, 200);

  // ── Abschnitte beobachten (scroll-basiert) ─────────────────────
  if ('IntersectionObserver' in window) {
    var sections = {
      leistungen: 'Leistungen',
      vorteile:   'Vorteile',
      quiz:       'Quiz',
      termin:     'Termin',
      kontakt:    'Kontakt'
    };
    var seen = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && !seen[en.target.id]) {
          seen[en.target.id] = true;
          send('section', sections[en.target.id] || en.target.id);
        }
      });
    }, { threshold: 0.25 });
    Object.keys(sections).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) io.observe(el);
    });
  }

  // ── Global verfügbar für CTA-Tracking ─────────────────────────
  window._track = send;

})();
