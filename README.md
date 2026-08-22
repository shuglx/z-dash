# Z-DASH

程序员个人工作台。极简后端 + 原生前端（HTML/CSS/JS，零依赖、零框架、零 CDN），所有修改实时写入 `data/` 目录的 JSON 文件，支持 PC / 移动端响应式。赛博朋克 / 极客终端风。

## 功能

### 待办事项 `#/todo`
- 三栏看板：未启动 TODO / 进行中 PROGRESS / 已完成 DONE
- 列内按项目自动分组（同项目归一组，未分组置底）
- 每任务含：标题（`[TAG]` 高亮）、优先级 P0-P2、项目、截止日期、可选详情 desc
- 隐藏字段：创建日期 `createdAt`、完成日期 `doneAt`（= 最后一次放入 DONE 的日期）
- PC 端拖拽切换状态；卡片箭头快捷切换：TODO 仅 `→`、PROGRESS 有 `←→`、DONE 仅 `←`
- 已完成任务卡片右上角 `ARCHIVE` 按钮（灰色边框）归档进历史（保留详情，日历按完成日期打点）
- `↓ WEEK REPORT` 导出本周工作为 Markdown（待办/进行中全部 + 已完成限本周）
- 快捷键 `N` 新建任务

### 历史归档 `#/archive`
- 关键词搜索（标题 / 项目 / 详情 / 日期）
- 范围筛选按钮：全部 / 本周 / 近 1 月 / 近 3 月 + 自定义日期区间
- 月历视图：当天任务数以数字徽标显示（固定右下角），点日期过滤列表（日历标记保留）
- 记录 `[view]` 查看详情（含创建/完成/归档日期与详情）、`[del]` 删除
- 前端分页（每页 10 条）
- `↓ EXPORT REPORT` 导出当前筛选结果为 Markdown

### 常用链接 `#/links`
- 链接增删改、点击新窗口跳转
- 每个链接必须归属某个分组（新建/编辑时必选，无 UNGROUPED）
- URL 支持任意协议（`https://`、`smb://`、`ssh://`、`mailto:` 等，需以合法协议开头）
- 分组管理：新建 / 重命名 / 折叠分组
- 删除分组前强制校验：组内链接必须先清空（移至其他分组或删除）
- 离线无 favicon，自动退化为字母方块图标
- 顶部 grep 搜索框：按名称 / URL 实时筛选，匹配分组自动展开，无结果显示空状态

### 数据统计 `#/stats`
- KPI 四卡：累计归档 / 本周完成 / 进行中 / 项目数
- STREET CRED 街区声望面板：等级徽章、XP 进度、streak、下一阶位提示（`👁 阶位` 按钮可预览全部 8 个声望阶位的挂件/面板/升级弹窗效果）
- GitHub 风格完成热力图（近 53 周，按归档 doneAt 打点，自定义 tooltip，宽度自适应）
- 项目分布横向条形图（归档 + 待办合并 Top 8）
- 近 12 周完成趋势柱状图（本周高亮）

### 工具抽屉 `#/tools`
- TIMESTAMP：时间戳（秒/毫秒自动识别）⇄ 日期时间双向联动；日期用自定义日历选择器（今天高亮、时分秒循环调节、确定关闭）
- JSON：格式化 / 压缩 / 复制，错误提示
- REGEX：正则实时测试，命中高亮 + 列表（含捕获组）
- ENCODE：MD5（纯 JS 实现）/ Base64 编解码 / URL 编解码，结果一键大小写转换与复制
- 2×2 面板网格，占满视口均分无滚动

### 全局
- 快捷键：数字 `1-9` 切页、`N` 新建、`E` 编辑/查看鼠标 hover 的项
- 所有弹层支持 `Esc` 关闭
- 侧边栏 STREET CRED 挂件：声望徽章 + 等级 + XP LED 进度条 + streak（紧贴 SYS MONITOR 上方）
- 侧边栏 SYS MONITOR：CPU / 内存 / 磁盘 LED 条（`GET /api/sys`，3 秒轮询，超阈值变色）
- 页面面包屑尾部终端光标闪烁动效

