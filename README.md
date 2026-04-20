# MD Preview Tool

> 🔥 现代化 Markdown 预览工具 - 基于 React + Node.js

## ✨ 特性

- 🚀 **轻量级架构** - Node.js 服务器，比 Spring Boot 简单 100 倍
- ⚡ **极速响应** - 基于 Vite 构建，即时加载
- 🎨 **现代化UI** - 使用 Tailwind CSS + shadcn/ui
- 🌙 **主题切换** - 支持浅色/深色/自动主题
- 📁 **文件浏览器** - 树形结构展示Markdown文件
- 🔍 **全文搜索** - 支持在Markdown中搜索内容
- 📑 **多标签页** - 支持同时打开多个文件
- 🎯 **拖拽支持** - 支持拖拽文件到页面预览

## 🏗️ 技术架构

```
┌────────────────────────────────────────────────────────┐
│               技术栈                                    │
├────────────────────────────────────────────────────────┤
│                                                         │
│  前端 (React)           后端 (Node.js)                  │
│  ├─ React 18           ├─ HTTP 服务器                   │
│  ├─ Vite 5            ├─ 文件系统 API                 │
│  ├─ Tailwind CSS       │   └─ /api/read-file          │
│  ├─ Zustand           │   └─ /api/list-directory     │
│  └─ marked.js         │   └─ /api/health             │
│                        └─ CORS 支持                    │
│                                                         │
└────────────────────────────────────────────────────────┘
```

## 🚀 快速开始

### 1. 启动后端服务器

```bash
cd server
npm install  # 仅第一次需要
node index.js
```

服务器将运行在 `http://localhost:3001`

### 2. 启动前端开发服务器

```bash
# 新开一个终端
cd md-preview-tool
npm install  # 仅第一次需要
npm run dev
```

前端将运行在 `http://localhost:3000`

### 3. 访问应用

打开浏览器访问：http://localhost:3000

## 📁 项目结构

```
md-preview-tool/
├── server/                    # Node.js 后端服务器
│   ├── index.js              # 主服务器文件
│   └── package.json          # 服务器依赖
│
├── src/                       # React 前端源码
│   ├── components/           # React 组件
│   ├── hooks/               # 自定义 Hooks
│   ├── stores/              # Zustand 状态库
│   ├── lib/                 # 工具函数
│   └── App.tsx             # 主应用
│
├── index.html                # HTML 入口
├── package.json             # 前端依赖
└── vite.config.ts           # Vite 配置
```

## 🌐 API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/config` | GET | 获取服务器配置 |
| `/api/read-file?path=xxx` | GET | 读取文件内容 |
| `/api/list-directory?path=xxx&depth=3` | GET | 列出目录内容 |

## ⚙️ 配置

### 修改基础路径

编辑 `server/index.js` 中的 `CONFIG`:

```javascript
const CONFIG = {
    PORT: 3001,
    BASE_PATH: 'D:\\你的\\路径',  // 修改这里
    CORS: '*'
};
```

### 环境变量

```bash
# Linux/Mac
BASE_PATH=/path/to/files node index.js

# Windows
set BASE_PATH=D:\path\to\files
node index.js
```

## 🎯 使用方式

### 方式一：文件路径输入

1. 在输入框中输入完整的文件路径
2. 按 Enter 或点击预览按钮
3. 例如：`D:\adas\项目\tool-service\README.md`

### 方式二：文件浏览器

1. 点击侧边栏展开文件树
2. 浏览本地目录结构
3. 点击文件即可预览

### 方式三：拖拽预览

1. 将 Markdown 文件直接拖拽到页面
2. 自动渲染内容

## 📊 对比

| 特性 | Spring Boot 方案 | Node.js 方案 |
|------|-----------------|--------------|
| 启动时间 | 10-30 秒 | **1 秒** |
| 内存占用 | 200-500 MB | **< 50 MB** |
| 配置复杂度 | 高 | **极低** |
| 依赖数量 | 多 | **仅 Node.js** |
| 学习成本 | 高 | **低** |

## 📄 许可证

MIT License
