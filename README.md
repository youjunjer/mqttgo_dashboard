# mqttgo_dashboard

這是一個以瀏覽器操作的 MQTT Web 控制台，可用來連線 Broker、發布訊息、訂閱 Topic，並將收到的資料即時顯示在 Dashboard。

## 功能

- 連線至 MQTT Broker（WebSocket / WSS）
- 發布 MQTT 訊息
- 訂閱一個或多個 Topic
- 顯示訊息列表
- 依 Topic 建立 Dashboard 元件
- 支援地圖座標顯示
- 支援將 Dashboard 匯出為獨立 HTML

目前 Dashboard 支援的顯示類型：

- 圖片
- 圖片(base64)
- 文字方塊
- 甜甜圈圖
- 溫度圖
- 類比圖
- 水位圖
- 折線圖
- 長條圖
- 滑動開關

## 文字方塊

`文字方塊` 用於顯示最新收到的 Topic 內容。

- 標題使用使用者設定的名稱
- 內容顯示最新 MQTT payload
- 若有設定單位，會顯示為 `payload + 單位`
- 若尚未收到資料，預設顯示 `--`

適合顯示：

- 溫度、濕度、電壓等單值資料
- `ON` / `OFF`
- `正常` / `異常`
- 純文字狀態訊息

## 使用方式

1. 開啟 [`index.html`](/home/youadmin/html/index.html)
2. 按 `連線`
3. 在 `推播 Publish` 區塊可手動發送訊息
4. 在 `Subscriptions` 區塊新增訂閱 Topic
5. 選擇要建立的 Dashboard 類型
6. 設定名稱、單位等欄位後按 `Subscribe`
7. Dashboard 會即時顯示該 Topic 的資料

## 匯出 Dashboard

按下頁面上的 `Dashboard儲存` 後，會產生一份獨立 HTML。

匯出檔案特性：

- 會保留 Broker 位址、Port、Topic、Widget 設定
- 不會匯出主頁連線表單中的帳號密碼
- 開啟後可獨立連線 Broker 並顯示資料

## 專案結構

- [`index.html`](/home/youadmin/html/index.html): 主頁介面
- [`js/app.js`](/home/youadmin/html/js/app.js): MQTT 連線、訂閱、Dashboard 產生邏輯
- [`css/style.css`](/home/youadmin/html/css/style.css): 自訂樣式
- [`assets/`](/home/youadmin/html/assets): 圖示與圖片資源

## 部署

此專案為靜態網站，可直接放入 Web 伺服器目錄使用，例如 Apache 或 Nginx。

如果只想本機測試，也可直接以瀏覽器開啟 `index.html`，但 Dashboard 與部分外部資源仍需網路連線。
