# Tool Service 架构分析与优化建议

## 一、当前架构分析

### 1.1 现有架构

```
┌─────────────────────────────────────────────────────────┐
│                    当前架构 (MCP模式)                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐         ┌─────────────────────────┐  │
│  │   Trae IDE   │  ────── │  Spring Boot MCP Service │  │
│  │   (Agent)    │  JSON   │  ┌─────────────────────┐ │  │
│  └──────────────┘   RPC   │  │  DatabaseMcpTool    │ │  │
│                          │  │  MarkdownMcpTool    │ │  │
│                          │  └─────────────────────┘ │  │
│                          │           │              │  │
│                          │  ┌─────────────────────┐ │  │
│                          │  │  达梦数据库 (5236)   │ │  │
│                          │  │  本地文件系统        │ │  │
│                          │  └─────────────────────┘ │  │
│                          └─────────────────────────┘  │
│                                   │                    │
│                                   │ HTTP              │
│                                   ▼                    │
│                          ┌─────────────────────────┐   │
│                          │    前端浏览器页面         │   │
│                          │  /md-preview (Thymeleaf) │   │
│                          └─────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 1.2 复杂度评估

| 组件 | 复杂度 | 问题点 |
|------|--------|--------|
| Spring Boot 服务 | 高 | 需要Java环境、依赖管理、端口占用 |
| MCP 协议层 | 中 | JSON-RPC实现、协议兼容性问题 |
| 数据库连接池 | 高 | HikariCP配置、达梦驱动 |
| 前端模板渲染 | 中 | Thymeleaf、后端数据绑定 |
| 服务维护 | 高 | 需要后台运行、端口管理、日志监控 |

## 二、方案一：保留MCP服务（当前方案）

### 2.1 优点
- AI Agent可以远程调用（跨机器）
- 统一的协议接口（MCP标准）
- 集中管理数据库连接

### 2.2 缺点
- **部署复杂**：需要启动Java服务
- **资源占用**：常驻内存、端口
- **维护成本**：版本升级、依赖管理
- **启动慢**：JVM启动需要时间

### 2.3 适用场景
- 团队协作（多个AI客户端共用一个服务）
- 需要远程访问数据库
- 有专门的运维人员管理

---

## 三、方案二：Skill + CLI 直连（推荐简化方案）

### 3.1 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                   简化架构 (Skill+CLI)                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐         ┌─────────────────────────┐  │
│  │   Trae IDE   │  ────── │  Trae 内置 Skill 执行器   │  │
│  │   (Agent)    │ 直接   │  ┌─────────────────────┐ │  │
│  └──────────────┘ 执行   │  │  dm-database-query   │ │  │
│                          │  │  Skill (达梦CLI)     │ │  │
│                          │  └─────────────────────┘ │  │
│                          │           │              │  │
│                          │  ┌─────────────────────┐ │  │
│                          │  │  disql 命令行工具    │ │  │
│                          │  │  本地达梦客户端      │ │  │
│                          │  └─────────────────────┘ │  │
│                          └─────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 3.2 核心优势

| 对比项 | MCP服务 | Skill+CLI |
|--------|---------|-----------|
| 启动时间 | 10-30秒 | 0秒（已集成） |
| 部署难度 | 高（需要Java环境） | 低（纯脚本） |
| 内存占用 | 200-500MB | <10MB |
| 维护成本 | 高 | 极低 |
| 本地调试 | 需要启动服务 | 即改即用 |

### 3.3 实现方式

#### 3.3.1 数据库查询 Skill

创建 `d:\adas\项目\tool-service\.trae\skills\dm-database-query\skill.md`:

```markdown
# 达梦数据库查询

使用达梦数据库CLI工具（disql）执行SQL查询。

## 命令格式

disql username/password@host:port/database < sql_file.sql
disql username/password@host:port/database "SQL语句"

## Windows 示例

```batch
@echo off
setlocal enabledelayedexpansion

set "HOST=%1"
set "PORT=%2"
set "DB=%3"
set "USER=%4"
set "PWD=%5"
set "SQL=%6"

echo !SQL! | disql !USER!/!PWD@!HOST!:!PORT!/!DB!
```

## 使用场景
- AI Agent 直接执行数据库查询
- 数据分析、报表生成
- 数据库结构探索
```

#### 3.3.2 配置文件管理

```yaml
# config/dm-cli-config.yaml
databases:
  master:
    host: 127.0.0.1
    port: 5236
    database: SOIL_SURVEY_DATA_APPLY
    username: SYSDBA
    password: ""

  sso:
    host: 127.0.0.1
    port: 5236
    database: SOIL_SURVEY_DATA_APPLY
    username: SYSDBA
    password: ""

