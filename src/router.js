let _routes = [];
let _currentCleanup = null;

export function initRouter(routes) {
  _routes = routes;

  function resolve() {
    const hash = location.hash.replace(/^#/, '') || '/';

    if (_currentCleanup) {
      _currentCleanup();
      _currentCleanup = null;
    }

    const app = document.getElementById('app');

    for (const [pattern, handler] of _routes) {
      const params = matchRoute(pattern, hash);
      if (params) {
        try {
          const result = handler(params);
          if (result && typeof result.then === 'function') {
            result.catch((e) => {
              console.error('Route handler error:', e);
              app.innerHTML = `<div class="error-state"><h2>页面加载失败</h2><p>${e.message}</p><button class="btn btn-primary" onclick="location.reload()">重试</button></div>`;
            });
          }
        } catch (e) {
          console.error('Route handler error:', e);
          app.innerHTML = `<div class="error-state"><h2>页面加载失败</h2><p>${e.message}</p><button class="btn btn-primary" onclick="location.reload()">重试</button></div>`;
        }
        return;
      }
    }

    // 404
    app.innerHTML = `<div class="error-state"><h2>页面未找到</h2><button class="btn btn-primary" id="not-found-home">返回首页</button></div>`;
    document.getElementById('not-found-home').onclick = () => navigate('/');
  }

  window.addEventListener('hashchange', resolve);

  // Resolve initial route
  resolve();
}

export function setCleanup(fn) {
  _currentCleanup = fn;
}

function matchRoute(pattern, hash) {
  const patternParts = pattern.split('/');
  const hashParts = hash.split('/');

  if (patternParts.length !== hashParts.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = decodeURIComponent(hashParts[i]);
    } else if (patternParts[i] !== hashParts[i]) {
      return null;
    }
  }
  return params;
}

export function navigate(path, { replace = false } = {}) {
  const nextHash = '#' + path;
  if (location.hash === nextHash) return;

  if (replace) {
    history.replaceState(null, '', nextHash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }

  location.hash = nextHash;
}

export function getCurrentPath() {
  return location.hash.replace(/^#/, '') || '/';
}
