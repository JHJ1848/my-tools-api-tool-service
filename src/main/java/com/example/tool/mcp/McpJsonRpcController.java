package com.example.tool.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/mcp")
public class McpJsonRpcController {

    private static final Logger logger = LoggerFactory.getLogger(McpJsonRpcController.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private McpProtocolHandler protocolHandler;

    @PostMapping("/json-rpc")
    public Map<String, Object> handleJsonRpc(@RequestBody Map<String, Object> request) {
        try {
            String jsonRpc = (String) request.get("jsonrpc");
            String method = (String) request.get("method");
            Object id = request.get("id");
            Map<String, Object> params = (Map<String, Object>) request.get("params");

            logger.info("收到MCP请求: method={}, id={}", method, id);

            if (!"2.0".equals(jsonRpc)) {
                return buildErrorResponse(id, -32600, "Invalid Request", "jsonrpc version must be 2.0");
            }

            Object result = protocolHandler.handleMethod(method, params);
            
            Map<String, Object> response = new HashMap<>();
            response.put("jsonrpc", "2.0");
            response.put("id", id);
            response.put("result", result);
            
            return response;

        } catch (McpProtocolHandler.McpException e) {
            logger.error("MCP处理错误: {}", e.getMessage());
            return buildErrorResponse(request.get("id"), e.getCode(), e.getMessage(), e.getData());
        } catch (Exception e) {
            logger.error("MCP服务器内部错误: {}", e.getMessage(), e);
            return buildErrorResponse(request.get("id"), -32603, "Internal error", e.getMessage());
        }
    }

    private Map<String, Object> buildErrorResponse(Object id, int code, String message, String data) {
        Map<String, Object> response = new HashMap<>();
        response.put("jsonrpc", "2.0");
        response.put("id", id);
        
        Map<String, Object> error = new HashMap<>();
        error.put("code", code);
        error.put("message", message);
        if (data != null) {
            error.put("data", data);
        }
        response.put("error", error);
        
        return response;
    }

    @GetMapping("/sse")
    public Map<String, Object> sseEndpoint() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "MCP SSE endpoint ready");
        response.put("message", "Use POST /api/mcp/json-rpc for JSON-RPC 2.0 communication");
        return response;
    }

    @GetMapping("/capabilities")
    public Map<String, Object> getCapabilities() {
        return protocolHandler.getServerCapabilities();
    }
}
