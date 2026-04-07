# Tool Service MEMORY

本文档记录当前仓库已经落地的实现事实，重点覆盖 Markdown 预览模块的系统边界、页面流程、按钮行为、接口契约、状态缓存和已知约束。

## 1. 使用原则

- 这里记录的是“当前实现事实”，不是需求草稿。
- 当 README、历史方案文档、口头描述与当前代码冲突时，以当前代码为准。
- 当前页面主实现以 `src/main/java/com/example/tool/mcp/MarkdownPreviewController.java` 和 `src/main/resources/templates/md-preview.html` 为准。
- 仓库里存在一套未接入当前运行链路的 React/Vite 前端脚手架与旧 README，不能把它当作当前线上实现。

## 2. 当前系统结构

### 2.1 当前有效架构

- 后端：Spring Boot
- 页面模板：Thymeleaf 风格静态模板文件 `md-preview.html`
- 页面入口：`GET /md-view`
- 页面数据主接口：`GET /api/md/preview-data`
- 原文读取：`GET /md-content`
- 文件下载：`GET /md-download`
- 文件保存：`POST /api/md/save-content`
- 工作目录配置：
  - `GET /api/md/workspace-config`
  - `POST /api/md/workspace-config`
  - `POST /api/md/workspace-config/pick-directory`

### 2.2 页面布局

页面固定分为四块：

- 左侧：Markdown 文件树
- 中间：标签栏 + 面包屑 + 预览/原文切换 + Markdown 正文
- 右侧：标题树 TOC
- 最右：请求调试面板

## 3. 核心状态

### 3.1 工作目录

- 配置键：`markdown.workspace.path`
- 用户级配置文件：`%USERPROFILE%\.tool-service\markdown-preview.properties`
- 读取优先级：
  1. 用户配置文件中的工作目录
  2. Spring 配置 `markdown.base-path`
  3. 若以上目录无效，则回退到桌面

### 3.2 页面关键状态

- `currentFilePath`
  - 当前打开的 md 相对路径
- `scope`
  - 当前文件树作用域目录
- `workspaceConfig`
  - 包含 `configuredPath`、`effectivePath`、`exists`、`fallbackToDesktop`
- `TABS_KEY = md-preview-open-tabs`
  - 已打开文件标签列表
- `TAB_HISTORY_KEY = md-preview-tab-history`
  - 标签访问历史
- `MAX_OPEN_TABS = 9`
  - 超过 9 个标签时会淘汰历史最远的标签
- `md-preview-expanded-paths`
  - 左侧树已展开目录
- TOC 折叠状态
  - 右侧标题树折叠状态持久化在 localStorage
- 请求调试面板状态
  - 包括面板展开状态、折叠区状态、请求标签数据、响应视图模式、API host/port

## 4. 页面主流程

### 4.1 启动流程

1. 打开 `/md-view`。
2. 前端先调用 `/api/md/workspace-config` 获取工作目录。
3. 无论工作目录接口是否成功，最终都会调用 `/api/md/preview-data` 加载页面主数据。
4. 若 URL 不带 `path`，页面进入空白壳态，仍渲染：
   - 左侧文件树
   - 工作目录输入区
   - 空标题树
   - 空预览提示
5. 若 URL 带 `path`，则加载对应 Markdown、标题树、面包屑和请求元数据。

### 4.2 文件打开流程

1. 点击左侧 md 文件。
2. 更新 `currentFilePath` 与浏览器地址栏 `/md-view?path=...`。
3. 调用 `/api/md/preview-data?path=...`。
4. 刷新：
   - 左侧文件树高亮
   - 顶部标签栏
   - 面包屑
   - Markdown 预览区
   - 右侧标题树
   - 请求调试面板元数据
5. 左侧文件树会保留原滚动位置，不应把左侧列表滚到顶部。

### 4.3 预览/原文切换流程

1. 默认进入预览模式。
2. 点击“原文本”时，调用 `/md-content?path=...`。
3. 切换模式时保持当前阅读行附近的滚动位置同步：
   - 预览切到原文时，同步原文滚动位置
   - 原文切回预览时，同步预览滚动位置

### 4.4 标签页流程

1. 打开新文件会注册标签。
2. 标签上限为 9。
3. 超出 9 个时，按标签访问历史淘汰最久未查看的标签。
4. 关闭全部标签后，页面回到 `/md-view` 空壳页，而不是旧的 JSON 页面。

## 5. 后端接口契约

### 5.1 `GET /md-view`

