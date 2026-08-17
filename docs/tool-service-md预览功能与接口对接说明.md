# Tool Service：Markdown 预览功能与接口对接说明

> 范围说明：本文档仅总结本项目中的 Markdown 预览、文档浏览、文档接口信息提取、接口调试面板及相关 HTTP 对接接口。数据库工具、MCP 协议工具、SQL 执行等模块不在本文档范围内。

## 1. 功能定位

Markdown 预览功能是项目中的本地文档工作台，用于浏览指定工作目录下的 Markdown 文件，并在预览页面内完成文档阅读、目录导航、全文搜索、文件切换、原文查看、文档下载、内容保存以及接口文档联动调试。

它不是单纯的 Markdown 渲染页面，而是一个面向研发文档和接口文档的综合工作台：

- 以本地文件系统目录作为文档源。
- 自动扫描 Markdown 文件并生成左侧文件树。
- 将 Markdown 内容转换成 HTML 预览。
- 自动提取标题生成右侧目录。
- 从接口文档格式中识别接口名称、路径、方法、请求参数和请求体示例。
- 将识别到的接口信息注入右侧接口调试面板，支持直接发送请求。
- 支持多标签页、当前文件定位、链接复制、文件名复制、原文查看和下载。

## 2. 总体架构

### 2.1 当前主链路

当前主要运行链路基于 Spring Boot 提供页面和接口：

```text
浏览器
  ↓
GET /md-view
  ↓
MarkdownPreviewController 返回 md-preview.html
  ↓
页面 JS 请求 /api/md/*、/md-content、/md-download 等接口
  ↓
后端读取本地 Markdown 文件、生成 HTML、TOC、接口元数据和文件树
  ↓
页面局部刷新预览区、侧边栏、目录区、接口调试区
```

关键文件：

| 层级 | 文件 | 作用 |
|---|---|---|
| 页面入口 | `src/main/resources/templates/md-preview.html` | Markdown 预览工作台主页面，包含布局、样式和交互脚本 |
| 控制器 | `src/main/java/com/example/tool/mcp/MarkdownPreviewController.java` | 提供页面、文件读取、文件列表、目录、保存、下载、预览数据等接口 |
| 缓存服务 | `src/main/java/com/example/tool/mcp/MarkdownPreviewCacheService.java` | 缓存侧边栏数据和文档渲染结果 |
| 页面搜索脚本 | `src/main/resources/static/md-search.js` | 页面内搜索、全局搜索、标题跳转等增强能力 |
| 配置 | `src/main/resources/application-md.yml` | Markdown 预览相关配置模板 |
| 应用配置 | `src/main/resources/application.yml` | Spring Boot 端口与模块化配置导入 |

### 2.2 历史/备用前端链路

仓库中还保留了 React + Vite + Node.js 文件服务的实现，主要文件包括：

| 文件 | 作用 |
|---|---|
| `src/App.tsx` | React 版本预览页面入口 |
| `src/components/Markdown/MarkdownPreview.tsx` | React 版 Markdown 渲染组件 |
| `src/hooks/useFileSystem.ts` | 调用 Node 文件 API 读取文件和目录 |
| `src/stores/fileStore.ts` | 文件树、最近文件、展开状态持久化 |
| `src/stores/tabsStore.ts` | 多标签页状态持久化 |
| `src/lib/apiConfig.ts` | Node API 主机和端口配置 |
| `server/index.js` | Node.js 轻量文件服务器 |

当前 Spring Boot 版 `md-preview.html` 是更完整的主链路；React + Node 版可视为早期或备用实现。

## 3. 后端模块分层

### 3.1 控制层：MarkdownPreviewController

`MarkdownPreviewController` 是 Markdown 预览功能的核心后端类，承担以下职责：

