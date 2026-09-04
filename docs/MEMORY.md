# Tool Service MEMORY

本文档记录当前仓库已经落地的实现事实，覆盖项目结构、运行链路、核心模块、接口契约、页面交互、缓存策略、历史包袱和维护约束。

## 1. 使用原则

- 这里记录的是“当前实现事实”，不是需求草稿。
- 当 README、历史方案文档、口头描述与当前代码冲突时，以当前代码为准。
- 当前事实源优先级：
  1. `src/main/java/**`
  2. `src/main/resources/**`
  3. `pom.xml`
  4. 本文档
  5. `README.md`、`ARCHITECTURE_ANALYSIS.md`、React/Node 原型目录

## 2. 仓库结构分层

### 2.1 Primary：当前有效主链路

- `package.json` / `vite.config.ts`
  - 当前主构建入口与 Electron 打包配置。
- `electron/**` (`main.ts`, `server.ts`, `preload.ts`)
  - 当前桌面端主进程与内置轻量 Node.js HTTP 协同服务。
- `resources/templates/md-preview.html`
  - 当前 Markdown 预览主页面。
- `resources/static/md-search.js`
  - 当前页面的本地全文搜索脚本。
- `docs/MEMORY.md`
  - 当前事实手册。

> 提示：原 `src/main/java/**`、`pom.xml` 及 Spring Boot 达梦数据库历史模块已彻底剥离移除。

### 2.2 Secondary：并存但未接入当前主发布链路的原型

- `src/App.tsx`、`src/main.tsx`、`src/components/**`、`src/hooks/**`、`src/stores/**`、`src/styles/**`
  - 一套 React/Vite 前端原型。
- `server/**`
  - 一套独立 Node 文件服务原型。
- `package.json`、`vite.config.ts`、`tailwind.config.js`
  - 对应上述 React/Vite 原型的构建配置。

### 2.3 Archive：历史说明或方案文档

- `README.md`
  - 当前内容主要描述 React + Node 的 MD Preview Tool，不是当前真实主链路说明。
- `ARCHITECTURE_ANALYSIS.md`
  - 架构分析与建议稿，不是现状事实源。
- `mcp-config/*.json`
  - MCP 客户端样例配置，不驱动当前服务端运行。
- `openspec/**`
  - 需求和变更过程资产，不属于运行时实现。

## 3. 当前有效架构

### 3.1 应用定位

当前项目是一个基于 Spring Boot 的本地工具服务，主要提供两类能力：

- 面向 AI 客户端的 MCP / HTTP 数据库工具能力
- 面向本地 Markdown 文档的浏览、预览、原文查看、保存、下载和请求调试能力

### 3.2 当前运行主链路

```text
Spring Boot 应用
├─ HTTP / REST 入口
│  ├─ /api/mcp/**         数据库工具与 MCP 兼容接口
│  ├─ /api/health/**      健康检查
│  └─ /api/md/** + /md-*  Markdown 预览工作台
├─ 工具层
│  ├─ DatabaseMcpTool
│  └─ MarkdownMcpTool
├─ 服务层
│  ├─ DatabaseQueryService
│  └─ QueryHistoryService
├─ 协议层
│  └─ McpProtocolHandler
└─ 资源层
   ├─ 达梦数据库
   └─ 本地 Markdown 文件系统
```

### 3.3 当前真实页面链路

- 页面入口：`GET /md-view`
- 页面模板：`src/main/resources/templates/md-preview.html`
- 页面数据接口：
  - `GET /api/md/workspace-config`
  - `GET /api/md/preview-data`
  - `GET /api/md/sidebar-data`
  - `GET /api/md/document-data`
  - `GET /md-content`
  - `GET /md-download`
  - `POST /api/md/save-content`

当前页面不是 React/Vite 构建产物，而是服务端直接返回模板页，前端逻辑以内联脚本和 `md-search.js` 为主。

## 4. 启动、构建与配置体系

### 4.1 启动入口

