// Selected works, taken from devchaudhary.com (js/content.js → normal.work).
// Media is served from the live site; to self-host, copy the files into
// /public/work/ and set MEDIA = '/work/'.
const MEDIA = 'https://devchaudhary.com/assets/media/'

export const WORKS = [
  {
    id: 'trustyy',
    title: 'Trustyy',
    caption: 'Shopify app revamp, Trustyy',
    meta: 'Shopify app revamp · UI/UX Designer · 1 month',
    video: `${MEDIA}trustyy.mp4`,
    // Main colour of the video; stands in for it on the page-turn snapshot.
    tone: '#7a6c06',
    body: [
      "A revamp that reached 497 merchants in July. I redesigned Trustyy Reviews from the user's point of view. Not just a UI makeover: I spent a month rethinking the experience, simplifying flows and removing friction.",
    ],
    stats: [
      { value: '497', label: 'merchants (from 390)' },
      { value: '260', label: 'installs in July' },
      { value: '+22%', label: 'merchant growth' },
    ],
    quote: "Good UX isn't about adding more. It's about making the right things easier.",
    tags: ['Shopify App', 'UI/UX Design'],
  },
  {
    id: 'goodex',
    title: 'Goodex',
    caption: 'AI candidate search, Goodex',
    meta: 'AI-powered candidate search · Goodspace AI',
    video: `${MEDIA}goodex.mp4`,
    poster: `${MEDIA}goodex-poster.webp`,
    body: ['Helping recruiters discover the right talent, faster. Find the right talent in one sentence.'],
    points: [
      'Natural-language search: just describe who you need.',
      'Filters auto-detected: role, experience, location, skills.',
      'Review & tweak the filters before you search.',
      'Rich, scannable candidate cards to unlock & save top talent.',
    ],
    tags: ['Internal Tool', 'Early Stage Startup', '0 → 1'],
  },
]
