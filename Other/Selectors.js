bing: {
  includeRegex: /^https?:\/\/(?:(?:www[2-4]?|cn|global|m)\.)?bing\.(?:com|[a-z]{2,3}(?:\.[a-z]{2})?)(?::\d+)?(?:[/?#]|$)/i,
  root: 'li.b_algo, div.b_algo',
  url: ['or', [['rejectOpaqueRedirect', ['attribute', 'href', 'a:has(> h2)[href], .b_algoheader a[href], h2 a[href]']], ['normalizeUrl', ['rejectEngineHost', ['domainToUrl', ['text', '.b_attribution, .b_algoheader cite, cite']]]], ['attribute', 'href', 'a:has(> h2)[href], .b_algoheader a[href], h2 a[href]']]],
  title: ['or', [['text', 'h2 a'], ['text', 'a h2'], ['text', '.b_title'], ['text', '.mc_vtvc_title'], ['text', 'a.title']]],
  snippet: ['or', [['text', '.b_caption p'], ['text', '.b_snippet'], ['text', '.b_paractl p'], ['text', '.b_lineclamp2'], ['text', '.mc_vtvc_meta'], ['text', '.snippet']]],
  button: { inset: { top: '10px', right: '5px' } },
  command: { link: { redirects: [{ path: /^\/ck\/a/, params: ['u'], codec: 'base64url', stripPrefix: /^a[01]/i }] } },
  pages: {
    images: {
      includeRegex: /^https?:\/\/images\.|^https?:\/\/[^/?#]+\/images(?:[/?#]|$)/i,
      button: false,
      root: 'li:has(div.iuscp), div.iuscp, div.imgpt',
      url: ['or', [['json', 'm', 'purl', 'a.iusc'], ['json', 'm', 'murl', 'a.iusc'], ['attribute', 'href', 'a[href]']]],
      title: ['or', [['json', 'm', 't', 'a.iusc'], ['attribute', 'alt', 'img[alt]']]],
      command: { grid: { cell: 'li', items: ['div.iuscp, div.imgpt'], has: 'a.iusc', deepest: true }, dedupeBy: 'a.iusc' }
    },
    videos: {
      includeRegex: /^https?:\/\/[^/?#]+\/videos?(?:[/?#]|$)/i,
      root: 'div.mc_vtvc',
      url: ['or', [['attribute', 'ourl', '[ourl]'], ['attribute', 'href', 'a.mc_vtvc_link[href]'], ['attribute', 'href', 'a[href]']]],
      title: ['text', '.mc_vtvc_title'],
    },
    news: {
      includeRegex: /^https?:\/\/[^/?#]+\/news(?:[/?#]|$)/i,
      root: 'div.news-card, .newscard',
      url: ['or', [['attribute', 'href', 'a.title[href]'], ['attribute', 'data-url', '[data-url]'], ['attribute', 'url', '[url]'], ['attribute', 'href', 'a[href]']]],
      title: ['text', 'a.title'],
    }
  },
},
google_scholar: {
  includeRegex: /^https?:\/\/(?:www\.)?scholar\.google\.(?:[a-z]{2,3}(?:\.[a-z]{2})?|[a-z]{4,})(?::\d+)?(?:[/?#]|$)/i,
  priority: 10,
  root: 'div.gs_r.gs_or.gs_scl',
  url: ['or', [['attribute', 'href', 'h3.gs_rt a[href]'], ['attribute', 'href', 'a[href]']]],
  title: ['or', [['text', 'h3.gs_rt a'], ['text', 'h3.gs_rt'], ['text', '.gs_rt']]],
  snippet: ['text', '.gs_rs'],
  command: { link: { redirects: [{ path: /\/scholar_url\/?$/, params: ['url'], codec: 'url' }] } },
},
google: {
  includeRegex: /^https?:\/\/(?:(?:www|images|video|videos|search|encrypted|m)\.)?google\.(?:[a-z]{2,3}(?:\.[a-z]{2})?|[a-z]{4,})(?::\d+)?\//i,
  excludeRegex: /^https?:\/\/[^/]+\/(?!(?:search|webhp|imghp|videohp)(?:[/?#]|$)|[?#]|$)/i,
  root: 'div.g, div.MjjYud:not(:has(#m-x-content)):not(:has(span.mgAbYb)):has(a[href])',
  url: ['or', [['rejectOpaqueRedirect', ['attribute', 'href', 'a[href]']], ['rejectEngineHost', ['domainToUrl', ['text', '.lJQCTe, .XVWGNd, .R8BTeb, span.ob9lvb, .eip8Bb']]], ['rejectEngineHost', ['domainToUrl', ['text', 'cite']]], ['attribute', 'href', 'a[href]']]],
  title: ['or', [['text', 'h3'], ['text', 'div[role="heading"]'], ['text', '.LC20lb'], ['text', '.DKV0Md'], ['text', '.sXLaOe'], ['text', '.c9DxTc'], ['text', 'a h3']]],
  snippet: ['or', [['text', '.st'], ['text', '.VwiC3b'], ['text', '.s3v9rd'], ['text', '.IsZvec'], ['text', '.lyLwlc'], ['text', '.yXK7lf'], ['text', '.ITZIwc']]],
  button: { scope: '#center_col', require: 'h3', requireSelf: 'g-img, .isv-r, .ivg-i', exclude: 'g-scrolling-carousel, #hdtb, #appbar, #searchform, #top_nav, #extabar, .isv-r, .ivg-i, .image-section, g-img, .is-extra-container' },
  command: {
    skip: '.sys_algo_rs, .AlsoTry_M, [data-yga*="sugg"]',
    group: { container: 'div.MjjYud', members: 'div.g, div.tF2Cxc, div.MjjYud' },
    preserveSpace: { container: '#rcnt, #rso' },
    blockedCss: ['.g.serh-blocked-visible, .MjjYud.serh-blocked-visible { background-color: var(--serh-blocked-bg) !important; border-radius: 8px !important; padding: 8px !important; transition: background 0.2s; }', '.serh-blocked-visible .yuRUbf, .serh-blocked-visible div[data-sokoban-container], .serh-blocked-visible div[data-snc] { background-color: transparent !important; background: transparent !important; background-image: none !important; }'],
    link: {
      redirects: [{ path: /^\/(?:url|goto)\/?$/, params: ['q', 'url', 'u'], codec: 'url' }, { path: /^(?:\/aclk|\/imgres|\/translate|\/pagead\/aclk)(?:\/|\?|$)/, params: ['adurl', 'imgurl', 'url', 'u', 'dest'], codec: 'url' }]
    }
  },
  pages: {
    images: {
      includeRegex: /^https?:\/\/(?:images\.google\.|(?:www\.)?google\.[^/]+\/(?:imghp|imgres)(?:[/?#]|$))|[?&](?:tbm=(?:isch|imgs)|udm=(?:2|imgs))(?:&|#|$)/i,
      button: false,
      root: 'div.ivg-i, div[data-attrid="images universal"], div.isv-r',
      url: ['or', [['attribute', 'data-lpage', '[data-lpage]'], ['queryParam', 'imgurl', ['attribute', 'href', 'a[href*="/imgres"]']], ['attribute', 'href', 'a[href]']]],
      title: ['or', [['attribute', 'alt', 'img[alt]'], ['attribute', 'alt', 'img']]],
      command: { grid: { anchor: 'grid', items: ['div.isv-r, div.ivg-i', 'div[data-attrid="images universal"]'] } }
    },
    videos: {
      includeRegex: /^https?:\/\/(?:videos?\.google\.|(?:www\.)?google\.[^/]+\/videohp(?:[/?#]|$))|[?&](?:tbm=(?:vid|vids)|udm=(?:7|vids))(?:&|#|$)/i,
      root: 'div.PmEWq, div.MjjYud:has(a[href]):not(:has(div.PmEWq))',
      url: ['or', [['attribute', 'data-curl', '[data-curl]'], ['attribute', 'href', 'a[href]']]],
    },
    news: { includeRegex: /[?&](?:tbm=nws|udm=12)(?:&|#|$)/i, root: 'a.aJWbwf, [data-news-cluster-id]', url: ['or', [['attribute', 'href'], ['attribute', 'href', 'a[href]']]] }
  },
},
duckduckgo_lite: {
  includeRegex: /^https?:\/\/lite\.duckduckgo\.com(?::\d+)?(?:[/?#]|$)/i,
  root: 'tr:has(.result-link)',
  url: ['attribute', 'href', 'a.result-link[href]'],
  title: ['text', '.result-link'],
  snippet: ['text', '.result-snippet'],
  extraSelector: '& + tr:not(:has(.result-link)), & + tr:not(:has(.result-link)) + tr:not(:has(.result-link)), & + tr:not(:has(.result-link)) + tr:not(:has(.result-link)) + tr:not(:has(.result-link))',
},
duckduckgo: {
  includeRegex: /^https?:\/\/(?:(?:www|html|start|m|safe|noai)\.)?(?:duckduckgo\.com|ddg\.gg)(?::\d+)?(?:[/?#]|$)/i,
  site: ['ddg', 'duckduckgo_lite'],
  root: '[data-testid="result"], [data-testid="web-vertical"] li > article, .result, .web-result, .tile',
  url: ['or', [['attribute', 'href'], ['attribute', 'href', 'a[data-testid="result-extras-url-link"]'], ['attribute', 'href', 'a[data-testid="result-title-a"]'], ['attribute', 'href', 'h2 > a'], ['attribute', 'href', '.result__url'], ['attribute', 'href', 'a[href]']]],
  title: ['or', [['text', 'a[data-testid="result-title-a"]'], ['text', '.result__title'], ['text', '.tile__title'], ['text', '.tile--title__title'], ['text', 'h2 a'], ['text', 'a h2'], ['text', 'h2']]],
  snippet: ['or', [['text', '[data-testid="result-snippet"]'], ['text', '[data-result="snippet"]'], ['text', '.result__snippet']]],
  command: { link: { redirects: [{ path: /^\/l\/?$/, params: ['uddg'], codec: 'url' }] } },
  pages: {
    images: {
      includeRegex: /[?&]iax=images(?:&|#|$)/i,
      button: false,
      root: 'li:has(> figure), figure',
      title: ['or', [['attribute', 'alt', 'img[alt]'], ['attribute', 'alt', 'img']]],
    },
    videos: { includeRegex: /[?&]iax=videos?(?:&|#|$)/i, root: '[data-testid="result"]:not(:has(article)), .result:not(:has(article)), a[href]:has(article)' },
    news: { includeRegex: /[?&]iar=news(?:&|#|$)/i, root: '[data-testid="result"]:not(:has(article)), li > article:has(h2), article:not(:has(article)):has(h2)' }
  },
},
yandex: {
  includeRegex: /^https?:\/\/(?:(?:www|m)\.)?(?:ya\.ru|yandex\.(?:[a-z]{2,3}(?:\.[a-z]{2})?|[a-z]{4,}))(?::\d+)?(?:[/?#]|$)/i,
  root: 'div.Organic',
  url: ['or', [['attribute', 'href', '.OrganicTitle a'], ['attribute', 'href', '.Path-Item a'], ['attribute', 'href', 'a.Link'], ['attribute', 'href', 'a[href]']]],
  title: ['text', '.OrganicTitle'],
  snippet: ['text', '.OrganicText'],
  button: { inset: { top: '10px', right: '5px' }, scope: '.main__content, .content, [class*="z6OLDwO9"]' },
  command: { group: { container: 'parent', members: 'div.Organic' } },
  pages: {
    images: {
      includeRegex: /^https?:\/\/images\.|^https?:\/\/[^/?#]+\/images(?:[/?#]|$)/i,
      button: false,
      root: '.JustifierRowLayout-Item, div.SerpItem',
      url: ['or', [['queryParam', 'img_url', ['attribute', 'href', 'a[href*="img_url="]']], ['attribute', 'href', 'a[href]']]],
      title: ['or', [['attribute', 'alt', 'img[alt]'], ['attribute', 'alt', 'img']]],
    },
    videos: { includeRegex: /^https?:\/\/[^/?#]+\/videos?(?:[/?#]|$)/i },
    news: { includeRegex: /^https?:\/\/[^/?#]+\/news(?:[/?#]|$)/i }
  },
},
brave: {
  includeRegex: /^https?:\/\/(?:safe\.)?search\.brave\.com(?::\d+)?(?:[/?#]|$)/i,
  root: '.snippet[data-type="web"], .snippet[data-type="news"], .snippet[data-type="videos"], .image-wrapper',
  url: ['attribute', 'href', 'a[href]'],
  title: ['or', [['text', '.title'], ['text', '.snippet-title'], ['text', '.img-title']]],
  snippet: ['or', [['text', '.generic-snippet .content'], ['text', '.generic-snippet'], ['text', '.line-clamp-dynamic'], ['text', '.snippet-description'], ['text', '.description']]],
  button: { inset: { top: '10px', right: '5px' } },
  pages: {
    images: {
      includeRegex: /search\.brave\.com\/images(?:[/?]|$)/i,
      button: false,
      root: 'button.image-result',
      url: ['or', [['base64Url', ['src', 'data-src'], 'img[src*="imgs.search.brave.com"]'], ['attribute', 'href', 'a[href]']]],
      title: ['or', [['text', '.image-metadata-title'], ['text', '.img-title'], ['attribute', 'alt', 'img[alt]']]],
    }
  },
},
ecosia: {
  includeRegex: /^https?:\/\/(?:(?:www|m)\.)?ecosia\.org(?::\d+)?(?:[/?#]|$)/i,
  root: 'article[data-test-id="organic-result"], article[data-test-id="videos-result"], article[data-test-id="news-result"], article[data-test-id="images-result"], div.result, article.result',
  url: ['or', [['attribute', 'href', 'a[data-test-id="result-link"][href]'], ['attribute', 'href', 'a.result__link[href]'], ['attribute', 'href', 'a.image-result__details-link[href]'], ['attribute', 'href', 'a.image-result__link[href]'], ['attribute', 'href', 'a[href]']]],
  title: ['or', [['text', 'h2[data-test-id="result-title"]'], ['text', '.result-title__heading'], ['text', 'h2.image-result__details-title'], ['text', 'h2']]],
  snippet: ['or', [['text', '[data-test-id="web-result-description"]'], ['text', '[data-test-id="news-result-description"]'], ['text', '.web-result__description'], ['text', '.news-result__description'], ['text', '.video-result__description'], ['text', '.result__description']]],
},
startpage: {
  includeRegex: /^https?:\/\/(?:(?:www|eu|m)\.)?startpage\.com(?::\d+)?(?:[/?#]|$)/i,
  root: 'div.result, .w-gl__result',
  url: ['or', [['attribute', 'href', 'a.result-link[href]'], ['attribute', 'href', 'a.wgl-site-title[href]'], ['attribute', 'href', 'a.wgl-display-url[href]'], ['attribute', 'href', 'a.display-url[href]'], ['attribute', 'href', '.w-gl__result-title[href]'], ['attribute', 'href', 'a[href]']]],
  title: ['or', [['text', 'a.result-link'], ['text', 'h2.wgl-title'], ['text', 'a.wgl-site-title'], ['text', '.w-gl__result-title']]],
  snippet: ['or', [['text', 'p.description'], ['text', '.result__main > p'], ['text', '.w-gl__description']]],
  pages: { images: { includeRegex: /[?&]cat=images(?:&|#|$)/i, button: false }, videos: { includeRegex: /[?&]cat=video(?:&|#|$)/i }, news: { includeRegex: /[?&]cat=news(?:&|#|$)/i } },
},
yahoo_japan: {
  includeRegex: /^https?:\/\/(?:(?:[a-z]{1,6}\.)?(?:(?:images|video|videos|news)\.)?(?:r\.)?search\.yahoo\.co\.jp(?::\d+)?(?:[/?#]|$)|news\.yahoo\.co\.jp(?::\d+)?\/search(?:[/?#].*)?)/i,
  matches: ['*://*.search.yahoo.co.jp/*', '*://*.news.yahoo.co.jp/*'],
  priority: 10,
  site: ['yahoo-japan'],
  root: '.sw-Card.Algo, li.b_algo, div.b_algo, #web .algo, .algo-sr, .richAlgo, #contents section:has(a h3)',
  url: ['or', [['attribute', 'href', 'a:has(> h3)'], ['attribute', 'href', 'a.sw-Card__titleInner[href]'], ['attribute', 'href', 'a.sw-Card__space'], ['attribute', 'href', 'h3 a'], ['attribute', 'href', '.s-title a'], ['attribute', 'href', '.s-title'], ['attribute', 'href', '.sw-Card__title a'], ['attribute', 'href', 'a[data-ylk*="slk:title"]'], ['attribute', 'href', 'a.ac-algo'], ['attribute', 'href', 'a[data-y-link-id]']]],
  title: ['or', [['text', 'h3'], ['text', '.s-title'], ['text', 'h2 a'], ['text', 'a h2'], ['text', '.b_title'], ['text', '.title']]],
  snippet: ['or', [['text', '.sw-Card__description'], ['text', '.sw-Card__snippet'], ['text', '.sw-Text__body'], ['text', 'p'], ['text', '.b_caption p'], ['text', '.b_snippet'], ['text', '.b_paractl p']]],
  button: { inset: { top: '10px', right: '5px' } },
  command: { skip: '.sys_algo_rs, .AlsoTry_M, [data-yga*="sugg"]', link: { redirects: [{ path: /^\/(?:r|rd)(?:\/|$)|ru=|\/\*/i, pathValue: /(?:^|\/)RU=([\s\S]*?)(?=(?:\/(?:rk|rs|rv|ro|re|rh|rt|_ylt|_ylu)=|\/$|$))/i, hrefSuffix: /\/\*+-?(https?(?::|%3A)[\s\S]*)$/i, params: ['u', 'url', 'target', 'dest', 'dst', 'r', 'ru'], codec: 'pattern' }] } },
  pages: {
    images: {
      includeRegex: /^https?:\/\/(?:images\.[^/]*yahoo\.co\.jp|(?:[a-z0-9-]+\.)*search\.yahoo\.co\.jp\/image\/search(?:[/?#]|$))/i,
      button: false,
      root: '.sw-ThumbnailGrid__columnItem, #isr div:has(> a[data-cl-params]), a.sw-Thumbnail',
      url: ['or', [['regexInclude', /^https?:\/\//i, ['regexSubstitute', /^(?:[\s\S]*?;)?targurl:\s*(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^;]*)?)(?:;[\s\S]*)?$/i, 'https://$1', ['attribute', 'data-cl-params', 'a.sw-Thumbnail']]], ['regexInclude', /^https?:\/\//i, ['regexSubstitute', /^(?:[\s\S]*?;)?targurl:\s*(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^;]*)?)(?:;[\s\S]*)?$/i, 'https://$1', ['attribute', 'data-cl-params', 'a']]], ['attribute', 'href', 'a[href]']]],
      title: ['or', [['text', '.sw-ThumbnailGrid__title'], ['attribute', 'alt', 'img[alt]'], ['attribute', 'alt', 'img']]],
      snippet: ['text', '.sw-ThumbnailGrid__domain'],
    },
    videos: { includeRegex: /^https?:\/\/(?:videos?\.[^/]*yahoo\.co\.jp|(?:[a-z0-9-]+\.)*search\.yahoo\.co\.jp\/video\/search(?:[/?#]|$))/i, root: '.Algo, a.sw-ListItem__wrapper[href], section.sw-ListItem', url: ['or', [['regexInclude', /^https?:\/\//i, ['regexSubstitute', /^(?:[\s\S]*?;)?targurl:\s*(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^;]*)?)(?:;[\s\S]*)?$/i, 'https://$1', ['attribute', 'data-cl-params', 'a']]], ['attribute', 'href', 'a[href]']]], title: ['or', [['text', '.sw-ListItem__title'], ['text', 'h3'], ['text', '.s-title']]] },
    news: {
      includeRegex: /^https?:\/\/news\./i,
      root: 'li:has(a[href*="/articles/"])',
      url: ['attribute', 'href', 'a[href*="/articles/"]'],
      title: ['or', [['text', 'div.newsFeed_item_body > div:nth-child(2) > div:nth-child(1)'], ['text', 'p'], ['text', 'a[href*="/articles/"]']]],
      snippet: ['text', 'p'],
    }
  },
},
yahoo: {
  includeRegex: /^https?:\/\/(?:[a-z]{1,6}\.)?(?:(?:images|video|videos|news)\.)?(?:r\.)?search\.yahoo\.(?:com|[a-z]{2,3}(?:\.[a-z]{2})?)(?::\d+)?(?:[/?#]|$)/i,
  root: '.sw-Card.Algo, li.b_algo, div.b_algo, #web .algo, .algo-sr, .richAlgo, #web ol > li > div',
  url: ['or', [['attribute', 'href', 'a:has(> h3)'], ['attribute', 'href', 'a.sw-Card__titleInner[href]'], ['attribute', 'href', 'a.sw-Card__space'], ['attribute', 'href', 'h3 a'], ['attribute', 'href', '.s-title a'], ['attribute', 'href', '.s-title'], ['attribute', 'href', '.sw-Card__title a'], ['attribute', 'href', 'a[data-ylk*="slk:title"]'], ['attribute', 'href', 'a.ac-algo'], ['attribute', 'href', 'a[data-y-link-id]']]],
  title: ['or', [['text', 'h3'], ['text', '.s-title'], ['text', 'h2 a'], ['text', 'a h2'], ['text', '.b_title'], ['text', '.title']]],
  snippet: ['or', [['text', '.sw-Card__description'], ['text', '.sw-Card__snippet'], ['text', '.sw-Text__body'], ['text', 'p'], ['text', '.b_caption p'], ['text', '.b_snippet'], ['text', '.b_paractl p']]],
  button: { inset: { top: '10px', right: '5px' } },
  command: { skip: '.sys_algo_rs, .AlsoTry_M, [data-yga*="sugg"]', link: { redirects: [{ path: /^\/(?:r|rd)(?:\/|$)|ru=|\/\*/i, pathValue: /(?:^|\/)RU=([\s\S]*?)(?=(?:\/(?:rk|rs|rv|ro|re|rh|rt|_ylt|_ylu)=|\/$|$))/i, hrefSuffix: /\/\*+-?(https?(?::|%3A)[\s\S]*)$/i, params: ['u', 'url', 'target', 'dest', 'dst', 'r', 'ru'], codec: 'pattern' }] } },
  pages: {
    images: {
      includeRegex: /^https?:\/\/(?:images\.[^/]*yahoo\.[^/]+|(?:[a-z0-9-]+\.)*search\.yahoo\.[^/]+\/search\/images(?:[/?#]|$))/i,
      button: false,
      root: '.sw-ThumbnailGrid__columnItem, #isr div:has(> a[data-cl-params]), a.sw-Thumbnail',
      url: ['or', [['regexInclude', /^https?:\/\//i, ['regexSubstitute', /^(?:[\s\S]*?;)?targurl:\s*(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^;]*)?)(?:;[\s\S]*)?$/i, 'https://$1', ['attribute', 'data-cl-params', 'a.sw-Thumbnail']]], ['regexInclude', /^https?:\/\//i, ['regexSubstitute', /^(?:[\s\S]*?;)?targurl:\s*(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^;]*)?)(?:;[\s\S]*)?$/i, 'https://$1', ['attribute', 'data-cl-params', 'a']]], ['attribute', 'href', 'a[href]']]],
      title: ['or', [['text', '.sw-ThumbnailGrid__title'], ['attribute', 'alt', 'img[alt]'], ['attribute', 'alt', 'img']]],
      snippet: ['text', '.sw-ThumbnailGrid__domain'],
    },
    videos: { includeRegex: /^https?:\/\/(?:videos?\.[^/]*yahoo\.[^/]+|(?:[a-z0-9-]+\.)*search\.yahoo\.[^/]+\/search\/video(?:[/?#]|$))/i },
    news: { includeRegex: /^https?:\/\/news\./i }
  },
},
so360: {
  includeRegex: /^https?:\/\/(?:(?:www|m|news)\.)?so\.com(?::\d+)?(?:[/?#]|$)/i,
  root: 'li.res-list:not(.mso-recommend-card):not(.guide-rel), div.res-list:not(.mso-recommend-card):not(.guide-rel)',
  url: ['or', [['attribute', 'href', 'h3 a[href]'], ['attribute', 'href', 'a:has(> h3)[href]'], ['attribute', 'href', 'a.alink[href]'], ['attribute', 'href', '.g-linkinfo a[href]'], ['attribute', 'href', 'a[href]']]],
  title: ['or', [['text', 'h3.res-title a'], ['text', 'h3 a'], ['text', '.res-title'], ['text', '.g-title a'], ['text', '.g-title']]],
  snippet: ['or', [['text', '.res-desc'], ['text', '.res-list-summary'], ['text', '.mh-desc'], ['text', '.summary']]],
  command: {
    link: {
      redirects: [{ path: /^\/jump\/?$/, params: ['u', 'url'], codec: 'url' }, { path: /(?:\/tc\b|\/link\b)/, params: ['url'], codec: 'url' }],
      directAttrs: ['data-mdurl', 'data-url', 'linkurl'],
      directScope: '.res-list, .vrwrap, .reactResult',
      directProtocol: 'https'
    }
  },
},
sogou: {
  includeRegex: /^https?:\/\/(?:(?:www|m|wap|news)\.)?sogou\.com(?::\d+)?(?:[/?#]|$)/i,
  root: 'div.vrwrap:has(h3), div.reactResult:has(h3), div.reactResult:has(.vr-title), div.vrResult:has(h3)',
  url: ['or', [['attribute', 'href', 'h3.vr-title a[href]'], ['attribute', 'href', '.vr-title a[href]'], ['attribute', 'href', 'a[class*="saTitle"][href]'], ['attribute', 'href', 'a.citeLinkClass[href]'], ['regexExclude', /^(?:javascript:|void\s*\()/i, ['attribute', 'href', 'a:has(> h3)[href]']], ['regexExclude', /^(?:javascript:|void\s*\()/i, ['attribute', 'href', 'a:has(h3)[href]']], ['regexExclude', /^(?:javascript:|void\s*\()/i, ['attribute', 'href', 'h3 a[href]']], ['regexExclude', /^(?:javascript:|void\s*\()/i, ['attribute', 'href', 'a[href]']]]],
  title: ['or', [['text', 'h3.vr-title a'], ['text', '.vr-title a'], ['text', 'a[class*="saTitle"]'], ['text', '.vr-title'], ['text', 'h3.vr-tit'], ['text', 'h3 a'], ['text', 'h3']]],
  snippet: ['or', [['text', '.space-txt'], ['text', '.star-wiki'], ['text', '.str_info'], ['text', 'p.sa-text-clamp3'], ['text', '[class*="saText"]']]],
  command: {
    link: {
      redirects: [{ path: /(?:\/tc\b|\/jump\b|\/link\b)/, params: ['url'], codec: 'url' }],
      directAttrs: ['data-mdurl', 'data-url', 'linkurl'],
      directScope: '.res-list, .vrwrap, .reactResult',
      directProtocol: 'https'
    }
  },
},
toutiao: {
  includeRegex: /^https?:\/\/(?:so|m)\.toutiao\.com(?::\d+)?(?:[/?#]|$)/i,
  root: '.result-content',
  url: ['or', [['attribute', 'href', 'a[href*="/search/jump"]'], ['attribute', 'href', 'a.l-card-title[href]'], ['attribute', 'href', 'a[href]:not([href*="/search?"])'], ['attribute', 'href', '.cs-header a[href]']]],
  title: ['or', [['text', 'a[href*="/search/jump"]'], ['text', '.l-card-title a'], ['text', '.l-card-title'], ['text', '.cs-header a']]],
  snippet: ['or', [['text', '.cs-card-content .text-regular'], ['text', '.cs-source'], ['text', '.l-paragraph'], ['text', '.l-source']]],
  command: { link: { redirects: [{ path: /^\/search\/jump\/?$/, params: ['url'], codec: 'url', chain: { hostSelf: true, param: 'h5_url' } }] } },
  pages: {
    images: {
      includeRegex: /[?&]pd=atlas(?:&|#|$)/i,
      button: false,
      root: '.l-waterfallY-item',
      url: ['or', [['jsonPath', '0.original_page_url', ['jsonPath', '', ['queryParam', 'preload', ['queryParam', 'url', ['attribute', 'href', 'a[href*="/search/jump"]']]]]], ['attribute', 'href', 'a[href*="/search/jump"]'], ['attribute', 'href', 'a[href]']]],
      title: ['or', [['attribute', 'alt', 'img[alt]'], ['jsonPath', '0.text', ['jsonPath', '', ['queryParam', 'preload', ['queryParam', 'url', ['attribute', 'href', 'a[href*="/search/jump"]']]]]]]],
      snippet: ['jsonPath', '0.text', ['jsonPath', '', ['queryParam', 'preload', ['queryParam', 'url', ['attribute', 'href', 'a[href*="/search/jump"]']]]]],
    },
    news: { includeRegex: /[?&]pd=information(?:&|#|$)/i },
    videos: { includeRegex: /[?&]pd=[a-z_]*video/i }
  },
},
quark: {
  includeRegex: /^https?:\/\/(?:(?:www|m|so)\.)?quark\.cn(?::\d+)?(?:[/?#]|$)|^https?:\/\/(?:(?:quark|yz)\.)?(?:(?:www|m)\.)?sm\.cn(?::\d+)?(?:[/?#]|$)/i,
  root: 'div.qk-card',
  url: ['or', [['attribute', 'href', '.qk-title a[href]'], ['attribute', 'href', 'a.qk-link-wrapper[href]'], ['attribute', 'href', 'a[href]']]],
  title: ['or', [['text', '.qk-title-text'], ['text', '.qk-title'], ['text', 'a.qk-link-wrapper']]],
  snippet: ['or', [['text', '.qk-paragraph-text'], ['text', '.qk-paragraph']]],
},
github: {
  includeRegex: /^https?:\/\/(?:www\.)?github\.com\/search\/?(?:[?#]|$)/i,
  matches: ['*://*.github.com/search*'],
  root: '[data-testid=\'results-list\'] > div',
  url: ['or', [['attribute', 'href', '.search-title a[href]'], ['attribute', 'href', 'h3 a[href]']]],
  title: ['or', [['text', '.search-title a'], ['text', 'h3 a[data-component=\'Link\']'], ['text', 'h3 a'], ['text', 'h3']]],
  snippet: ['or', [['text', 'h3 ~ div'], ['text', 'h3 + div'], ['text', 'article .description']]],
  button: false,
},
greasyfork: {
  includeRegex: /^https?:\/\/(?:www\.)?greasyfork\.org\/(?:[a-z]{2}(?:-[a-z0-9]{2,4})?\/)?scripts(?:\/(?:by-site\/[^/?#]*|language\/[a-z0-9+-]+)\/?)?(?:[?#]|$)/i,
  matches: ['*://*.greasyfork.org/*'],
  root: '#browse-script-list li[data-script-id]',
  url: ['attribute', 'href', 'a.script-link[href]'],
  title: ['or', [['text', 'a.script-link'], ['text', 'article h2 a']]],
  snippet: ['or', [['text', '.script-description'], ['text', 'article .description']]],
  button: false,
},
other: {
  root: '',
  url: ['attribute', 'href', 'a[href]'],
  title: ['text', 'h3'],
  snippet: ['text', 'p'],
  button: { inset: { top: '10px', right: '35px' }, exclude: 'header, [role="navigation"], [role="tablist"], [role="search"]' },
}
