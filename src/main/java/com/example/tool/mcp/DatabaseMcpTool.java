package com.example.tool.mcp;

import com.example.tool.config.ToolServiceProperties;
import com.example.tool.service.DatabaseQueryService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class DatabaseMcpTool {

    private static final Logger logger = LoggerFactory.getLogger(DatabaseMcpTool.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private DatabaseQueryService queryService;

    @Autowired
    private ToolServiceProperties toolServiceProperties;

    public List<Map<String, Object>> getToolDefinitions() {
        // 达梦数据库功能未启用时，返回空列表
        if (!toolServiceProperties.getDameng().isEnabled()) {
            return new ArrayList<>();
        }

        List<Map<String, Object>> tools = new ArrayList<>();

        Map<String, Object> query = new HashMap<>();
        query.put("name", "dm_query");
        query.put("description", "执行达梦数据库SQL查询（仅支持SELECT语句）");
        query.put("inputSchema", Map.of(
            "type", "object",
            "properties", Map.of(
                "sql", Map.of(
                    "type", "string",
                    "description", "要执行的SQL查询语句（SELECT）"
                ),
                "database", Map.of(
                    "type", "string",
                    "description", "数据库名称，如 master, sso, FARMLAND_ENGINEER_QUALITY_INSPECT，默认master"
                ),
                "limit", Map.of(
                    "type", "integer",
                    "description", "返回结果数量限制，默认1000"
                )
            ),
            "required", Arrays.asList("sql")
        ));
        tools.add(query);

        Map<String, Object> executeSql = new HashMap<>();
        executeSql.put("name", "dm_execute_sql");
        executeSql.put("description", "自动执行达梦数据库SQL（智能判断SQL类型：SELECT/DML/DDL）");
        executeSql.put("inputSchema", Map.of(
            "type", "object",
            "properties", Map.of(
                "sql", Map.of(
                    "type", "string",
                    "description", "要执行的SQL语句"
                ),
                "database", Map.of(
                    "type", "string",
                    "description", "数据库名称，默认master"
                ),
                "type", Map.of(
                    "type", "string",
                    "description", "SQL类型：auto/query/update/ddl，默认auto"
                )
            ),
            "required", Arrays.asList("sql")
        ));
        tools.add(executeSql);

        Map<String, Object> listTables = new HashMap<>();
        listTables.put("name", "dm_list_tables");
        listTables.put("description", "获取达梦数据库表列表");
        listTables.put("inputSchema", Map.of(
            "type", "object",
            "properties", Map.of(
                "database", Map.of(
                    "type", "string",
                    "description", "数据库名称，默认master"
                ),
                "limit", Map.of(
                    "type", "integer",
                    "description", "返回结果数量限制，默认100"
                )
            ),
            "required", new ArrayList<>()
        ));
        tools.add(listTables);

        Map<String, Object> tableInfo = new HashMap<>();
        tableInfo.put("name", "dm_table_info");
        tableInfo.put("description", "获取达梦数据库表结构信息");
        tableInfo.put("inputSchema", Map.of(
            "type", "object",
            "properties", Map.of(
                "tableName", Map.of(
                    "type", "string",
                    "description", "表名称"
                ),
                "database", Map.of(
                    "type", "string",
                    "description", "数据库名称，默认master"
                )
            ),
            "required", Arrays.asList("tableName")
        ));
        tools.add(tableInfo);

        Map<String, Object> listDatasources = new HashMap<>();
        listDatasources.put("name", "dm_list_datasources");
        listDatasources.put("description", "获取可用的达梦数据库数据源列表");
        listDatasources.put("inputSchema", Map.of(
            "type", "object",
            "properties", Map.of(),
            "required", new ArrayList<>()
        ));
        tools.add(listDatasources);

        return tools;
    }

    public Object executeTool(String toolName, Map<String, Object> arguments) {
        // 达梦数据库功能未启用时，返回错误提示
        if (!toolServiceProperties.getDameng().isEnabled()) {
            return Map.of("success", false, "error", "达梦数据库功能已禁用");
        }

        logger.info("执行数据库工具: {}, 参数: {}", toolName, arguments);

        try {
            switch (toolName) {
                case "dm_query":
                    return handleQuery(arguments);
                case "dm_execute_sql":
                    return handleExecuteSql(arguments);
                case "dm_list_tables":
                    return handleListTables(arguments);
                case "dm_table_info":
                    return handleTableInfo(arguments);
                case "dm_list_datasources":
                    return handleListDatasources();
                default:
                    return Map.of("success", false, "error", "未知工具: " + toolName);
            }
        } catch (Exception e) {
            logger.error("数据库工具执行错误: {}", e.getMessage(), e);
            return Map.of("success", false, "error", "工具执行错误: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private Object handleQuery(Map<String, Object> arguments) {
        String sql = (String) arguments.get("sql");
        if (sql == null || sql.isEmpty()) {
            return Map.of("success", false, "error", "sql参数不能为空");
        }

        String database = getStringOrDefault(arguments, "database", "master");
        int limit = getIntOrDefault(arguments, "limit", 1000);

        DatabaseQueryService.QueryResult result = queryService.executeQuery(sql, database);

        Map<String, Object> response = new HashMap<>();
        response.put("success", result.isSuccess());
        response.put("database", database);
        
        if (result.isSuccess()) {
            List<Map<String, Object>> data = result.getData();
            if (limit > 0 && data.size() > limit) {
                data = data.subList(0, limit);
            }
            response.put("data", data);
            response.put("total", result.getTotal());
            response.put("message", "查询成功，返回 " + data.size() + " 条记录");
        } else {
            response.put("error", result.getMessage());
        }

        return response;
    }

    @SuppressWarnings("unchecked")
    private Object handleExecuteSql(Map<String, Object> arguments) {
        String sql = (String) arguments.get("sql");
        if (sql == null || sql.isEmpty()) {
            return Map.of("success", false, "error", "sql参数不能为空");
        }

        String database = getStringOrDefault(arguments, "database", "master");
        String type = getStringOrDefault(arguments, "type", "auto");

        DatabaseQueryService.QueryResult result = queryService.executeAutoSql(sql, database, type);

        Map<String, Object> response = new HashMap<>();
        response.put("success", result.isSuccess());
        response.put("database", database);
        response.put("sqlType", type);
        
        if (result.isSuccess()) {
            response.put("data", result.getData());
            response.put("total", result.getTotal());
            response.put("message", result.getMessage());
        } else {
            response.put("error", result.getMessage());
        }

        return response;
    }

    @SuppressWarnings("unchecked")
    private Object handleListTables(Map<String, Object> arguments) {
        String database = getStringOrDefault(arguments, "database", "master");
        int limit = getIntOrDefault(arguments, "limit", 100);

        DatabaseQueryService.QueryResult result = queryService.getTableList(database, limit);

        Map<String, Object> response = new HashMap<>();
        response.put("success", result.isSuccess());
        response.put("database", database);
        
        if (result.isSuccess()) {
            response.put("data", result.getData());
            response.put("total", result.getTotal());
            response.put("message", "获取到 " + result.getTotal() + " 个表");
        } else {
            response.put("error", result.getMessage());
        }

        return response;
    }

    @SuppressWarnings("unchecked")
    private Object handleTableInfo(Map<String, Object> arguments) {
        String tableName = (String) arguments.get("tableName");
        if (tableName == null || tableName.isEmpty()) {
            return Map.of("success", false, "error", "tableName参数不能为空");
        }

        String database = getStringOrDefault(arguments, "database", "master");

        DatabaseQueryService.QueryResult result = queryService.getTableInfo(tableName, database);

        Map<String, Object> response = new HashMap<>();
        response.put("success", result.isSuccess());
        response.put("database", database);
        response.put("tableName", tableName);
        
        if (result.isSuccess()) {
            response.put("data", result.getData());
            response.put("total", result.getTotal());
            response.put("message", "获取到 " + result.getTotal() + " 个字段");
        } else {
            response.put("error", result.getMessage());
        }

        return response;
    }

    private Object handleListDatasources() {
        List<String> dataSources = queryService.getAvailableDataSources();

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("dataSources", dataSources);
        response.put("total", dataSources.size());
        response.put("message", "可用数据源: " + String.join(", ", dataSources));

        return response;
    }

    private String getStringOrDefault(Map<String, Object> map, String key, String defaultValue) {
        Object value = map.get(key);
        if (value != null && !value.toString().isEmpty()) {
            return value.toString();
        }
        return defaultValue;
    }

    private int getIntOrDefault(Map<String, Object> map, String key, int defaultValue) {
        Object value = map.get(key);
        if (value != null) {
            try {
                return Integer.parseInt(value.toString());
            } catch (NumberFormatException e) {
                return defaultValue;
            }
        }
        return defaultValue;
    }
}
