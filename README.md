# MDPreviewTool (Windows 桌面端与内网 Markdown 协同工作台)

> 🚀 专为 Windows 系统打造的轻量级 Markdown 预览工作台，支持原生桌面客户端运行、局域网一键协同共享与原生文件选择。

---

## 📦 下载安装（正式发行版）

所有正式版本发布在
[GitHub Releases](https://github.com/JHJ1848/my-tools-api-tool-service/releases)，
每个版本提供以下四种发行产物，按需选择其一即可：

| 产物 | 适用场景 | 使用方式 |
| :--- | :--- | :--- |
| **`MDPreviewTool-Setup-X.Y.Z-x64.exe`** | 标准安装（推荐） | 双击安装向导，可选安装目录，自动创建桌面和开始菜单快捷方式 |
| **`MDPreviewTool-X.Y.Z-x64.zip`** | 绿色目录版 | 解压后双击其中的 `MDPreviewTool.exe` 即可运行 |
| **`MDPreviewTool-X.Y.Z-x64-portable.exe`** | 单文件便携版 | 双击即用，适合 U 盘或临时使用 |
| **`MDPreviewTool-X.Y.Z-x64.msi`** | 企业或域环境部署 | 默认安装到系统盘的 `Apps\MDPreviewTool`，支持集中部署和自选目录 |

> 免安装使用时可选择 ZIP 解压版或单文件便携版。

### 版本与更新

- 遵循 [语义化版本](https://semver.org/lang/zh-CN/)，变更记录见 [CHANGELOG.md](CHANGELOG.md)
- 发布新版本：本地执行 `npm run release -- 1.2.0 "备注"`（自动构建全部产物并发布），
  或直接推送 `v*` 标签由 GitHub Actions 自动构建发布

---

## 💻 运行与开发环境要求 (Windows)

| 依赖项 | 最低版本要求 | 说明 |
| :--- | :--- | :--- |
| **操作系统** | Windows 10 / Windows 11 (x64) | 推荐使用最新版本 |
| **Node.js** | `>= 18.0.0` (推荐 18.x / 20.x LTS) | [Node.js 官方下载](https://nodejs.org/) |
| **包管理器** | `npm` (`>= 9.0.0`) | 随 Node.js 自带 |
| **终端环境** | Windows PowerShell / CMD | 强制支持 UTF-8 编码 |

---

## ⚡ 换机 / 新环境一键初始化

在新电脑上拉取代码后，**无需手动执行繁琐命令**，直接使用项目内置的 Windows 初始化脚本：

### 方式一：双击初始化 (推荐)
直接双击项目根目录下的 **`scripts\setup.bat`** 即可。

### 方式二：PowerShell 终端一键初始化
```powershell
.\scripts\setup.ps1
```

> **脚本自动完成的工作**：
> 1. ✅ **环境依赖检查**：自动检测 Node.js 与 npm 是否就绪；
> 2. ✅ **安装全量依赖**：自动执行 `npm install` 还原 `node_modules`；
> 3. ✅ **编译打包发包**：自动执行 `npm run dist:app`，生成 `dist-app\win-unpacked\MDPreviewTool.exe`。
> 4. ✅ **创建桌面图标**：在 Windows 桌面创建 **`MDPreviewTool`** 快捷方式。

---

## 🛠️ 常用开发与运行命令

```powershell
# 1. 启动桌面端热更新开发模式
npm run dev

# 2. 编译并打包为 Windows 独立绿色可执行程序 (输出至 dist-app)
npm run dist:app

# 3. 构建标准发行产物 (输出至 release: Setup 安装器 / MSI / 便携版 exe / 绿色目录版 zip)
npm run dist

# 4. 只构建某一类产物
npm run dist:nsis     # NSIS 安装器
npm run dist:msi      # MSI 安装包
npm run dist:portable # 单文件便携版 exe
npm run dist:zip      # 绿色目录版 zip

# 5. 一键发布新版本 (改版本号 → 构建 → 提交打 tag → 推送 → GitHub Release)
npm run release -- 1.2.0
npm run release:dry                 # 在临时目录预检下一个补丁版本

# 6. 直接运行已编译的桌面客户端
.\scripts\start-desktop.bat
```

---

## 🌐 核心功能特性

1. **原生 Windows 桌面体验**：
   - 独立运行进程 `MDPreviewTool.exe`，带多尺寸应用图标。
   - 标题栏支持鼠标左键长按拖拽；
   - 支持最小化、最大化与关闭；
   - **智能关闭拦截**：关闭时可选择“最小化到系统托盘（保持后台共享）”或“彻底退出”，支持“记住我的选择”；
   - **Windows 原生目录选择**：点击左上角 `📁` 即可呼出系统文件夹选择对话框，自动递归全量扫描子层级 `.md` 文件并自动定位打开首篇文档。
2. **内网 / 局域网 HTTP 协同**：
   - 后台启动 HTTP 服务，优先监听 `9527`，被占用时自动选择空闲端口。局域网内的用户可通过工作台或系统托盘复制的分享链接访问。
3. **精准 Markdown 渲染与接口保护**：
   - 多下划线 URL 路径（如 `/ssda/grading_standard/delete_by_name`）与蛇形字段严格字面量呈现，彻底杜绝下划线丢失或斜体误转。
