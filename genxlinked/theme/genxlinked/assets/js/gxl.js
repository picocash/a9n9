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