## 街区声望系统（XP）

把工作台玩成游戏：完成任务得 XP，连续归档攒 streak，优先级越高分越多。

### 计分规则

- **结算时机**：归档即结算 —— 点击任务卡 `ARCHIVE` 按钮的瞬间 XP 到账；删除归档记录则相应扣回
- **单条 XP = 优先级基础分 + streak 加成**：

| 优先级 | 基础分 |
|---|---|
| P0 紧急 | 30 |
| P1 重要 | 20 |
| P2 普通 | 10 |

| 归档当日连续工作日 | 加成 |
|---|---|
| ≥ 30 天 | +60 |
| ≥ 14 天 | +30 |
| ≥ 7 天 | +15 |
| ≥ 3 天 | +5 |

- **streak 按工作日连续**：周六/日自动跳过不算断签（周五归档 → 下周一归档 = 连续 2 天）；今天还没归档不判死，保留到当天结束；同时记录最长 streak（BEST）；断签无惩罚，仅加成清零

### 等级与阶位

- 升级所需 XP：Lv1-24 每级 `50 + 25×(L-1)`；Lv25 起每级 `710 + 85×(L-25)`（25 级后明显变陡）；封顶 Lv50
- 8 档声望阶位（徽章 + 代号 + 专属色）：

| Lv 区间 | 徽章 | 代号 | 阶位 |
|---|---|---|---|
| 1-4 | `·` | NOBODY | 无名之辈 |
| 5-9 | `▸` | ROOKIE | 街区新人 |
| 10-14 | `◆` | STREET KID | 街头小子 |
| 15-19 | `◈` | FIXER | 中间人 |
| 20-26 | `✦` | NETRUNNER | 网络黑客 |
| 27-34 | `❖` | CORPO | 企业寡头 |
| 35-44 | `★` | LEGEND | 夜之城传奇 |
| 45-50 | `Ω` | ICON | 活着的传说 |

### 反馈

- 归档 toast：`ARCHIVED → +25 XP (P1 20 + STREAK 5)`
- 升级时刻：LEVEL UP 专用弹窗（金色标题 + 新阶位徽章，LV 数字跟随阶位色）
- 侧边栏挂件实时刷新；`#/stats` 声望面板含 XP 构成（基础/加成/优先级计数）

### 数据口径

- 纯派生计算：XP / 等级 / streak 全部由 `archive.json` 实时推导，**不新增数据文件、零迁移**
- 起算锚点 `config.xpSince`（首次启动自动写入当天）：仅完成日期 ≥ 锚点的归档计分，更早的历史归档保留展示与统计、不计 XP
- 升级弹窗判据 `localStorage['zd-xp-lv']`，数据重置后自动向下同步

## 数据存储

数据源为 `data/` 目录下的本地 JSON 文件（`todos.json` / `archive.json` / `links.json`）。由极简后端 `server.js` 负责读写：

| 模式 | 条件 | 说明 |
|------|------|------|
| **LIVE 实时读写**（默认） | 通过 `server.js` 启动访问 | 所有增删改通过 `PUT /api/<key>` 实时写回 `data/*.json`（临时文件 + 原子改名，杜绝写坏） |
| SEED 种子只读 | `file://` 直开 / 后端不可达 | 展示 `assets/js/seed.js` 内置数据，改动不落盘 |

> 为什么需要后端：浏览器安全限制，纯前端 + 静态服务器无法直接写服务器的文件系统，必须由一个小进程承担写盘。

### 启动（个人电脑日常用法）

启动脚本统一在 `bin/` 目录，覆盖三大平台：

| 平台 | 命令 | 说明 |
|---|---|---|
| macOS / Linux | `./bin/start.sh` | 启动后端 + 自动打开浏览器，Ctrl+C 停止；换端口 `./bin/start.sh 8001` |
| macOS 双击 | 双击 `bin/start.command` | 用 Terminal 打开并启动 |
| Windows | `bin\start.bat`（双击或命令行） | 服务跑在独立最小化窗口，关闭该窗口即停止 |

Node 需要 18.20.8+（零第三方依赖）。

