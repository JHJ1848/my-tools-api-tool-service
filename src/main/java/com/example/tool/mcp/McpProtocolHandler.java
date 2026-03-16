package com.example.tool.mcp;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class McpProtocolHandler {

    private static final Logger logger = LoggerFactory.getLogger(McpProtocolHandler.class);

    @Autowired
    private MarkdownMcpTool markdownTool;

    @Autowired
    private DatabaseMcpTool databaseTool;

    private String protocolVersion = "2024-11-05";
    private String serverName = "tool-service";
    private String serverVersion = "1.0.0";

    public Object handleMethod(String method, Map<String, Object> params) {
        logger.info("处理MCP方法: {}", method);

        switch (method) {
            case "initialize":
                return handleInitialize(params);
            case "tools/list":
                return handleToolsList();
            case "tools/call":
                return handleToolsCall(params);
            case "resources/list":
                return handleResourcesList();
            case "resources/templates/list":
                return handleResourcesTemplatesList();
            case "ping":
                return handlePing();
            default:
                throw new McpException(-32601, "Method not found: " + method, null);
        }
    }

    private Map<String, Object> handleInitialize(Map<String, Object> params) {
        logger.info("MCP客户端初始化: {}", params);

        Map<String, Object> result = new HashMap<>();
        result.put("protocolVersion", protocolVersion);
        result.put("serverInfo", Map.of(
            "name", serverName,
            "version", serverVersion
        ));
        result.put("capabilities", getServerCapabilities());

        return result;
    }

    private Map<String, Object> handleToolsList() {
        List<Map<String, Object>> tools = new ArrayList<>();

        tools.addAll(markdownTool.getToolDefinitions());
        tools.addAll(databaseTool.getToolDefinitions());

        Map<String, Object> result = new HashMap<>();
        result.put("tools", tools);

        logger.info("返回工具列表，共 {} 个工具", tools.size());
        return result;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> handleToolsCall(Map<String, Object> params) {
        String toolName = (String) params.get("name");
        Map<String, Object> arguments = (Map<String, Object>) params.get("arguments");

        if (toolName == null || toolName.isEmpty()) {
            throw new McpException(-32602, "Invalid params: tool name is required", null);
        }

        logger.info("调用工具: {}, 参数: {}", toolName, arguments);

        Object result;
        
        if (toolName.startsWith("md_")) {
            result = markdownTool.executeTool(toolName, arguments);
        } else if (toolName.startsWith("dm_")) {
            result = databaseTool.executeTool(toolName, arguments);
        } else {
            throw new McpException(-32602, "Unknown tool: " + toolName, null);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("content", Arrays.asList(
            Map.of(
                "type", "text",
                "text", result != null ? result.toString() : ""
            )
        ));

        return response;
    }

    private Map<String, Object> handleResourcesList() {
        List<Map<String, Object>> resources = new ArrayList<>();

        Map<String, Object> mdResource = new HashMap<>();
        mdResource.put("uri", "md://files");
        mdResource.put("name", "Markdown Files");
        mdResource.put("description", "Available markdown files for preview");
        mdResource.put("mimeType", "application/json");
        resources.add(mdResource);

        Map<String, Object> dbResource = new HashMap<>();
        dbResource.put("uri", "db://datasources");
        dbResource.put("name", "Database Datasources");
        dbResource.put("description", "Available database datasources");
        dbResource.put("mimeType", "application/json");
        resources.add(dbResource);

        Map<String, Object> result = new HashMap<>();
        result.put("resources", resources);

        return result;
    }

    private Map<String, Object> handleResourcesTemplatesList() {
        Map<String, Object> result = new HashMap<>();
        result.put("resourceTemplates", Arrays.asList(
            Map.of(
                "uriTemplate", "md://{path}",
                "name", "Markdown File",
                "description", "Read a markdown file by path",
                "mimeType", "text/markdown"
            ),
            Map.of(
                "uriTemplate", "db://{database}/tables",
                "name", "Database Tables",
                "description", "List tables in a database",
                "mimeType", "application/json"
            )
        ));

        return result;
    }

    private Map<String, Object> handlePing() {
        Map<String, Object> result = new HashMap<>();
        result.put("pong", true);
        return result;
    }

    public Map<String, Object> getServerCapabilities() {
        Map<String, Object> capabilities = new HashMap<>();
        
        Map<String, Object> tools = new HashMap<>();
        tools.put("listChanged", true);
        capabilities.put("tools", tools);

        Map<String, Object> resources = new HashMap<>();
        resources.put("subscribe", true);
        resources.put("listChanged", true);
        capabilities.put("resources", resources);

        return capabilities;
    }

    public static class McpException extends RuntimeException {
        private final int code;
        private final String data;

        public McpException(int code, String message, String data) {
            super(message);
            this.code = code;
            this.data = data;
        }

        public int getCode() {
            return code;
        }

        public String getData() {
            return data;
        }
    }
}