- 返回 Markdown 预览页面模板。
- 管理工作目录配置。
- 扫描 Markdown 文件列表。
- 构建左侧文件树 HTML。
- 读取 Markdown 文件原文。
- 将 Markdown 转换为 HTML。
- 生成文章目录 TOC。
- 识别接口文档元数据。
- 保存 Markdown 内容。
- 下载 Markdown 文件。
- 对路径进行规范化和安全限制，防止越权访问工作目录之外的文件。

#### 3.1.1 工作目录管理

后端会从用户目录下的配置文件读取当前 Markdown 工作目录：

```text
%USERPROFILE%\.tool-service\markdown-preview.properties
```

关键逻辑：

- 配置键：`markdown.workspace.path`
- 如果配置的目录不存在，则回退到当前用户桌面目录。
- 如果当前运行环境不是 headless，则支持弹出系统目录选择框。
- 修改工作目录后，会清空预览缓存，确保文件树和文档内容刷新。

返回给前端的工作目录状态包括：

| 字段 | 含义 |
|---|---|
| `configuredPath` | 用户保存的目录路径 |
| `effectivePath` | 当前实际使用的目录路径 |
| `exists` | 配置目录是否存在 |
| `fallbackToDesktop` | 是否回退到桌面目录 |
| `supportsDirectoryPicker` | 是否支持系统目录选择框 |

#### 3.1.2 文件路径规范化

控制器中的路径处理逻辑会将输入路径统一为相对路径，并做以下处理：

- 替换 Windows 反斜杠为 `/`。
- 去掉开头的 `/`。
- 过滤空路径。
- 将相对路径解析到当前工作目录下。
- 校验解析后的绝对路径必须仍在工作目录内部。
- 只扫描 `.md` 文件。

这保证页面只能访问配置工作目录下的 Markdown 文件。

### 3.2 缓存层：MarkdownPreviewCacheService

`MarkdownPreviewCacheService` 使用内存缓存优化页面加载性能。

#### 3.2.1 侧边栏缓存

侧边栏缓存用于缓存文件扫描结果：

| 属性 | 说明 |
|---|---|
| 缓存 Key | 工作目录路径 + 当前 scope |
| 缓存内容 | Markdown 文件列表、目录列表 |
| TTL | 30 秒 |
| 命中返回 | `cacheHit = true` |

适用场景：频繁切换文件时避免反复扫描文件系统。

#### 3.2.2 文档缓存

文档缓存用于缓存单个 Markdown 文件的渲染结果：

| 属性 | 说明 |
|---|---|
| 缓存 Key | 文件绝对路径 |
| 校验条件 | 文件最后修改时间 + 文件大小 |
| 缓存内容 | 标题、HTML 内容、TOC、接口元数据 |
| 失效方式 | 文件修改时间或大小变化后自动失效 |

适用场景：同一文件在标签页间反复切换时复用渲染结果。

### 3.3 配置层

#### 3.3.1 Spring Boot 应用配置

`src/main/resources/application.yml` 中默认端口为：

```yaml
server:
  port: 9527
```

因此主页面默认访问地址为：

```text
http://localhost:9527/md-view
```

#### 3.3.2 Markdown 模块配置模板

`src/main/resources/application-md.yml` 中定义 Markdown 预览相关配置：

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `markdown.preview.root-paths` | `./docs,./md-files` | Markdown 根目录配置模板 |
| `markdown.preview.enable-image-preview` | `true` | 是否启用本地图片预览配置项 |
| `markdown.preview.allowed-extensions` | `.md,.markdown,.txt` | 允许扩展名配置项 |
| `markdown.preview.max-file-size` | `10` | 最大文件大小 MB 配置项 |

注意：当前 `MarkdownPreviewController` 的实际工作目录主要使用 `markdown.base-path` 默认值和用户持久化工作目录配置；`application-md.yml` 更像模块化配置模板。

## 4. 页面模块分层

### 4.1 页面布局

`md-preview.html` 的页面结构分为四个主要区域：

