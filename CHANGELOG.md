# 更新日志 (Changelog)

本项目遵循 [语义化版本 2.0.0](https://semver.org/lang/zh-CN/) 与
[Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范。
所有正式发行版本发布于
[GitHub Releases](https://github.com/JHJ1848/my-tools-api-tool-service/releases)。

## [未发布]

### 计划
- 应用内自动更新（electron-updater，基于 latest.yml）

## [1.1.0] - 2026-09-04

### 新增
- 标准发行体系：一键发布脚本 `npm run release -- <版本号>`，自动完成
  版本号更新 → 全量构建 → 提交打标签 → 推送 → 创建 GitHub Release 并上传产物
- CI 自动发布：推送 `v*` 标签触发 GitHub Actions，在 Windows 环境自动构建并发布
- 绿色目录版安装方式（`*-portable.zip`）：整目录下载解压后直接运行 exe，免安装
- 单文件便携版（`*-portable.exe`）：无需安装，双击即用
- CHANGELOG.md 版本变更记录

### 变更
- 仓库元数据修正：`repository` / `homepage` 指向实际 GitHub 仓库
  `JHJ1848/my-tools-api-tool-service`
- 构建脚本 `scripts/build-dist.js` 支持 `zip` 目标；`dist:all` 现生成
  NSIS / MSI / 便携版 / 绿色目录版四类产物

### 移除
- 清理 Java/Spring Boot 后端遗留代码与配置（项目已转型为纯 Electron 桌面应用）

## [1.0.0] - 2026-08-17

### 新增
- Windows 桌面端 Markdown 预览工作台首个版本
- 原生窗口：目录选择、递归扫描 `.md`、多标签、目录树、全局搜索
- Markdown 渲染：代码高亮、Mermaid 图表、KaTeX 公式、下划线 URL 严格字面量呈现
- 内网/局域网 HTTP 协同：自启本地 HTTP 服务（默认端口 `9527`），
  局域网用户浏览器访问 `http://<IP>:9527/md-view` 直接预览
- 关闭拦截：最小化到系统托盘保持共享，或彻底退出，支持记住选择

[未发布]: https://github.com/JHJ1848/my-tools-api-tool-service/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/JHJ1848/my-tools-api-tool-service/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/JHJ1848/my-tools-api-tool-service/releases/tag/v1.0.0
