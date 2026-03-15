/**
 * CS2CT 数据抓取 - Content Script
 * 录制时轮询，在期望地址上直接尝试抓取页面数据
 */

(function () {
  /** 防止程序化注入时重复执行（如：开始录制时注入已加载过脚本的标签页） */
  if (window.__CS2CT_CONTENT_LOADED__) return;
  window.__CS2CT_CONTENT_LOADED__ = true;

  const registry = window.CS2CTPlatformRegistry;
  const LOOP_INTERVAL = 200;

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

  // ============ 录制逻辑：仅在录制时轮询，直接尝试抓取 ============
  let tickIntervalId = null;

  function startPolling() {
    if (tickIntervalId) return;
    tickIntervalId = setInterval(tick, LOOP_INTERVAL);
  }

  function stopPolling() {
    if (tickIntervalId) {
      clearInterval(tickIntervalId);
      tickIntervalId = null;
    }
  }

  async function tick() {
    try {
      const { recording } = await chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE' });
      if (!recording) return;

      const platform = getPlatform();
      if (!platform) return;

      if (!isExpectedUrl()) return;

      if (!hasProductElements()) return;

      const { items, goodsName } = extractProductData();
      if (items.length === 0) return;

      await chrome.runtime.sendMessage({
        type: 'SCRAPE_DATA',
        payload: { platform: items[0].platform, goodsName, items }
      });
    } catch (_) {}
  }

  chrome.runtime.onMessage.addListener((msg) => {
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