```text
┌──────────────────────────────────────────────────────────────┐
│ 左侧文件树 │ 右侧目录 │ 中间文档区域                   │ 接口调试面板 │
│ sidebar    │ toc      │ tabs + toolbar + preview/raw   │ request panel │
└──────────────────────────────────────────────────────────────┘
```

页面主要 DOM 区域：

| 区域 | DOM/类名 | 功能 |
|---|---|---|
| 左侧文件树 | `#sidebar-container` | 文件树、目录切换、搜索、定位、复制 |
| 右侧目录 | `#toc-container` | Markdown 标题目录、滚动联动、折叠展开 |
| 标签栏 | `.tabs-bar` | 多文件标签页管理 |
| 工具栏 | `.toolbar` | 面包屑、预览/原文切换、下载 |
| 预览区 | `#markdown-body` | 渲染后的 HTML 内容 |
| 原文区 | `#raw-body` | Markdown 原文本内容 |
| 接口调试区 | `#request-panel` | 接口参数编辑和请求发送 |

### 4.2 文件树功能

左侧文件树由后端生成 HTML，前端绑定交互事件。

功能包括：

- 展示当前工作目录下的 Markdown 文件层级结构。
- 文件夹折叠和展开。
- 当前文件高亮。
- 搜索文件名。
- 一键定位当前文件。
- 复制文件名。
- 复制可访问链接，例如：`/md-view?path=xxx.md`。
- 点击文件后通过局部请求加载文档，不强制整页刷新。

后端生成树时会：

- 将文件路径按 `/` 拆分为树结构。
- 文件夹和文件按名称排序。
- 当前文件增加 `active` 样式。
- 为文件操作按钮写入 `data-path` 和 `data-name`。

### 4.3 文档预览功能

文档预览由后端把 Markdown 转为 HTML 后返回。

支持的 Markdown 能力包括：

- 标题 `#` 到 `######`。
- 自动生成标题锚点。
- 段落。
- 粗体、斜体、行内代码等内联格式。
- 代码块和语言标记。
- 表格。
- 有序列表、无序列表。
- 任务列表。
- 引用块。
- 分割线。
- YAML front matter 处理。
- `/change` 行标记高亮。
- HTML 转义，降低直接注入风险。

代码高亮使用页面引入的 `highlight.js` CDN 资源。

### 4.4 文章目录 TOC

后端会从 Markdown 标题中提取目录数据，再渲染为右侧目录 HTML。

目录能力包括：

- 支持多级标题。
- 标题锚点与正文标题联动。
- 点击目录跳转到对应标题。
- 滚动时自动高亮当前标题。
- 支持折叠状态持久化。
- 支持跳转弹窗按标题搜索。

### 4.5 原文模式

页面支持在“预览模式”和“原文本”之间切换：

- 预览模式展示后端转换后的 HTML。
- 原文本模式通过 `/md-content?path=...` 获取原始 Markdown。
- 原文加载使用请求序号和 `AbortController` 避免快速切换文件时旧请求覆盖新内容。

### 4.6 多标签页

页面内置多标签页逻辑，主要能力：

- 打开文件时注册标签页。
- 点击标签切换文件。
- 关闭当前标签。
- 关闭其他标签。
- 标签历史记录用于控制最多保留数量。
- 标签状态保存在浏览器本地存储。

### 4.7 搜索能力

搜索能力分为三类：

| 类型 | 实现位置 | 说明 |
|---|---|---|
| 文件树搜索 | `md-preview.html` | 按文件名过滤左侧文件树 |
| 当前文档搜索 | `md-search.js` | 在当前预览内容中高亮匹配项并支持上下跳转 |
| 全局文档搜索 | `md-search.js` | 遍历所有 Markdown 文件，通过 `/md-content` 拉取内容后搜索 |

### 4.8 文件下载与保存

页面支持：

