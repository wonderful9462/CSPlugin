/**
 * CS2CT 数据抓取 - Content Script
 * 录制时轮询 URL 变化，在期望地址上轮询元素直到捕获数据（5 秒超时）
 */

(function () {
  /** 防止程序化注入时重复执行（如：开始录制时注入已加载过脚本的标签页） */
  if (window.__CS2CT_CONTENT_LOADED__) return;
  window.__CS2CT_CONTENT_LOADED__ = true;

  const registry = window.CS2CTPlatformRegistry;
const LOOP_INTERVAL = 200;
const ELEMENT_POLL_TIMEOUT = 5000;
/** URL 变化后需稳定时长再抓，避免 SPA 未更新 DOM 时抓到旧数据 */
const URL_STABLE_DELAY = 300;

function getPlatform() {
  return registry?.getPlatform() ?? null;
}

function extractProductData() {
  const platform = getPlatform();
  const scraper = registry?.getScraper(platform);
  if (!scraper?.extractProductData) return { items: [], goodsName: '未知商品' };
  return scraper.extractProductData();
}

function hasProductElements() {
  const platform = getPlatform();
  const scraper = registry?.getScraper(platform);
  if (!scraper?.hasProductElements) return false;
  return scraper.hasProductElements();
}

function isExpectedUrl() {
  const platform = getPlatform();
  return platform && registry?.isExpectedUrl(platform);
}

/** 获取用于去重标识的 URL（UUYP 等分页不改变地址的平台会拼接页码） */
function getEffectiveUrl() {
  const platform = getPlatform();
  const scraper = registry?.getScraper(platform);
  if (scraper?.getEffectiveUrl) return scraper.getEffectiveUrl(window.location.href);
  return window.location.href;
}

// ============ 录制逻辑：仅在录制时轮询 ============
let lastUrl = '';
let elementPollStart = null;
let tickIntervalId = null;
/** 本页已抓取 URL（避免异步写入前的竞态重复抓取） */
const scrapedUrlsLocal = new Set();

function startPolling() {
  if (tickIntervalId) return;
  tickIntervalId = setInterval(tick, LOOP_INTERVAL);
}

function stopPolling() {
  if (tickIntervalId) {
    clearInterval(tickIntervalId);
    tickIntervalId = null;
  }
  lastUrl = '';
  elementPollStart = null;
}

async function tick() {
  try {
    const { recording } = await chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE' });
    if (!recording) return;

    const platform = getPlatform();
    if (!platform) return;

    const current = getEffectiveUrl();
    if (!isExpectedUrl()) {
      lastUrl = current;
      elementPollStart = null;
      return;
    }

    if (current !== lastUrl) {
      lastUrl = current;
      elementPollStart = Date.now();
    }
    if (!elementPollStart) elementPollStart = Date.now();

    if (Date.now() - elementPollStart > ELEMENT_POLL_TIMEOUT) {
      elementPollStart = null;
      return;
    }

    if (Date.now() - elementPollStart < URL_STABLE_DELAY) return;

    if (scrapedUrlsLocal.has(current)) return;
    const { scraped } = await chrome.runtime.sendMessage({ type: 'CHECK_URL_SCRAPED', url: current });
    if (scraped) return;

    if (hasProductElements()) {
      const { items, goodsName } = extractProductData();
      if (items.length > 0) {
        scrapedUrlsLocal.add(current);
        await chrome.runtime.sendMessage({
          type: 'SCRAPE_DATA',
          payload: { platform: items[0].platform, goodsName, items, url: current }
        });
        elementPollStart = null;
      }
    }
  } catch (_) {}
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'CLEAR_SCRAPED') scrapedUrlsLocal.clear();
  if (msg?.type === 'RECORDING_STATE_CHANGED') {
    if (msg.recording) startPolling();
    else stopPolling();
  }
});

chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE' }).then(
  ({ recording }) => { if (recording) startPolling(); },
  () => {}
);
})();
