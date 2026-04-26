(function () {
  if (window.__nexusRouter) return;
  window.__nexusRouter = true;

  function isInternalHtml(url) {
    return url.origin === location.origin && /\.html($|\?|#)/i.test(url.pathname);
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    if (a.target && a.target !== '_self') return;
    if (a.hasAttribute('download')) return;
    var url;
    try { url = new URL(a.href, location.href); } catch (_) { return; }
    if (!isInternalHtml(url)) return;
    if (url.pathname === location.pathname && url.hash) return;
    e.preventDefault();
    navigate(url.href, true);
  });

  window.addEventListener('popstate', function () {
    navigate(location.href, false);
  });

  async function navigate(href, push) {
    var res;
    try {
      res = await fetch(href, { credentials: 'same-origin' });
    } catch (_) {
      location.href = href;
      return;
    }
    var ct = res.headers.get('content-type') || '';
    if (res.redirected || !res.ok || ct.indexOf('text/html') === -1) {
      location.href = res.url || href;
      return;
    }
    var html = await res.text();
    var doc = new DOMParser().parseFromString(html, 'text/html');
    swapInto(doc, href, push);
  }

  function swapInto(doc, href, push) {
    document.title = doc.title;

    var oldMain = document.querySelector('main.main');
    var newMain = doc.querySelector('main.main');
    if (!oldMain || !newMain) { location.href = href; return; }

    document.body.className = doc.body.className;
    var oldApp = document.querySelector('.app');
    var newApp = doc.querySelector('.app');
    if (oldApp && newApp) oldApp.className = newApp.className;

    var mount = document.getElementById('sidebar-mount');
    var newMount = doc.getElementById('sidebar-mount');
    if (mount && newMount && newMount.dataset.path) {
      mount.dataset.path = newMount.dataset.path;
    }

    oldMain.replaceWith(newMain);
    runScripts(newMain);
    addHeadStylesheets(doc);
    runHeadEntryScripts(doc);

    if (push) history.pushState(null, '', href);
    window.dispatchEvent(new CustomEvent('nexus:navigated', {
      detail: { path: new URL(href, location.href).pathname },
    }));
  }

  // Vite hoists each page's entry script and stylesheet into <head>.
  // swapInto only re-runs scripts inside <main>, so we replicate the head:
  // dynamic-import any new module script, link-tag any new stylesheet.
  // Both sets are seeded with what's already loaded so we never duplicate.
  var loaded = { entry: Object.create(null), css: Object.create(null) };
  (function seed() {
    document.querySelectorAll('head script[type="module"][src]').forEach(function (s) {
      loaded.entry[new URL(s.src, location.href).href] = true;
    });
    document.querySelectorAll('head link[rel="stylesheet"][href]').forEach(function (l) {
      loaded.css[new URL(l.href, location.href).href] = true;
    });
  })();
  function addHeadStylesheets(doc) {
    doc.querySelectorAll('head link[rel="stylesheet"][href]').forEach(function (l) {
      var href = new URL(l.href, location.href).href;
      if (loaded.css[href]) return;
      loaded.css[href] = true;
      var n = document.createElement('link');
      n.rel = 'stylesheet'; n.href = href;
      if (l.crossOrigin) n.crossOrigin = l.crossOrigin;
      document.head.appendChild(n);
    });
  }
  function runHeadEntryScripts(doc) {
    doc.querySelectorAll('head script[type="module"][src]').forEach(function (s) {
      var src = new URL(s.src, location.href).href;
      if (loaded.entry[src]) return;
      loaded.entry[src] = true;
      import(/* @vite-ignore */ src).catch(function (e) { console.error('entry import failed', src, e); });
    });
  }

  function runScripts(root) {
    var scripts = Array.prototype.slice.call(root.querySelectorAll('script'));
    scripts.forEach(function (old) {
      var isModule = (old.type || '').toLowerCase() === 'module';
      // Modules: if the bundle has already loaded once, it will have registered a
      // global remount hook on window.__nexusMounts keyed by its src. Call that
      // instead of re-downloading. Otherwise load the module normally (first visit).
      if (isModule && old.src) {
        var srcUrl = new URL(old.src, location.href);
        var key = srcUrl.pathname;
        var mounts = window.__nexusMounts || {};
        if (mounts[key]) { try { mounts[key](); } catch (e) { console.error(e); } old.remove(); return; }
      }
      var s = document.createElement('script');
      for (var i = 0; i < old.attributes.length; i++) {
        var at = old.attributes[i];
        s.setAttribute(at.name, at.value);
      }
      if (isModule && old.src) {
        // First-ever load of this bundle in this session — no busting needed;
        // subsequent navigations use the __nexusMounts hook above.
        s.src = old.src;
      } else if (old.src) {
        // Plain scripts: re-executing via a fresh tag works and uses HTTP cache.
        s.src = old.src;
      } else {
        s.textContent = old.textContent;
      }
      old.replaceWith(s);
    });
  }
})();
