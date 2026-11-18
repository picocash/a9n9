/* Hide polls and quiz result counts until the vote counter answers (route may not be live yet). */
(function () {
  var els = document.querySelectorAll('.gxl-poll');
  if (!els.length) return;
  els.forEach(function (el) { el.hidden = true; });
  fetch('/gxl-api/poll/health-check', { redirect: 'error' }).then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .then(function (d) { if (d && 'counts' in d) els.forEach(function (el) { el.hidden = false; }); }).catch(function () {});
})();
/* GenX Linked quick polls: one tap, then show everyone's answers. */
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
/* GenX Linked quizzes: answer every question, get a result, see how other readers scored (counts via the poll API). */
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
  new MutationObserver(function () {
    document.querySelectorAll('.gxl-poll.is-voted').forEach(function (el) {
      addShare(el, function () { var m = el.querySelector('.gxl-poll-opt.is-mine .gxl-poll-t'), q = el.querySelector('.gxl-poll-q'); return (q ? q.textContent + ' ' : '') + 'My answer: ' + (m ? m.textContent : '') + '. What’s yours?'; });
    });
    document.querySelectorAll('.gxl-quiz.is-done').forEach(function (el) {
      var out = el.querySelector('.gxl-quiz-out');
      addShare(out, function () { var r = el.querySelector('.gxl-quiz-r:not([hidden]) .gxl-quiz-name'), t = el.querySelector('.gxl-quiz-title'); return (t ? t.textContent + ' ' : '') + 'I got: ' + (r ? r.textContent : '') + '. Take it:'; });
      var btn = out.querySelector('.gxl-answer-share'); if (btn) btn.textContent = 'Share my result';
    });
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
})();
