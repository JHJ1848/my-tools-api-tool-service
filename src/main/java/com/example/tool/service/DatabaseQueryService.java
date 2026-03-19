package com.example.tool.service;

import com.example.tool.config.DataSourceConfig;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.sql.*;
import java.util.*;

@Service
@ConditionalOnProperty(name = "tool-service.dameng.enabled", havingValue = "true", matchIfMissing = true)
public class DatabaseQueryService {

    private static final Logger logger = LoggerFactory.getLogger(DatabaseQueryService.class);
    private static final int DEFAULT_QUERY_TIMEOUT = 30;
    private static final int DEFAULT_MAX_ROWS = 1000;

    @Autowired
    private DataSourceConfig dataSourceConfig;

    @Autowired
    private QueryHistoryService queryHistoryService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    public DatabaseQueryService() {
        objectMapper.configure(SerializationFeature.FAIL_ON_EMPTY_BEANS, false);
    }

    public static class QueryResult {
        private List<Map<String, Object>> data;
        private int total;
        private String message;
        private boolean success;
        private String database;

        public QueryResult() {}

        public QueryResult(boolean success, String message) {
            this.success = success;
            this.message = message;
        }

        public QueryResult(boolean success, List<Map<String, Object>> data, int total) {
            this.success = success;
            this.data = data;
            this.total = total;
        }

        public List<Map<String, Object>> getData() { return data; }
        public void setData(List<Map<String, Object>> data) { this.data = data; }
        public int getTotal() { return total; }
        public void setTotal(int total) { this.total = total; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
        public boolean isSuccess() { return success; }
        public void setSuccess(boolean success) { this.success = success; }
        public String getDatabase() { return database; }
        public void setDatabase(String database) { this.database = database; }
    }

    public QueryResult executeQuery(String sql, String database) {
        String trimmedSql = sql.trim();
        long startTime = System.currentTimeMillis();

        if (database == null || database.isEmpty()) {
            database = "master";
        }

        // 验证SQL安全性 - 只允许 SELECT 和 WITH (CTE) 语句
        if (!isSafeQuery(trimmedSql)) {
            logger.warn("不安全的SQL查询: {}", trimmedSql);
            return new QueryResult(false, "仅允许执行 SELECT 查询语句");
        }

        logger.info("执行SQL查询 - 数据库: {}, SQL: {}", database, trimmedSql);

        DataSource dataSource = dataSourceConfig.getDataSource(database);

        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {
            
            stmt.setQueryTimeout(DEFAULT_QUERY_TIMEOUT);
            stmt.setMaxRows(DEFAULT_MAX_ROWS);
            
            try (ResultSet rs = stmt.executeQuery(trimmedSql)) {

                ResultSetMetaData metaData = rs.getMetaData();
                int columnCount = metaData.getColumnCount();
                List<String> columnNames = new ArrayList<>();
                for (int i = 1; i <= columnCount; i++) {
                    columnNames.add(metaData.getColumnLabel(i));
                }

                List<Map<String, Object>> resultList = new ArrayList<>();
                while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    for (int i = 0; i < columnCount; i++) {
                        Object value = rs.getObject(i + 1);
                        row.put(columnNames.get(i), convertValue(value));
                    }
                    resultList.add(row);
                }

                long duration = System.currentTimeMillis() - startTime;
                logger.info("查询成功 - 数据库: {}, 返回记录数: {}, 耗时: {}ms", database, resultList.size(), duration);

                QueryResult result = new QueryResult(true, resultList, resultList.size());
                result.setDatabase(database);
                
                queryHistoryService.recordQuery(trimmedSql, database, "SELECT", true, duration, resultList.size());
                return result;

            }

        } catch (SQLTimeoutException e) {
            long duration = System.currentTimeMillis() - startTime;
            logger.error("SQL查询超时 - 数据库: {}, 超时时间: {}秒", database, DEFAULT_QUERY_TIMEOUT);
            queryHistoryService.recordQuery(trimmedSql, database, "SELECT", false, duration, 0);
            return new QueryResult(false, "查询超时，已超过 " + DEFAULT_QUERY_TIMEOUT + " 秒");
        } catch (SQLException e) {
            long duration = System.currentTimeMillis() - startTime;
            logger.error("SQL执行错误 - 数据库: {}, 错误: {}", database, e.getMessage());
            queryHistoryService.recordQuery(trimmedSql, database, "SELECT", false, duration, 0);
            return new QueryResult(false, "SQL执行错误: " + e.getMessage());
        }
    }

