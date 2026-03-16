package com.example.tool.mcp;

import com.example.tool.service.DatabaseQueryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    @Autowired
    private DatabaseQueryService queryService;

    @GetMapping
    public Map<String, Object> health() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "UP");
        response.put("service", "tool-service");
        response.put("timestamp", System.currentTimeMillis());
        return response;
    }

    @GetMapping("/db")
    public Map<String, Object> checkDatabase() {
        Map<String, Object> response = new HashMap<>();
        try {
            DatabaseQueryService.QueryResult result = queryService.executeQuery("SELECT 1", "master");
            if (result.isSuccess()) {
                response.put("status", "UP");
                response.put("database", "master");
                response.put("message", "数据库连接正常");
            } else {
                response.put("status", "DOWN");
                response.put("message", result.getMessage());
            }
        } catch (Exception e) {
            response.put("status", "DOWN");
            response.put("message", e.getMessage());
        }
        return response;
    }
}
