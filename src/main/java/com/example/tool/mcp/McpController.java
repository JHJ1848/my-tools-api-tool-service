package com.example.tool.mcp;

import com.example.tool.service.DatabaseQueryService;
import com.example.tool.service.QueryHistoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/mcp")
@ConditionalOnProperty(name = "tool-service.dameng.enabled", havingValue = "true", matchIfMissing = true)
public class McpController {

    @Autowired
    private DatabaseToolProvider toolProvider;

    @Autowired
    private DatabaseQueryService queryService;

    @Autowired
    private QueryHistoryService historyService;

    @GetMapping("/tools")
    public Map<String, Object> listTools() {
        List<DatabaseToolProvider.ToolDefinition> tools = toolProvider.getAvailableTools();
        return Map.of(
            "success", true,
            "tools", tools
        );
    }

    @PostMapping("/execute")
    public Map<String, Object> executeTool(@RequestBody Map<String, Object> request) {
        String toolName = (String) request.get("tool");
        @SuppressWarnings("unchecked")
        Map<String, Object> arguments = (Map<String, Object>) request.get("arguments");

        if (toolName == null || toolName.isEmpty()) {
            return Map.of(
                "success", false,
                "error", "tool参数不能为空"
            );
        }

        DatabaseToolProvider.ToolResult result = toolProvider.executeTool(toolName, arguments);
        return Map.of(
            "success", result.isSuccess(),
            "result", result.getResult(),
            "error", result.getError() != null ? result.getError() : ""
        );
    }

    @GetMapping("/datasources")
    public Map<String, Object> listDataSources() {
        List<String> dataSources = queryService.getAvailableDataSources();
        return Map.of(
            "success", true,
            "dataSources", dataSources
        );
    }

    @PostMapping("/query")
    public Map<String, Object> executeQuery(@RequestBody Map<String, Object> request) {
        String sql = (String) request.get("sql");
        String database = (String) request.getOrDefault("database", "master");

        if (sql == null || sql.isEmpty()) {
            return Map.of(
                "success", false,
                "message", "sql参数不能为空"
            );
        }

        DatabaseQueryService.QueryResult result = queryService.executeQuery(sql, database);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", result.isSuccess());
        response.put("data", result.getData());
        response.put("total", result.getTotal());
        response.put("message", result.getMessage());
        response.put("database", result.getDatabase() != null ? result.getDatabase() : database);
        
        return response;
    }

    @PostMapping("/update")
    public Map<String, Object> executeUpdate(@RequestBody Map<String, Object> request) {
        String sql = (String) request.get("sql");
        String database = (String) request.getOrDefault("database", "master");

        if (sql == null || sql.isEmpty()) {
            return Map.of(
                "success", false,
                "message", "sql参数不能为空"
            );
        }

        DatabaseQueryService.QueryResult result = queryService.executeUpdate(sql, database);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", result.isSuccess());
        response.put("message", result.getMessage());
        response.put("total", result.getTotal());
        response.put("database", result.getDatabase() != null ? result.getDatabase() : database);
        
        return response;
    }

    @PostMapping("/ddl")
    public Map<String, Object> executeDDL(@RequestBody Map<String, Object> request) {
        String sql = (String) request.get("sql");
        String database = (String) request.getOrDefault("database", "master");

        if (sql == null || sql.isEmpty()) {
            return Map.of(
                "success", false,
                "message", "sql参数不能为空"
            );
        }

        DatabaseQueryService.QueryResult result = queryService.executeDDL(sql, database);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", result.isSuccess());
        response.put("message", result.getMessage());
        response.put("database", result.getDatabase() != null ? result.getDatabase() : database);
        
        return response;
    }

    @PostMapping("/execute-sql")
    public Map<String, Object> executeSql(@RequestBody Map<String, Object> request) {
        String sql = (String) request.get("sql");
        String database = (String) request.getOrDefault("database", "master");
        String type = (String) request.getOrDefault("type", "auto");

        if (sql == null || sql.isEmpty()) {
            return Map.of(
                "success", false,
                "message", "sql参数不能为空"
            );
        }

        DatabaseQueryService.QueryResult result;
        String upperSql = sql.trim().toUpperCase();

        if ("auto".equals(type)) {
            if (upperSql.startsWith("SELECT") || upperSql.startsWith("WITH")) {
                result = queryService.executeQuery(sql, database);
            } else if (isDDL(upperSql)) {
                result = queryService.executeDDL(sql, database);
            } else {
                result = queryService.executeUpdate(sql, database);
            }
        } else if ("query".equals(type)) {
            result = queryService.executeQuery(sql, database);
        } else if ("update".equals(type)) {
            result = queryService.executeUpdate(sql, database);
        } else if ("ddl".equals(type)) {
            result = queryService.executeDDL(sql, database);
        } else {
            return Map.of(
                "success", false,
                "message", "无效的type参数，仅支持: auto, query, update, ddl"
            );
        }
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", result.isSuccess());
        response.put("data", result.getData());
        response.put("total", result.getTotal());
        response.put("message", result.getMessage());
        response.put("database", result.getDatabase() != null ? result.getDatabase() : database);
        
        return response;
    }

    private boolean isDDL(String sql) {
        return sql.startsWith("CREATE") || sql.startsWith("ALTER") || 
               sql.startsWith("DROP") || sql.startsWith("TRUNCATE") ||
               sql.startsWith("COMMENT");
    }

    @GetMapping("/tables")
    public Map<String, Object> listTables(
            @RequestParam(required = false, defaultValue = "master") String database,
            @RequestParam(required = false, defaultValue = "100") int limit) {
        DatabaseQueryService.QueryResult result = queryService.getTableList(database, limit);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", result.isSuccess());
        response.put("data", result.getData());
        response.put("total", result.getTotal());
        response.put("message", result.getMessage());
        response.put("database", result.getDatabase() != null ? result.getDatabase() : database);
        
        return response;
    }

    @GetMapping("/table-info")
    public Map<String, Object> getTableInfo(
            @RequestParam String tableName,
            @RequestParam(required = false, defaultValue = "master") String database) {
        DatabaseQueryService.QueryResult result = queryService.getTableInfo(tableName, database);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", result.isSuccess());
        response.put("data", result.getData());
        response.put("total", result.getTotal());
        response.put("message", result.getMessage());
        response.put("database", result.getDatabase() != null ? result.getDatabase() : database);
        
        return response;
    }

    @GetMapping("/history")
    public Map<String, Object> getHistory(@RequestParam(required = false, defaultValue = "50") int limit) {
        List<Map<String, Object>> history = historyService.getHistory(limit);
        return Map.of(
            "success", true,
            "data", history,
            "total", history.size()
        );
    }

    @DeleteMapping("/history")
    public Map<String, Object> clearHistory() {
        historyService.clearHistory();
        return Map.of(
            "success", true,
            "message", "查询历史已清空"
        );
    }
}
