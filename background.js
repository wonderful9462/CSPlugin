/**
 * 后台服务 - 管理录制状态与数据累积
 */

const STORAGE_KEYS = {
  RECORDING: 'cs2ct_recording',
  DATA: 'cs2ct_data',
  STATS: 'cs2ct_stats',
  SCRAPED_URLS: 'cs2ct_scraped_urls'
};

/** 与 manifest content_scripts 一致，用于程序化注入 */
const CONTENT_SCRIPT_FILES = [
  'platforms/platformRegistry.js',
  'platforms/buff.js',
  'platforms/uuyp.js',
  'platforms/eco.js',
  'platforms/c5.js',
  'content.js'
];

const TARGET_URL_PATTERNS = [
  'https://buff.163.com/*',
  'https://www.youpin898.com/*',
  'https://www.ecosteam.cn/*',
  'https://www.c5game.com/*'
];

/** 抓取请求队列，串行处理避免并发写入覆盖 */
let scrapeQueue = Promise.resolve();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCRAPE_DATA') {
    const task = scrapeQueue.then(() => handleScrapedData(message.payload));
    scrapeQueue = task.catch(() => {}); // 防止单次失败阻塞后续
    task.then(sendResponse).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (message.type === 'GET_RECORDING_STATE') {
    chrome.storage.local.get(STORAGE_KEYS.RECORDING).then(r => {
      sendResponse({ recording: !!r[STORAGE_KEYS.RECORDING] });
    });
    return true;
  }
  if (message.type === 'SET_RECORDING_STATE') {
    chrome.storage.local.set({ [STORAGE_KEYS.RECORDING]: message.recording }).then(() => {
      sendResponse({ ok: true });
      chrome.tabs.query({ url: TARGET_URL_PATTERNS }, (tabs) => {
        const recording = message.recording;
        if (recording && tabs.length > 0) {
          // 开始录制时：先注入脚本到匹配标签页（解决「先开标签后装插件」导致无 content script 的问题）
          tabs.forEach((tab) => {
            if (tab.id) {
              chrome.scripting.executeScript({ target: { tabId: tab.id }, files: CONTENT_SCRIPT_FILES })
                .then(() => {
                  chrome.tabs.sendMessage(tab.id, { type: 'RECORDING_STATE_CHANGED', recording }).catch(() => {});
                })
                .catch(() => {
                  // 可能已有脚本，直接发消息
                  chrome.tabs.sendMessage(tab.id, { type: 'RECORDING_STATE_CHANGED', recording }).catch(() => {});
                });
            }
          });
        } else {
          tabs.forEach((tab) => {
            if (tab.id) chrome.tabs.sendMessage(tab.id, { type: 'RECORDING_STATE_CHANGED', recording }).catch(() => {});
          });
        }
      });
    });
    return true;
  }
  if (message.type === 'GET_DATA') {
    getStoredData().then(({ data, stats }) => {
      sendResponse({ data, stats });
    });
    return true;
  }
  if (message.type === 'CLEAR_DATA') {
    chrome.storage.local.set({
      [STORAGE_KEYS.DATA]: [],
      [STORAGE_KEYS.STATS]: {},
      [STORAGE_KEYS.SCRAPED_URLS]: []
    }).then(() => {
      sendResponse({ ok: true });
      chrome.tabs.query({ url: TARGET_URL_PATTERNS }, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id) chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_SCRAPED' }).catch(() => {});
        });
      });
    });
    return true;
  }
  if (message.type === 'CHECK_URL_SCRAPED') {
    chrome.storage.local.get(STORAGE_KEYS.SCRAPED_URLS).then(r => {
      const urls = r[STORAGE_KEYS.SCRAPED_URLS] || [];
      sendResponse({ scraped: urls.includes(message.url) });
    });
    return true;
  }
});

async function handleScrapedData(payload) {
  const { platform, goodsName, items, url } = payload;
  if (!items?.length) return { ok: true };

  const result = await chrome.storage.local.get([
    STORAGE_KEYS.DATA,
    STORAGE_KEYS.STATS,
    STORAGE_KEYS.SCRAPED_URLS
  ]);
  const data = result[STORAGE_KEYS.DATA] || [];
  const stats = result[STORAGE_KEYS.STATS] || {};
  const scrapedUrls = result[STORAGE_KEYS.SCRAPED_URLS] || [];

  // 二次校验：URL 已抓取则跳过，避免竞态导致的重复
  if (url && scrapedUrls.includes(url)) return { ok: true, skipped: true };

  // 追加数据
  const newItems = items.map(item => ({ ...item, goods_name: goodsName }));
  data.push(...newItems);

  // 更新统计：按皮肤名称计数（去除名称中所有空格）
  const name = (goodsName || '未知商品').replace(/\s/g, '');
  stats[name] = (stats[name] || 0) + items.length;

  // 记录已抓取 URL
  if (url && !scrapedUrls.includes(url)) scrapedUrls.push(url);

  await chrome.storage.local.set({
    [STORAGE_KEYS.DATA]: data,
    [STORAGE_KEYS.STATS]: stats,
    [STORAGE_KEYS.SCRAPED_URLS]: scrapedUrls
  });

  return { ok: true, total: data.length };
}

async function getStoredData() {
  const result = await chrome.storage.local.get([STORAGE_KEYS.DATA, STORAGE_KEYS.STATS]);
  return {
    data: result[STORAGE_KEYS.DATA] || [],
    stats: result[STORAGE_KEYS.STATS] || {}
  };
}

