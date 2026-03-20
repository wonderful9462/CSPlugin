/**
 * C5GAME 平台抓取 - 在售列表
 * 页面结构：/csgo/{itemId}/item/sell 或 /csgo/{itemId}/{name}/sell，分页不改变 URL
 */

(function () {
  const registerScraper = window.CS2CTPlatformRegistry?.registerScraper;
  if (!registerScraper) return;

  const PRICE_REGEX = /[¥￥]\s*([\d.]+)/;

  /** C5 把整数与小数拆到相邻 span，textContent 中间会有换行，[\d.]+ 会在换行处截断，必须先去掉空白 */
  function parsePriceFromOrPriceEl(priceEl) {
    if (!priceEl) return null;
    const compact = (priceEl.textContent || '').replace(/\s+/g, '');
    const m = compact.match(PRICE_REGEX);
    if (m) {
      const n = parseFloat(m[1]);
      if (!isNaN(n)) return n;
    }
    const stripped = compact.replace(/[¥￥]/g, '');
    const n = parseFloat(stripped);
    return !isNaN(n) ? n : null;
  }

  function parseGoodsId() {
    const match = window.location.pathname.match(/\/csgo\/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  function getGoodsName() {
    const title = document.querySelector('title');
    if (title?.textContent) {
      const m = title.textContent.match(/^(.+?)_csgo/);
      if (m) return m[1].trim();
    }
    const h1 = document.querySelector('h1, [class*="item-detail"] [class*="title"]');
    return h1?.textContent?.trim() || null;
  }

  function extractProductData() {
    const goodsId = parseGoodsId();
    const goodsName = getGoodsName();
    const items = [];

    const rows = document.querySelectorAll('.on-sale-table-item, [class*="on-sale-table-item"]');
    rows.forEach((row) => {
      if (row.closest('.el-carousel, [class*="el-carousel"]')) return;
      try {
        let floatValue = null;
        const wearEl = row.querySelector('.abrasion-value span, [class*="abrasion-value"] span');
        if (wearEl) {
          const wearText = wearEl.textContent?.trim();
          if (wearText && !isNaN(parseFloat(wearText))) {
            floatValue = parseFloat(wearText);
          }
        }

        let price = null;
        const priceEl = row.querySelector('.or-price.text-price, [class*="or-price"][class*="text-price"], .col-5 .or-price');
        if (priceEl) {
          price = parsePriceFromOrPriceEl(priceEl);
        }

        if (price == null || isNaN(price)) return;

        items.push({
          platform: 'c5',
          goods_id: goodsId,
          float_value: floatValue,
          price: price,
          goods_name: goodsName
        });
      } catch (e) {
        console.warn('[CS2CT] C5 解析失败:', e);
      }
    });

    return { items, goodsName: goodsName || '未知商品' };
  }

  function hasProductElements() {
    const rows = document.querySelectorAll('.on-sale-table-item, [class*="on-sale-table-item"]');
    return Array.from(rows).some((row) => !row.closest('.el-carousel, [class*="el-carousel"]'));
  }

  registerScraper('c5', {
    parseGoodsId,
    getGoodsName,
    extractProductData,
    hasProductElements
  });
})();
