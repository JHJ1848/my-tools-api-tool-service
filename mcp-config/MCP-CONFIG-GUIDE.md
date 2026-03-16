# MCP 工具服务配置指南

## 服务地址

MCP JSON-RPC 端点：
```
http://<服务器IP>:8080/api/mcp/json-rpc
```

## MCP 工具列表

### Markdown 预览工具

| 工具名称 | 描述 | 参数 |
|---------|------|------|
| md_list_files | 列出所有可用的Markdown文件 | 无 |
| md_read_file | 读取指定Markdown文件的内容 | path: 文件路径 |
| md_render | 渲染Markdown文件为HTML并返回预览链接 | path: 文件路径 |

### 数据库查询工具

| 工具名称 | 描述 | 参数 |
|---------|------|------|
| dm_query | 执行SELECT查询 | sql, database, limit |
| dm_execute_sql | 自动执行SQL（智能判断类型） | sql, database, type |
| dm_list_tables | 获取表列表 | database, limit |
| dm_table_info | 获取表结构信息 | tableName, database |
| dm_list_datasources | 获取数据源列表 | 无 |

## 客户端配置

### Claude Desktop

将 `mcp-config/claude-desktop-mcp-config.json` 中的内容添加到 `claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "tool-service": {
      "url": "http://127.0.0.1:8080/api/mcp/json-rpc",
      "description": "达梦数据库与Markdown预览MCP工具服务"
    }
  }
}
```

### Cursor / Windsurf

将 `mcp-config/cursor-mcp-config.json` 中的内容添加到 `.cursor/mcp.json` 或 `settings.json`：

```json
{
  "mcp": {
    "servers": {
      "tool-service": {
        "url": "http://127.0.0.1:8080/api/mcp/json-rpc"
      }
    }
  }
}
```

### 其他支持MCP的客户端

使用标准HTTP POST方式调用：

```bash
curl -X POST http://127.0.0.1:8080/api/mcp/json-rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

## 外部数据库配置

### 方式一：环境变量

在启动服务前设置环境变量：

```bash
# Windows
set DM_DB_ENABLED=true
set DM_DB_HOST=127.0.0.1
set DM_DB_PORT=5236
set DM_DB_NAME=SOIL_SURVEY_DATA_APPLY
set DM_DB_USERNAME=SYSDBA
set DM_DB_PASSWORD=mll123!@#

# Linux/Mac
export DM_DB_ENABLED=true
export DM_DB_HOST=127.0.0.1
export DM_DB_PORT=5236
export DM_DB_NAME=SOIL_SURVEY_DATA_APPLY
export DM_DB_USERNAME=SYSDBA
export DM_DB_PASSWORD=mll123!@#
```

### 方式二：application.yml

修改 `src/main/resources/application-datasource.yml`：

```yaml
spring:
  datasource:
    dynamic:
      primary: master
      datasource:
        master:
          url: jdbc:dm://127.0.0.1:5236/SOIL_SURVEY_DATA_APPLY
```

### 配置优先级

环境变量 > application.yml

## API 调用示例

### 1. 初始化连接

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "clientInfo": {
      "name": "example-client",
      "version": "1.0.0"
    }
  }
}
```

### 2. 获取工具列表

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

### 3. 执行数据库查询

```json
{
  "jsonrpc": "2.0",
  "id": 3,
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

### 4. 读取Markdown文件

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "md_read_file",
    "arguments": {
      "path": "tool-service/README.md"
    }
  }
}
```

## 注意事项

1. 确保服务端口8080已开放
2. 确保局域网内可访问
3. 外部数据库配置需要设置 `DM_DB_ENABLED=true`
4. 首次使用建议通过 `/api/mcp/capabilities` 确认服务正常
