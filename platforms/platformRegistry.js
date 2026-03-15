/**
 * 平台注册表 - 统一调度各平台抓取逻辑
 * 新增平台：在此注册 + 实现对应 scraper
 */

(function () {
  const PLATFORMS = {
    buff: {
      host: 'buff.163.com',
      scraper: null,
      isExpectedUrl: (pathname) => /\/goods\/\d+/.test(pathname)
    },
    uuyp: {
      host: 'youpin898.com',
      scraper: null,
      isExpectedUrl: (pathname, search) =>
        pathname.includes('goods-list') && new URLSearchParams(search).has('templateId')
    },
    eco: {
      host: 'ecosteam.cn',
      scraper: null,
      isExpectedUrl: (pathname) => /\/goods\//.test(pathname)
    },
    c5: {
      host: 'c5game.com',
      scraper: null,
      isExpectedUrl: (pathname) => /\/csgo\/\d+/.test(pathname) && pathname.includes('/sell')
    }
  };

  function getPlatform() {
    const host = window.location.hostname;
    for (const [id, { host: h }] of Object.entries(PLATFORMS)) {
      if (host.includes(h)) return id;
    }
    return null;
  }

  function getScraper(platformId) {
    return PLATFORMS[platformId]?.scraper ?? null;
  }

  function registerScraper(platformId, scraper) {
    if (PLATFORMS[platformId]) {
      PLATFORMS[platformId].scraper = scraper;
    }
  }

  function isExpectedUrl(platformId) {
    const p = PLATFORMS[platformId];
    if (!p?.isExpectedUrl) return false;
    const { pathname, search } = window.location;
    return p.isExpectedUrl(pathname, search);
  }

  window.CS2CTPlatformRegistry = {
    getPlatform,
    getScraper,
    registerScraper,
    isExpectedUrl
  };
})();
