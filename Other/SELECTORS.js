  const SELECTORS = {
    bing: {
      match: /^(?:(?:www[2-4]?|cn|global|m)\.)?bing\.(?:com|[a-z]{2,3}(?:\.[a-z]{2})?)$/,
      containers: 'li.b_algo, div.b_algo',
      titles: ['h2 a', 'a h2', '.b_title'],
      snippets: ['.b_caption p', '.b_snippet', '.b_paractl p', '.b_lineclamp2'],
      links: 'a[href]',
    },
    google_scholar: {
      match: /^(?:www\.)?scholar\.google\.(?:[a-z]{2,3}(?:\.[a-z]{2})?|[a-z]{4,})$/,
      containers: 'div.gs_r.gs_or.gs_scl',
      titles: ['h3.gs_rt a', 'h3.gs_rt', '.gs_rt'],
      snippets: ['.gs_rs'],
      links: ['h3.gs_rt a[href]', 'a[href]'],
    },
    google: {
      match: /^(?:(?:www|images|video|videos|search|encrypted|m)\.)?google\.(?:[a-z]{2,3}(?:\.[a-z]{2})?|[a-z]{4,})$/,
      containers: 'div.g, div.MjjYud',
      titles: ['h3', 'div[role="heading"]', '.LC20lb', '.DKV0Md', '.sXLaOe', '.c9DxTc', 'a h3'],
      snippets: ['.st', '.VwiC3b', '.s3v9rd', '.IsZvec', '.lyLwlc', '.yXK7lf'],
      links: 'a[href]',
    },
    duckduckgo_lite: {
      match: /^lite\.duckduckgo\.com$/,
      containers: 'tr:has(.result-link)',
      titles: ['.result-link'],
      snippets: ['.result-snippet'],
      links: ['a.result-link[href]'],
      extraElements: [
        '+ tr:not(:has(.result-link))',
        '+ tr:not(:has(.result-link)) + tr:not(:has(.result-link))',
        '+ tr:not(:has(.result-link)) + tr:not(:has(.result-link)) + tr:not(:has(.result-link))',
      ],
    },
    duckduckgo: {
      match: /^(?:(?:www|html|start|m|safe|noai)\.)?(?:duckduckgo\.com|ddg\.gg)$/,
      containers: '[data-testid="result"], [data-testid="web-vertical"] li > article, .result, .web-result, .tile',
      titles: ['a[data-testid="result-title-a"]', '.result__title', '.tile__title', '.tile--title__title', 'h2 a', 'a h2', 'h2'],
      snippets: ['[data-testid="result-snippet"]', '[data-result="snippet"]', '.result__snippet'],
      links: ['a[data-testid="result-extras-url-link"]', 'a[data-testid="result-title-a"]', 'h2 > a', '.result__url', 'a[href]'],
    },
    yandex: {
      match: /^(?:(?:www|m)\.)?(?:ya\.ru|yandex\.(?:[a-z]{2,3}(?:\.[a-z]{2})?|[a-z]{4,}))$/,
      containers: 'div.Organic',
      titles: ['.OrganicTitle'],
      snippets: ['.OrganicText'],
      links: ['.OrganicTitle a', '.Path-Item a', 'a.Link', 'a[href]'],
    },
    brave: {
      match: /^search\.brave\.com$/,
      containers: '.snippet[data-type="web"], .snippet[data-type="news"], .snippet[data-type="videos"], .image-wrapper',
      titles: ['.title', '.snippet-title', '.img-title'],
      snippets: ['.generic-snippet .content', '.generic-snippet', '.line-clamp-dynamic', '.snippet-description', '.description'],
      links: ['a[href]'],
    },
    yahoo: {
      match: /^(?:[a-z]{2,6}\.)?(?:(?:images|video|videos|news)\.)?(?:r\.)?search\.yahoo\.(?:com|[a-z]{2,3}(?:\.[a-z]{2})?)$/,
      containers: '.sw-Card.Algo, li.b_algo, div.b_algo, #web .algo, .algo-sr, .richAlgo',
      titles: ['h3', '.s-title', 'h2 a', 'a h2', '.b_title', '.title'],
      snippets: ['.sw-Card__description', '.sw-Card__snippet', '.sw-Text__body', 'p', '.b_caption p', '.b_snippet', '.b_paractl p'],
      links: ['h3 a', '.s-title', '.sw-Card__title a', 'a[data-ylk*="slk:title"]', 'a.ac-algo', 'a[data-y-link-id]'],
    },
    other: {
      containers: '',
      titles: [],
      snippets: [],
      links: 'a[href]',
    }
  };
