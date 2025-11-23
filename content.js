// X Location Reveal - Content Script
// Shows country flag tooltips on hover over usernames, profile pictures, and names

// ============================================================================
// CACHE & RATE LIMITING
// ============================================================================

// Persistent cache for 30 days
let locationCache = new Map();
const CACHE_KEY = 'x_location_cache';
const CACHE_EXPIRY_DAYS = 30;

// Rate limiting - 800ms between requests
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 800;
const requestQueue = [];
let isProcessingQueue = false;
let rateLimitResetTime = 0;

// Track pending requests to avoid duplicates
const pendingRequests = new Map();

// ============================================================================
// TOOLTIP MANAGEMENT
// ============================================================================

let currentTooltip = null;
let tooltipTimeout = null;
let currentHoveredElement = null;

// Create tooltip element
function createTooltip() {
  const tooltip = document.createElement('div');
  tooltip.id = 'x-location-tooltip';
  tooltip.style.cssText = `
    position: fixed;
    background: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    z-index: 999999;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    opacity: 0;
    transition: opacity 0.3s ease;
    white-space: nowrap;
  `;
  document.body.appendChild(tooltip);
  return tooltip;
}

// Show tooltip at cursor position
function showTooltip(x, y, flag, countryName) {
  if (!currentTooltip) {
    currentTooltip = createTooltip();
  }

  currentTooltip.textContent = `${flag} ${countryName}`;
  currentTooltip.style.left = `${x + 15}px`;
  currentTooltip.style.top = `${y + 15}px`;
  
  // Trigger reflow for animation
  currentTooltip.offsetHeight;
  currentTooltip.style.opacity = '1';
}

// Update tooltip position as cursor moves
function updateTooltipPosition(x, y) {
  if (currentTooltip && currentTooltip.style.opacity === '1') {
    currentTooltip.style.left = `${x + 15}px`;
    currentTooltip.style.top = `${y + 15}px`;
  }
}

// Hide tooltip
function hideTooltip() {
  if (currentTooltip) {
    currentTooltip.style.opacity = '0';
    setTimeout(() => {
      if (currentTooltip && currentTooltip.style.opacity === '0') {
        currentTooltip.remove();
        currentTooltip = null;
      }
    }, 300);
  }
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

// Load cache from storage
async function loadCache() {
  try {
    if (!chrome.runtime?.id) return;

    const result = await chrome.storage.local.get(CACHE_KEY);
    if (result[CACHE_KEY]) {
      const cached = result[CACHE_KEY];
      const now = Date.now();

      for (const [username, data] of Object.entries(cached)) {
        if (data.expiry && data.expiry > now && data.location !== null) {
          locationCache.set(username, data.location);
        }
      }
      console.log(`[X Location Reveal] Loaded ${locationCache.size} cached locations`);
    }
  } catch (error) {
    if (!error.message?.includes('Extension context invalidated')) {
      console.error('[X Location Reveal] Error loading cache:', error);
    }
  }
}

// Save cache to storage (debounced)
let saveCacheTimeout = null;
async function saveCache() {
  try {
    if (!chrome.runtime?.id) return;

    const cacheObj = {};
    const now = Date.now();
    const expiry = now + (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    for (const [username, location] of locationCache.entries()) {
      cacheObj[username] = {
        location: location,
        expiry: expiry,
        cachedAt: now
      };
    }

    await chrome.storage.local.set({ [CACHE_KEY]: cacheObj });
  } catch (error) {
    if (!error.message?.includes('Extension context invalidated')) {
      console.error('[X Location Reveal] Error saving cache:', error);
    }
  }
}

function debouncedSaveCache() {
  if (saveCacheTimeout) clearTimeout(saveCacheTimeout);
  saveCacheTimeout = setTimeout(saveCache, 5000);
}

// ============================================================================
// PAGE SCRIPT INJECTION
// ============================================================================

function injectPageScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('pageScript.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);

  // Listen for rate limit info
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.type === '__rateLimitInfo') {
      rateLimitResetTime = event.data.resetTime;
      console.log(`[X Location Reveal] Rate limited. Resuming in ${Math.ceil(event.data.waitTime / 1000 / 60)} minutes`);
    }
  });
}

// ============================================================================
// API REQUEST HANDLING
// ============================================================================

// Process request queue with rate limiting
async function processRequestQueue() {
  if (isProcessingQueue || requestQueue.length === 0) return;

  // Check rate limit
  if (rateLimitResetTime > 0) {
    const now = Math.floor(Date.now() / 1000);
    if (now < rateLimitResetTime) {
      const waitTime = (rateLimitResetTime - now) * 1000;
      setTimeout(processRequestQueue, Math.min(waitTime, 60000));
      return;
    } else {
      rateLimitResetTime = 0;
    }
  }

  isProcessingQueue = true;

  while (requestQueue.length > 0) {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }

    const { screenName, resolve, reject } = requestQueue.shift();
    lastRequestTime = Date.now();

    makeLocationRequest(screenName)
      .then(location => resolve(location))
      .catch(error => reject(error))
      .finally(() => {
        setTimeout(processRequestQueue, 100);
      });
  }

  isProcessingQueue = false;
}