- 通过 `/md-download?path=...` 下载当前 Markdown 文件。
- 通过 `/api/md/save-content?path=...` 保存 Markdown 内容。
- 保存成功后后端会清理对应文档缓存，后续预览重新渲染。

## 5. 接口文档识别与请求调试模块

这是本功能中和“接口对接”最相关的部分。

### 5.1 接口元数据识别规则

后端会扫描 Markdown 文档中的特定格式，用于提取接口信息。

识别的字段格式如下：

```markdown
- **接口名称**: 用户详情
- **接口路径**: /api/users/{id}
- **请求方式**: GET
```

字段识别规则：

| 字段 | 正则意图 | 说明 |
|---|---|---|
| 接口名称 | `- **接口名称**: ...` | 作为接口标题，优先于三级标题 |
| 接口路径 | `- **接口路径**: ...` | 自动规范化为 `/` 开头 |
| 请求方式 | `- **请求方式**: GET` | 自动转成大写 |

### 5.2 标题层级约定

接口元数据提取依赖标题层级：

| 标题层级 | 用途 |
|---|---|
| `###` | 当前接口块标题 |
| `#### 请求参数` | 提取请求参数表格 |
| `#### 请求体` | 提取请求体表格和 JSON 示例 |
| `##` 或更高级标题 | 重置当前接口上下文 |

也就是说，一个推荐的接口文档块结构如下：

````markdown
### 获取用户详情

- **接口名称**: 获取用户详情
- **接口路径**: /api/users/{id}
- **请求方式**: GET

#### 请求参数

| 参数名 | 必选 | 类型 | 说明 |
|---|---|---|---|
| id | 是 | string | 用户 ID |
| includeProfile | 否 | boolean | 是否包含资料 |

#### 请求体

```json
{
  "example": true
}
```
````

### 5.3 参数表格解析

后端会解析 Markdown 表格，识别以下列：

| 列名 | 对应字段 | 说明 |
|---|---|---|
| `参数名` | `name` | 参数名称 |
| `必选` | `required` | 是否必填 |
| `类型` | `type` | 参数类型 |
| `说明` | `description` | 参数说明 |

如果列名不存在，会按默认列序号兜底读取：

```text
参数名 -> 第 1 列
必选   -> 第 2 列
类型   -> 第 3 列
说明   -> 第 4 列
```

### 5.4 路径参数识别

接口路径中形如 `{id}` 的占位符会被识别为路径参数：

```text
/api/users/{id}
```

后端会在请求参数表中查找同名参数，如果找到则复用类型、必选和说明；如果没找到，则默认：

| 字段 | 默认值 |
|---|---|
| `type` | `string` |
| `required` | `是` |
| `description` | 空字符串 |

### 5.5 请求体 JSON 示例识别

在 `#### 请求体` 区域中，第一个 `json` 代码块会被提取为请求体示例：

````markdown
#### 请求体

```json
{
  "name": "demo"
}
```
````

提取后会放入接口元数据字段 `bodyExample`，用于前端请求面板预填。

### 5.6 前端请求调试面板

页面右侧接口调试面板支持：

- 根据当前标题或接口区域匹配后端提取的接口元数据。
- 自动填充接口路径、请求方法、路径参数、查询参数、请求体示例。
- 支持编辑 API Base URL。
- 支持新增、修改、删除参数行。
- 自动将路径模板 `{id}` 替换成填写的路径参数值。
- 自动序列化 Query 参数。
- 支持不同 HTTP Method。
- 使用浏览器 `fetch` 直接发送请求。
- 自动识别 JSON 响应并格式化展示。
- 支持响应树形预览与原始响应切换。
- 请求配置和标签状态保存在浏览器本地存储。

请求发送的大致流程：

```text
文档接口元数据
  ↓
normalizeApiSections / getStructuredMetadata / parseInterfaceMetadata
  ↓
buildRequestState
  ↓
resolvePath + serializeQueryParams
  ↓
fetch(state.fullUrl, options)
  ↓
响应文本/JSON 格式化展示
```

