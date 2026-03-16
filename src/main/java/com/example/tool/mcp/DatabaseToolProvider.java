package com.example.tool.mcp;

import com.example.tool.service.DatabaseQueryService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class DatabaseToolProvider {

    @Autowired
    private DatabaseQueryService queryService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    public static class ToolDefinition {
        private String name;
        private String description;
        private Map<String, ToolParameter> inputSchema;

        public ToolDefinition(String name, String description, Map<String, ToolParameter> inputSchema) {
            this.name = name;
            this.description = description;
            this.inputSchema = inputSchema;
        }

        public String getName() { return name; }
        public String getDescription() { return description; }
        public Map<String, ToolParameter> getInputSchema() { return inputSchema; }
    }

    public static class ToolParameter {
        private String type;
        private String description;
        private boolean required;

        public ToolParameter(String type, String description, boolean required) {
            this.type = type;
            this.description = description;
            this.required = required;
        }

        public String getType() { return type; }
        public String getDescription() { return description; }
        public boolean isRequired() { return required; }
    }

    public static class ToolResult {
        private String result;
        private boolean success;
        private String error;

        public ToolResult(String result, boolean success) {
            this.result = result;
            this.success = success;
        }

        public ToolResult(String error, boolean success, boolean isError) {
            this.error = error;
            this.success = success;
        }

        public String getResult() { return result; }
        public boolean isSuccess() { return success; }
        public String getError() { return error; }
    }

    public List<ToolDefinition> getAvailableTools() {
        List<ToolDefinition> tools = new ArrayList<>();

        Map<String, ToolParameter> queryParams = new LinkedHashMap<>();
        queryParams.put("sql", new ToolParameter("string", "要执行的SQL查询语句（支持SELECT）", true));
        queryParams.put("database", new ToolParameter("string", "数据库名称，如 FARMLAND_ENGINEER_QUALITY_INSPECT，默认master", false));
        queryParams.put("limit", new ToolParameter("integer", "返回结果数量限制，默认1000", false));
        tools.add(new ToolDefinition(
            "dm_query",
            "执行达梦数据库SQL查询（支持SELECT语句）",
            queryParams
        ));

        Map<String, ToolParameter> updateParams = new LinkedHashMap<>();
        updateParams.put("sql", new ToolParameter("string", "要执行的DML语句（INSERT/UPDATE/DELETE）", true));
        updateParams.put("database", new ToolParameter("string", "数据库名称，默认master", false));
        tools.add(new ToolDefinition(
            "dm_update",
            "执行达梦数据库DML更新操作（INSERT/UPDATE/DELETE）",
            updateParams
        ));

        Map<String, ToolParameter> ddlParams = new LinkedHashMap<>();
        ddlParams.put("sql", new ToolParameter("string", "要执行的DDL语句（CREATE/ALTER/DROP）", true));
        ddlParams.put("database", new ToolParameter("string", "数据库名称，默认master", false));
        tools.add(new ToolDefinition(
            "dm_ddl",
            "执行达梦数据库DDL操作（CREATE/ALTER/DROP）",
            ddlParams
        ));

        Map<String, ToolParameter> executeSqlParams = new LinkedHashMap<>();
        executeSqlParams.put("sql", new ToolParameter("string", "要执行的SQL语句", true));
        executeSqlParams.put("database", new ToolParameter("string", "数据库名称，默认master", false));
        executeSqlParams.put("type", new ToolParameter("string", "SQL类型：auto/query/update/ddl，默认auto", false));
        tools.add(new ToolDefinition(
            "dm_execute_sql",
            "自动执行达梦数据库SQL（智能判断SQL类型）",
            executeSqlParams
        ));

        Map<String, ToolParameter> listTablesParams = new LinkedHashMap<>();
        listTablesParams.put("database", new ToolParameter("string", "数据库名称，默认master", false));
        listTablesParams.put("limit", new ToolParameter("integer", "返回结果数量限制，默认100", false));
        tools.add(new ToolDefinition(
            "dm_list_tables",
            "获取达梦数据库表列表",
            listTablesParams
        ));

        Map<String, ToolParameter> tableInfoParams = new LinkedHashMap<>();
        tableInfoParams.put("tableName", new ToolParameter("string", "表名称", true));
        tableInfoParams.put("database", new ToolParameter("string", "数据库名称，默认master", false));
        tools.add(new ToolDefinition(
            "dm_table_info",
            "获取达梦数据库表结构信息",
            tableInfoParams
        ));

        Map<String, ToolParameter> listDsParams = new LinkedHashMap<>();
        tools.add(new ToolDefinition(
            "dm_list_datasources",
            "获取可用的达梦数据库数据源列表",
            listDsParams
        ));

        return tools;
    }

    public ToolResult executeTool(String toolName, Map<String, Object> arguments) {
        try {
            switch (toolName) {
                case "dm_query":
                    return handleDmQuery(arguments);
                case "dm_update":
                    return handleDmUpdate(arguments);
                case "dm_ddl":
                    return handleDmDdl(arguments);
                case "dm_execute_sql":
                    return handleDmExecuteSql(arguments);
                case "dm_list_tables":
                    return handleDmListTables(arguments);
                case "dm_table_info":
                    return handleDmTableInfo(arguments);
                case "dm_list_datasources":
                    return handleDmListDatasources();
                default:
                    return new ToolResult("未知工具: " + toolName, false, true);
            }
        } catch (Exception e) {
            return new ToolResult("工具执行错误: " + e.getMessage(), false, true);
        }
    }

    private ToolResult handleDmQuery(Map<String, Object> arguments) {
        Object sqlObj = arguments.get("sql");
        if (sqlObj == null) {
            return new ToolResult("参数sql不能为空", false, true);
        }
        String sql = sqlObj.toString();

        String database = "master";
        Object dbObj = arguments.get("database");
        if (dbObj != null && !dbObj.toString().isEmpty()) {
            database = dbObj.toString();
        }

        DatabaseQueryService.QueryResult result = queryService.executeQuery(sql, database);
        return new ToolResult(queryService.toJson(result), result.isSuccess());
    }

    private ToolResult handleDmListDatasources() {
        List<String> dataSources = queryService.getAvailableDataSources();
        try {
            String json = objectMapper.writeValueAsString(Map.of(
                "success", true,
                "dataSources", dataSources
            ));
            return new ToolResult(json, true);
        } catch (Exception e) {
            return new ToolResult("获取数据源列表失败: " + e.getMessage(), false, true);
        }
    }

    private ToolResult handleDmUpdate(Map<String, Object> arguments) {
        Object sqlObj = arguments.get("sql");
        if (sqlObj == null) {
            return new ToolResult("参数sql不能为空", false, true);
        }
        String sql = sqlObj.toString();

        String database = "master";
        Object dbObj = arguments.get("database");
        if (dbObj != null && !dbObj.toString().isEmpty()) {
            database = dbObj.toString();
        }

        DatabaseQueryService.QueryResult result = queryService.executeUpdate(sql, database);
        return new ToolResult(queryService.toJson(result), result.isSuccess());
    }

    private ToolResult handleDmDdl(Map<String, Object> arguments) {
        Object sqlObj = arguments.get("sql");
        if (sqlObj == null) {
            return new ToolResult("参数sql不能为空", false, true);
        }
        String sql = sqlObj.toString();

        String database = "master";
        Object dbObj = arguments.get("database");
        if (dbObj != null && !dbObj.toString().isEmpty()) {
            database = dbObj.toString();
        }

        DatabaseQueryService.QueryResult result = queryService.executeDDL(sql, database);
        return new ToolResult(queryService.toJson(result), result.isSuccess());
    }

    private ToolResult handleDmExecuteSql(Map<String, Object> arguments) {
        Object sqlObj = arguments.get("sql");
        if (sqlObj == null) {
            return new ToolResult("参数sql不能为空", false, true);
        }
        String sql = sqlObj.toString();

        String database = "master";
        Object dbObj = arguments.get("database");
        if (dbObj != null && !dbObj.toString().isEmpty()) {
            database = dbObj.toString();
        }

        String type = "auto";
        Object typeObj = arguments.get("type");
        if (typeObj != null) {
            type = typeObj.toString();
        }

        DatabaseQueryService.QueryResult result = queryService.executeAutoSql(sql, database, type);
        return new ToolResult(queryService.toJson(result), result.isSuccess());
    }

    private ToolResult handleDmListTables(Map<String, Object> arguments) {
        String database = "master";
        Object dbObj = arguments.get("database");
        if (dbObj != null && !dbObj.toString().isEmpty()) {
            database = dbObj.toString();
        }

        int limit = 100;
        Object limitObj = arguments.get("limit");
        if (limitObj != null) {
            try {
                limit = Integer.parseInt(limitObj.toString());
            } catch (NumberFormatException e) {
                limit = 100;
            }
        }

        DatabaseQueryService.QueryResult result = queryService.getTableList(database, limit);
        return new ToolResult(queryService.toJson(result), result.isSuccess());
    }

    private ToolResult handleDmTableInfo(Map<String, Object> arguments) {
        Object tableNameObj = arguments.get("tableName");
        if (tableNameObj == null) {
            return new ToolResult("参数tableName不能为空", false, true);
        }
        String tableName = tableNameObj.toString();

        String database = "master";
        Object dbObj = arguments.get("database");
        if (dbObj != null && !dbObj.toString().isEmpty()) {
            database = dbObj.toString();
        }

        DatabaseQueryService.QueryResult result = queryService.getTableInfo(tableName, database);
        return new ToolResult(queryService.toJson(result), result.isSuccess());
    }
}
