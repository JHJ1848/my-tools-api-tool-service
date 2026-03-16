# MCP 工具服务模块规格说明书

## 1. 项目概述

### 项目名称
MCP Tool Service - 达梦数据库与Markdown预览MCP服务

### 项目背景
当前项目已经具备：
- 本地MD预览工具（基于Spring Boot的Web服务）
- 达梦数据库SQL查询服务（支持DML、DDL、查询等）

需要将这两个功能转换为标准的MCP（Model Context Protocol）协议服务，使其能被局域网内的其他AI客户端调用。

### 项目目标
1. 实现完整的MCP协议服务端，支持JSON-RPC 2.0
2. 封装现有的MD预览功能为MCP工具
3. 封装现有的DMSQL查询功能为MCP工具
4. 支持数据库IP和端口的外部配置
5. 提供各AI客户端的MCP配置模板

## 2. 技术架构

### 技术栈
- Spring Boot 3.2.0
- Java 17
- MCP协议（JSON-RPC 2.0）
- 达梦数据库驱动

### 架构设计
```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Tool Service                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │         MCP Protocol Handler (JSON-RPC 2.0)         │   │
│  │  - initialize                                        │   │
│  │  - tools/list                                        │   │
│  │  - tools/call                                        │   │
│  │  - resources/list                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌──────────────────────┐  ┌──────────────────────────┐   │
│  │   MD Preview Tool   │  │   Database Query Tool   │   │
│  │   - md_list_files   │  │   - dm_query            │   │
│  │   - md_read_file   │  │   - dm_execute_sql      │   │
│  │   - md_render      │  │   - dm_list_tables      │   │
│  └──────────────────────┘  │   - dm_table_info      │   │
│                             │   - dm_list_datasources│   │
│                             └──────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           External Config (IP:Port)                 │   │
│  │   - DM_DB_HOST: 数据库主机地址                        │   │
│  │   - DM_DB_PORT: 数据库端口                           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### MCP服务端点
- HTTP REST: `/api/mcp` (现有，已扩展)
- MCP协议: `/api/mcp/json-rpc` (新增，完整MCP协议支持)

## 3. 功能规格

### 3.1 MCP协议支持

#### 3.1.1 初始化（initialize）
MCP客户端连接时发送的初始化请求，返回服务端能力。

#### 3.1.2 工具列表（tools/list）
返回所有可用的MCP工具，包括：
- MD预览工具（3个）
- 数据库查询工具（5个）

#### 3.1.3 工具调用（tools/call）
执行指定的MCP工具并返回结果。

### 3.2 MD预览工具

| 工具名称 | 描述 | 参数 |
|---------|------|------|
| md_list_files | 列出所有MD文件 | 无 |
| md_read_file | 读取指定MD文件内容 | path: 文件路径 |
| md_render | 渲染MD文件为HTML | path: 文件路径 |

### 3.3 数据库查询工具

| 工具名称 | 描述 | 参数 |
|---------|------|------|
| dm_query | 执行SELECT查询 | sql, database, limit |
| dm_execute_sql | 自动执行SQL | sql, database, type |
| dm_list_tables | 获取表列表 | database, limit |
| dm_table_info | 获取表结构 | tableName, database |
| dm_list_datasources | 获取数据源列表 | 无 |

### 3.4 外部配置支持

通过环境变量或配置文件支持数据库连接信息的外部注入：

| 配置项 | 说明 | 默认值 |
|-------|------|-------|
| DM_DB_HOST | 数据库主机IP | 127.0.0.1 |
| DM_DB_PORT | 数据库端口 | 5236 |
| DM_DB_NAME | 数据库名称 | SOIL_SURVEY_DATA_APPLY |
| DM_DB_USERNAME | 数据库用户名 | SYSDBA |
| DM_DB_PASSWORD | 数据库密码 | (从配置文件读取) |

## 4. MCP配置模板

### 4.1 Claude Desktop配置
```json
{
  "mcpServers": {
    "tool-service": {
      "url": "http://192.168.x.x:8080/api/mcp/json-rpc",
      "description": "达梦数据库与MD预览MCP服务"
    }
  }
}
```

### 4.2 Cursor/Windsurf配置
```json
{
  "mcp": {
    "servers": {
      "tool-service": {
        "url": "http://192.168.x.x:8080/api/mcp/json-rpc"
      }
    }
  }
}
```

### 4.3 外部数据库配置（推荐）
```json
{
  "mcpServers": {
    "tool-service-db": {
      "url": "http://192.168.x.x:8080/api/mcp/json-rpc",
      "env": {
        "DM_DB_HOST": "127.0.0.1",
        "DM_DB_PORT": "5236"
      }
    }
  }
}
```

## 5. API接口规范

### 5.1 MCP JSON-RPC端点
- URL: `/api/mcp/json-rpc`
- 方法: POST
- Content-Type: application/json
- 请求体: JSON-RPC 2.0格式

### 5.2 请求示例

#### tools/list请求:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

#### tools/call请求:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "dm_query",
    "arguments": {
      "sql": "SELECT * FROM user_tables WHERE ROWNUM <= 10",
      "database": "master"
    }
  }
}
```

## 6. 验收标准

### 6.1 功能验收
- [ ] MCP协议完全支持（initialize, tools/list, tools/call）
- [ ] MD预览工具正常工作（列出、读取、渲染）
- [ ] 数据库查询工具正常工作（查询、DDL、DML）
- [ ] 外部数据库IP/端口配置生效

### 6.2 配置验收
- [ ] 提供Claude Desktop配置模板
- [ ] 提供Cursor/Windsurf配置模板
- [ ] 支持外部环境变量配置

### 6.3 兼容性验收
- [ ] 可被局域网内其他机器访问
- [ ] 支持标准的MCP客户端连接