disql_path: "C:\dmdbms\bin\disql.exe"
```

---

## 四、方案三：前端静态化 MD 预览（推荐）

### 4.1 完全前端化架构

```
┌─────────────────────────────────────────────────────────┐
│                  MD预览 静态架构                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐    直接打开                        │
│  │   Trae IDE        │ ──────────────────────────────►   │
│  │   (Agent)         │   file:///d:/adas/项目/...       │
│  └──────────────────┘                                   │
│                                                          │
│  ┌──────────────────┐    AI Agent 调用                   │
│  │  md-preview       │ ──────────────────────────────►   │
│  │  Skill            │   使用 browser 工具打开            │
│  └──────────────────┘                                   │
│                                                          │
│                    ┌─────────────────────────┐          │
│                    │   md-preview.html        │          │
│                    │   (纯前端静态文件)        │          │
│                    ├─────────────────────────┤          │
│                    │  marked.js 渲染          │          │
│                    │  highlight.js 语法高亮  │          │
│                    │  File API 读取本地       │          │
│                    │  无需任何后端服务        │          │
│                    └─────────────────────────┘          │
└─────────────────────────────────────────────────────────┘
```

### 4.2 优势对比

| 特性 | 后端渲染 | 前端静态 |
|------|----------|----------|
| 服务器依赖 | 必须 | **不需要** |
| 文件读取 | 后端读取 | File API |
| MD渲染 | 服务端 | 客户端marked.js |
| 文件列表 | API接口 | 静态配置/扫描 |
| 实时更新 | 需刷新页面 | 天然支持 |
| 离线使用 | 不可用 | **完全可用** |
| 启动速度 | 慢 | 即时 |

### 4.3 前端MD预览实现

创建 `d:\adas\项目\tool-service\src\main\resources\static\md-static-preview.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MD 本地预览</title>

    <!-- CDN 依赖（可选离线） -->
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>

    <style>
        /* 内联所有样式，确保离线可用 */
        :root {
            --bg-color: #ffffff;
            --text-color: #24292e;
            --code-bg: #f6f8fa;
            --border-color: #e1e4e8;
            --link-color: #0366d6;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
            line-height: 1.6;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            color: var(--text-color);
            background: var(--bg-color);
        }

        #markdown-body {
            /* Markdown 样式 */
        }

        #file-selector {
            margin-bottom: 20px;
            padding: 10px;
            border: 1px solid var(--border-color);
            border-radius: 6px;
        }

        #file-path {
            width: 100%;
            padding: 8px;
            margin-top: 10px;
        }

        .file-tree {
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid var(--border-color);
            padding: 10px;
            margin-top: 10px;
        }

        .tree-item {
            padding: 4px 8px;
            cursor: pointer;
        }

        .tree-item:hover {
            background: var(--code-bg);
        }

        /* 语法高亮覆盖 */
        pre code {
            background: var(--code-bg);
            padding: 16px;
            border-radius: 6px;
            overflow-x: auto;
        }

        /* URL参数处理 */
        .loading {
            text-align: center;
            padding: 40px;
            color: #666;
        }

        .error {
            color: #d73a49;
            padding: 20px;
            background: #ffeef0;
            border-radius: 6px;
        }
    </style>
</head>
<body>
    <div id="file-selector">
        <h3>📄 选择要预览的 Markdown 文件</h3>
        <input type="text" id="file-path"
               placeholder="输入文件路径，例如: D:\adas\项目\tool-service\README.md"
               onkeypress="if(event.key==='Enter') loadFile()">
        <button onclick="loadFile()">预览</button>
        <button onclick="scanDirectory()">浏览目录</button>

        <div id="file-tree" class="file-tree" style="display:none;"></div>
    </div>

    <div id="markdown-body">
        <div class="loading">加载中...</div>
    </div>

    <script>
        // 初始化 marked.js
        marked.setOptions({
            highlight: function(code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
                return hljs.highlightAuto(code).value;
            },
            breaks: true,
            gfm: true
        });

        // 从 URL 参数获取文件路径
        function getUrlParam(name) {
            const params = new URLSearchParams(window.location.search);
            return params.get(name);
        }

        // 加载文件
        async function loadFile(filePath) {
            if (!filePath) {
                filePath = document.getElementById('file-path').value;
            }

            if (!filePath) {
                showError('请输入文件路径');
                return;
            }

            showLoading();

            try {
                // 使用 File API 读取本地文件
                // 注意：这需要浏览器允许 file:// 协议访问
                const response = await fetch('file://' + filePath.replace(/\\/g, '/'));

                if (!response.ok) {
                    throw new Error('文件读取失败');
                }

                const content = await response.text();
                renderMarkdown(content);
                document.getElementById('file-path').value = filePath;

            } catch (error) {
                // 如果 fetch 失败（跨域或CORS），尝试使用文件输入
                showFileInput(filePath);
            }
        }

        // 渲染 Markdown
        function renderMarkdown(content) {
            const html = marked.parse(content);
            document.getElementById('markdown-body').innerHTML = html;

            // 应用代码高亮
            document.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        }

        // 文件输入方式（备选）
        function showFileInput(filePath) {
            document.getElementById('markdown-body').innerHTML = `
                <div style="padding: 20px; border: 2px dashed #ccc; text-align: center;">
                    <p>由于浏览器安全限制，请使用以下方式：</p>
                    <p><strong>方式一：</strong>直接拖拽 MD 文件到页面</p>
                    <p><strong>方式二：</strong></p>
                    <input type="file" id="file-input" accept=".md" onchange="handleFileSelect(event)">
                    <p style="color: #666; font-size: 12px; margin-top: 20px;">
                        当前路径: ${filePath}
                    </p>
                </div>
            `;
        }

        // 处理文件选择
        function handleFileSelect(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    renderMarkdown(e.target.result);
                };
                reader.readAsText(file);
            }
        }

        // 拖拽支持
        document.body.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        document.body.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const file = e.dataTransfer.files[0];
            if (file && file.name.endsWith('.md')) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    renderMarkdown(e.target.result);
                };
                reader.readAsText(file);
            }
        });

        // 显示加载中
        function showLoading() {
            document.getElementById('markdown-body').innerHTML =
                '<div class="loading">⏳ 正在加载...</div>';
        }

        // 显示错误
        function showError(message) {
            document.getElementById('markdown-body').innerHTML =
                `<div class="error">❌ ${message}</div>`;
        }

        // 页面加载时自动检查 URL 参数
        window.onload = function() {
            const path = getUrlParam('path');
            if (path) {
                loadFile(decodeURIComponent(path));
            } else {
                // 检查是否是本地文件协议
                const urlPath = getUrlParam('file');
                if (urlPath) {
                    loadFile(decodeURIComponent(urlPath));
                }
            }
        };
    </script>
