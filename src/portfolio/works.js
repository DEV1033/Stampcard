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
  {
    id: 'vyanex',
    title: 'VyanEx',
    caption: 'Clinic & check-in apps, VyanEx',
    meta: 'Clinic & check-in apps',
    screens: [
      { src: `${MEDIA}screen-1.webp`, alt: 'VyanEx landing screen' },
      { src: `${MEDIA}screen-5.webp`, alt: 'Check-in timeline screen (light)' },
      { src: `${MEDIA}screen-6.webp`, alt: 'Check-in timeline screen (dark)' },
      { src: `${MEDIA}screen-2.webp`, alt: 'VyanEx patient records screen' },
      { src: `${MEDIA}screen-7.webp`, alt: 'Check-in screen' },
      { src: `${MEDIA}screen-3.webp`, alt: 'VyanEx team management screen' },
      { src: `${MEDIA}screen-4.webp`, alt: 'VyanEx dashboard screen' },
    ],
  },
]