    private Object convertValue(Object value) {
        if (value == null) {
            return null;
        }

        String className = value.getClass().getName();
        
        if (className.contains("dm.jdbc")) {
            return value.toString();
        }
        
        if (value instanceof byte[]) {
            return Base64.getEncoder().encodeToString((byte[]) value);
        }
        
        if (value instanceof Blob) {
            try {
                Blob blob = (Blob) value;
                byte[] bytes = blob.getBytes(1, (int) blob.length());
                return Base64.getEncoder().encodeToString(bytes);
            } catch (SQLException e) {
                return "[BLOB]";
            }
        }
        
        if (value instanceof Clob) {
            try {
                Clob clob = (Clob) value;
                return clob.getSubString(1, (int) clob.length());
            } catch (SQLException e) {
                return "[CLOB]";
            }
        }
        
        return value;
    }

    public QueryResult executeQuery(String sql) {
        return executeQuery(sql, "master");
    }

    public QueryResult executeUpdate(String sql, String database) {
        String trimmedSql = sql.trim();
        long startTime = System.currentTimeMillis();

        if (database == null || database.isEmpty()) {
            database = "master";
        }

        logger.info("执行SQL更新 - 数据库: {}, SQL: {}", database, trimmedSql);

        DataSource dataSource = dataSourceConfig.getDataSource(database);

        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {

            int affectedRows = stmt.executeUpdate(trimmedSql);
            long duration = System.currentTimeMillis() - startTime;

            logger.info("更新成功 - 数据库: {}, 影响行数: {}, 耗时: {}ms", database, affectedRows, duration);

            QueryResult result = new QueryResult(true, "操作成功，影响行数: " + affectedRows);
            result.setDatabase(database);
            result.setTotal(affectedRows);
            
            queryHistoryService.recordQuery(trimmedSql, database, "UPDATE", true, duration, affectedRows);
            return result;

        } catch (SQLException e) {
            long duration = System.currentTimeMillis() - startTime;
            logger.error("SQL执行错误 - 数据库: {}, 错误: {}", database, e.getMessage());
            queryHistoryService.recordQuery(trimmedSql, database, "UPDATE", false, duration, 0);
            return new QueryResult(false, "SQL执行错误: " + e.getMessage());
        }
    }

    public QueryResult executeUpdate(String sql) {
        return executeUpdate(sql, "master");
    }

    public QueryResult executeDDL(String sql, String database) {
        String trimmedSql = sql.trim();
        long startTime = System.currentTimeMillis();

        if (database == null || database.isEmpty()) {
            database = "master";
        }

        logger.info("执行DDL操作 - 数据库: {}, SQL: {}", database, trimmedSql);

        DataSource dataSource = dataSourceConfig.getDataSource(database);

        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {

            stmt.execute(trimmedSql);
            long duration = System.currentTimeMillis() - startTime;

            logger.info("DDL操作成功 - 数据库: {}, 耗时: {}ms", database, duration);

            QueryResult result = new QueryResult(true, "DDL操作执行成功");
            result.setDatabase(database);
            
            queryHistoryService.recordQuery(trimmedSql, database, "DDL", true, duration, 0);
            return result;

        } catch (SQLException e) {
            long duration = System.currentTimeMillis() - startTime;
            logger.error("DDL执行错误 - 数据库: {}, 错误: {}", database, e.getMessage());
            queryHistoryService.recordQuery(trimmedSql, database, "DDL", false, duration, 0);
            return new QueryResult(false, "DDL执行错误: " + e.getMessage());
        }
    }

