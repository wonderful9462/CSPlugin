/**
 * 悠悠有品（UUYP）平台抓取
 */

(function () {
  const registerScraper = window.CS2CTPlatformRegistry?.registerScraper;
  if (!registerScraper) return;

  const WEAR_REGEX = /磨损[：:]\s*([\d.]+)/;
const PRICE_REGEX = /[¥￥]\s*([\d.]+)/;

function parseGoodsId() {
  const params = new URLSearchParams(window.location.search);
  const templateId = params.get('templateId');
  return templateId ? parseInt(templateId, 10) : null;
}

function getGoodsName() {
  const breadcrumb = document.querySelector('.ant-breadcrumb');
  if (breadcrumb) {
    const links = breadcrumb.querySelectorAll('.ant-breadcrumb-link');
    for (const el of links) {
      const text = el.textContent?.trim() || '';
      if (text && text !== '饰品市场' && /\|/.test(text)) return text;
    }
  }
  const titles = document.querySelectorAll('[class*="title"]');
  for (const el of titles) {
    const text = el.textContent?.trim() || '';
    if (text && /\|/.test(text) && text.length < 80) return text;
  }
  return null;
}

function extractProductData() {
  const goodsId = parseGoodsId();
  const goodsName = getGoodsName();
  const items = [];

  const tables = document.querySelectorAll('table.ant-table, table');
  for (const table of tables) {
    const thead = table.querySelector('thead');
    if (!thead) continue;
    const headerText = thead.textContent || '';
    if (!headerText.includes('磨损度') || !headerText.includes('价格')) continue;

    const rows = table.querySelectorAll('tbody tr.ant-table-row, tbody tr');
    for (const row of rows) {
      if (row.classList.contains('ant-table-expanded-row')) continue;

      const rowText = row.textContent || '';
      const wearMatch = rowText.match(WEAR_REGEX);
      const priceMatch = rowText.match(PRICE_REGEX);

      const floatValue = wearMatch ? parseFloat(wearMatch[1]) : null;
      const price = priceMatch ? parseFloat(priceMatch[1]) : null;

      if (price == null || isNaN(price)) continue;

      items.push({
        platform: 'uuyp',
        goods_id: goodsId,
        float_value: floatValue,
        price: price,
        goods_name: goodsName
      });
    }
    break;
  }

  return { items, goodsName: goodsName || '未知商品' };
}

function hasProductElements() {
  const tables = document.querySelectorAll('table.ant-table, table');
  for (const table of tables) {
    const thead = table.querySelector('thead');
    if (thead?.textContent?.includes('磨损度')) {
      const rows = table.querySelectorAll('tbody tr.ant-table-row, tbody tr');
      if (rows.length > 0) return true;
    }
  }
  return false;
}

  registerScraper('uuyp', {
    parseGoodsId,
    getGoodsName,
    extractProductData,
    hasProductElements
  });
})();