- 返回页面模板 `md-preview.html`
- `path` 参数只影响前端初始化 URL，不参与服务端渲染模板

### 5.2 `GET /api/md/workspace-config`

返回：

```json
{
  "configuredPath": "配置中的原始路径",
  "effectivePath": "当前实际生效的绝对路径",
  "exists": true,
  "fallbackToDesktop": false
}
```

### 5.3 `POST /api/md/workspace-config`

请求：

```json
{
  "path": "绝对目录路径"
}
```

成功返回：

```json
{
  "success": true,
  "config": {}
}
```

失败时返回 `success=false` 和错误信息。

### 5.4 `POST /api/md/workspace-config/pick-directory`

- 服务端直接弹出 Windows/Swing 目录选择框
- 依赖图形环境
- 用户取消时返回 `cancelled=true`
- headless 环境会失败

### 5.5 `GET /api/md/preview-data`

请求参数：

- `path`：当前 md 相对路径，可空
- `scope`：当前作用域目录，可空

返回字段：

- `title`
- `content`
- `sidebar`
- `toc`
- `path`
- `scope`
- `directories`
- `apiSections`
- `apiSectionsVersion`
- `workspaceConfig`

分支规则：

- `path` 为空：只返回页面壳数据
- `path` 有值且文件存在：返回正文、toc、接口元数据
- `path` 有值但文件不存在：返回 404

### 5.6 `GET /md-content`

- 输入：`path`
- 输出：Markdown 原文文本

### 5.7 `GET /md-download`

- 输入：`path`
- 输出：对应 md 下载流

### 5.8 `POST /api/md/save-content`

- 输入：`path + content`
- 输出：保存成功标记

### 5.9 `GET /md-list`

- 输入：`scope`
- 输出：作用域内 md 相对路径数组

## 6. 左侧文件树区域

### 6.1 区域职责

- 展示工作目录下的 Markdown 树
- 搜索文件
- 定位当前文件
- 复制文件名 / 文件链接
- 维护目录展开状态

### 6.2 元素与行为

- 工作目录输入框
  - 展示当前 `effectivePath`
  - 当配置目录失效时，状态文案显示“已回退到桌面”
- `保存`
  - 保存输入框中的目录
  - 成功后清空当前文件与标签
  - 地址栏重置为 `/md-view`
  - 重新加载工作区
- `选择`
  - 调后端目录选择接口
  - 成功后清空当前文件与标签
  - 地址栏重置为 `/md-view`
  - 重新加载工作区
- 搜索框
  - 按文件名和文件相对路径匹配
  - 匹配文本高亮
  - 自动展开命中的父目录
  - 清空搜索时恢复原始展开状态
- `⌖` 定位按钮
  - 清空搜索词
  - 定位并闪烁高亮当前活动文件
- 文件夹行
  - 点击展开/收起
  - 带 0.2s 的展开收起动画
  - 展开状态写入 `md-preview-expanded-paths`
- md 文件行
  - 点击后打开文件
  - 不应把左侧文件树滚动到顶部
  - 只更新高亮和主内容
- 复制文件名按钮
  - 把文件名写入剪贴板
- 复制链接按钮
  - 把 `window.location.origin + /md-view?path=...` 写入剪贴板

### 6.3 提示行为

- 文件名过长时，悬浮 0.6s 显示完整名称
- 搜索命中高亮通过 `<mark>` 渲染

## 7. 顶部标签栏、工具栏、面包屑

### 7.1 标签栏

- 标签点击
  - 切换到该文件
- 标签关闭 `×`
  - 关闭当前标签
  - 若关闭的是活动标签，则切到相邻标签或空壳页
- 标签右键菜单
  - `关闭当前`
  - `关闭其他标签页`
  - `关闭所有`
- 快捷键
  - `Ctrl+W`：关闭当前标签
  - `Ctrl+1~9`：快速切换前 9 个标签

### 7.2 工具栏

- `预览模式`
  - 显示 HTML 预览区
  - 从原文模式切回时同步滚动位置
- `原文本`
  - 显示原文区
  - 首次进入时加载 `/md-content`
  - 与预览模式同步滚动位置
- `下载`
  - 下载当前 Markdown 文件

### 7.3 面包屑

面包屑分两类：

- 文件路径段
  - 显示当前 md 路径
  - 超长时固定长度显示省略
  - 支持横向拖选查看后半段
  - 悬浮 0.6s 显示完整内容
