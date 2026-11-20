/* Hide polls and quiz result counts until the vote counter answers (route may not be live yet). */
(function () {
  var els = document.querySelectorAll('.gxl-poll');
  if (!els.length) return;
  els.forEach(function (el) { el.hidden = true; });
  fetch('/gxl-api/poll/health-check', { redirect: 'error' }).then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .then(function (d) { if (d && 'counts' in d) els.forEach(function (el) { el.hidden = false; }); }).catch(function () {});
})();
/* GenXLinked quick polls: one tap, then show everyone's answers. */
(function () {
  var API = '/gxl-api/poll/';
  function key(id) { return 'gxl-poll-' + id; }
  function store(id, v) { try { if (v === undefined) return localStorage.getItem(key(id)); localStorage.setItem(key(id), v); } catch (e) { return null; } }
  function show(el, data, mine) {
    var opts = el.querySelectorAll('.gxl-poll-opt'), total = (data && data.total) || 0;
    el.classList.add('is-voted');
    opts.forEach(function (b, i) {
      var n = (data && data.counts && data.counts[i]) || 0, pct = total ? Math.round(n * 100 / total) : 0;
      b.disabled = true; b.setAttribute('aria-pressed', String(i === mine));
      if (i === mine) b.classList.add('is-mine');
      b.querySelector('.gxl-poll-bar').style.width = pct + '%';
      b.querySelector('.gxl-poll-pct').textContent = total ? pct + '%' : '';
    });
    el.querySelector('.gxl-poll-note').textContent = total ? total + (total === 1 ? ' vote so far.' : ' votes so far.') + ' Thanks for answering.' : 'Thanks. Results appear as more people answer.';
  }
  document.querySelectorAll('.gxl-poll').forEach(function (el) {
    var id = el.getAttribute('data-poll'), prev = store(id);
    if (prev !== null && prev !== undefined) {
      fetch(API + id).then(function (r) { return r.json(); }).then(function (d) { show(el, d, Number(prev)); }).catch(function () { show(el, null, Number(prev)); });
    }
    el.querySelectorAll('.gxl-poll-opt').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = Number(b.getAttribute('data-i'));
        store(id, String(i));
        fetch(API + id, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ i: i }) })
          .then(function (r) { return r.json(); }).then(function (d) { show(el, d, i); }).catch(function () { show(el, null, i); });
      });
    });
  });
})();
/* GenXLinked quizzes: answer every question, get a result, see how other readers scored (counts via the poll API). */
(function () {
  var API = '/gxl-api/poll/';
  document.querySelectorAll('.gxl-quiz').forEach(function (el) {
    var id = el.getAttribute('data-quiz'), names = (el.getAttribute('data-names') || '').split('|');
    var qs = el.querySelectorAll('.gxl-quiz-q'), out = el.querySelector('.gxl-quiz-out'), dist = el.querySelector('.gxl-quiz-dist'), reset = el.querySelector('.gxl-quiz-reset');
    function score() {
      var total = 0, done = 0;
      qs.forEach(function (q) { var s = q.querySelector('.is-picked'); if (s) { done++; total += Number(s.getAttribute('data-p')); } });
      if (done < qs.length) return;
      var shown = null;
      el.querySelectorAll('.gxl-quiz-r').forEach(function (r) { var hit = total >= Number(r.getAttribute('data-lo')) && total <= Number(r.getAttribute('data-hi')); r.hidden = !hit; if (hit) shown = r; });
      if (!shown) return;
      el.classList.add('is-done'); reset.hidden = false; shown.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var i = Number(shown.getAttribute('data-i')), sent = false;
      try { sent = localStorage.getItem('gxl-quiz-' + id) !== null; localStorage.setItem('gxl-quiz-' + id, String(i)); } catch (e) {}
      fetch(API + id, sent ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ i: i }) })
        .then(function (r) { return r.json(); }).then(function (d) {
          if (!d || !d.total) return;
          dist.innerHTML = '<p class="gxl-quiz-kicker">How readers scored (' + d.total + ')</p>' + names.map(function (n, k) { var c = (d.counts && d.counts[k]) || 0, p = Math.round(c * 100 / d.total); return '<div class="gxl-quiz-row"><span>' + n + '</span><span class="gxl-quiz-track"><span style="width:' + p + '%"></span></span><b>' + p + '%</b></div>'; }).join('');
          dist.hidden = false;
        }).catch(function () {});
    }
    qs.forEach(function (q) {
      q.querySelectorAll('.gxl-quiz-a').forEach(function (b) {
        b.addEventListener('click', function () { q.querySelectorAll('.gxl-quiz-a').forEach(function (x) { x.classList.remove('is-picked'); x.setAttribute('aria-pressed', 'false'); }); b.classList.add('is-picked'); b.setAttribute('aria-pressed', 'true'); q.classList.add('is-answered'); score(); });
      });
    });
    reset.addEventListener('click', function () { el.querySelectorAll('.is-picked').forEach(function (x) { x.classList.remove('is-picked'); }); el.querySelectorAll('.gxl-quiz-r').forEach(function (r) { r.hidden = true; }); el.classList.remove('is-done'); reset.hidden = true; dist.hidden = true; qs[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  });
})();
/* Sharing: native share sheet where supported, copy link, floating share on phones, infographic save/share,
   share-your-answer after polls and quizzes. Plain links only: no third-party share scripts, no tracking. */
