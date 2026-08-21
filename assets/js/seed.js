/* Z-DASH 种子数据 — data/*.json 不可用时（file:// 直开 / 首次使用）的兜底数据源 */
window.SEED = {
  config: {
    version: 1,
    theme: "dark",
    pet: true
  },
  todos: {
    version: 1,
    items: [
      { id: "t-0001", title: "[BUG] 修复 CI 流水线 flaky test", status: "todo", priority: "P0", project: "infra", dueDate: "2026-08-21", desc: "偶发超时，疑似 cache 命中不一致，需复现后打补丁。", createdAt: "2026-08-18T09:12:00", doneAt: null },
      { id: "t-0002", title: "给 z-dash 写 README 和部署脚本", status: "todo", priority: "P2", project: "self", dueDate: "2026-08-25", createdAt: "2026-08-16T14:30:00", doneAt: null },
      { id: "t-0003", title: "[FEAT] 调研 sqlite-wasm 做本地存储", status: "todo", priority: "P1", project: "dev", dueDate: "2026-08-30", createdAt: "2026-08-15T10:05:00", doneAt: null },
      { id: "t-0004", title: "重构 auth 模块，抽掉全局 session", status: "doing", priority: "P0", project: "gateway", dueDate: "2026-08-20", createdAt: "2026-08-12T11:00:00", doneAt: null },
      { id: "t-0005", title: "[DOC] 补全 API 网关限流设计文档", status: "doing", priority: "P1", project: "gateway", dueDate: "2026-08-22", createdAt: "2026-08-13T16:45:00", doneAt: null },
      { id: "t-0006", title: "升级 Node 22，修掉 deprecation 告警", status: "done", priority: "P1", project: "infra", dueDate: null, createdAt: "2026-08-10T09:00:00", doneAt: "2026-08-19T10:32:00" },
      { id: "t-0007", title: "代码评审：PR #482 webhook 重试逻辑", status: "done", priority: "P2", project: "gateway", dueDate: null, createdAt: "2026-08-09T15:20:00", doneAt: "2026-08-18T18:05:00" }
    ]
  },
  archive: {
    version: 1,
    items: [
      { id: "a-0001", title: "排查线上 Redis 连接泄漏", project: "infra", priority: "P0", desc: "连接数持续增长，确认是 maxIdle 设置过小导致频繁重建连接，已调大并加监控告警。", createdAt: "2026-08-10T09:00:00", doneAt: "2026-08-15", archivedAt: "2026-08-16T09:00:00" },
      { id: "a-0002", title: "写完季度 OKR 复盘", project: "self", priority: "P2", createdAt: "2026-08-01T10:00:00", doneAt: "2026-08-12", archivedAt: "2026-08-13T20:11:00" },
      { id: "a-0003", title: "迁移日志采集到 OTel", project: "observ", priority: "P1", createdAt: "2026-07-20T09:00:00", doneAt: "2026-08-08", archivedAt: "2026-08-09T10:40:00" },
      { id: "a-0004", title: "修复登录页 401 重定向死循环", project: "gateway", priority: "P0", createdAt: "2026-07-29T11:00:00", doneAt: "2026-08-03", archivedAt: "2026-08-04T11:22:00" },
      { id: "a-0005", title: "整理内部 npm registry 白名单", project: "infra", priority: "P2", createdAt: "2026-07-15T10:00:00", doneAt: "2026-07-28", archivedAt: "2026-07-29T09:15:00" }
    ]
  },
  weekly: {
    version: 1,
    items: []
  },
  links: {
    version: 1,
    groups: [
      { id: "g-01", name: "DEV", collapsed: false },
      { id: "g-02", name: "INTERNAL", collapsed: false }
    ],
    items: [
      { id: "l-0001", title: "GitHub", url: "https://github.com", groupId: "g-01", createdAt: "2026-08-01T10:00:00" },
      { id: "l-0002", title: "Stack Overflow", url: "https://stackoverflow.com", groupId: "g-01", createdAt: "2026-08-01T10:01:00" },
      { id: "l-0003", title: "MDN Web Docs", url: "https://developer.mozilla.org", groupId: "g-01", createdAt: "2026-08-01T10:02:00" },
      { id: "l-0004", title: "内部持续交付", url: "https://cd.internal.corp/pipeline", groupId: "g-02", createdAt: "2026-08-02T09:00:00" },
      { id: "l-0005", title: "Grafana 看板", url: "https://grafana.internal.corp/d/ops", groupId: "g-02", createdAt: "2026-08-02T09:05:00" }
    ]
  }
};