- 标题段
  - 展示当前阅读位置对应的 1~3 级标题
  - 各级标题段长度固定
  - 三级标题空间按总宽均分
  - 超长省略并带悬浮提示
  - 点击后滚动到对应标题

## 8. 右侧标题树 TOC

### 8.1 区域职责

- 展示当前文档标题结构
- 支持标题折叠/展开
- 跟随阅读位置高亮
- 与面包屑、正文滚动联动

### 8.2 交互规则

- 标题圆点/折叠按钮
  - 点击切换当前节点展开状态
  - 状态持久化到 localStorage
- 标题文本
  - 点击滚动到正文对应标题
- 三级标题特殊逻辑
  - 激活某个三级标题时，会突出当前三级标题分组
  - 同时对四级标题展示做联动控制
- 缩进
  - 不同层级缩进已加大，用于增强层级区分
- 动画
  - 展开/收起带 0.2s 过渡

### 8.3 联动行为

- 正文滚动时，TOC 自动高亮当前标题
- TOC 高亮切换时会更新：
  - 顶部面包屑
  - URL hash
  - 标题定位反馈闪烁

## 9. Markdown 正文区

### 9.1 职责

- 展示 Markdown 渲染后的 HTML
- 支持标题折叠
- 支持代码高亮
- 支持表格和列表
- 支持从文档提取接口元数据驱动请求面板

### 9.2 当前已知渲染规则

- `-` 列表按标准 Markdown 列表解析
- 有序列表应按真实序号连续渲染，而不是全部显示为 1
- 需要区分：
  - `--` 普通文本
  - `---` 分隔线
- 标题可点击折叠对应正文块

## 10. 原文本区域

- 点击“原文本”才显示
- 从 `/md-content` 读取原始 Markdown
- 切换预览/原文时保持当前阅读位置尽量一致
- 原文加载失败时应显示错误，而不是空白无反馈

## 11. 请求调试面板

### 11.1 区域职责

- 根据文档里的接口说明生成请求调试表单
- 支持多请求标签
- 支持 host/port 自定义
- 支持路径参数、查询参数、请求体编辑
- 支持 raw / preview 响应查看

### 11.2 元素与行为

- 面板开关按钮
  - 展开/收起请求面板
  - 状态持久化
- 请求标签
  - 点击切换标签
- 请求标签关闭按钮
  - 关闭单个请求标签
  - 若只剩一个，则重建默认标签
- `+`
  - 新增一个请求标签
- host / port 输入框
  - 支持修改请求地址
  - `保存` 后写入本地配置
- 请求方法下拉
  - 切换 GET / POST
- 请求路径输入框
  - 录入路径与 query string
  - 自动拆分路径参数与查询参数
- 路径参数表格
  - 可编辑
- 查询参数表格
  - 可编辑
  - 可删除行
- `+ 添加查询参数`
  - 追加空查询参数行
- `发送请求`
  - 发起真实请求
  - 成功/失败信息写入响应区与消息提示
- `清空`
  - 重置当前请求标签数据，保留标签 id/name
- 响应 `raw`
  - 展示原始文本
- 响应 `preview`
  - 以 JSON 树展示
- JSON 树节点
  - 点击展开/收起
- 文档中的“调用”按钮
  - 从当前 Markdown 中提取接口名称、路径、方法、参数
  - 直接回填到请求面板
  - 自动展开面板

## 12. 路径与安全规则

- `path` 和 `scope` 都会先做规范化：
  - `\` 转 `/`
  - 去前后 `/`
  - 合并连续 `/`
  - 禁止 `..`
- 实际解析出的路径必须位于工作目录下
- 左侧树、预览、原文、下载、保存全部依赖同一套工作目录基线

## 13. 已知约束

- `POST /api/md/workspace-config/pick-directory` 依赖桌面环境，服务端通过 Swing 弹窗选目录，不适合 headless 场景。
- 当前仓库里存在旧 README 和前端脚手架文件，但不代表当前运行中的真实 UI。
- 本模块强依赖浏览器 localStorage 维持标签、树展开、面板配置等体验。

## 14. 当前维护建议

- 后续修改页面行为时，优先同步本文件，而不是继续让 README 承担事实文档职责。
- 如果新增按钮或快捷键，至少补充：
  - 所在区域
  - 触发方式
  - 成功行为
  - 失败提示
  - 是否写入 localStorage
- 如果修改工作目录策略，必须同步：
  - 配置优先级
  - 回退逻辑
  - 接口返回结构
