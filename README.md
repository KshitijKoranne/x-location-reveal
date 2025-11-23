# X Location Reveal - Installation Guide

## Quick Install

1. **Download the Extension**
   - Clone or download this repository to your computer

2. **Open Chrome Extensions**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the `X-Location-Reveal` folder

4. **Start Using**
   - Visit [x.com](https://x.com) or [twitter.com](https://twitter.com)
   - Hover over any username, profile picture, or display name
   - See the country flag tooltip appear!

## Requirements

- Google Chrome or any Chromium-based browser
- Must be logged into X/Twitter

## How It Works

When you hover over usernames, the extension:
1. Checks the local cache (30-day expiry)
2. If not cached, queries Twitter's GraphQL API
3. Displays a beautiful tooltip with flag + country name
4. Caches the result for future use

## Features

✅ **Hover Tooltips** - No visual clutter, only shows on hover  
✅ **Aggressive Caching** - 30-day cache, minimal API calls  
✅ **Rate Limit Protection** - 800ms throttle, handles 429 gracefully  
✅ **Works Everywhere** - Tweets, profiles, search, notifications  
✅ **Smooth Animations** - Cursor-following tooltip with fade effects  
✅ **Dark/Light Mode** - Adapts to your theme

## Privacy

- Only queries public account information
- No data sent to third-party servers
- All API requests go directly to X/Twitter
- Cache stored locally in your browser

## Troubleshooting

**Tooltips not appearing?**
- Make sure you're logged into X/Twitter
- Check browser console for errors
- The account may not have location data set

**Rate limited?**
- Extension automatically handles this
- Cached data will still show
- Wait a few minutes and try again

## License

MIT
