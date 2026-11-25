/* ===================================================================
   页面逻辑：全部内容由 DATA 渲染，改内容只改数据不改结构
   =================================================================== */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* 箭头链：每个词包成 nowrap 段，只允许在箭头处折行，避免「分/享」被拆开 */
  function arrowChain(s) {
    var parts = String(s == null ? '' : s).split('→');
    if (parts.length < 2) return esc(s);
    return parts.map(function (p) { return '<span class="seg">' + esc(p.trim()) + '</span>'; })
      .join('<span class="ar">→</span>');
  }

  /* ---------- 计时：把各种时长写法归一成 6 档 ---------- */
  var BINS = ['≤45′', '90′', '2–3 h', '半天', '一天', '多日'];
  function binOf(txt) {
    var s = String(txt || '');
    if (/多日|×\s*2\s*天|2\s*天|两天/.test(s)) return 6;
    if (/一日|1\s*天|全天/.test(s)) return 5;
    // 时间跨度：9:30–15:00 这类按小时差判断，别被 19:00 里的 9:00 骗到
    var sp = s.match(/\d{1,2}:\d{2}\s*[–\-—]\s*\d{1,2}:\d{2}/);
    if (sp) {
      var parts = sp[0].split(/[–\-—]/);
      var hm = function (x) { var v = x.trim().split(':'); return (+v[0]) * 60 + (+v[1]); };
      var diff = Math.abs(hm(parts[1]) - hm(parts[0]));
      if (diff >= 300) return 5;
      if (diff >= 150) return 3;
    }
    if (/半天|半日/.test(s)) return 4;
    var m = s.match(/(\d+)\s*分钟/);
    if (m) { var n = +m[1]; return n <= 45 ? 1 : (n <= 95 ? 2 : 3); }
    var h = s.match(/(\d+(?:\.\d+)?)\s*小时/);
    if (h) { var mm = +h[1] * 60; return mm <= 95 ? 2 : 3; }
    if (/一场|工作坊/.test(s)) return 3;
    return 2;
  }

  /* ---------- 标签：课程 id → 标签名 ---------- */
  var tagOf = {};
  DATA.COURSE_TAGS.forEach(function (t) {
    t.courses.forEach(function (id) {
      (tagOf[id] = tagOf[id] || []).push(t.id);
    });
  });

  var courseById = {};
  DATA.COURSES.forEach(function (c) { courseById[c.id] = c; });

  /* ---------- 封面目录 ---------- */
  var toc = $('#tocList');
  DATA.ERAS.forEach(function (e) {
    var b = document.createElement('button');
    b.className = 'toc-btn';
    b.type = 'button';
    b.innerHTML = '<span class="no">' + esc(e.no) + '</span>' +
      '<span class="nm">' + esc(e.name) + '</span>' +
      '<span class="yr">' + esc(e.years) + '</span>';
    b.addEventListener('click', function () {
      selectEra(e.id);
      document.getElementById('eras').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    toc.appendChild(b);
  });

  /* ---------- 阶段时间轴 ---------- */
  var rail = $('#eraRail');
  var yearSpan = function (y) { var p = String(y).split(/[–—-]/); return Math.max(1, (+p[1] || +p[0]) - (+p[0]) + 1); };
  DATA.ERAS.forEach(function (e) {
    var b = document.createElement('button');
    b.className = 'rail-item';
    b.type = 'button';
    b.dataset.era = e.id;
    b.style.flexGrow = yearSpan(e.years);
    b.innerHTML = '<span class="no">' + esc(e.no) + '</span>' +
      '<span class="yrs">' + esc(e.years) + '</span>' +
      '<span class="nm">' + esc(e.name) + '</span>' +
      '<span class="bar" style="width:100%"></span>';
    b.addEventListener('click', function () { selectEra(e.id); });
    rail.appendChild(b);
  });

  var state = { era: null, tag: 'all', page: 1 };
/* 分页沿用旧版：宽屏 8 门/页，≤980px 4 门/页 */
function coursePer() { return window.innerWidth > 980 ? 8 : 4; }

  function renderEraPanel() {
    var panel = $('#eraPanel');
    var cur = state.era;
    var e = cur ? DATA.ERAS.filter(function (x) { return x.id === cur; })[0] : DATA.ERAS[DATA.ERAS.length - 1];
    var n = cur ? DATA.COURSES.filter(function (c) { return c.era === e.id; }).length : DATA.COURSES.length;
    panel.innerHTML =
      '<div>' +
        '<div class="big">' + esc(e.years) + '</div>' +
        '<div class="role">' + esc(e.role) + '</div>' +
      '</div>' +
      '<div>' +
        '<p class="summary">' + esc(e.summary) + '</p>' +
        '<div class="marks">' + e.marks.map(function (m) {
          return '<div class="mark-row"><k>' + esc(m.k) + '</k><span>' + esc(m.v) + '</span></div>';
        }).join('') + '</div>' +
        '<div class="focus">' + e.focus.map(function (f) { return '<span>' + esc(f) + '</span>'; }).join('') + '</div>' +
      '</div>' +
      '<div class="era-count">' +
        '<div><b>' + n + '</b><span>' + (cur ? '门课程在这一阶段' : '门课程 · 全目录') + '</span></div>' +
        '<a href="#catalog" id="eraJump">' + (cur ? '只看这 ' + n + ' 门 ↓' : '点上方阶段可筛选 ↓') + '</a>' +
      '</div>';
    $('#eraJump').addEventListener('click', function () { applyFilter(); });
  }

  function selectEra(id) {
    state.era = (state.era === id) ? null : id;
    state.page = 1;
    $$('.rail-item').forEach(function (el) {
      el.classList.toggle('on', el.dataset.era === state.era);
    });
    renderEraPanel();
    applyFilter();
  }

  /* ---------- 筛选 chips ---------- */
  var chips = $('#chips');
  var tagCount = {};
  DATA.COURSE_TAGS.forEach(function (t) { tagCount[t.id] = t.courses.length; });

  function chipHTML(id, label, count, on) {
    return '<button class="chip' + (on ? ' on' : '') + '" data-tag="' + id + '">' +
      esc(label) + ' <b>' + count + '</b></button>';
  }
  chips.innerHTML = chipHTML('all', '全部', DATA.COURSES.length, true) +
    DATA.COURSE_TAGS.map(function (t) {
      return chipHTML(t.id, t.name, tagCount[t.id], false);
    }).join('');

  $$('.chip').forEach(function (c) {
    c.addEventListener('click', function () {
      state.tag = c.dataset.tag;
      state.page = 1;
      $$('.chip').forEach(function (x) { x.classList.toggle('on', x === c); });
      applyFilter();
    });
  });

  /* ---------- 目录行 ---------- */
  var list = $('#catList');

  DATA.COURSES.forEach(function (c, i) {
    var no = 'C-' + String(i + 1).padStart(2, '0');
    var bin = binOf(c.duration);
    var yr = String(c.dt || '').slice(0, 4);
    var ruler = '';
    var coverRuler = '';
    for (var k = 1; k <= 6; k++) {
      ruler += '<i class="' + (k <= bin ? 'f' : '') + '"></i>';
      coverRuler += '<i class="' + (k <= bin ? 'f' : '') + '"></i>';
    }

    /* 教案封面：默认是同色板里的"封面牌"（编号 + 年份 + 课程名 + 时长刻度）；
       若数据里给了 c.cover（图片路径），则直接输出静态 <img>，照片优先。 */
    var cover = c.cover
      ? '<figure class="rb-cover has-img" aria-label="课程封面：' + esc(c.title) + '">' +
          '<img src="' + esc(c.cover) + '" alt="' + esc(c.title) + ' 现场" loading="lazy">' +
          '<span class="cap"><span>' + no + ' · ' + esc(yr) + '</span><span>' + esc(c.duration) + '</span></span>' +
        '</figure>'
      : '<figure class="rb-cover" aria-label="课程封面：' + esc(c.title) + '">' +
          '<span class="ghost" aria-hidden="true">' + esc(yr) + '</span>' +
          '<span class="top"><span>' + no + '</span><span>' + esc(yr) + '</span></span>' +
          '<p class="tt">' + esc(c.title) + '</p>' +
          '<span class="bt">' +
            '<span class="rule" aria-hidden="true">' + coverRuler + '</span>' +
            '<span class="fm">' + esc(c.form) + ' · ' + BINS[bin - 1] + '</span>' +
          '</span>' +
        '</figure>';

    var li = document.createElement('li');
    li.className = 'row';
    li.dataset.era = c.era;
    li.dataset.tags = (tagOf[c.id] || []).join(' ');
    li.innerHTML =
      '<button class="row-head" type="button" aria-expanded="false">' +
        '<span class="cid">' + no + '</span>' +
        '<span class="ctitle">' + esc(c.title) + '<i>' + esc(c.dt) + '</i>' +
          /* 窄屏专用：被隐藏的三列压成一行小字挂标题下，信息不丢 */
          '<span class="cmini">' + esc(c.form) + ' · ' + esc(c.age) + ' · ' + esc(c.duration) + ' · ' + esc(c.scale) + '</span>' +
        '</span>' +
        '<span class="cform">' + esc(c.form) + '</span>' +
        '<span class="cage">' + esc(c.age) + '</span>' +
        '<span class="cdur"><span class="ruler" aria-label="时长刻度 ' + BINS[bin - 1] + '">' + ruler + '</span><em>' + esc(c.duration) + '</em></span>' +
        '<span class="cscale">' + esc(c.scale) + '</span>' +
        '<span class="cv">＋</span>' +
      '</button>' +
      '<div class="row-body"><div>' +
        '<div class="rb-wrap">' +
          cover +
          '<div class="rb-in">' +
            '<div>' +
              '<p class="brief">' + esc(c.brief) + '</p>' +
              '<ul class="ul">' + c.points.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' +
            '</div>' +
            '<div class="side">' +
              '<span class="k">Deliverables · 教具</span>' +
              '<div class="tools-inline">' + c.tools.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' +
              '<p class="outcome"><b>Result · 结果</b>' + esc(c.outcome) + '</p>' +
              '<p class="ev">EVIDENCE ON FILE · ' + esc(c.form) + '</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div></div>';

    li.querySelector('.row-head').addEventListener('click', function () {
      var open = li.classList.toggle('open');
      this.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    list.appendChild(li);
  });

  function applyFilter() {
    var matched = [];
    $$('.row').forEach(function (row) {
      var okTag = (state.tag === 'all') || row.dataset.tags.split(' ').indexOf(state.tag) > -1;
      var okEra = (!state.era) || row.dataset.era === state.era;
      if (okTag && okEra) { matched.push(row); }
    });

    var per = coursePer();
    var pages = Math.max(1, Math.ceil(matched.length / per));
    if (state.page > pages) state.page = pages;
    if (state.page < 1) state.page = 1;
    var from = (state.page - 1) * per;
    var to = from + per;

    $$('.row').forEach(function (row) {
      var i = matched.indexOf(row);
      var show = i > -1 && i >= from && i < to;
      row.hidden = !show;
      if (!show) {
        row.classList.remove('open');
        row.querySelector('.row-head').setAttribute('aria-expanded', 'false');
      }
    });

    var cnt = $('#catCount');
    cnt.textContent = matched.length + ' / ' + DATA.COURSES.length + ' courses';
    renderPager(matched.length, pages);
  }

  /* ---------- 分页器 ---------- */
  function renderPager(total, pages) {
    var info = $('#pgInfo');
    if (info) info.textContent = total + ' 门 · 第 ' + state.page + ' / ' + pages + ' 页';
    var pager = $('#pager');
    if (!pager) return;
    var nums = '';
    for (var i = 1; i <= pages; i++) {
      nums += '<button class="pg-num' + (i === state.page ? ' on' : '') + '" data-pg="' + i + '" type="button"' +
        ' aria-label="第 ' + i + ' 页"' + (i === state.page ? ' aria-current="page"' : '') + '>' + i + '</button>';
    }
    pager.innerHTML =
      '<button class="pg-btn" data-go="-1" type="button" aria-label="上一页"' + (state.page === 1 ? ' disabled' : '') + '>‹</button>' +
      '<div class="pg-nums">' + nums + '</div>' +
      '<button class="pg-btn" data-go="1" type="button" aria-label="下一页"' + (state.page === pages ? ' disabled' : '') + '>›</button>';
  }

  (function bindPager() {
    var pager = $('#pager');
    if (pager) {
      pager.addEventListener('click', function (e) {
        var num = e.target.closest('.pg-num');
        var btn = e.target.closest('.pg-btn');
        if (num) state.page = parseInt(num.dataset.pg, 10);
        else if (btn) state.page += parseInt(btn.dataset.go, 10);
        else return;
        applyFilter();
        var cat = document.getElementById('catalog');
        if (cat) cat.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    var lastPer = coursePer();
    window.addEventListener('resize', function () {
      var per = coursePer();
      if (per === lastPer) return;
      lastPer = per;
      state.page = 1;
      applyFilter();
    });
  })();

  /* ---------- 方法论 ---------- */
  var mi = $('#mIndex'), ml = $('#mList');
  DATA.METHODS.forEach(function (m, i) {
    var no = 'M-' + String(i + 1).padStart(2, '0');
    m._id = 'm-' + (i + 1);
    var a = document.createElement('a');
    a.href = '#' + m._id;
    a.innerHTML = '<span>' + no + '</span>' + esc(m.title);
    mi.appendChild(a);
  });
  ml.innerHTML = DATA.METHODS.map(function (m, i) {
    var no = 'M-' + String(i + 1).padStart(2, '0');
    return '<article class="m-item" id="' + m._id + '">' +
      '<div class="meta"><span>' + no + '</span><b>' + esc(m.title) + '</b><span>' + esc(m.en) + '</span></div>' +
      '<p class="claim' + (m.claim.split('→').length > 4 ? ' long' : '') + '">' + arrowChain(m.claim) + '</p>' +
      '<p class="desc">' + esc(m.desc) + '</p>' +
      '<span class="proof">PROOF · ' + esc(m.proof) + '</span>' +
      '</article>';
  }).join('');

  /* ---------- 形态 ---------- */
  $('#formatGrid').innerHTML = DATA.FORMATS.map(function (f, i) {
    var no = 'F-' + String(i + 1).padStart(2, '0');
    return '<article class="fmt">' +
      '<div class="top"><span class="no">' + no + '</span><span class="en">' + esc(f.en) + '</span></div>' +
      '<h3>' + esc(f.title) + '</h3>' +
      '<p class="claim">' + esc(f.claim) + '</p>' +
      '<p class="desc">' + esc(f.desc) + '</p>' +
      '<ul class="specs">' + f.specs.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
      '<div class="cases"><em>Cases · 案例</em>' + f.cases.map(function (id) {
        var c = courseById[id];
        return c ? esc(c.title) : esc(id);
      }).join(' · ') + '</div>' +
      '</article>';
  }).join('');

  /* ---------- 教具清单 ---------- */
  var cats = [];
  DATA.TOOLKITS.forEach(function (t) { if (cats.indexOf(t.cat) < 0) cats.push(t.cat); });
  var idx = 0;
  $('#toolList').innerHTML = cats.map(function (cat) {
    var rows = DATA.TOOLKITS.filter(function (t) { return t.cat === cat; }).map(function (t) {
      idx++;
      return '<div class="tool-line"><span class="tn">T-' + String(idx).padStart(2, '0') + '</span>' +
        '<span class="tt">' + esc(t.n) + '</span>' +
        '<span class="lead" aria-hidden="true"></span>' +
        '<span class="tf">' + esc(t.from) + '</span></div>';
    }).join('');
    return '<div class="tool-group"><h4>' + esc(cat) + '</h4>' + rows + '</div>';
  }).join('');

  /* ---------- 合作 ---------- */
  $('#partnerList').innerHTML = DATA.PARTNERS.map(function (p) {
    return '<div class="partner"><b>' + esc(p.t) + '</b><p>' + esc(p.d) + '</p></div>';
  }).join('');


  /* ---------- 主题 ---------- */
  var root = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem('scicom-courses-theme'); } catch (e) {}
  var qs = new URLSearchParams(location.search).get('theme');
  var next = qs === 'dark' ? 'dark' : qs === 'paper' ? 'paper' : (saved || 'paper');
  root.setAttribute('data-theme', next);
  var meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', next === 'dark' ? '#0a0e0b' : '#f2f0e7');

  $('#themeBtn').addEventListener('click', function () {
    var t = root.getAttribute('data-theme') === 'dark' ? 'paper' : 'dark';
    root.setAttribute('data-theme', t);
    if (meta) meta.setAttribute('content', t === 'dark' ? '#0a0e0b' : '#f2f0e7');
    try { localStorage.setItem('scicom-courses-theme', t); } catch (e) {}
  });

  /* ---------- 进度条 ---------- */
  var prog = $('#prog');
  function onScroll() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    prog.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- 入场 ----------
     不用 IntersectionObserver：某些内嵌浏览器 / 无头环境里回调会漏，
     漏一次那段内容就永远 opacity:0。改成滚动位置判定，行为可预期。 */
  var rvEls = $$('.rv');
  function revealRv() {
    var h = window.innerHeight || document.documentElement.clientHeight;
    rvEls.forEach(function (el) {
      if (el.classList.contains('in')) return;
      var r = el.getBoundingClientRect();
      if (r.top < h * 0.94 && r.bottom > 0) el.classList.add('in');
    });
  }
  var rvTick = false;
  function onRvScroll() {
    if (rvTick) return;
    rvTick = true;
    window.requestAnimationFrame(function () { revealRv(); rvTick = false; });
  }
  window.addEventListener('scroll', onRvScroll, { passive: true });
  window.addEventListener('resize', onRvScroll);
  window.addEventListener('load', revealRv);
  revealRv();

  /* 初始：默认选中最近一个阶段（当前的），但目录不筛 */
  renderEraPanel();
  applyFilter();

  /* ---------- 右下角：微信二维码 + 回到页首 ---------- */
  (function () {
    var wxBtn = document.getElementById('wxBtn');
    var pop = document.getElementById('wxPop');
    var topBtn = document.getElementById('topBtn');
    if (wxBtn && pop) {
      wxBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var on = pop.classList.toggle('on');
        wxBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
      });
      document.addEventListener('click', function (e) {
        if (!pop.classList.contains('on') || pop.contains(e.target)) return;
        pop.classList.remove('on');
        wxBtn.setAttribute('aria-expanded', 'false');
      });
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' || !pop.classList.contains('on')) return;
        pop.classList.remove('on');
        wxBtn.setAttribute('aria-expanded', 'false');
      });
    }
    if (topBtn) {
      var sync = function () { topBtn.classList.toggle('on', window.scrollY > 480); };
      window.addEventListener('scroll', sync, { passive: true });
      sync();
      topBtn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    }
  })();

})();

