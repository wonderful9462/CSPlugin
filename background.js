/**
 * 后台服务 - 管理录制状态与数据累积
 */

const STORAGE_KEYS = {
  RECORDING: 'cs2ct_recording',
  DATA: 'cs2ct_data',
  STATS: 'cs2ct_stats'
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

/** 规范化商品名：去除空格，括号转为中文括号，英文字母转大写 */
function normalizeGoodsName(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .replace(/\s/g, '')
    .replace(/\(/g, '（')
    .replace(/\)/g, '）')
    .replace(/\[/g, '【')
    .replace(/\]/g, '】')
    .replace(/\{/g, '｛')
    .replace(/\}/g, '｝')
    .toUpperCase();
}

/** 生成商品唯一标识：goods_name + float_value */
function getItemKey(goodsName, floatValue) {
  const normalized = normalizeGoodsName(goodsName);
  const floatStr = floatValue != null ? String(floatValue) : '';
  return `${normalized}|${floatStr}`;
}

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
      [STORAGE_KEYS.STATS]: {}
    }).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }
});

/** 从 item 数组构建 key -> item 字典（存储格式保证无重复 key） */
function buildDataMap(items) {
  const map = new Map();
  for (const item of items) {
    map.set(getItemKey(item.goods_name, item.float_value), item);
  }
  return map;
}

async function handleScrapedData(payload) {
  const { goodsName, items } = payload;
  if (!items?.length) return { ok: true };

  const result = await chrome.storage.local.get([STORAGE_KEYS.DATA, STORAGE_KEYS.STATS]);
  const stats = result[STORAGE_KEYS.STATS] || {};

  const normalizedGoodsName = normalizeGoodsName(goodsName || '未知商品');
  if (normalizedGoodsName === '未知商品') return { ok: true }; // goods_name 无效则丢弃
  if (normalizedGoodsName.includes('（纪念品）')) return { ok: true }; // 纪念品舍弃

  // 从已有 data 构建字典（同 key 只保留最低价）
  const dataMap = buildDataMap(result[STORAGE_KEYS.DATA] || []);

  // 本批次内先按 key 去重，只保留每个 key 价格最低的 item
  const batchMap = new Map();
  for (const item of items) {
    if (item.float_value == null || item.price == null) continue;
    const key = getItemKey(goodsName || item.goods_name || '未知商品', item.float_value);
    const normalized = { ...item, goods_name: normalizedGoodsName };
    const existing = batchMap.get(key);
    if (!existing || item.price < existing.price) batchMap.set(key, normalized);
  }

  let newCount = 0;
  let hasChange = false;
  for (const [key, item] of batchMap) {
    const existing = dataMap.get(key);
    if (!existing || item.price < existing.price) {
      dataMap.set(key, item);
      if (!existing) newCount++;
      hasChange = true;
    }
  }

  if (!hasChange) return { ok: true, total: dataMap.size, skipped: true };

  stats[normalizedGoodsName] = (stats[normalizedGoodsName] || 0) + newCount;

  // 保存时再转为列表
  const data = Array.from(dataMap.values());

  await chrome.storage.local.set({
    [STORAGE_KEYS.DATA]: data,
    [STORAGE_KEYS.STATS]: stats
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