    public QueryResult executeDDL(String sql) {
        return executeDDL(sql, "master");
    }

    public QueryResult executeBatch(String sql, String database) {
        String trimmedSql = sql.trim();

        if (database == null || database.isEmpty()) {
            database = "master";
        }

        logger.info("执行批量SQL - 数据库: {}, SQL: {}", database, trimmedSql);

        DataSource dataSource = dataSourceConfig.getDataSource(database);

        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {

            boolean hasResultSet = stmt.execute(trimmedSql);
            int affectedRows = 0;

            if (!hasResultSet) {
                affectedRows = stmt.getUpdateCount();
            }

            do {
                if (hasResultSet) {
                    ResultSet rs = stmt.getResultSet();
                    List<Map<String, Object>> resultList = new ArrayList<>();
                    ResultSetMetaData metaData = rs.getMetaData();
                    int columnCount = metaData.getColumnCount();
                    List<String> columnNames = new ArrayList<>();
                    for (int i = 1; i <= columnCount; i++) {
                        columnNames.add(metaData.getColumnLabel(i));
                    }
                    while (rs.next()) {
                        Map<String, Object> row = new LinkedHashMap<>();
                        for (int i = 0; i < columnCount; i++) {
                            Object value = rs.getObject(i + 1);
                            row.put(columnNames.get(i), convertValue(value));
                        }
                        resultList.add(row);
                    }
                    QueryResult result = new QueryResult(true, resultList, resultList.size());
                    result.setDatabase(database);
                    return result;
                } else {
                    affectedRows = stmt.getUpdateCount();
                }
                hasResultSet = stmt.getMoreResults();
            } while (hasResultSet || affectedRows != -1);

            QueryResult result = new QueryResult(true, "批量SQL执行成功");
            result.setDatabase(database);
            return result;

        } catch (SQLException e) {
            logger.error("批量SQL执行错误 - 数据库: {}, 错误: {}", database, e.getMessage(), e);
            return new QueryResult(false, "批量SQL执行错误: " + e.getMessage());
        }
    }

    public QueryResult executeBatch(String sql) {
        return executeBatch(sql, "master");
    }

    public String toJson(QueryResult result) {
        try {
            return objectMapper.writeValueAsString(result);
        } catch (JsonProcessingException e) {
            return "{\"success\":false,\"message\":\"JSON转换错误\"}";
        }
    }

    public List<String> getAvailableDataSources() {
        // 从配置中动态获取数据源列表
        return dataSourceConfig.getConfiguredDataSources();
    }

    public QueryResult executeAutoSql(String sql, String database, String type) {
        String upperSql = sql.trim().toUpperCase();

        if ("auto".equals(type)) {
            if (upperSql.startsWith("SELECT") || upperSql.startsWith("WITH")) {
                return executeQuery(sql, database);
            } else if (isDDL(upperSql)) {
                return executeDDL(sql, database);
            } else {
                return executeUpdate(sql, database);
            }
        } else if ("query".equals(type)) {
            return executeQuery(sql, database);
        } else if ("update".equals(type)) {
            return executeUpdate(sql, database);
        } else if ("ddl".equals(type)) {
            return executeDDL(sql, database);
        } else {
            return new QueryResult(false, "无效的type参数，仅支持: auto, query, update, ddl");
        }
    }

    private boolean isDDL(String sql) {
        return sql.startsWith("CREATE") || sql.startsWith("ALTER") ||
               sql.startsWith("DROP") || sql.startsWith("TRUNCATE") ||
               sql.startsWith("COMMENT");
    }

