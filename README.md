# MD Preview Tool (Windows 桌面端与内网 Markdown 协同工作台)

> 🚀 专为 Windows 系统打造的轻量级 Markdown 预览工作台，支持原生桌面客户端运行、局域网一键协同共享与原生文件选择。

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
> 3. ✅ **编译打包发包**：自动执行 `npm run dist:app` 编译 Vite 前端与 Electron 主进程，生成独立绿色的 `dist-app\MD Preview Tool.exe`；
> 4. ✅ **创建桌面图标**：自动在您的 Windows 桌面上生成专属的 **`MD Preview Tool`** 快捷启动方式。

---

## 🛠️ 常用开发与运行命令

```powershell
# 1. 启动桌面端热更新开发模式
npm run dev

# 2. 编译并打包为 Windows 独立绿色可执行程序 (输出至 dist-app)
npm run dist:app

# 3. 直接运行已编译的桌面客户端
.\scripts\start-desktop.bat
```

---

## 🌐 核心功能特性

1. **原生 Windows 桌面体验**：
   - 独立运行进程 `MD Preview Tool.exe`，带高分辨率 Markdown 专属 ICON；
   - 标题栏支持鼠标左键长按拖拽；
   - 支持最小化、最大化与关闭；
   - **智能关闭拦截**：关闭时可选择“最小化到系统托盘（保持后台共享）”或“彻底退出”，支持“记住我的选择”；
   - **Windows 原生目录选择**：点击左上角 `📁` 即可呼出系统文件夹选择对话框，自动递归全量扫描子层级 `.md` 文件并自动定位打开首篇文档。
2. **内网 / 局域网 HTTP 协同**：
   - 后台自启 Node.js 原生 HTTP 服务（默认端口 `9527`），局域网内其他用户通过浏览器即可直接访问并预览：
     `http://<您的本机IP>:9527/md-view`
3. **精准 Markdown 渲染与接口保护**：
   - 多下划线 URL 路径（如 `/ssda/grading_standard/delete_by_name`）与蛇形字段严格字面量呈现，彻底杜绝下划线丢失或斜体误转。