- 主类：`ToolServiceApplication`
- 默认端口：`9527`
- 主配置文件：`src/main/resources/application.yml`

### 4.2 配置导入顺序

`application.yml` 会导入以下配置：

- 外部文件：
  - `config/application-dameng.yml`
  - `config/application-md.yml`
  - `config/application-mcp.yml`
- classpath 默认文件：
  - `application-dameng.yml`
  - `application-md.yml`
  - `application-mcp.yml`

结论：

- 运行目录下 `config/` 中的同名配置优先于 classpath 默认配置。
- `src/main/resources/application-datasource.yml` 已标记为弃用说明文件。

### 4.3 功能开关

- `tool-service.dameng.enabled`
  - 控制数据库相关 HTTP 接口、MCP 控制器、协议层与数据库工具是否启用。
- `tool-service.markdown.enabled`
  - 只影响 `MarkdownMcpTool` 是否对 MCP 工具列表暴露 Markdown 工具。
  - 不影响 `MarkdownPreviewController` 的页面与 HTTP 预览接口。

### 4.4 CORS 与异常

- `CorsConfig`
  - 对所有路径放开跨域、方法和请求头。
- `GlobalExceptionHandler`
  - 对资源 404 返回统一 JSON。
  - 其他异常统一返回 `500` 和裁剪后的堆栈摘要。

## 5. 数据库模块

### 5.1 数据源实现事实

- 固定 Bean：
  - `masterDataSource`
  - `ssoDataSource`
- 主数据源：
  - `master`
- 动态数据源：
  - 对除 `master` / `sso` 以外的名称，`DataSourceConfig.getDataSource(name)` 会按名称动态创建连接池。

注意：

- 早期文档或图示中提到的“三个固定数据源”不是当前代码的严格事实。
- 当前代码显式维护的固定数据源只有 `master` 和 `sso`。
- 其他数据库名称通过动态创建实现，不应把旧图示直接当成当前固定实现。

### 5.2 数据库配置来源

- 优先使用 `spring.datasource.dynamic.datasource.master.*` 与 `sso.*`
- 当 `DM_DB_ENABLED=true` 时，连接信息可被一组外部环境变量覆盖：
  - `DM_DB_HOST`
  - `DM_DB_PORT`
  - `DM_DB_NAME`
  - `DM_DB_USERNAME`
  - `DM_DB_PASSWORD`

### 5.3 查询与执行行为

- `DatabaseQueryService.executeQuery`
  - 仅允许 `SELECT` / `WITH`
  - 设置 30 秒查询超时
  - 最大返回 1000 行
- `executeUpdate`
  - 执行 DML
- `executeDDL`
  - 执行 DDL
- `executeAutoSql`
  - `auto` 模式下按 SQL 首词自动分发到 query / update / ddl
- `getTableList`
  - 查询 `user_tables`
- `getTableInfo`
  - 查询 `user_tab_columns`
  - 表名会做安全校验和双引号转义

### 5.4 查询历史

- 存储文件：`logs/query_history.csv`
- 记录字段：
  - timestamp
  - sql
  - database
  - type
  - success
  - duration_ms
  - affected_rows
- 单条 SQL 文本最多截断到 500 字符
- `GET /api/mcp/history` 读取最近记录
- `DELETE /api/mcp/history` 清空历史

### 5.5 健康检查

- `GET /api/health`
  - 返回服务状态
- `GET /api/health/db`
  - 通过执行 `SELECT 1` 检测 `master` 数据库可用性

注意：

- 这两个健康检查接口都依赖 `tool-service.dameng.enabled=true`。

## 6. MCP 协议与数据库工具暴露

### 6.1 REST 风格数据库接口

控制器：`McpController`

接口包括：

- `GET /api/mcp/tools`
- `POST /api/mcp/execute`
- `GET /api/mcp/datasources`
- `POST /api/mcp/query`
- `POST /api/mcp/update`
- `POST /api/mcp/ddl`
- `POST /api/mcp/execute-sql`
- `GET /api/mcp/tables`
- `GET /api/mcp/table-info`
- `GET /api/mcp/history`
- `DELETE /api/mcp/history`

