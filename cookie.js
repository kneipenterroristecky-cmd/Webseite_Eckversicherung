/* =============================================
   Daniel Eck – Versicherungsmakler – Cookie Consent
   ============================================= */

var COOKIE_KEY = 've_cookie_consent';

function getCookieConsent() {
  try { return JSON.parse(localStorage.getItem(COOKIE_KEY)); }
  catch (e) { return null; }
}

function setCookieConsent(prefs) {
  localStorage.setItem(COOKIE_KEY, JSON.stringify({
    notwendig: true,
    funktional: prefs.funktional || false,
    statistik:  prefs.statistik  || false,
    marketing:  prefs.marketing  || false,
    timestamp:  new Date().toISOString()
  }));
}

function applyConsent(prefs) {
  if (prefs.funktional) {
    loadCalendly();
  }
}

function loadCalendly() {
  if (document.getElementById('calendly-widget-js')) return;
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://assets.calendly.com/assets/external/widget.css';
  document.head.appendChild(link);
  var s = document.createElement('script');
  s.id = 'calendly-widget-js';
  s.src = 'https://assets.calendly.com/assets/external/widget.js';
  document.head.appendChild(s);
}

function showCookieBanner() {
  var banner = document.getElementById('cookieBanner');
  if (banner) setTimeout(function() { banner.classList.add('show'); }, 600);
}

function hideCookieBanner() {
  var banner = document.getElementById('cookieBanner');
  if (banner) banner.classList.remove('show');
}

function acceptAll() {
  var prefs = { notwendig: true, funktional: true, statistik: true, marketing: true };
  setCookieConsent(prefs);
  applyConsent(prefs);
  hideCookieBanner();
  closeCookieSettings();
}

function acceptNecessary() {
  var prefs = { notwendig: true, funktional: false, statistik: false, marketing: false };
  setCookieConsent(prefs);
  applyConsent(prefs);
  hideCookieBanner();
  closeCookieSettings();
}

function saveSettings() {
  var prefs = {
    notwendig:  true,
    funktional: document.getElementById('toggleFunktional').checked,
    statistik:  document.getElementById('toggleStatistik').checked,
    marketing:  document.getElementById('toggleMarketing').checked
  };
  setCookieConsent(prefs);
  applyConsent(prefs);
  hideCookieBanner();
  closeCookieSettings();
}

function openCookieSettings() {
  var consent = getCookieConsent();
  if (consent) {
    document.getElementById('toggleFunktional').checked = consent.funktional;
    document.getElementById('toggleStatistik').checked  = consent.statistik;
    document.getElementById('toggleMarketing').checked  = consent.marketing;
  }
  document.getElementById('cookieSettings').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeCookieSettings() {
  document.getElementById('cookieSettings').classList.remove('show');
  document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', function() {
  var consent = getCookieConsent();
  if (!consent) {
    showCookieBanner();
  } else {
    applyConsent(consent);
  }
});
