# CS2CT 皮肤数据抓取 Chrome 插件

抓取不同平台（BUFF、悠悠有品、ECO、C5GAME 等）的皮肤商品信息，并保存为 JSONL 格式文件。

## 功能

- **弹窗面板**：点击扩展图标打开弹窗
- **录制模式**：开始录制后，访问商品页会自动抓取数据
- **统计面板**：按皮肤名称（如「FN57 | 涂鸦潦草 (略有磨损)」）统计抓取数量
- **保存 / 清除**：保存为 JSONL 到本地，或清除所有数据

## 抓取字段

| 字段 | 说明 |
|------|------|
| `platform` | 平台标识：`buff` / `uuyp` / `eco` / `c5` |
| `goods_id` | 商品 ID |
| `float_value` | 磨损度，无磨损为 `null` |
| `price` | 价格（人民币） |
| `goods_name` | 皮肤名称（跨平台通用） |

## 使用方法

1. 点击浏览器工具栏中的插件图标，打开弹窗
2. 点击「开始录制」
3. 访问商品页，数据会自动抓取：
   - BUFF：`https://buff.163.com/goods/857652`
   - 悠悠有品：`https://www.youpin898.com/market/goods-list?templateId=xxx`
   - ECO：`https://www.ecosteam.cn/goods/730-18761-1-laypageSale-0-1.html`
   - C5GAME：`https://www.c5game.com/csgo/553479334/item/sell`
4. 弹窗实时显示各皮肤抓取数量
5. 点击「停止录制」结束
6. 点击「保存到本地」下载 JSONL 文件
7. 点击「清除」清空所有数据

## 安装方法

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择 CSPlugin 目录

## 文件结构

```
CSPlugin/
├── manifest.json       # 插件配置
├── background.js      # 后台服务（录制状态、数据累积）
├── content.js         # 内容脚本（入口、录制逻辑）
├── platforms/         # 平台抓取模块（高内聚低耦合）
│   ├── platformRegistry.js  # 平台注册与调度
│   ├── buff.js        # BUFF 抓取
│   ├── uuyp.js        # 悠悠有品抓取
│   ├── eco.js         # ECO 在售抓取
│   └── c5.js          # C5GAME 在售抓取
├── popup.html
├── popup.js
├── logo.png
└── README.md
```

### 新增平台

1. 在 `platforms/platformRegistry.js` 的 `PLATFORMS` 中注册：`{ host: 'xxx.com', scraper: null, isExpectedUrl }`
2. 新建 `platforms/xxx.js`，实现 `parseGoodsId`、`getGoodsName`、`extractProductData`、`hasProductElements`，并调用 `registerScraper`
3. 若分页不改变 URL（如 UUYP、C5），需实现 `getEffectiveUrl(baseUrl)` 将页码拼接到 URL 用于去重
4. 在 `manifest.json` 的 `content_scripts.js` 中按顺序加入新文件
5. 在 `manifest.json` 的 `host_permissions` 和 `content_scripts.matches` 中加入新平台的 URL 模式
6. 在 `background.js` 的 `CONTENT_SCRIPT_FILES` 和 `TARGET_URL_PATTERNS` 中加入新平台