### 6.2 JSON-RPC 风格 MCP 接口

控制器：`McpJsonRpcController`

接口包括：

- `POST /api/mcp/json-rpc`
- `GET /api/mcp/sse`
- `GET /api/mcp/capabilities`

### 6.3 协议层行为

`McpProtocolHandler` 当前支持的方法：

- `initialize`
- `tools/list`
- `tools/call`
- `resources/list`
- `resources/templates/list`
- `ping`

当前服务信息：

- `protocolVersion = 2024-11-05`
- `serverName = tool-service`
- `serverVersion = 1.0.0`

### 6.4 工具暴露事实

#### 数据库工具

`DatabaseMcpTool` 当前暴露：

- `dm_query`
- `dm_execute_sql`
- `dm_list_tables`
- `dm_table_info`
- `dm_list_datasources`

#### Markdown 工具

`MarkdownMcpTool` 当前暴露：

- `md_list_files`
- `md_read_file`
- `md_render`

注意：

- `MarkdownMcpTool` 是否返回工具定义取决于 `tool-service.markdown.enabled`
- 但 MCP 控制器整体仍受 `tool-service.dameng.enabled` 控制
- 也就是说，当前代码里数据库功能关闭时，MCP 接口整体不会对外提供，即使 Markdown 工具类本身仍存在

## 7. Markdown 预览工作台

### 7.1 页面定位

Markdown 预览工作台是一页式文档浏览与调试页面，入口是 `/md-view`。

页面固定分为四块：

- 左侧：Markdown 文件树
- 中间：标签栏 + 面包屑 + 预览/原文切换 + 正文区
- 右侧：标题树 TOC
- 最右：请求调试面板

### 7.2 工作目录配置

- 配置键：`markdown.workspace.path`
- 用户级配置文件：
  - `%USERPROFILE%\.tool-service\markdown-preview.properties`
- 读取优先级：
  1. 用户级配置文件
  2. `markdown.base-path`
  3. 桌面目录回退

工作目录配置接口：

- `GET /api/md/workspace-config`
- `POST /api/md/workspace-config`
- `POST /api/md/workspace-config/pick-directory`

返回字段包括：

- `configuredPath`
- `effectivePath`
- `exists`
- `fallbackToDesktop`
- `supportsDirectoryPicker`

注意：

- `pick-directory` 通过 Swing 打开系统目录选择框
- 依赖图形环境
- headless 场景下会返回 `unsupported=true`

### 7.3 页面主数据接口

- `GET /api/md/preview-data`
  - 返回页面壳数据 + 文档数据
- `GET /api/md/sidebar-data`
  - 只返回左树壳层数据
- `GET /api/md/document-data`
  - 只返回当前文档数据
- `GET /md-content`
  - 返回原始 Markdown 文本
- `GET /md-download`
  - 返回下载流
- `POST /api/md/save-content`
  - 保存 Markdown 文本

### 7.4 路径安全规则

