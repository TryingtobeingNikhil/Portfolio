/* ============================================================================
   Articles shown in the Writing section (and in ⌘K search).

   To add a new article:
     1. Copy any line below and paste it into the right series.
     2. Change the title, url, date and views (views are optional; update them
        whenever you like, and the totals on the site recalculate).
     3. Save, commit, push. Netlify redeploys in about 30 seconds.

   Parts inside a series are listed in reading order (Part 1 first).
   To start a new series, add a new block with its own name.
   ========================================================================== */

window.ARTICLES = [
  {
    series: 'Inference engine',
    numbered: true,
    items: [
      { title: 'Why the naive way breaks',        url: 'https://x.com/i/article/2076614881672069120', date: '2026-07-13', views: 2854 },
      { title: 'Continuous batching',             url: 'https://x.com/i/article/2077328696772640768', date: '2026-07-16', views: 5811 },
      { title: 'The request queue',               url: 'https://x.com/i/article/2078781579464421376', date: '2026-07-19', views: 1831 },
      { title: 'Prefill vs decode',               url: 'https://x.com/i/article/2080620281383522304', date: '2026-07-24', views: 1178 },
      { title: 'Block allocator / paged KV',      url: 'https://x.com/i/article/2082060121384050688', date: '2026-07-28', views: 1248 },
      { title: 'Paged KV cache inside attention', url: 'https://x.com/i/article/2083183456272756736', date: '2026-07-31', views: 1700 },
      { title: 'Preemption / CPU swap',           url: 'https://x.com/i/article/2086066627808837632', date: '2026-08-08', views: 612 },
      { title: 'Measuring it',                    url: 'https://x.com/i/article/2087502057842642944', date: '2026-08-12', views: 538 },
    ],
  },
  {
    series: 'RLForge',
    numbered: true,
    items: [
      { title: 'Environment contract: terminated vs truncated', url: 'https://x.com/i/article/2088559226566377472', date: '2026-08-17', views: 2802 },
      { title: 'Vector envs and the auto-reset bug',            url: 'https://x.com/i/article/2090741526725009408', date: '2026-08-21', views: 1285 },
      { title: 'Replay buffer',                                 url: 'https://x.com/i/article/2093701924617121792', date: '2026-08-29', views: 3111 },
      { title: 'Agent, trainer and tabular Q-learning',         url: 'https://x.com/i/article/2101771071162867712', date: '2026-09-21', views: 721 },
      { title: 'Tensors: storage, shape, forward ops',          url: 'https://x.com/i/article/2103826733950767104', date: '2026-09-26', views: 1079 },
    ],
  },
  {
    series: 'Essays & algorithms',
    numbered: false, // shows the tag instead of a part number
    items: [
      { tag: 'Essay', title: "Why vLLM is fast: PagedAttention isn't the whole story", url: 'https://x.com/i/article/2096296193731256321', date: '2026-09-06', views: 4185 },
      { tag: 'RL',    title: 'Q-Learning',                                             url: 'https://x.com/i/article/2091287834892419072', date: '2026-08-23', views: 2131 },
      { tag: 'RL',    title: 'SARSA',                                                  url: 'https://x.com/i/article/2092127609761226753', date: '2026-08-25', views: 890 },
      { tag: 'RL',    title: 'Deep Q-Network (DQN)',                                   url: 'https://x.com/i/article/2094331060444385280', date: '2026-08-31', views: 806 },
      { tag: 'RL',    title: 'REINFORCE',                                              url: 'https://x.com/i/article/2095804674058440704', date: '2026-09-04', views: 271 },
      { tag: 'Guide', title: 'A plain-English guide to Jev (TypeSafe AI)',             url: 'https://x.com/i/article/2101270137412411392', date: '2026-09-19', views: 608 },
    ],
  },
];
