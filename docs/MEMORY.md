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

- `pom.xml`
  - 当前主构建入口，Spring Boot + Maven。
- `src/main/java/com/example/tool/**`
  - 当前后端主实现。
- `src/main/resources/application*.yml`
  - 当前配置体系。
- `src/main/resources/templates/md-preview.html`
  - 当前 Markdown 预览页面。
- `src/main/resources/static/md-search.js`
  - 当前页面的本地全文搜索脚本。
- `docs/MEMORY.md`
  - 当前事实手册。

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
   - **智能关闭拦截与系统托盘**：关闭时弹出确认框（最小化到托盘或彻底退出，支持“记住选择”），托盘支持双击唤醒与右键菜单。
   - **Windows 原生目录选择**：点击 `📁` 图标呼出原生文件夹选择器，自动递归全量扫描子层级 `.md` 文件并自动定位打开首篇文档。
2. **斜体转义缺陷彻底根治**：
   - 多下划线 URL 路径（如 `/ssda/grading_standard/delete_by_name`）与蛇形命名标识符（`delete_by_name`、`is_deleted`）通过前置占位保护，严格保持字面量，杜绝斜体误转。
3. **Windows 一键初始化与跨机部署**：
   - 提供 `setup.bat` 与 `setup.ps1`，在新机器上双击即可全自动完成依赖安装、构建发包与桌面快捷方式创建。