## 6. HTTP 接口清单

### 6.1 页面入口

#### GET `/md-view`

返回 Markdown 预览主页面。

参数：

| 参数 | 必填 | 说明 |
|---|---|---|
| `path` | 否 | 初始打开的 Markdown 文件相对路径 |

示例：

```text
GET /md-view?path=docs/README.md
```

返回：`text/html`。

### 6.2 工作目录配置接口

#### GET `/api/md/workspace-config`

获取当前 Markdown 工作目录配置。

返回示例：

```json
{
  "configuredPath": "D:\\docs",
  "effectivePath": "D:\\docs",
  "exists": true,
  "fallbackToDesktop": false,
  "supportsDirectoryPicker": true
}
```

#### POST `/api/md/workspace-config`

保存工作目录。

请求体：

```json
{
  "path": "D:\\docs"
}
```

成功返回：

```json
{
  "success": true,
  "message": "工作目录已更新",
  "config": { }
}
```

失败情况：

- 目录不存在。
- 输入路径不是有效文件夹。
- 保存配置文件失败。

#### POST `/api/md/workspace-config/pick-directory`

调用服务端系统目录选择框选择工作目录。

适用条件：服务端必须运行在支持 GUI 的环境中；headless 环境下不可用。

返回：

```json
{
  "success": true,
  "config": { }
}
```

如果用户取消选择：

```json
{
  "success": false,
  "cancelled": true,
  "config": { }
}
```

### 6.3 预览聚合接口

#### GET `/api/md/preview-data`

一次性返回侧边栏数据和文档数据，适合页面初始化或兼容旧加载流程。

参数：

| 参数 | 必填 | 说明 |
|---|---|---|
| `path` | 否 | 当前 Markdown 文件相对路径 |
| `scope` | 否 | 当前侧边栏目录范围 |

返回字段：

| 字段 | 说明 |
|---|---|
| `sidebar` | 左侧文件树 HTML |
| `scope` | 当前目录范围 |
| `directories` | 可切换的目录列表 |
| `workspaceConfig` | 工作目录配置 |
| `title` | 当前文档标题 |
| `content` | 当前文档渲染后的 HTML |
| `toc` | 当前文档目录 HTML |
| `path` | 当前文件路径 |
| `apiSections` | 从文档中提取的接口元数据 |
| `apiSectionsVersion` | 接口元数据格式版本，当前为 `1` |
| `cacheHit` | 是否命中缓存 |
| `fileLastModified` | 文件最后修改时间戳 |
| `fileSize` | 文件大小 |

### 6.4 侧边栏接口

#### GET `/api/md/sidebar-data`

只返回侧边栏相关数据，用于文件切换时减少重复加载。

参数：

| 参数 | 必填 | 说明 |
|---|---|---|
| `scope` | 否 | 目录范围 |
| `currentPath` | 否 | 当前文件路径，用于高亮 |

返回字段：

| 字段 | 说明 |
|---|---|
| `sidebar` | 文件树 HTML |
| `scope` | 当前目录范围 |
| `directories` | 目录列表 |
| `workspaceConfig` | 工作目录配置 |
| `cacheHit` | 是否命中侧边栏缓存 |

### 6.5 文档数据接口

#### GET `/api/md/document-data`

只返回指定 Markdown 文档的预览数据。

参数：

| 参数 | 必填 | 说明 |
|---|---|---|
| `path` | 是 | Markdown 文件相对路径 |

返回字段：

| 字段 | 说明 |
|---|---|
| `title` | 文档标题 |
| `content` | HTML 内容 |
| `toc` | 目录 HTML |
| `apiSections` | 接口元数据 |
| `cacheHit` | 是否命中文档缓存 |
| `fileLastModified` | 文件最后修改时间戳 |
| `fileSize` | 文件大小 |

### 6.6 原文读取接口