    /**
     * 验证SQL标识符（表名、列名）是否安全
     * 仅允许字母、数字、下划线，且不能以数字开头
     */
    private boolean isValidIdentifier(String identifier) {
        if (identifier == null || identifier.isEmpty()) {
            return false;
        }
        return identifier.matches("^[a-zA-Z_][a-zA-Z0-9_]*$");
    }

    /**
     * 对SQL标识符进行安全转义
     */
    private String escapeIdentifier(String identifier) {
        if (identifier == null) {
            return null;
        }
        // 双引号包围是SQL标准转义方式
        return "\"" + identifier.replace("\"", "\"\"") + "\"";
    }

    /**
     * 验证SQL查询是否安全 - 仅允许 SELECT 和 WITH (CTE) 语句
     */
    private boolean isSafeQuery(String sql) {
        if (sql == null || sql.isEmpty()) {
            return false;
        }
        String upperSql = sql.toUpperCase().trim();
        // 只允许 SELECT 和 WITH (公用表表达式)
        return upperSql.startsWith("SELECT") || upperSql.startsWith("WITH");
    }

    public QueryResult getTableList(String database, int limit) {
        if (database == null || database.isEmpty()) {
            database = "master";
        }

        logger.info("获取表列表 - 数据库: {}, 限制: {}", database, limit);

        DataSource dataSource = dataSourceConfig.getDataSource(database);

        String sql = "SELECT table_name FROM user_tables ORDER BY table_name";

        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {
            
            stmt.setMaxRows(limit);
            
            try (ResultSet rs = stmt.executeQuery(sql)) {
                List<Map<String, Object>> resultList = new ArrayList<>();
                while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("tableName", rs.getString("table_name"));
                    resultList.add(row);
                }

                QueryResult result = new QueryResult(true, resultList, resultList.size());
                result.setDatabase(database);
                return result;
            }

        } catch (SQLException e) {
            logger.error("获取表列表错误 - 数据库: {}, 错误: {}", database, e.getMessage(), e);
            return new QueryResult(false, "获取表列表错误: " + e.getMessage());
        }
    }

    public QueryResult getTableInfo(String tableName, String database) {
        if (database == null || database.isEmpty()) {
            database = "master";
        }

        // 验证表名安全性，防止SQL注入
        if (!isValidIdentifier(tableName)) {
            logger.warn("无效的表名: {}", tableName);
            return new QueryResult(false, "无效的表名，仅允许字母、数字、下划线");
        }

        logger.info("获取表结构 - 数据库: {}, 表: {}", database, tableName);

        DataSource dataSource = dataSourceConfig.getDataSource(database);

        // 使用转义后的表名
        String safeTableName = escapeIdentifier(tableName);
        String sql = "SELECT column_name, data_type, data_length, data_precision, data_scale, " +
                     "nullable, column_id, data_default " +
                     "FROM user_tab_columns WHERE table_name = UPPER(" + safeTableName + ") ORDER BY column_id";

        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {

            List<Map<String, Object>> resultList = new ArrayList<>();
            while (rs.next()) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("columnName", rs.getString("column_name"));
                row.put("dataType", rs.getString("data_type"));
                row.put("dataLength", rs.getObject("data_length"));
                row.put("dataPrecision", rs.getObject("data_precision"));
                row.put("dataScale", rs.getObject("data_scale"));
                row.put("nullable", rs.getString("nullable"));
                row.put("columnId", rs.getObject("column_id"));
                row.put("defaultValue", rs.getString("data_default"));
                resultList.add(row);
            }

            if (resultList.isEmpty()) {
                QueryResult result = new QueryResult(false, "表不存在或无权限访问: " + tableName);
                result.setDatabase(database);
                return result;
            }

            QueryResult result = new QueryResult(true, resultList, resultList.size());
            result.setDatabase(database);
            return result;

        } catch (SQLException e) {
            logger.error("获取表结构错误 - 数据库: {}, 表: {}, 错误: {}", database, tableName, e.getMessage(), e);
            return new QueryResult(false, "获取表结构错误: " + e.getMessage());
        }
    }
}
