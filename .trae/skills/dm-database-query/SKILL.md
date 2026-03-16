---
name: "dm-database-query"
description: "Query and modify Dameng database using MCP tool service. Invoke when user needs to query, insert, update, delete data, or execute DDL/DML operations on Dameng database."
---

# Dameng Database Query Skill

This skill provides comprehensive access to Dameng database operations including query, insert, update, delete, and DDL operations through the MCP tool service.

## Service Configuration

- **Service URL**: `http://127.0.0.1:8080/api/mcp`
- **Available Databases**:
  - `master`: SOIL_SURVEY_DATA_APPLY
  - `sso`: SOIL_SURVEY_DATA_APPLY
  - `FARMLAND_ENGINEER_QUALITY_INSPECT`: FARMLAND_ENGINEER_QUALITY_INSPECT

## Security Configuration

- **Query Timeout**: 30 seconds
- **Max Rows**: 1000 rows
- **Connection Pool**: 10 max connections, 2 min idle

## Available Endpoints

### 1. Execute SELECT Query
**Endpoint**: `POST /api/mcp/query`

Execute SQL SELECT queries.

**Request Body**:
```json
{
  "sql": "SELECT * FROM table_name WHERE condition",
  "database": "master",
  "limit": 1000
}
```

### 2. Execute DML Update (INSERT/UPDATE/DELETE)
**Endpoint**: `POST /api/mcp/update`

Execute INSERT, UPDATE, DELETE operations.

**Request Body**:
```json
{
  "sql": "INSERT INTO users (name, email) VALUES ('张三', 'zhangsan@example.com')",
  "database": "master"
}
```

### 3. Execute DDL Operations
**Endpoint**: `POST /api/mcp/ddl`

Execute CREATE, ALTER, DROP, TRUNCATE operations.

**Request Body**:
```json
{
  "sql": "CREATE TABLE test_table (id INT PRIMARY KEY, name VARCHAR(100))",
  "database": "master"
}
```

### 4. Auto Execute SQL (Smart Type Detection)
**Endpoint**: `POST /api/mcp/execute-sql`

Automatically detects SQL type and executes accordingly.

**Request Body**:
```json
{
  "sql": "SELECT * FROM users WHERE id = 1",
  "database": "master",
  "type": "auto"
}
```

**Type Parameter**:
- `auto`: Automatically detect type (default)
- `query`: SQL Force SELECT query
- `update`: Force DML operation
- `ddl`: Force DDL operation

### 5. List Tables
**Endpoint**: `GET /api/mcp/tables`

Get list of tables in database.

**Parameters**:
- `database`: Database name (default: master)
- `limit`: Max number of results (default: 100)

### 6. Get Table Info
**Endpoint**: `GET /api/mcp/table-info`

Get table structure information.

**Parameters**:
- `tableName`: Table name (required)
- `database`: Database name (default: master)

### 7. Query History
**Endpoint**: `GET /api/mcp/history`

Get query history stored in CSV.

**Parameters**:
- `limit`: Max number of results (default: 50)

### 8. Clear History
**Endpoint**: `DELETE /api/mcp/history`

Clear query history.

### 9. Health Check
**Endpoint**: `GET /api/health`

Check service health.

### 10. Database Health Check
**Endpoint**: `GET /api/health/db`

Check database connection.

### 11. List Available Tools
**Endpoint**: `GET /api/mcp/tools`

Returns a list of available database tools.

### 12. List Data Sources
**Endpoint**: `GET /api/mcp/datasources`

Returns a list of available database connections.

## Supported SQL Types

### Query Operations (SELECT)
- SELECT statements
- WITH common table expressions (CTE)
- JOIN operations
- Subqueries

### DML Operations (Data Manipulation Language)
- INSERT - Insert data
- UPDATE - Update data
- DELETE - Delete data
- MERGE - Merge data

### DDL Operations (Data Definition Language)
- CREATE - Create tables, indexes, views, etc.
- ALTER - Modify table structure
- DROP - Drop tables, indexes, etc.
- TRUNCATE - Truncate table data
- COMMENT - Add comments

## Usage Guidelines

1. **Always specify the database parameter** when executing queries (default: "master")
2. **Check the success field** in responses before processing data
3. **Handle error messages** appropriately when success is false
4. **Use appropriate endpoint** for different SQL types:
   - Use `/query` for SELECT
   - Use `/update` for INSERT/UPDATE/DELETE
   - Use `/ddl` for CREATE/ALTER/DROP
   - Use `/execute-sql` with type="auto" for automatic detection

## Example Queries

### Query with SELECT
```json
{
  "sql": "SELECT * FROM users LIMIT 10",
  "database": "master"
}
```

### Query with WHERE clause
```json
{
  "sql": "SELECT id, name, email FROM users WHERE status = 'active' AND created_at > '2024-01-01'",
  "database": "master"
}
```

### Insert data
```json
{
  "sql": "INSERT INTO users (name, email, status) VALUES ('新用户', 'newuser@example.com', 'active')",
  "database": "master"
}
```

### Update data
```json
{
  "sql": "UPDATE users SET name = '修改后的名称', status = 'inactive' WHERE id = 1",
  "database": "master"
}
```

### Delete data
```json
{
  "sql": "DELETE FROM users WHERE id = 1 AND status = 'inactive'",
  "database": "master"
}
```

### Create table
```json
{
  "sql": "CREATE TABLE new_table (id INT PRIMARY KEY, name VARCHAR(100), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
  "database": "master"
}
```

### List tables
```
GET /api/mcp/tables?database=master&limit=10
```

### Get table structure
```
GET /api/mcp/table-info?tableName=users&database=master
```

### Get query history
```
GET /api/mcp/history?limit=10
```

## Error Handling

Common error scenarios:
- **Missing SQL parameter**: Returns error message "sql参数不能为空"
- **Invalid database**: Query will fail with connection error
- **SQL syntax error**: Returns database-specific error message
- **Query timeout**: Returns error message "查询超时，已超过 30 秒"
- **Constraint violation**: Returns error message with constraint details

## Testing the Service

Before using this skill, verify the service is running:

```bash
# Test health
curl http://127.0.0.1:8080/api/health

# Test database health
curl http://127.0.0.1:8080/api/health/db

# Test query
curl -X POST http://127.0.0.1:8080/api/mcp/query \
  -H "Content-Type: application/json" \
  -d '{"sql":"SELECT 1","database":"master"}'

# List tables
curl "http://127.0.0.1:8080/api/mcp/tables?database=master&limit=10"

# Get table info
curl "http://127.0.0.1:8080/api/mcp/table-info?tableName=sys_dict&database=master"

# Get query history
curl "http://127.0.0.1:8080/api/mcp/history?limit=10"

# Clear history
curl -X DELETE http://127.0.0.1:8080/api/mcp/history
```

## Best Practices

1. **Use LIMIT** in SELECT queries to avoid returning large datasets
2. **Specify only needed columns** instead of using SELECT *
3. **Add appropriate WHERE clauses** to filter results
4. **Test queries with small LIMIT first** before running full queries
5. **Use appropriate database** for the data you need to access
6. **Always include WHERE clause** in UPDATE and DELETE operations to avoid accidentally updating/deleting all records
7. **Check affected rows count** in response to verify operation success
8. **Use health check** to verify service and database availability before running queries
9. **Query history** is stored in CSV format at `logs/query_history.csv` for auditing
