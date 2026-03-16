# Markdown 预览功能优化计划

本计划旨在优化 Markdown 预览页面的布局，增加左侧文件列表侧边栏，解决页面空白空间过多的问题，并提供便捷的文件导航功能。

## 目标
1.  **优化页面布局**：将页面改为左右分栏布局，左侧为文件列表，右侧为 Markdown 内容预览。
2.  **集成文件列表**：在左侧侧边栏展示服务检测到的所有 `.md` 文件。
3.  **实现点击跳转**：点击左侧列表中的文件名，右侧预览区域更新为对应文件的内容。
4.  **优化视觉体验**：减少页面空白，提供更紧凑、高效的阅读体验。

## 实施步骤

### 1. 分析与设计
- [ ] 分析 [MarkdownPreviewController.java](file:///d:/adas/项目/tool-service/src/main/java/com/example/tool/mcp/MarkdownPreviewController.java) 中的 `renderPage` 和 `viewMarkdown` 方法。
- [ ] 设计 HTML 结构：使用 Flexbox 布局，左侧侧边栏 (`sidebar`) 宽度固定或可调整，右侧内容区 (`content`) 自适应。
- [ ] 设计 CSS 样式：确保侧边栏支持独立滚动，右侧内容区也支持独立滚动（类似 IDE 或文档网站布局）。

### 2. 后端代码修改
- [ ] 修改 `MarkdownPreviewController` 类：
    - [ ] 重构 `viewMarkdown` 方法，在渲染页面前调用 `listMdFiles()` 获取文件列表。
    - [ ] 更新 `renderPage` 方法签名，增加 `List<String> files` 参数。
    - [ ] 在 `renderPage` 中生成侧边栏的 HTML 代码。
    - [ ] 优化 `listMdFiles` 方法（如果需要），确保路径格式统一且易于在前端展示。

### 3. 前端模板与样式更新
- [ ] 更新 `renderPage` 中的 HTML 模板：
    - [ ] 添加 `<div class="layout">` 容器包裹侧边栏和内容区。
    - [ ] 添加 `<aside class="sidebar">` 用于显示文件列表。
    - [ ] 添加搜索框（可选，优化体验）用于过滤文件列表。
    - [ ] 将原有的 Markdown 内容容器放入 `<main class="content">`。
- [ ] 更新 CSS 样式：
    - [ ] 设置 `.layout` 为 `display: flex; height: 100vh; overflow: hidden;`。
    - [ ] 设置 `.sidebar` 为 `width: 300px; background: #252525; overflow-y: auto; border-right: 1px solid #404040;`。
    - [ ] 设置 `.content` 为 `flex: 1; overflow-y: auto; padding: 20px;`。
    - [ ] 优化文件列表项样式：`padding`, `hover` 效果，`active` 状态（高亮当前文件）。
    - [ ] 确保 Markdown 内容样式在新的布局中正常显示（如表格、代码块的宽度自适应）。

### 4. 功能增强 (JavaScript)
- [ ] 添加简单的 JavaScript：
    - [ ] 高亮当前正在预览的文件。
    - [ ] (可选) 实现侧边栏文件列表的客户端搜索/过滤功能。

### 5. 验证与测试
- [ ] 启动服务。
- [ ] 访问预览页面，检查左右分栏布局是否正常。
- [ ] 检查左侧文件列表是否完整显示。
- [ ] 点击列表项，验证是否能正确跳转并加载对应文件内容。
- [ ] 检查页面空白空间是否得到有效利用。