// Make API request via page script
function makeLocationRequest(screenName) {
  return new Promise((resolve, reject) => {
    const requestId = Date.now() + Math.random();

    const handler = (event) => {
      if (event.source !== window) return;

      if (event.data && 
          event.data.type === '__locationResponse' &&
          event.data.screenName === screenName && 
          event.data.requestId === requestId) {
        window.removeEventListener('message', handler);
        const location = event.data.location;
        const isRateLimited = event.data.isRateLimited || false;

        // Cache only if not rate limited
        if (!isRateLimited && location) {
          locationCache.set(screenName, location);
          debouncedSaveCache();
        }

        resolve(location || null);
      }
    };
    window.addEventListener('message', handler);

    window.postMessage({
      type: '__fetchLocation',
      screenName,
      requestId
    }, '*');

    // Timeout after 10 seconds
    setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve(null);
    }, 10000);
  });
}

// Get user location (with caching and rate limiting)
async function getUserLocation(screenName) {
  // Check cache first
  if (locationCache.has(screenName)) {
    const cached = locationCache.get(screenName);
    if (cached !== null) {
      return cached;
    }
  }

  // Check if already pending
  if (pendingRequests.has(screenName)) {
    return pendingRequests.get(screenName);
  }

  // Queue new request
  const promise = new Promise((resolve, reject) => {
    requestQueue.push({ screenName, resolve, reject });
    processRequestQueue();
  });

  pendingRequests.set(screenName, promise);
  
  try {
    const result = await promise;
    return result;
  } finally {
    pendingRequests.delete(screenName);
  }
}

// ============================================================================
// USERNAME EXTRACTION
// ============================================================================

function extractUsername(element) {
  // Strategy 1: Check for username link in element or parents
  let current = element;
  for (let i = 0; i < 5; i++) {
    if (!current) break;

    const links = current.querySelectorAll('a[href^="/"]');
    for (const link of links) {
      const href = link.getAttribute('href');
      const match = href.match(/^\/([^\/\?]+)/);
      if (match && match[1]) {
        const username = match[1];
        const excludedRoutes = ['home', 'explore', 'notifications', 'messages', 'i', 'compose', 'search', 'settings', 'hashtag'];
        if (!excludedRoutes.includes(username) && username.length > 0 && username.length < 20) {
          return username;
        }
      }
    }

    current = current.parentElement;
  }

  return null;
}

// ============================================================================
// HOVER EVENT HANDLERS
// ============================================================================

async function handleMouseEnter(event) {
  const element = event.currentTarget;
  currentHoveredElement = element;

  // Clear any existing timeout
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout);
    tooltipTimeout = null;
  }

  const screenName = extractUsername(element);
  if (!screenName) return;

  // Get location (from cache or API)
  const location = await getUserLocation(screenName);
  if (!location) return;

  // Check if still hovering the same element
  if (currentHoveredElement !== element) return;

  // Get flag
  const flag = getCountryFlag(location);
  if (!flag) return;

  // Show tooltip at current cursor position
  showTooltip(event.clientX, event.clientY, flag, location);
}

function handleMouseMove(event) {
  updateTooltipPosition(event.clientX, event.clientY);
}

function handleMouseLeave(event) {
  const element = event.currentTarget;
  
  if (currentHoveredElement === element) {
    currentHoveredElement = null;
  }

  // Small delay before hiding to prevent flicker
  if (tooltipTimeout) clearTimeout(tooltipTimeout);
  tooltipTimeout = setTimeout(() => {
    hideTooltip();
  }, 50);
}

// ============================================================================
// ELEMENT ATTACHMENT
// ============================================================================

function attachHoverListeners(element) {
  if (element.dataset.xLocationAttached === 'true') return;
  element.dataset.xLocationAttached = 'true';

  element.addEventListener('mouseenter', handleMouseEnter);
  element.addEventListener('mousemove', handleMouseMove);
  element.addEventListener('mouseleave', handleMouseLeave);
}

function processElements() {
  // Find all hoverable elements: usernames, profile pictures, display names
  const selectors = [
    'a[href^="/"][role="link"]',  // Username links
    'div[data-testid="UserAvatar-Container-"]', // Profile pictures
    'div[data-testid="User-Name"]', // User name containers
    'article[data-testid="tweet"]' // Tweets (will extract username from within)
  ];

  const elements = document.querySelectorAll(selectors.join(', '));
  
  elements.forEach(element => {
    // Only attach to elements that likely contain usernames
    const username = extractUsername(element);
    if (username) {
      attachHoverListeners(element);
    }
  });
}

// ============================================================================
// MUTATION OBSERVER
// ============================================================================

let observer = null;

function initObserver() {
  if (observer) observer.disconnect();

  observer = new MutationObserver((mutations) => {
    let shouldProcess = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        shouldProcess = true;
        break;
      }
    }

    if (shouldProcess) {
      setTimeout(processElements, 300);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

async function init() {
  console.log('[X Location Reveal] Extension initialized');

  // Load cache
  await loadCache();

  // Inject page script
  injectPageScript();

  // Process initial elements
  setTimeout(processElements, 2000);

  // Set up observer
  initObserver();

  // Handle SPA navigation
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      setTimeout(processElements, 2000);
    }
  }).observe(document, { subtree: true, childList: true });

  // Periodic cache save
  setInterval(saveCache, 30000);
}

// Start when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
