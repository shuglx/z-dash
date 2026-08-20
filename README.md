# Z-DASH

程序员个人工作台。纯静态站点（原生 HTML/CSS/JS，零依赖、零框架、零 CDN），离线可用，支持 PC / 移动端响应式。赛博朋克 / 极客终端风。

## 功能

### 待办事项 `#/todo`
- 三栏看板：未启动 / 进行中 / 已完成
- PC 端拖拽卡片切换状态；移动端卡片 `→` 按钮快捷切换
- 新建 / 编辑 / 删除，优先级 P0-P2，项目标签，截止日期
- 标题 `[TAG]` 前缀自动高亮（如 `[BUG]`、`[FEAT]`）
- 已完成任务一键 `arch` 归档进历史
- 快捷键 `N` 新建任务

### 历史归档 `#/archive`
- 关键词搜索（标题 / 项目 / 日期）
- 时间范围：近 1 周 / 1 个月 / 3 个月 / 全部 / 自定义区间（默认近 1 个月）
- 月历视图，完成日红点打点，点日期过滤当日清单
- 记录可删除

### 常用链接 `#/links`
- 链接增删改、点击新窗口跳转
- 分组管理：新建 / 重命名 / 折叠分组
- 删除分组前强制校验：组内链接必须先清空（移出或删除）
- 离线无 favicon，自动退化为字母方块图标

## 数据存储

数据源为 `data/` 目录下的本地 JSON 文件（`todos.json` / `archive.json` / `links.json`），三级读写策略：

| 模式 | 条件 | 说明 |
|------|------|------|
| **FS-SYNC 实时读写**（推荐） | Chrome / Edge，通过 `http://localhost` 访问 | 点侧边栏「连接DATA」授权 `data/` 目录一次，之后所有增删改直接实时写回 JSON 文件；句柄存 IndexedDB，刷新免重复授权 |
| CACHE 缓存 | 任意浏览器 | 读写 localStorage，点「导出JSON」下载后覆盖 `data/*.json` 落盘 |
| 种子兜底 | `file://` 直开且无缓存 | 展示 `assets/js/seed.js` 内置数据 |

### 本地运行

```bash
cd z-dash
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

也可以直接双击 `index.html` 打开（降级为缓存 / 种子模式）。

## 主题

暗色（默认）与亮色可切换，侧边栏 / 移动端顶栏均有切换按钮，选择持久化保存。

## 目录结构

```
z-dash/
├── index.html               # 入口
├── assets/
│   ├── css/style.css        # 主题变量 + 全部样式
│   └── js/
│       ├── seed.js          # 兜底种子数据
│       ├── store.js         # 数据层（FS Access / localStorage / 导出）
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
- File System Access API 实现浏览器实时读写本地文件
- 系统等宽字体栈，无任何外部资源，完全离线
