# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## 项目概述

MCP Tool Service - 工具服务器：提供数据库、Md预览MCP服务，基于Spring Boot 3.2.0 + Java 17，为AI客户端提供MCP协议服务。

## 常用命令

```bash
# 构建项目
mvn clean package

# 运行项目
mvn spring-boot:run

# 运行测试
mvn test

# 运行单个测试类
mvn test -Dtest=ClassName

# 打包并跳过测试
mvn package -DskipTests

# 启动（已编译的jar）
java -jar target/tool-service-1.0.0.jar

# 先停止再启动（重新打包）
call port.bat & mvn clean spring-boot:run
```

## 技术架构

```
┌─────────────────────────────────────────┐
│        MCP Tool Service (Spring Boot)   │
├─────────────────────────────────────────┤
│  MCP Protocol Handler (JSON-RPC 2.0)    │
│  ├─ /api/mcp (REST兼容)                 │
│  └─ /api/mcp/json-rpc (标准MCP)         │
├─────────────────────────────────────────┤
│  工具层:                                  │
│  ├─ DatabaseMcpTool (达梦数据库操作)    │
│  └─ MarkdownMcpTool (MD文件预览)        │
├─────────────────────────────────────────┤
│  服务层:                                  │
│  ├─ DatabaseQueryService               │
│  └─ QueryHistoryService                │
├─────────────────────────────────────────┤
│  数据源 (3个):                           │
│  ├─ master: SOIL_SURVEY_DATA_APPLY     │
│  ├─ sso: SOIL_SURVEY_DATA_APPLY        │
│  └─ FARMLAND_ENGINEER_QUALITY_INSPECT   │
└─────────────────────────────────────────┘
```

## 核心端点

| 端点 | 说明 |
|------|------|
| `GET /api/health` | 健康检查 |
| `POST /api/mcp/query` | 执行SELECT查询 |
| `POST /api/mcp/update` | 执行DML更新 |
| `POST /api/mcp/execute-sql` | 智能执行SQL |
| `GET /api/mcp/tables` | 获取表列表 |
| `GET /api/mcp/table-info` | 获取表结构 |
| `GET /api/md/list` | 列出MD文件 |
| `GET /preview/md/{path}` | 预览MD文件 |

## 数据库配置

- **主机**: 127.0.0.1
- **端口**: 5236
- **驱动**: dm.jdbc.driver.DmDriver (DmJdbcDriver18 8.1.3.140)
- **连接池**: 最大10连接，超时30秒

---

## 本地 Skills

Skills 目录: `.trae/skills/`

使用 Skill 工具调用这些 skills

### 可用 Skills

| Skill | 用途 |
|-------|------|
| **openspec-propose** | 提出新变更 - 一次性生成 proposal、design、tasks |
| **openspec-apply-change** | 应用变更 - 实现 OpenSpec change 中的任务 |
| **openspec-archive-change** | 归档变更 - 完成变更后归档并更新主 specs |
| **openspec-explore** | 探索模式 - 思考伙伴，用于探索想法、调查问题、澄清需求 |
| **dm-database-query** | 达梦数据库查询 - 使用 MCP 工具服务查询、插入、更新、删除数据 |
| **md-preview** | Markdown 预览 - 在浏览器中预览本地 MD 文件 |

### 触发关键词
- 数据库操作: "查询数据库"、"执行 SQL"、"达梦数据库"
- Markdown 预览: "预览 markdown"、"预览 MD 文件"、"打开 md 文件"
- OpenSpec 变更: "新变更"、"应用变更"、"归档变更"、"探索变更"