#### GET `/md-content`

读取 Markdown 原文内容。

参数：

| 参数 | 必填 | 说明 |
|---|---|---|
| `path` | 是 | Markdown 文件相对路径 |

返回：`text/plain` Markdown 原文。

用途：

- 原文本模式展示。
- 全局搜索逐个读取文件内容。

### 6.7 文件下载接口

#### GET `/md-download`

下载 Markdown 文件。

参数：

| 参数 | 必填 | 说明 |
|---|---|---|
| `path` | 是 | Markdown 文件相对路径 |

返回：文件流。

响应头包含：

```text
Content-Disposition: attachment; filename="xxx.md"
```

### 6.8 文件列表接口

#### GET `/md-list`

返回当前工作目录下的 Markdown 文件路径列表。

参数：

| 参数 | 必填 | 说明 |
|---|---|---|
| `scope` | 否 | 限制扫描范围 |

返回示例：

```json
[
  "docs/README.md",
  "docs/api/user.md"
]
```

#### GET `/api/md/directories`

返回 Markdown 文件所涉及的目录列表，用于目录切换器。

返回示例：

```json
[
  "docs",
  "docs/api"
]
```

### 6.9 内容保存接口

#### POST `/api/md/save-content`

保存 Markdown 文件内容。

参数：

| 参数 | 必填 | 说明 |
|---|---|---|
| `path` | 是 | Markdown 文件相对路径 |

请求体：

```json
{
  "content": "# 新内容"
}
```

成功返回：

```json
{
  "success": true,
  "message": "保存成功"
}
```

保存后会清理该文件的文档缓存。

## 7. 接口元数据 `apiSections` 字段结构

从文档提取出的接口信息会放入 `apiSections` 数组。单项结构如下：

```json
{
  "sectionType": "requestParams",
  "headingText": "请求参数",
  "headingId": "请求参数",
  "interfaceTitle": "获取用户详情",
  "interfaceHeadingText": "获取用户详情",
  "interfaceHeadingId": "获取用户详情",
  "path": "/api/users/{id}",
  "method": "GET",
  "pathParams": [
    {
      "name": "id",
      "type": "string",
      "required": "是",
      "description": "用户 ID"
    }
  ],
  "params": [
    {
      "name": "id",
      "required": "是",
      "type": "string",
      "description": "用户 ID"
    }
  ],
  "bodyExample": "",
  "sourceLine": 12
}
```

字段说明：

| 字段 | 说明 |
|---|---|
| `sectionType` | `requestParams` 或 `requestBody` |
| `headingText` | 当前四级标题文本 |
| `headingId` | 当前四级标题锚点 |
| `interfaceTitle` | 接口显示名称，优先使用 `接口名称` |
| `interfaceHeadingText` | 所属三级标题 |
| `interfaceHeadingId` | 所属三级标题锚点 |
| `path` | 接口路径 |
| `method` | 请求方式 |
| `pathParams` | 从路径 `{}` 中提取的路径参数 |
| `params` | 参数表格解析结果 |
| `bodyExample` | 请求体 JSON 示例，仅 `requestBody` 通常有值 |
| `sourceLine` | 元数据来源行号 |

## 8. 前端与后端接口调用关系

### 8.1 页面初始化

```text
打开 /md-view
  ↓
fetchWorkspaceConfig -> GET /api/md/workspace-config
  ↓
loadShellData -> GET /api/md/sidebar-data
  ↓
loadDocumentData -> GET /api/md/document-data?path=...
  ↓
渲染文件树、目录、正文、接口面板
```

### 8.2 文件切换

```text
点击文件树文件
  ↓
openFile(path)
  ↓
更新 URL：/md-view?path=...
  ↓
loadDocumentData(path)
  ↓
局部替换正文、TOC、apiSections
  ↓
注册标签页并高亮当前文件
```

### 8.3 原文模式

