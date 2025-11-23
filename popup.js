// X Location Reveal - Popup Script

const CACHE_KEY = 'x_location_cache';

// Country name to flag emoji mapping (subset for popup)
const COUNTRY_FLAGS = {
  "Afghanistan": "🇦🇫", "Albania": "🇦🇱", "Algeria": "🇩🇿", "Argentina": "🇦🇷",
  "Australia": "🇦🇺", "Austria": "🇦🇹", "Bangladesh": "🇧🇩", "Belgium": "🇧🇪",
  "Brazil": "🇧🇷", "Canada": "🇨🇦", "Chile": "🇨🇱", "China": "🇨🇳",
  "Colombia": "🇨🇴", "Czech Republic": "🇨🇿", "Denmark": "🇩🇰", "Egypt": "🇪🇬",
  "Europe": "🇪🇺", "Finland": "🇫🇮", "France": "🇫🇷", "Germany": "🇩🇪",
  "Greece": "🇬🇷", "Hong Kong": "🇭🇰", "Hungary": "🇭🇺", "India": "🇮🇳",
  "Indonesia": "🇮🇩", "Iran": "🇮🇷", "Iraq": "🇮🇶", "Ireland": "🇮🇪",
  "Israel": "🇮🇱", "Italy": "🇮🇹", "Japan": "🇯🇵", "Kenya": "🇰🇪",
  "Malaysia": "🇲🇾", "Mexico": "🇲🇽", "Netherlands": "🇳🇱", "New Zealand": "🇳🇿",
  "Nigeria": "🇳🇬", "Norway": "🇳🇴", "Pakistan": "🇵🇰", "Philippines": "🇵🇭",
  "Poland": "🇵🇱", "Portugal": "🇵🇹", "Romania": "🇷🇴", "Russia": "🇷🇺",
  "Saudi Arabia": "🇸🇦", "Singapore": "🇸🇬", "South Africa": "🇿🇦", "Korea": "🇰🇷",
  "South Korea": "🇰🇷", "Spain": "🇪🇸", "Sweden": "🇸🇪", "Switzerland": "🇨🇭",
  "Taiwan": "🇹🇼", "Thailand": "🇹🇭", "Turkey": "🇹🇷", "Ukraine": "🇺🇦",
  "United Arab Emirates": "🇦🇪", "United Kingdom": "🇬🇧", "United States": "🇺🇸",
  "Venezuela": "🇻🇪", "Vietnam": "🇻🇳"
};

function getCountryFlag(countryName) {
  if (!countryName) return '🌍';
  
  if (COUNTRY_FLAGS[countryName]) {
    return COUNTRY_FLAGS[countryName];
  }
  
  const normalized = countryName.trim();
  for (const [country, flag] of Object.entries(COUNTRY_FLAGS)) {
    if (country.toLowerCase() === normalized.toLowerCase()) {
      return flag;
    }
  }
  
  return '🌍';
}

async function loadCacheStats() {
  try {
    const result = await chrome.storage.local.get(CACHE_KEY);
    const cache = result[CACHE_KEY] || {};
    
    const now = Date.now();
    const validEntries = Object.entries(cache).filter(([_, data]) => {
      return data.expiry && data.expiry > now && data.location !== null;
    });

    // Update count
    document.getElementById('cacheCount').textContent = validEntries.length;

    // Display recent profiles (last 10)
    const cacheItemsContainer = document.getElementById('cacheItems');
    
    if (validEntries.length === 0) {
      cacheItemsContainer.innerHTML = '<div class="empty-state">No profiles cached yet. Hover over usernames on X/Twitter!</div>';
      return;
    }

    // Sort by most recently cached
    validEntries.sort((a, b) => (b[1].cachedAt || 0) - (a[1].cachedAt || 0));

    // Take top 10
    const recentEntries = validEntries.slice(0, 10);

    cacheItemsContainer.innerHTML = recentEntries.map(([username, data]) => {
      const flag = getCountryFlag(data.location);
      return `
        <div class="cache-item">
          <span class="cache-username">@${username}</span>
          <span class="cache-location">
            <span>${flag}</span>
            <span>${data.location}</span>
          </span>
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error('Error loading cache stats:', error);
    document.getElementById('cacheCount').textContent = '0';
  }
}

// Load stats on popup open
document.addEventListener('DOMContentLoaded', loadCacheStats);