手动启动方式：`node server.js 8000`，然后打开 `http://localhost:8000`。直接双击 `index.html` 则降级为种子只读模式。

### 自动备份

服务运行期间每天 **00:01** 自动将 `data/` 全部 JSON 打包为 `data_backup/z-dash-backup-<时间戳>.tar.gz`（零依赖 tar+gzip，程序未运行则跳过当天）。默认保留 7 个，超出删最旧；保留数改 `config.json` 的 `backupKeep` 字段。手动立即备份：`node server.js --backup-now`。

## 主题

暗色（默认）与亮色可切换，侧边栏 / 移动端顶栏均有切换按钮。

## 全局配置 `data/config.json`

用户偏好统一持久化在 `data/config.json`（与其他数据同走 `GET/PUT /api/config`，新增功能直接加字段即可）：

| 字段 | 说明 | 默认 |
|---|---|---|
| `theme` | `dark` / `light` 主题 | `dark` |
| `pet` | 桌宠开关 | `true` |
| `xpSince` | 声望系统起算锚点（该日期前的归档不计 XP） | 首次启动自动写入当天 |
| `backupKeep` | 自动备份保留个数（data_backup/ 目录, 已 gitignore） | `7` |

## 桌宠

右下角常驻透明动画桌宠（移植自开源项目 [dsh-pet](https://github.com/PC2005-cloud/dsh-pet)，MIT 协议，原为 DeepSeek Harness 插件，此处移植为原生 JS）：

- 透明 webm 动画（`assets/pet/`）：待机呼吸、写代码、小提琴、三支舞、四季动作……新增动作只需把素材放进 `assets/pet/` 并在 `assets/js/pet.js` 的 `ACTS` / `CLICKS` 等池中登记动画名即可
- 永不停止的动画链：每段播完按概率选下一个（30% 待机 / 10% 转向 / 40% 动作 / 20% 漫游移动）
- 点击有随机回应（开心 / 害羞 / 傲娇 / 元气挥手 / 挠痒）；按住拖动可放到任意位置
- 双缓冲 video 交叉淡入，切换零空白帧；支持 `prefers-reduced-motion`
- 侧边栏 / 移动端顶栏「桌宠」按钮开关，状态持久化到 `config.json`（默认开）

## 目录结构

```
z-dash/
├── index.html               # 入口
├── server.js                # 极简后端：静态服务 + JSON 读写 API（Node 18+）
├── bin/                     # 启动脚本（三平台）
│   ├── start.sh             #   macOS / Linux
│   ├── start.command        #   macOS 双击入口
│   └── start.bat            #   Windows
├── assets/
│   ├── css/style.css        # 主题变量 + 全部样式
│   ├── pet/                 # 桌宠透明动画（webm, 可随时增减）
│   └── js/
│       ├── seed.js          # 种子只读数据
│       ├── store.js         # 数据层（GET/PUT /api/<key>）
│       ├── ui.js            # 弹层表单 / 确认框 / toast
│       ├── xp.js            # 街区声望系统（XP/等级/streak 派生计算）
│       ├── views-stats.js   # 数据统计（热力图 / 图表）
│       ├── views-todo.js    # 待办看板
│       ├── views-archive.js # 历史归档
│       ├── views-weekly.js  # 周报管理
│       ├── views-tools.js   # 工具抽屉（时间戳 / JSON / 正则 / 加解密）
│       ├── views-links.js   # 常用链接
│       ├── pet.js           # 桌宠（动画链 / 拖拽 / 漫游）
│       └── app.js           # hash 路由 / 导航 / 主题 / 快捷键
└── data/
    ├── todos.json
    ├── archive.json
    ├── links.json
    └── config.json
```

## 技术说明

- Hash 路由单页应用：`#/todo` `#/archive` `#/links`
- 响应式断点 820px：PC 侧边栏 / 移动端底部 Tab 栏
- HTML5 Drag & Drop 实现看板拖拽
- 后端 `server.js` 以 `GET/PUT /api/<key>` 实时读写 `data/*.json`（临时文件 + 原子改名写盘）
- 系统等宽字体栈，无任何外部资源，完全离线
