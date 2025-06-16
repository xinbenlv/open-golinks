## 🧭 Google Analytics Data API 集成指南（适用于 Heroku + Node.js）

我们将从 Heroku 上的 Node.js 应用访问 **GA4 数据（如用户数、页面浏览数等）**，使用 **Google Analytics Data API v1**，通过 **Service Account 服务账户 + 环境变量** 实现安全认证。

---

### 🧱 第一步：GCP 配置

#### 1. 启用 GA4 Data API

* 打开 GCP 控制台：[https://console.cloud.google.com/apis](https://console.cloud.google.com/apis)
* 切换到你项目 → 搜索 `Google Analytics Data API v1`
* 启用该 API

#### 2. 创建服务账户

* 进入：**IAM & Admin → Service Accounts**
* 创建服务账户，例如命名为 `analytics-data-reader`
* 点击该账户 → "Keys" → “Add Key” → 选择 JSON，下载密钥文件（`your-key.json`）

#### 3. 给该服务账户授权 GA4 权限

⚠️ 非常关键！否则服务账户没有权限读取数据：

* 打开 [Google Analytics](https://analytics.google.com/) 后台
* 进入目标 GA4 Property → Admin → Account Access Management
* 添加服务账户的邮箱（如：`xxx@your-project.iam.gserviceaccount.com`）为 **Viewer** 或 **Analyst**

---

### 🔐 第二步：将服务账户密钥设置为 Heroku 环境变量

#### 使用一行命令设置（最简方式）：

```bash
heroku config:set GOOGLE_APPLICATION_CREDENTIALS_JSON="$(cat /path/to/your-key.json | base64)"
```

⚠️ 注意用 `"` 包住 `$(...)`，防止换行导致错误。

---

### ⚙️ 第三步：在 Node.js 中使用 GCP SDK 并加载凭据

#### 1. 安装依赖

```bash
npm install @google-analytics/data fs
```

#### 2. 在代码中加载服务账户凭据

```js
const fs = require('fs');
const {BetaAnalyticsDataClient} = require('@google-analytics/data');

// Step 1: 写入 JSON 凭据到 Heroku 的 /tmp 临时文件
const credentials = Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON, 'base64').toString('utf-8');
const tempKeyPath = '/tmp/gcp-key.json';
fs.writeFileSync(tempKeyPath, credentials);

// Step 2: 设置给 GCP SDK 使用
process.env.GOOGLE_APPLICATION_CREDENTIALS = tempKeyPath;

// Step 3: 初始化 SDK 客户端
const analyticsDataClient = new BetaAnalyticsDataClient();

// Step 4: 运行一个简单的报告
async function runReport() {
  const [response] = await analyticsDataClient.runReport({
    property: 'properties/YOUR_GA4_PROPERTY_ID', // ← 替换成你的 GA4 property ID，如 "properties/123456789"
    dateRanges: [{startDate: '7daysAgo', endDate: 'today'}],
    dimensions: [{name: 'city'}],
    metrics: [{name: 'activeUsers'}],
  });

  console.log('Report result:');
  response.rows.forEach(row => {
    console.log(`${row.dimensionValues[0].value}: ${row.metricValues[0].value}`);
  });
}

runReport();
```

---

### 🧪 测试检查点

* [ ] `heroku config:get GOOGLE_APPLICATION_CREDENTIALS_JSON` 能打印出内容
* [ ] `/tmp/gcp-key.json` 写入成功（Heroku 的临时路径）
* [ ] SDK 能正常初始化、返回 GA4 报告数据

---

### 📦 可选优化

* 将加载凭据逻辑封装为模块，如 `loadGCPKey()`，提高复用性；
* 如果将来接入其他 GCP 服务（如 BigQuery, Storage），此流程同样适用；
