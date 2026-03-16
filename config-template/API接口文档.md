# Tool Service API 接口文档

## 基础信息

- **服务端口**: 8080
- **基础路径**: `http://127.0.0.1:8080`
- **Content-Type**: `application/json`

---

## 接口列表

### 1. 健康检查

#### 1.1 服务健康检查
**请求**

```http
GET /api/health
```

**响应示例**

```json
{
  "status": "UP",
  "service": "tool-service",
  "timestamp": 1772263298821
}
```

#### 1.2 数据库健康检查
**请求**

```http
GET /api/health/db
```

**响应示例**

```json
{
  "status": "UP",
  "database": "master",
  "message": "数据库连接正常"
}
```

---

### 2. 执行SQL查询（SELECT）

**请求**

```http
POST /api/mcp/query
```

**请求体**

```json
{
  "sql": "SELECT * FROM sys_area_info WHERE id = 10",
  "database": "master",
  "limit": 1000
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sql | string | 是 | SQL查询语句（支持SELECT和WITH开头的查询） |
| database | string | 否 | 数据源名称，支持 `master`、`sso` 或 `FARMLAND_ENGINEER_QUALITY_INSPECT`，默认 `master` |
| limit | integer | 否 | 返回结果数量限制，默认1000 |

**成功响应示例**

```json
{
  "success": true,
  "data": [...],
  "total": 1,
  "message": null,
  "database": "master"
}
```

---

### 3. 执行SQL更新（DML - INSERT/UPDATE/DELETE）

**请求**

```http
POST /api/mcp/update
```

**请求体**

```json
{
  "sql": "UPDATE users SET name = '新名称' WHERE id = 1",
  "database": "master"
}
```

**成功响应示例**

```json
{
  "success": true,
  "message": "操作成功，影响行数: 1",
  "total": 1,
  "database": "master"
}
```

---

### 4. 执行DDL操作

**请求**

```http
POST /api/mcp/ddl
```

**请求体**

```json
{
  "sql": "CREATE TABLE test_table (id INT PRIMARY KEY, name VARCHAR(100))",
  "database": "master"
}
```

**成功响应示例**

```json
{
  "success": true,
  "message": "DDL操作执行成功",
  "database": "master"
}
```

---

### 5. 自动执行SQL（智能判断SQL类型）

**请求**

```http
POST /api/mcp/execute-sql
```

**请求体**

```json
{
  "sql": "SELECT * FROM users WHERE id = 1",
  "database": "master",
  "type": "auto"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sql | string | 是 | SQL语句 |
| database | string | 否 | 数据源名称，默认 `master` |
| type | string | 否 | SQL类型：`auto`（自动判断）、`query`（查询）、`update`（更新）、`ddl`（DDL），默认 `auto` |

---

### 6. 获取表列表

**请求**

```http
GET /api/mcp/tables
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| database | string | 否 | 数据源名称，默认 `master` |
| limit | integer | 否 | 返回结果数量限制，默认100 |

**响应示例**

```json
{
  "success": true,
  "data": [
    {"tableName": "USERS"},
    {"tableName": "ORDERS"}
  ],
  "total": 2,
  "database": "master"
}
```

---

### 7. 获取表结构信息

**请求**

```http
GET /api/mcp/table-info
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| tableName | string | 是 | 表名称 |
| database | string | 否 | 数据源名称，默认 `master` |

**响应示例**

```json
{
  "success": true,
  "data": [
    {
      "columnName": "ID",
      "dataType": "BIGINT",
      "dataLength": 8,
      "dataPrecision": null,
      "dataScale": 0,
      "nullable": "N",
      "columnId": 1,
      "defaultValue": null
    }
  ],
  "total": 1,
  "database": "master"
}
```

---

### 8. 获取查询历史

**请求**

```http
GET /api/mcp/history
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| limit | integer | 否 | 返回结果数量限制，默认50 |

**响应示例**

```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2026-02-28 15:22:23",
      "sql": "SELECT * FROM sys_dict WHERE ROWNUM <= 1",
      "database": "master",
      "type": "SELECT",
      "success": true,
      "durationMs": 6,
      "affectedRows": 1
    }
  ],
  "total": 1
}
```

---

### 9. 清空查询历史

**请求**

```http
DELETE /api/mcp/history
```

**响应示例**

```json
{
  "success": true,
  "message": "查询历史已清空"
}
```

---

### 10. 获取数据源列表

**请求**

```http
GET /api/mcp/datasources
```

**响应示例**

```json
{
  "success": true,
  "dataSources": ["master", "sso", "FARMLAND_ENGINEER_QUALITY_INSPECT"]
}
```

---

### 11. 获取可用工具列表

**请求**

```http
GET /api/mcp/tools
```

**响应示例**

```json
{
  "success": true,
  "tools": [
    {
      "name": "dm_query",
      "description": "执行达梦数据库SQL查询（支持SELECT语句）",
      "inputSchema": {...}
    },
    {
      "name": "dm_update",
      "description": "执行达梦数据库DML更新操作（INSERT/UPDATE/DELETE）",
      "inputSchema": {...}
    },
    {
      "name": "dm_ddl",
      "description": "执行达梦数据库DDL操作（CREATE/ALTER/DROP）",
      "inputSchema": {...}
    },
    {
      "name": "dm_execute_sql",
      "description": "自动执行达梦数据库SQL（智能判断SQL类型）",
      "inputSchema": {...}
    },
    {
      "name": "dm_list_tables",
      "description": "获取达梦数据库表列表",
      "inputSchema": {...}
    },
    {
      "name": "dm_table_info",
      "description": "获取达梦数据库表结构信息",
      "inputSchema": {...}
    },
    {
      "name": "dm_list_datasources",
      "description": "获取可用的达梦数据库数据源列表",
      "inputSchema": {...}
    }
  ]
}
```

---

### 12. 执行MCP工具

**请求**

```http
POST /api/mcp/execute
```

**请求体**

```json
{
  "tool": "dm_query",
  "arguments": {
    "sql": "SELECT * FROM sys_area_info WHERE id = 10",
    "database": "master"
  }
}
```

---

## 支持的SQL类型

### 查询操作 (SELECT)
- SELECT 语句
- WITH 公共表表达式 (CTE)

### DML操作 (Data Manipulation Language)
- INSERT - 插入数据
- UPDATE - 更新数据
- DELETE - 删除数据
- MERGE - 合并数据

### DDL操作 (Data Definition Language)
- CREATE - 创建表、索引、视图等
- ALTER - 修改表结构
- DROP - 删除表、索引等
- TRUNCATE - 清空表数据
- COMMENT - 添加注释

---

## 安全配置

### SQL 限制
- **查询超时**: 30 秒
- **最大返回行数**: 1000 行

### 连接池配置
- **最大连接数**: 10
- **最小空闲连接**: 2
- **连接超时**: 30 秒
- **空闲超时**: 10 分钟
- **最大生命周期**: 30 分钟

---

## 数据源配置

| 数据源名称 | 数据库实例 |
|-----------|-----------|
| master | SOIL_SURVEY_DATA_APPLY |
| sso | SOIL_SURVEY_DATA_APPLY |
| FARMLAND_ENGINEER_QUALITY_INSPECT | FARMLAND_ENGINEER_QUALITY_INSPECT |

---

## 错误码说明

| 字段 | 说明 |
|------|------|
| success: false | 操作失败 |
| success: true | 操作成功 |
| message | 错误信息或成功消息 |
| data | 查询结果数据 |
| total | 返回记录数/影响行数 |

---

## 注意事项

1. **SQL支持**: 支持 SELECT、INSERT、UPDATE、DELETE、CREATE、ALTER、DROP 等SQL语句
2. **数据源**: 支持 `master`、`sso` 和 `FARMLAND_ENGINEER_QUALITY_INSPECT` 数据源，默认使用 `master`
3. **查询历史**: 所有SQL操作都会被记录到 `logs/query_history.csv`
4. **CORS**: 支持跨域请求
5. **数据库类型**: 仅支持达梦数据库（DmDB）

---

## curl 命令示例

```bash
# 健康检查
curl http://127.0.0.1:8080/api/health

# 数据库健康检查
curl http://127.0.0.1:8080/api/health/db

# 查询数据
curl -X POST http://127.0.0.1:8080/api/mcp/query \
  -H "Content-Type: application/json" \
  -d '{"sql":"SELECT * FROM users LIMIT 10","database":"master"}'

# 插入数据
curl -X POST http://127.0.0.1:8080/api/mcp/update \
  -H "Content-Type: application/json" \
  -d '{"sql":"INSERT INTO users (name) VALUES (\"test\")","database":"master"}'

# 获取表列表
curl "http://127.0.0.1:8080/api/mcp/tables?database=master&limit=10"

# 获取表结构
curl "http://127.0.0.1:8080/api/mcp/table-info?tableName=users&database=master"

# 获取查询历史
curl "http://127.0.0.1:8080/api/mcp/history?limit=10"

# 清空查询历史
curl -X DELETE http://127.0.0.1:8080/api/mcp/history

# 列出所有 MD 文件
curl http://127.0.0.1:8080/api/md/list

# 预览 MD 文件（直接在浏览器打开）
# http://127.0.0.1:8080/preview/md/tool-service/README.md
# http://127.0.0.1:8080/preview/md/tool-service/.trae/skills/dm-database-query/SKILL.md
```
