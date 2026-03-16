package com.example.tool.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.text.SimpleDateFormat;
import java.util.*;

@Service
public class QueryHistoryService {

    private static final Logger logger = LoggerFactory.getLogger(QueryHistoryService.class);
    private static final String HISTORY_FILE = "logs/query_history.csv";
    private static final SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");

    public QueryHistoryService() {
        initHistoryFile();
    }

    private void initHistoryFile() {
        try {
            File historyFile = new File(HISTORY_FILE);
            if (!historyFile.getParentFile().exists()) {
                historyFile.getParentFile().mkdirs();
            }
            if (!historyFile.exists()) {
                try (FileWriter writer = new FileWriter(historyFile)) {
                    writer.append("timestamp,sql,database,type,success,duration_ms,affected_rows\n");
                }
            }
        } catch (IOException e) {
            logger.error("初始化查询历史文件失败: {}", e.getMessage());
        }
    }

    public void recordQuery(String sql, String database, String type, boolean success, long durationMs, int affectedRows) {
        try (FileWriter writer = new FileWriter(HISTORY_FILE, true)) {
            String timestamp = dateFormat.format(new Date());
            String escapedSql = sql.replace("\"", "\"\"");
            writer.append(String.format("\"%s\",\"%s\",\"%s\",\"%s\",%s,%d,%d\n",
                timestamp,
                escapedSql.length() > 500 ? escapedSql.substring(0, 500) + "..." : escapedSql,
                database,
                type,
                success,
                durationMs,
                affectedRows
            ));
        } catch (IOException e) {
            logger.error("记录查询历史失败: {}", e.getMessage());
        }
    }

    public List<Map<String, Object>> getHistory(int limit) {
        List<Map<String, Object>> history = new ArrayList<>();
        try {
            List<String> lines = Files.readAllLines(Paths.get(HISTORY_FILE));
            int start = Math.max(1, lines.size() - limit);
            for (int i = start; i < lines.size(); i++) {
                String line = lines.get(i);
                if (line.trim().isEmpty()) continue;
                
                String[] parts = parseCsvLine(line);
                if (parts.length >= 7) {
                    Map<String, Object> record = new LinkedHashMap<>();
                    record.put("timestamp", parts[0]);
                    record.put("sql", parts[1]);
                    record.put("database", parts[2]);
                    record.put("type", parts[3]);
                    record.put("success", "true".equals(parts[4]));
                    record.put("durationMs", Long.parseLong(parts[5]));
                    record.put("affectedRows", Integer.parseInt(parts[6]));
                    history.add(record);
                }
            }
            Collections.reverse(history);
        } catch (Exception e) {
            logger.error("读取查询历史失败: {}", e.getMessage());
        }
        return history;
    }

    public void clearHistory() {
        try (FileWriter writer = new FileWriter(HISTORY_FILE)) {
            writer.append("timestamp,sql,database,type,success,duration_ms,affected_rows\n");
        } catch (IOException e) {
            logger.error("清空查询历史失败: {}", e.getMessage());
        }
    }

    private String[] parseCsvLine(String line) {
        List<String> result = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuotes = false;
        
        for (char c : line.toCharArray()) {
            if (c == '"') {
                inQuotes = !inQuotes;
            } else if (c == ',' && !inQuotes) {
                result.add(current.toString().trim());
                current = new StringBuilder();
            } else {
                current.append(c);
            }
        }
        result.add(current.toString().trim());
        return result.toArray(new String[0]);
    }
}
