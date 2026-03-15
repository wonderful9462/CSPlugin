/**
 * ECO 平台抓取 - 在售列表
 * 页面结构：商品详情页含「出售」tab，表格 tbody[data-saletradetype="1"] 为在售
 */

(function () {
  const registerScraper = window.CS2CTPlatformRegistry?.registerScraper;
  if (!registerScraper) return;

  const PRICE_REGEX = /[¥￥]\s*([\d.]+)/;

function parseGoodsId() {
  const match = window.location.pathname.match(/\/goods\/\d+-(\d+)-/);
  if (match) return parseInt(match[1], 10);
  const tbody = document.querySelector('.layui-tab-item.sale tbody[data-classid]');
  const classId = tbody?.getAttribute('data-classid');
  return classId ? parseInt(classId, 10) : null;
}

function getGoodsName() {
  // 优先使用中文名称（.goods-name / .-PreGoodsName-），如 M4A4（StatTrak™） | 涡轮 (破损不堪)
  const nameEl = document.querySelector('.goods-name, .-PreGoodsName-');
  const chineseName = nameEl?.textContent?.trim();
  if (chineseName) return chineseName;
  const box = document.querySelector('#goodsdetailBox');
  return box?.getAttribute('data-hashname') || null;
}

function extractProductData() {
  const goodsId = parseGoodsId();
  const goodsName = getGoodsName();
  const items = [];

  const tbody = document.querySelector('.layui-tab-item.sale.layui-show tbody[data-saletradetype="1"]');
  if (!tbody) return { items, goodsName: goodsName || '未知商品' };

  const classId = tbody.getAttribute('data-classid');
  const resolvedGoodsId = goodsId ?? (classId ? parseInt(classId, 10) : null);

  const rows = tbody.querySelectorAll('tr[data-tradetype="1"]');
  rows.forEach((row) => {
    try {
      let floatValue = null;
      const wearEl = row.querySelector('p.WearRate span:last-child');
      if (wearEl) {
        const wearText = wearEl.textContent?.trim();
        if (wearText && !isNaN(parseFloat(wearText))) {
          floatValue = parseFloat(wearText);
        }
      }

      let price = null;
      const priceEl = row.querySelector('td span.price');
      if (priceEl) {
        const priceMatch = priceEl.textContent?.match(PRICE_REGEX);
        if (priceMatch) price = parseFloat(priceMatch[1]);
      }

      if (price == null || isNaN(price)) return;

      items.push({
        platform: 'eco',
        goods_id: resolvedGoodsId,
        float_value: floatValue,
        price: price,
        goods_name: goodsName
      });
    } catch (e) {
      console.warn('[CS2CT] ECO 解析失败:', e);
    }
  });

  return { items, goodsName: goodsName || '未知商品' };
}

function hasProductElements() {
  const tbody = document.querySelector('.layui-tab-item.sale tbody[data-saletradetype="1"]');
  return tbody && tbody.querySelectorAll('tr[data-tradetype="1"]').length > 0;
}

  registerScraper('eco', {
    parseGoodsId,
    getGoodsName,
    extractProductData,
    hasProductElements
  });
})();