</body>
</html>
```

### 4.4 使用方式

#### 4.4.1 AI Agent 调用

```
用户："预览 D:\adas\项目\tool-service\README.md"

Agent 执行：
1. 打开浏览器到 md-static-preview.html
2. 自动加载指定文件
```

#### 4.4.2 浏览器直接打开

```
file:///D:/adas/项目/tool-service/src/main/resources/static/md-static-preview.html?path=tool-service/README.md
```

#### 4.4.3 Trae Skill 配置

```yaml
# .trae/skills/md-preview/skill.yaml
name: md-preview
description: 预览本地 Markdown 文件
trigger:
  - "预览"
  - "打开"
  - "查看"

actions:
  - type: open-browser
    url: "file:///D:/adas/项目/tool-service/src/main/resources/static/md-static-preview.html?path={path}"
```

---

## 五、综合建议

### 5.1 架构选择

| 需求 | 推荐方案 |
|------|----------|
| 简化部署、快速迭代 | **方案二 + 方案三** |
| 团队协作、远程访问 | 保留MCP服务 |
| 降低复杂度 | Skill + CLI + 前端静态 |

### 5.2 实施步骤

#### 第一阶段：MD预览前端化（1天）
- [ ] 创建 `md-static-preview.html`
- [ ] 测试本地文件读取
- [ ] 完善拖拽功能
- [ ] 更新 CLAUDE.md 文档

#### 第二阶段：数据库CLI化（2天）
- [ ] 创建 `scripts/dm-query.bat`
- [ ] 创建数据库查询 Skill
- [ ] 测试各种SQL场景
- [ ] 完善错误处理

#### 第三阶段：可选 - 精简MCP服务
- [ ] 评估是否需要保留MCP
- [ ] 如果不需要，完全移除
- [ ] 清理相关代码

### 5.3 风险评估

| 风险 | 解决方案 |
|------|----------|
| File API 跨域限制 | 提供文件拖拽/选择器 |
| 达梦CLI不存在 | 检查并提示安装 |
| 大文件性能 | 分页、虚拟滚动 |
| 安全性 | 本地文件操作，无远程风险 |

---

## 六、最终推荐架构

```
┌─────────────────────────────────────────────────────────┐
│               推荐简化架构（零后端服务）                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐                                       │
│  │   Trae IDE   │  ────────────────────────────────►     │
│  │   (Agent)    │                                       │
│  └──────────────┘    ┌─────────────────────────────┐   │
│                       │   Trae 内置能力 + Skills    │   │
│                       ├─────────────────────────────┤   │
│                       │                               │   │
│                       │  💾 dm-database-query Skill  │   │
│                       │     └─► disql CLI           │   │
│                       │                               │   │
│                       │  📄 md-preview Skill          │   │
│                       │     └─► md-static-preview.html│   │
│                       │                               │   │
│                       │  📝 dm-database-query CLI     │   │
│                       │     └─► PowerShell + disql   │   │
│                       │                               │   │
│                       └─────────────────────────────┘   │
│                                                          │
│  完全不需要独立的后端服务！                               │
└─────────────────────────────────────────────────────────┘
```

### 6.1 优势

✅ **零部署**：无需启动任何服务
✅ **秒启动**：即改即用
✅ **零依赖**：不依赖Java环境
✅ **低维护**：纯脚本，前端文件
✅ **高可用**：不怕服务崩溃
✅ **易调试**：直接查看源码

### 6.2 缺点

❌ 不支持远程访问（但这个场景很少用）
❌ 需要本机安装达梦客户端
❌ 没有连接池（每次查询新建连接）

---

## 七、总结

| 问题 | 答案 |
|------|------|
| Skill + CLI能否取代MCP服务？ | ✅ **完全可以**，且更简单 |
| MD预览需要后端吗？ | ✅ **不需要**，纯前端即可 |
| 推荐架构？ | **零后端**，全部前端化 + CLI |

立即开始实施吗？
