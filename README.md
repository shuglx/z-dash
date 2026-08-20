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
- 关键词搜索（标题 / 项目 / 日期）
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

## 数据存储

数据源为 `data/` 目录下的本地 JSON 文件（`todos.json` / `archive.json` / `links.json`）。由极简后端 `server.js` 负责读写：

| 模式 | 条件 | 说明 |
|------|------|------|
| **LIVE 实时读写**（默认） | 通过 `server.js` 启动访问 | 所有增删改通过 `PUT /api/<key>` 实时写回 `data/*.json`（临时文件 + 原子改名，杜绝写坏） |
| SEED 种子只读 | `file://` 直开 / 后端不可达 | 展示 `assets/js/seed.js` 内置数据，改动不落盘 |

> 为什么需要后端：浏览器安全限制，纯前端 + 静态服务器无法直接写服务器的文件系统，必须由一个小进程承担写盘。

### 启动（个人电脑日常用法）

```bash
cd z-dash
./start.sh        # 启动后端 + 自动打开浏览器，Ctrl+C 停止
./start.sh 8001   # 换端口
```

macOS 也可以直接**双击 `start.command`**（会用终端打开并启动）。Node 需要 18.20.8+（零第三方依赖）。

手动启动方式：`node server.js 8000`，然后打开 `http://localhost:8000`。直接双击 `index.html` 则降级为种子只读模式。

## 主题

暗色（默认）与亮色可切换，侧边栏 / 移动端顶栏均有切换按钮，选择持久化保存。

## 目录结构

```
z-dash/
├── index.html               # 入口
├── server.js                # 极简后端：静态服务 + JSON 读写 API（Node 18+）
├── start.sh                 # 一键启动脚本（终端）
├── start.command            # macOS 双击启动入口
├── assets/
│   ├── css/style.css        # 主题变量 + 全部样式
│   └── js/
│       ├── seed.js          # 种子只读数据
│       ├── store.js         # 数据层（GET/PUT /api/<key>）
│       ├── ui.js            # 弹层表单 / 确认框 / toast
│       ├── views-todo.js    # 待办看板
│       ├── views-archive.js # 历史归档
│       ├── views-links.js   # 常用链接
│       └── app.js           # hash 路由 / 导航 / 主题 / 快捷键
└── data/
    ├── todos.json
    ├── archive.json
    └── links.json
```

## 技术说明

- Hash 路由单页应用：`#/todo` `#/archive` `#/links`
- 响应式断点 820px：PC 侧边栏 / 移动端底部 Tab 栏
- HTML5 Drag & Drop 实现看板拖拽
- 后端 `server.js` 以 `GET/PUT /api/<key>` 实时读写 `data/*.json`（临时文件 + 原子改名写盘）
- 系统等宽字体栈，无任何外部资源，完全离线
