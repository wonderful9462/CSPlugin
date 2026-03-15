/**
 * BUFF 平台抓取
 */

(function () {
  const registerScraper = window.CS2CTPlatformRegistry?.registerScraper;
  if (!registerScraper) return;

  function parseGoodsId() {
  const match = window.location.pathname.match(/\/goods\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function getGoodsName() {
  const row = document.querySelector('tr.selling[data-goods-info]');
  if (row) {
    try {
      const info = JSON.parse(row.getAttribute('data-goods-info') || '{}');
      return info.name || null;
    } catch (_) {}
  }
  const h1 = document.querySelector('.detail-title h1, h1.detail-title');
  return h1?.textContent?.trim() || null;
}

function extractProductData() {
  const goodsIdFromUrl = parseGoodsId();
  const goodsName = getGoodsName();
  const items = [];

  const sellingRows = document.querySelectorAll('tr.selling[data-asset-info][data-order-info]');

  sellingRows.forEach((row) => {
    try {
      const assetInfoStr = row.getAttribute('data-asset-info');
      const orderInfoStr = row.getAttribute('data-order-info');
      const goodsInfoStr = row.getAttribute('data-goods-info');

      if (!assetInfoStr || !orderInfoStr) return;

      const assetInfo = JSON.parse(assetInfoStr);
      const orderInfo = JSON.parse(orderInfoStr);
      const name = goodsName || (goodsInfoStr ? JSON.parse(goodsInfoStr).name : null);

      const goodsId = assetInfo.goods_id ?? orderInfo.goods_id ?? goodsIdFromUrl;
      const floatValue = assetInfo.paintwear != null ? parseFloat(assetInfo.paintwear) : null;
      const price = orderInfo.price != null ? parseFloat(orderInfo.price) : null;

      items.push({
        platform: 'buff',
        goods_id: goodsId,
        float_value: floatValue,
        price: price,
        goods_name: name
      });
    } catch (e) {
      console.warn('[CS2CT] BUFF 解析失败:', e);
    }
  });

  if (items.length === 0 && goodsIdFromUrl) {
    const buyBtn = document.querySelector('.btn-buy-order[data-goodsid][data-price]');
    if (buyBtn) {
      const price = parseFloat(buyBtn.getAttribute('data-price'));
      const assetInfoStr = buyBtn.getAttribute('data-asset-info');
      let floatValue = null;
      if (assetInfoStr) {
        try {
          const assetInfo = JSON.parse(assetInfoStr);
          floatValue = assetInfo.paintwear != null ? parseFloat(assetInfo.paintwear) : null;
        } catch (_) {}
      }
      items.push({
        platform: 'buff',
        goods_id: goodsIdFromUrl,
        float_value: floatValue,
        price: price,
        goods_name: goodsName
      });
    }
  }

  return { items, goodsName: goodsName || '未知商品' };
}

function hasProductElements() {
  return document.querySelector('tr.selling[data-asset-info][data-order-info]') ||
    document.querySelector('.btn-buy-order[data-goodsid][data-price]');
}

  registerScraper('buff', {
    parseGoodsId,
    getGoodsName,
    extractProductData,
    hasProductElements
  });
})();