```text
点击“原文本”
  ↓
toggleView('raw')
  ↓
GET /md-content?path=...
  ↓
展示 Markdown 原文
```

### 8.4 接口调试

```text
文档中存在接口信息
  ↓
后端返回 apiSections
  ↓
前端匹配当前标题/接口块
  ↓
自动填充请求面板
  ↓
用户编辑 Base URL、参数、请求体
  ↓
fetch(fullUrl, options)
  ↓
展示响应状态、原文、JSON 树
```

## 9. 备用 React + Node 文件服务接口

仓库中 `server/index.js` 提供了一组轻量文件服务接口，主要服务于 React/Vite 版本。

### 9.1 Node 服务配置

| 配置 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3001` | Node 文件服务端口 |
| `BASE_PATH` | `D:\adas\项目` | 文件访问基础目录 |
| `CORS` | `*` | 跨域配置 |

### 9.2 Node API 清单

#### GET `/api/health`

健康检查。

返回：

```json
{
  "success": true,
  "status": "ok",
  "timestamp": "..."
}
```

#### GET `/api/config`

返回 Node 服务配置。

```json
{
  "success": true,
  "basePath": "D:\\adas\\项目",
  "port": 3001
}
```

#### GET `/api/read-file?path=...`

读取指定文件内容。

安全限制：解析后的绝对路径必须位于 `BASE_PATH` 下。

返回字段：

| 字段 | 说明 |
|---|---|
| `success` | 是否成功 |
| `path` | 文件路径 |
| `content` | 文件内容 |
| `size` | 文件大小 |
| `modified` | 修改时间 |

#### GET `/api/list-directory?path=...&depth=...`

列出目录中的 Markdown 文件和子目录。

规则：

- 跳过隐藏文件。
- 跳过 `node_modules`、`target`、`dist`。
- 只返回目录和 `.md` 文件。
- 目录在前，文件在后，按名称排序。

## 10. 数据状态与本地持久化

### 10.1 服务端持久化

| 内容 | 位置 | 说明 |
|---|---|---|
| Markdown 工作目录 | `%USERPROFILE%\.tool-service\markdown-preview.properties` | 保存 `markdown.workspace.path` |

### 10.2 浏览器本地持久化

页面会通过 `localStorage` 保存若干状态：

| 状态 | 说明 |
|---|---|
| 多标签页 | 已打开文档、当前激活文档、历史访问顺序 |
| 请求面板配置 | API Base URL、请求标签、参数、请求体等 |
| TOC 折叠状态 | 目录展开/折叠状态 |
| React 备用版本状态 | 文件树、最近文件、标签页、主题等 |

## 11. 异常与边界处理

### 11.1 文件不存在

当请求的 Markdown 文件不存在时：

- `/api/md/document-data` 返回 404 或错误信息。
- `/md-content` 返回 404。
- `/md-download` 返回 404。

### 11.2 路径不安全

当传入路径解析后不在当前工作目录内部时，后端拒绝访问，避免读取工作目录外的文件。

### 11.3 工作目录不可用

如果保存的工作目录不存在，系统自动回退到桌面目录，并在配置接口中返回 `fallbackToDesktop = true`。

### 11.4 快速切换文件

前端使用 `AbortController` 和请求序号控制，避免旧请求慢返回后覆盖新文件内容。

### 11.5 接口文档格式不完整

如果文档中缺少接口名称、路径、请求方式或参数表：

- 后端仍会尽量返回已有字段。
- 前端请求面板会使用默认值或空值。
- 路径默认规范化为 `/` 开头。
- 请求方法会被规范化为大写。

## 12. 推荐接口文档写法

为了让接口调试面板自动识别，推荐 Markdown 接口文档按以下格式书写：

````markdown
### 获取用户详情

- **接口名称**: 获取用户详情
- **接口路径**: /api/users/{id}
- **请求方式**: GET

#### 请求参数

| 参数名 | 必选 | 类型 | 说明 |
|---|---|---|---|
| id | 是 | string | 用户 ID |
| includeProfile | 否 | boolean | 是否返回用户资料 |

#### 请求体

```json
{
  "demo": true
}
```
````

说明：

- 接口块使用 `###` 标题。
- 请求参数和请求体使用 `#### 请求参数`、`#### 请求体`。
- 参数表建议使用固定列名：`参数名`、`必选`、`类型`、`说明`。
- 路径参数使用 `{参数名}` 格式。
- 请求体示例使用 `json` 代码块。