(function () {
  var canShare = !!navigator.share;
  var pageUrl = location.origin + location.pathname;
  var pageTitle = (document.querySelector('h1.gh-article-title') || {}).textContent || document.title;
  function toast(msg) { var t = document.createElement('div'); t.className = 'gxl-toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2200); }
  function copy(text) {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { toast('Link copied'); }).catch(function () {
      var a = document.createElement('textarea'); a.value = text; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); toast('Link copied'); } catch (e) {} a.remove();
    });
  }
  function nativeShare(data) { return navigator.share(data).catch(function () {}); }
  window.gxlShare = function (text, url) { url = url || pageUrl; if (canShare) return nativeShare({ title: pageTitle, text: text, url: url }); copy(text + ' ' + url); };
  document.querySelectorAll('.gxl-share').forEach(function (bar) {
    var url = bar.getAttribute('data-url'), title = bar.getAttribute('data-title');
    var nb = bar.querySelector('.gxl-share-native');
    if (canShare && nb) { nb.hidden = false; nb.addEventListener('click', function () { nativeShare({ title: title, text: title, url: url }); }); }
    var cb = bar.querySelector('.gxl-share-copy'); if (cb) cb.addEventListener('click', function () { copy(url); });
  });
  var fab = document.querySelector('.gxl-fab');
  if (fab && window.matchMedia('(max-width: 680px)').matches) {
    fab.hidden = false;
    fab.addEventListener('click', function () { if (canShare) nativeShare({ title: pageTitle, text: pageTitle, url: pageUrl }); else document.getElementById('gxl-share-end').scrollIntoView({ behavior: 'smooth' }); });
  }
  // Infographic: save + share buttons under the image
  document.querySelectorAll('.gh-content img[alt^="Infographic"]').forEach(function (img) {
    var fig = img.closest('figure') || img, row = document.createElement('div'); row.className = 'gxl-ig-actions';
    var name = (location.pathname.replace(/\//g, '') || 'genxlinked') + '-infographic.png';
    row.innerHTML = '<a class="gxl-share-btn" href="' + img.src + '" download="' + name + '">Save infographic</a><button type="button" class="gxl-share-btn gxl-ig-share">Share infographic</button>';
    fig.insertAdjacentElement('afterend', row);
    row.querySelector('.gxl-ig-share').addEventListener('click', function () {
      fetch(img.src).then(function (r) { return r.blob(); }).then(function (b) {
        var file = new File([b], name, { type: b.type || 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], title: pageTitle, text: pageTitle + ' ' + pageUrl });
        throw 0;
      }).catch(function () { window.gxlShare('The numbers at a glance:', pageUrl); });
    });
  });
  // Polls and quizzes: offer to share the reader's answer once it shows
  function addShare(box, textFn) {
    if (box.querySelector('.gxl-answer-share')) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'gxl-share-btn gxl-answer-share'; b.textContent = 'Share your answer';
    b.addEventListener('click', function () { window.gxlShare(textFn()); });
    box.appendChild(b);
  }
  // ...and, for readers who are not members yet, the signup at the same moment (the results-by-country promise lives in the letter)
  var isMember = document.body.getAttribute('data-gxl-member') === '1';
  function addJoin(box) {
    if (isMember || box.querySelector('.gxl-answer-join')) return;
    var p = document.createElement('p'); p.className = 'gxl-answer-join';
    p.innerHTML = 'Get the results by country in Friday’s letter. <button type="button" class="gxl-btn" data-gxl-join>Join GenXLinked free</button>';
    box.appendChild(p);
  }
  new MutationObserver(function () {
    document.querySelectorAll('.gxl-poll.is-voted').forEach(function (el) {
      addShare(el, function () { var m = el.querySelector('.gxl-poll-opt.is-mine .gxl-poll-t'), q = el.querySelector('.gxl-poll-q'); return (q ? q.textContent + ' ' : '') + 'My answer: ' + (m ? m.textContent : '') + '. What’s yours?'; });
    });
    document.querySelectorAll('.gxl-quiz.is-done').forEach(function (el) {
      var out = el.querySelector('.gxl-quiz-out');
      addShare(out, function () { var r = el.querySelector('.gxl-quiz-r:not([hidden]) .gxl-quiz-name'), t = el.querySelector('.gxl-quiz-title'); return (t ? t.textContent + ' ' : '') + 'I got: ' + (r ? r.textContent : '') + '. Take it:'; });
      var btn = out.querySelector('.gxl-answer-share'); if (btn) btn.textContent = 'Share my result';
    });
    document.querySelectorAll('.gxl-poll.is-voted').forEach(function (el) { addJoin(el); });
    document.querySelectorAll('.gxl-quiz.is-done .gxl-quiz-out').forEach(function (out) { addJoin(out); });
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
})();
/* Phone menu: "Sections" button opens the full list */
(function () {
  var btn = document.querySelector('.gxl-menu-toggle'), nav = document.getElementById('gxl-menu');
  if (!btn || !nav) return;
  btn.addEventListener('click', function () { var open = nav.classList.toggle('is-open'); btn.setAttribute('aria-expanded', String(open)); btn.textContent = open ? 'Close' : 'Sections'; });
})();
/* Join with a code (like beatthechefs): email -> 6-digit code -> signed in and subscribed. No password, no link to click.
   /gxl-api/join creates the member unsubscribed; Ghost's own sign-in sends the code (OTC); after the code checks out,
   the signed-in member subscribes themselves to the newsletter. */
(function () {
  var NEWSLETTER = '6afda7bc4d15660001e2b1df';
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  var modal = el('<div class="gxl-join" role="dialog" aria-modal="true" aria-labelledby="gxl-join-h" hidden><div class="gxl-join-box">' +
    '<button type="button" class="gxl-join-x" aria-label="Close">&times;</button>' +
    '<div class="gxl-join-step" data-step="1"><p class="gxl-poll-kicker">Free, one letter a week</p><h2 id="gxl-join-h">Join GenXLinked</h2>' +
    '<p class="gxl-join-sub">No password. We email you a 6-digit code.</p>' +
    '<div class="gxl-join-google" hidden></div>' +
    '<form class="gxl-join-f1"><label for="gxl-join-email">Email</label><input id="gxl-join-email" type="email" autocomplete="email" required placeholder="you@example.com">' +
    '<label for="gxl-join-name">First name <span>(optional)</span></label><input id="gxl-join-name" type="text" autocomplete="given-name" maxlength="80">' +
    '<button type="submit" class="gxl-btn">Send me a code</button><p class="gxl-join-err" role="alert"></p></form></div>' +
    '<div class="gxl-join-step" data-step="2" hidden><p class="gxl-poll-kicker">Check your email</p><h2>Enter your code</h2>' +
    '<p class="gxl-join-sub">We sent a 6-digit code to <b class="gxl-join-to"></b>. It may take a minute; check spam too.</p>' +
    '<form class="gxl-join-f2"><label for="gxl-join-code">Code</label><input id="gxl-join-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6" required>' +
    '<button type="submit" class="gxl-btn">Sign in</button><p class="gxl-join-err" role="alert"></p></form>' +
    '<p class="gxl-join-alt"><button type="button" class="gxl-join-back">Use a different email</button> &middot; <button type="button" class="gxl-join-resend">Send a new code</button></p></div>' +
    '</div></div>');
  document.body.appendChild(modal);
  var state = { email: '', ref: '' }, lastFocus = null;
  function show(step) { modal.querySelectorAll('.gxl-join-step').forEach(function (s) { s.hidden = s.getAttribute('data-step') !== String(step); }); var f = modal.querySelector('.gxl-join-step:not([hidden]) input'); if (f) setTimeout(function () { f.focus(); }, 30); }
  function open() { lastFocus = document.activeElement; modal.hidden = false; document.documentElement.classList.add('gxl-noscroll'); show(state.ref ? 2 : 1); }
  function close() { modal.hidden = true; document.documentElement.classList.remove('gxl-noscroll'); if (lastFocus) lastFocus.focus(); if (location.hash === '#join') history.replaceState(null, '', location.pathname + location.search); }
  function err(form, msg) { form.querySelector('.gxl-join-err').textContent = msg || ''; }
  function busy(form, on) { var b = form.querySelector('button[type=submit]'); b.disabled = on; b.dataset.label = b.dataset.label || b.textContent; b.textContent = on ? 'One moment…' : b.dataset.label; }
  function sendCode() {
    return fetch('/members/api/integrity-token/', { credentials: 'same-origin' }).then(function (r) { return r.text(); }).then(function (tok) {
      return fetch('/members/api/send-magic-link/', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: state.email, emailType: 'signin', includeOTC: true, integrityToken: tok, honeypot: '' }) });
    }).then(function (r) { if (r.status === 429) throw new Error('Too many tries for this address. Wait a few minutes, then try again.'); if (!r.ok) throw new Error('send'); return r.json(); }).then(function (j) { state.ref = j.otc_ref || ''; return j; });
  }
  modal.querySelector('.gxl-join-f1').addEventListener('submit', function (e) {
    e.preventDefault(); var f = e.target; err(f); busy(f, true);
    state.email = f.querySelector('#gxl-join-email').value.trim();
    fetch('/gxl-api/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: state.email, name: f.querySelector('#gxl-join-name').value.trim() }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.'); }); })
      .then(sendCode).then(function () {
        modal.querySelector('.gxl-join-to').textContent = state.email;
        if (!state.ref) { modal.querySelector('[data-step="2"] .gxl-join-sub').innerHTML = 'We emailed a sign-in link to <b>' + esc(state.email) + '</b>. Open it on this device to finish.'; modal.querySelector('.gxl-join-f2').hidden = true; }
        try { localStorage.setItem('gxl-join-sub', '1'); } catch (x) {}
        show(2);
      }).catch(function (x) { err(f, x.message === 'send' ? 'We could not send the code. Check the address and try again.' : x.message); }).then(function () { busy(f, false); });
  });
  modal.querySelector('.gxl-join-f2').addEventListener('submit', function (e) {
    e.preventDefault(); var f = e.target; err(f); busy(f, true);
    var otc = f.querySelector('#gxl-join-code').value.trim();
    fetch('/members/api/integrity-token/', { credentials: 'same-origin' }).then(function (r) { return r.text(); })
      .then(function (tok) { return fetch('/members/api/verify-otc/', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ otc: otc, otcRef: state.ref, integrityToken: tok }) }); })
      .then(function (r) { if (r.status === 429) throw new Error('Too many tries. Wait a few minutes, then send a new code.'); return r.json().then(function (j) { if (!r.ok || !j.redirectUrl) throw new Error('That code did not work. Check it, or send a new one.'); location.href = j.redirectUrl; }); })
      .catch(function (x) { err(f, x.message); busy(f, false); });
  });
  modal.querySelector('.gxl-join-back').addEventListener('click', function () { state.ref = ''; show(1); });
  modal.querySelector('.gxl-join-resend').addEventListener('click', function (e) { var b = e.target; b.disabled = true; sendCode().then(function () { b.textContent = 'Sent'; }).catch(function () { b.textContent = 'Try again'; b.disabled = false; }); });
  modal.querySelector('.gxl-join-x').addEventListener('click', close);
  modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) close(); });
  document.addEventListener('click', function (e) { var t = e.target.closest('[data-gxl-join]'); if (t) { e.preventDefault(); open(); } });
  if (location.hash === '#join' || location.hash === '#/portal/signup') open();
  // After the code: subscribe the now signed-in member to the weekly letter, once.
  var flag = null; try { flag = localStorage.getItem('gxl-join-sub'); } catch (x) {}
  if (document.body.getAttribute('data-gxl-member') === '1' && flag) {
    fetch('/members/api/member/', { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ newsletters: [{ id: NEWSLETTER }] }) })
      .then(function (r) { if (r.ok) { try { localStorage.removeItem('gxl-join-sub'); } catch (x) {} var t = document.createElement('div'); t.className = 'gxl-toast'; t.textContent = "You're in. One letter a week, free."; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3500); } });
  }
  window.gxlJoin = { open: open, close: close, state: state, show: show };
})();
/* Continue with Google (only when /gxl-api/config returns a client ID). Google's script loads only when the join box opens. */
(function () {
  var box = document.querySelector('.gxl-join-google'); if (!box || !window.gxlJoin) return;
  var loaded = false, origOpen = window.gxlJoin.open;
  function onCred(resp) {
    var err = document.querySelector('.gxl-join-f1 .gxl-join-err'); if (err) err.textContent = '';
    fetch('/gxl-api/google', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ credential: resp.credential }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.url) throw new Error(j.error || 'Google sign-in failed. Use the email code.'); location.href = j.url; }); })
      .catch(function (x) { if (err) err.textContent = x.message; });
  }
  function setup() {
    if (loaded) return; loaded = true;
    fetch('/gxl-api/config').then(function (r) { return r.json(); }).then(function (c) {
      if (!c.googleClientId) return;
      var s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = function () {
        google.accounts.id.initialize({ client_id: c.googleClientId, callback: onCred, auto_select: false, itp_support: true, use_fedcm_for_prompt: true });
        box.hidden = false; box.innerHTML = '<div class="gxl-join-gbtn"></div><p class="gxl-join-or"><span>or use your email</span></p>';
        google.accounts.id.renderButton(box.querySelector('.gxl-join-gbtn'), { theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', width: Math.min(380, box.clientWidth || 340) });
        google.accounts.id.prompt();
      };
      document.head.appendChild(s);
    }).catch(function () {});
  }
  window.gxlJoin.open = function () { origOpen(); setup(); };
  document.addEventListener('click', function (e) { if (e.target.closest('[data-gxl-join]')) setup(); }, true);
  if (location.hash === '#join') setup();
})();