- `path` 和 `scope` 都会先规范化：
  - `\` 转 `/`
  - 去首尾 `/`
  - 合并连续 `/`
  - 禁止 `..`
- 解析后的真实路径必须位于当前工作目录下
- 左树、预览、原文、下载、保存使用同一套工作目录基线

### 7.5 页面核心状态

- `currentFilePath`
  - 当前打开的 Markdown 相对路径
- `currentSidebarScope`
  - 当前左树作用域目录
- `currentWorkspaceConfig`
  - 当前工作目录配置对象
- `currentApiSections`
  - 从 Markdown 中提取的接口元数据

localStorage 关键键包括：

- `md-preview-open-tabs`
- `md-preview-tab-history`
- `md-preview-expanded-paths`
- TOC 折叠状态
- 请求调试面板展开状态与内部配置

### 7.6 页面主流程

#### 启动流程

1. 打开 `/md-view`
2. 前端请求 `/api/md/workspace-config`
3. 初始化左树壳层与当前文档
4. 如果 URL 无 `path`，页面保持空壳态
5. 如果 URL 有 `path`，则加载正文、TOC、面包屑和请求元数据

#### 文件打开流程

1. 点击左侧 Markdown 文件
2. 更新 `currentFilePath`
3. 更新地址栏 `/md-view?path=...`
4. 只刷新文档区，不强制重置左树滚动和展开状态
5. 刷新标签、面包屑、TOC、正文和请求面板

#### 预览/原文切换流程

1. 默认进入预览模式
2. 点击“原文本”时通过 `/md-content` 加载原文
3. 切换预览/原文时尽量保持当前阅读位置一致

### 7.7 左侧文件树区域

职责：

- 展示工作目录下 Markdown 树
- 搜索文件
- 定位当前文件
- 复制文件名 / 文件链接
- 维护目录展开状态

关键交互：

- 树节点排序规则
  - 目录（文件夹）优先排在最前，Markdown 文件排在后面
  - 目录与文件各自内部按名称字母升序（忽略大小写、自然数字顺序）独立排序
- 文件夹展开/收起
  - 有 0.2 秒动画
  - 展开状态持久化
- 文件点击
  - 打开文件
  - 不应把左侧树滚到顶部
- 搜索框
  - 按文件名和相对路径匹配
  - 命中内容高亮
  - 自动展开命中的父目录
- Tooltip
  - 长文件名悬浮 0.6 秒显示完整值

### 7.8 顶部标签栏、工具栏、面包屑

标签栏：

- 打开文件会注册标签
- 上限 9 个
- 超限时按访问历史淘汰最久未查看标签
- 支持右键菜单：
  - 关闭当前
  - 关闭其他标签页
  - 关闭所有
- 支持快捷键：
  - `Ctrl+W`
  - `Ctrl+1~9`

工具栏：

- `预览模式`
- `原文本`
- `下载`

面包屑：

- 文件路径段支持固定长度省略
- 可拖选横向查看长文本
- 标题段展示当前阅读位置对应的 1~3 级标题
- 超长内容有悬浮提示

### 7.9 右侧标题树 TOC

职责：

- 展示标题结构
- 支持折叠/展开
- 跟随阅读位置高亮
- 与面包屑、正文滚动、URL hash 联动

交互事实：

- 不同层级缩进已加大
- 展开/收起带 0.2 秒动画
- 点击标题会滚动到正文对应位置

### 7.10 正文区与原文区

正文区能力：

- Markdown HTML 渲染
- 代码高亮
- 标题折叠
- 列表、表格等结构渲染
- 从文档提取接口元数据以驱动请求面板

原文区能力：

- 延迟加载
- 失败时显示错误提示，不是空白
- 与预览区保持滚动位置相对一致

### 7.11 请求调试面板

职责：

- 根据文档中的接口描述生成调试表单
- 支持多请求标签
- 支持 host / port 自定义
- 支持路径参数、查询参数、请求体编辑
- 支持 raw / preview 响应查看

关键交互：

- 面板开关状态持久化
- 文档中的“调用”按钮可直接回填请求信息
- 若只剩一个请求标签，关闭时会重建默认标签

## 8. Markdown 预览性能链路

### 8.1 后端缓存

`MarkdownPreviewCacheService` 提供两类缓存：

- 侧栏缓存
  - Key：`workspacePath + scope`
  - TTL：30 秒
- 文档缓存
  - Key：文件绝对路径
  - 命中条件：`lastModified + fileSize` 一致

缓存失效：

- 工作目录变更后 `clearAll()`
- 保存 Markdown 后 `evictDocument(filePath)`

### 8.2 前端增量加载

前端把加载流程拆为两层：

- `loadShellData`
  - 只负责左树壳层和工作区相关信息
- `loadDocumentData`
  - 只负责当前文档、TOC、面包屑、请求元数据

兼容入口：

- `loadPreviewData`
  - 组合调用壳层与文档层

### 8.3 并发保护

前端通过两种机制防止快速切换时旧请求覆盖新状态：

- `AbortController`
- 自增序列号 `sidebarLoadSeq` / `previewLoadSeq` / `rawLoadSeq`

### 8.4 局部初始化

当前页面已把以下逻辑改为局部或按需执行：

- 原文加载
- 代码高亮
- Tooltip 应用
- 文档区刷新

目标是减少 Markdown 切换时的整页重初始化和闪动。

## 9. 历史原型与边界说明

### 9.1 当前不应当作事实源的内容

- `README.md`
  - 当前主要描述 React + Node 的独立 MD Preview Tool
- `server/**`
  - 独立 Node 文件服务原型
- 根目录 `package.json` / `vite.config.ts`
  - React/Vite 原型构建体系
- `src/**` 下的 React 组件与 hooks
  - 原型前端，不是当前 `/md-view` 主链路
- `ARCHITECTURE_ANALYSIS.md`
  - 架构建议稿，不是现状说明

### 9.2 这些内容的参考价值

- 可作为未来前后端分离或 UI 重构的参考素材
- 不应参与当前事实判断
- 不应继续作为默认项目介绍口径

## 10. 已知约束与维护规则

### 10.1 运行约束

- `pick-directory` 依赖桌面环境
- 当前页面强依赖浏览器 localStorage 维持交互体验
- `mvn clean` 可能因运行中的模板文件占用而失败
- `mvn -Dproject.build.directory=target-verify compile` 可用于绕开当前 target 锁文件问题

### 10.2 修改优先级

后续若修改 Markdown 页面行为，优先同步本文档，而不是继续依赖 README。

### 10.3 维护时最容易写错的地方

- 把 React/Node 原型误当成当前主实现
- 把早期“三数据源”口径误当成当前固定事实
- 误以为 `tool-service.markdown.enabled` 会关闭整个 Markdown 页面链路
- 忽略工作目录的用户级配置与桌面回退策略
- 忽略前端缓存/并发保护链路，回归到整页刷新

### 10.4 新增功能时的同步要求

如果新增按钮、快捷键或接口，至少同步本文档中的以下内容：

- 所属区域
- 触发方式
- 成功行为
- 失败行为
- 是否写入 localStorage
- 是否影响缓存、URL 或工作目录状态

## 11. v1.0.0 独立桌面端与内网协同服务升级事实 (2026-08)

### 11.1 架构升级
- 彻底移除对 JVM/Spring Boot 及达梦数据库的硬依赖，重构为轻量级 Electron + Node.js 原生 HTTP 嵌入式架构。
- 后台自启 Node.js 原生 HTTP 服务监听 `0.0.0.0:9527`，自动探测局域网 IP（`http://<LAN_IP>:9527/md-view`），实现本地与局域网多端同步预览。

### 11.2 核心体验与修复
1. **Windows 原生桌面集成**：
   - 绿色独立可执行程序 `dist-app\MD Preview Tool.exe`，带 Markdown 专属高分辨率 ICON。
   - 标题栏支持鼠标左键拖动窗口（`-webkit-app-region: drag`），集成最小化、最大化/还原、关闭控制。
   - **智能关闭拦截与系统托盘**：托盘右键菜单规范为“打开工作台”、“复制内网分享链接”、“退出”；关闭时弹出决策框或按首选项配置自动执行。
   - **全量矢量图标重构与专业组件库规范 (Lucide & Octicon Zero-Emoji)**：
     - 全面清理并替换了顶部标题栏、菜单栏、URL 栏、工具栏、侧边栏、大纲目录、代码复制按钮、API 浮动面板、空状态欢迎页、403 页面以及设置模态弹窗中的所有 Emoji 图标，全面接入标准 Lucide / Octicon 矢量 SVG 图标与现代极简排版（实测运行时 0 噪点 Emoji）；
     - **资源打包同步与覆盖机制修复**：
       - 彻底清除了遗留的 `src/main/resources` 历史资产；
       - 修复了 PowerShell 构建脚本中 `Copy-Item` 针对 `$appDir\resources` 的嵌套副本缺陷，构建前自动深度清理目标目录，确保开发源码与可执行程序运行包 100% 同步生效。
     - **Windows EXE 文件 PE 二进制内嵌图标注入**：
       - 新增 [`scripts/patch-exe-icon.js`](../scripts/patch-exe-icon.js)，基于 `resedit` 在打包构建流中直接将多尺寸几何 MD 专属 `resources/icon.ico` 写入 `MD Preview Tool.exe` 的 Windows PE Header，彻底生效文件资源管理器与桌面图标。
   - **Task-Loop 任务调度器挂载**：
     - 本会话（`86e8ae20-773d-4f9e-8d5d-77aa8631bc6f`）已注册为项目持久主会话，全面接入 `.agents/task-loop/` 调度框架。
   - **Windows 原生目录选择**：点击 `📁` 图标呼出原生选择器，自动递归全量扫描子层级 `.md` 文件并自动定位打开首篇文档。
2. **斜体转义缺陷彻底根治**：
   - 多下划线 URL 路径（如 `/ssda/grading_standard/delete_by_name`）与蛇形命名标识符（`delete_by_name`、`is_deleted`）通过前置占位保护，严格保持字面量，杜绝斜体误转。
3. **Windows 一键初始化与跨机部署**：
   - 提供 `scripts/setup.bat` 与 `scripts/setup.ps1`，在新机器上双击即可全自动完成依赖安装、构建发包与桌面快捷方式创建。

### 11.3 局域网 IP 展示、URL 标题定位与开发同源升级 (2026-08)
1. **侧栏本机 IP 组件**：
   - 侧边栏“Markdown 文件列表”标题右侧新增 `sidebar-lan-badge` 徽标组件，直观呈现 `IP(本机的): <LAN_IP>:9527`。
   - 点击徽章可直接复制当前文档与阅读进度的完整局域网分享 URL，并提供视觉反馈。
2. **URL 标题与首行定位全链路联动**：
   - 支持复合参数 `#h=...&l1=...` 及传统 anchor 锚点，正文区平滑滚动并闪烁高亮。
   - 右侧 TOC 标题树自动展开所有祖先折叠层级，激活高亮并调用 `scrollIntoView` 确保目录树同步滚动到当前标题。
   - 若 URL 中无标题 hash，正文和右侧 TOC 自动定位到首行（顶部）。
   - 增加 `hashchange` 事件监听与多次微调补偿，避免代码高亮或媒体加载后的高度偏移。
3. **开发环境与 EXE 启动同源等效**：
   - 修改 `electron/main.ts`，主窗口统一加载 `http://127.0.0.1:9527/md-view`，彻底解决 `npm run dev` 弹出旧版 React 原型黑底混乱界面的问题，确保开发与生产完全同源同质。

### 11.4 服务启停控制架构升级与 Failed to fetch 死锁根治 (2026-08)
1. **故障根因根治（服务永续性与共享权限解耦）**：
   - 历史缺陷：旧版将页面“内网服务”开关直接绑定到底层 `server.close()`。在 Web 端关闭服务后，底层 TCP Socket 被释放，再次点击开启时发起的 HTTP 请求被系统拒绝（`ECONNREFUSED`），导致前端报错 `服务启停切换失败: Failed to fetch` 并造成通信死锁。
   - 架构升级：将“局域网共享控制”与“底层 HTTP 服务”彻底解耦。底层 HTTP 服务（`127.0.0.1:9527`）始终保持运行，保障主机 Electron 窗口及本机浏览器的数据接口（加载文件树、文档内容、保存等）永远畅通可用。
2. **安全中间件与访客模式**：
   - **局域网访问控制**：当“内网服务”关闭时，拦截所有非 `127.0.0.1` / `localhost` 的外部局域网请求（返回 403 Forbidden 友好的暂停说明页与 JSON 拦截），本地 `127.0.0.1` 仍可正常访问与随时重新开启。
   - **局域网访客保护**：外部局域网设备访问时自动设为访客模式，开关禁用，仅主机管理员可启停内网共享，杜绝误关。
3. **全端兼容与平滑启停**：
   - 更新 `electron/server.ts`、`electron/main.ts`、`md-preview.html`，开关切换瞬间生效，绝不再出现网络断连或死锁。

### 11.5 Markdown 代码块统一轻量展示规范 (2026-08)
1. **统一展示规范**：正文 Markdown 代码块采用现代等宽字体，右上角配备动态 SVG 复制按钮，无额外冗余边框。

### 11.6 标准化可发行应用发布体系 (MSI/NSIS/Portable Pipeline - 2026-08)
1. **发行包矩阵（对标 CC Switch）**：
   - **Windows MSI 安装包**：基于 WiX 4.0 生成 `release/MD Preview Tool-1.0.0-x64.msi`，提供原生 Windows Installer 安装进度弹窗与 GPO 企业级静默部署；
   - **Windows NSIS 安装向导**：生成 `release/MD Preview Tool-Setup-1.0.0-x64.exe`，支持自定义安装路径、桌面与开始菜单快捷方式以及控制面板一键卸载；
   - **绿色便携单文件**：生成 `release/MD Preview Tool-1.0.0-x64-portable.exe`，免安装即开即用。
2. **自动化构建与镜像加速流水线**：
   - 核心构建脚本：[`scripts/build-dist.js`](../scripts/build-dist.js) 统一注入国内镜像（`ELECTRON_MIRROR`, `ELECTRON_BUILDER_BINARIES_MIRROR`），规避海外网络超时；
   - 指令体系：`npm run dist:msi`、`npm run dist:nsis`、`npm run dist:portable`、`npm run dist:all`。
3. **运行时资源寻址加固**：
   - `electron/server.ts` 中的 `findResourceFile` 扩展对 `process.resourcesPath` 与 `process.resourcesPath/app` 的检索，确保无论在解压态还是 MSI/NSIS 安装态均能 100% 稳定读取模板与静态文件。
   - 所有 Markdown 代码块（包括 JSON、SQL、各类代码片段及非标准文档伪代码）统一采用**图 1 风格的极简、轻量高亮代码框**展示，杜绝笨重复杂的外层卡片与多余的表格切换栏，保持文档阅读的紧凑与连贯性。
2. **核心特性与实现机制**：
   - **深色优雅高亮**：由 `highlight.js` 统一完成语法高亮与语法着色（键名、字符串、数值、布尔值精准渲染）；
   - **轻量浮动复制**：每个代码块右上角保留精致小巧的 `📋 复制` 按钮（悬浮浮现，点击反馈 `✓ 已复制`）；
   - **嵌套与缩进兼容**：服务端正则已全面支持缩进代码块（`^\s*```\s*(.*?)\s*$`），确保无序列表、有序列表项内部的代码块均能准确解析为标准代码框。


### 11.6 正常的开关重启与全链路缓存热重载机制 (2026-08)
1. **交互定位与操作模型**：
   - 用户无需进入命令行打命令重启进程，支持在桌面端/Web 端右上角通过标准的“关 -> 开”两次点击逻辑（即正常的开/关循环）实现服务与缓存的热重载。
2. **服务端缓存即时清除**：
   - 当开关由关闭切换至开启（`reloaded: true`）时，服务端（Node `electron/server.ts`、Electron 主进程 `electron/main.ts` 及 Spring Boot 控制器）立即执行 `clearAllCache()` 清空所有文档与侧边栏内存缓存（`documentCache` 与 `sidebarCache`）。
3. **前端文档与视图自动刷新**：
   - 前端监听到开启成功后，自动调用 `loadShellData()` 刷新文件列表，并对当前已打开的 `currentFilePath` 触发 `loadDocumentData()` 重新加载渲染，使最新的 Markdown 语法和表格解析结果立即呈现在屏幕上。