## 13. 可截图位置预留

如后续需要把本文档补充成带图版，建议预留以下截图问题，由人工截图后替换占位说明。

### 截图问题 1：Markdown 预览主界面

请截图展示 `http://localhost:9527/md-view` 打开后的整体界面，要求包含左侧文件树、右侧目录、中间预览区和右侧接口调试面板。

占位：`![Markdown 预览主界面](请替换为截图路径)`

### 截图问题 2：工作目录配置区域

请截图展示工作目录输入、保存、选择目录及当前目录状态提示。

占位：`![工作目录配置](请替换为截图路径)`

### 截图问题 3：接口调试面板自动填充效果

请打开一篇包含接口名称、接口路径、请求方式、请求参数表格的 Markdown 文档，截图展示请求面板自动填充后的效果。

占位：`![接口调试面板](请替换为截图路径)`

### 截图问题 4：全文搜索或当前文档搜索效果

请截图展示搜索关键词后的高亮结果和结果跳转区域。

占位：`![搜索效果](请替换为截图路径)`

## 14. 当前实现的注意事项

- `MarkdownPreviewController` 位于 `mcp` 包名下，但本文仅关注其中 Markdown 预览 HTTP 页面和接口，不涉及 MCP 协议工具。
- 当前主页面大量交互脚本集中在 `md-preview.html`，功能完整但文件体积较大。
- Markdown 转 HTML 是后端自实现解析逻辑，并非使用标准 Markdown 解析库。
- `application-md.yml` 中的部分配置项更偏模板化，实际工作目录优先由用户持久化配置控制。
- 目录选择接口依赖服务端 GUI 环境，服务器/headless 场景下不可用。
- 接口调试面板请求由浏览器直接发起，可能受到目标服务 CORS 策略影响。

## 15. 快速使用流程

1. 启动 Spring Boot 服务。
2. 浏览器访问 `http://localhost:9527/md-view`。
3. 在页面中设置 Markdown 工作目录，或使用默认回退目录。
4. 从左侧文件树选择 Markdown 文件。
5. 在中间区域阅读预览内容，右侧目录用于跳转。
6. 点击“原文本”查看 Markdown 原文。
7. 点击“下载”下载当前文件。
8. 如果文档符合接口格式，右侧接口调试面板会自动识别并预填接口请求信息。
9. 填写 API Base URL 和参数后，直接发送请求查看响应。

## 16. 对接方使用建议

如果其他系统或页面要对接本项目的 Markdown 预览能力，推荐优先使用以下接口组合：

| 场景 | 推荐接口 |
|---|---|
| 嵌入预览页面 | `/md-view?path=...` |
| 获取文件树 | `/api/md/sidebar-data` |
| 获取文档 HTML + TOC + 接口元数据 | `/api/md/document-data?path=...` |
| 获取原始 Markdown | `/md-content?path=...` |
| 获取接口元数据 | `/api/md/document-data` 返回的 `apiSections` |
| 下载 Markdown | `/md-download?path=...` |
| 保存 Markdown | `/api/md/save-content?path=...` |
| 管理工作目录 | `/api/md/workspace-config` |

最小对接流程：

```text
GET /api/md/sidebar-data
  ↓
用户选择 path
  ↓
GET /api/md/document-data?path=...
  ↓
展示 content/toc，读取 apiSections 做接口调试或二次加工
```
