let routes = [];

/**
 * Initialize the hash-based router.
 * @param {Array<[string, Function]>} routeList - Array of [pattern, handler] pairs
 */
export function initRouter(routeList) {
  routes = routeList;
  
  function resolve() {
    const hash = window.location.hash.slice(1) || '/';
    for (const [pattern, handler] of routes) {
      const params = matchRoute(pattern, hash);
      if (params !== null) {
        handler(params);
        return;
      }
    }
    // Fallback: try the home route
    const home = routes.find(([p]) => p === '/');
    if (home) home[1]({});
  }
  
  window.addEventListener('hashchange', resolve);
  resolve();
}

/**
 * Navigate to a path (updates window.location.hash).
 */
export function navigate(path) {
  window.location.hash = path;
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
