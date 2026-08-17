package com.example.tool.mcp;

import com.example.tool.config.ToolServiceProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

@Component
public class MarkdownMcpTool {

    private static final Logger logger = LoggerFactory.getLogger(MarkdownMcpTool.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${markdown.base-path:C:\\workspace}")
    private String basePath;

    @Autowired
    private ToolServiceProperties toolServiceProperties;

    public List<Map<String, Object>> getToolDefinitions() {
        // Markdown功能未启用时，返回空列表
        if (!toolServiceProperties.getMarkdown().isEnabled()) {
            return new ArrayList<>();
        }

        List<Map<String, Object>> tools = new ArrayList<>();

        Map<String, Object> listFiles = new HashMap<>();
        listFiles.put("name", "md_list_files");
        listFiles.put("description", "列出所有可用的Markdown文件");
        listFiles.put("inputSchema", Map.of(
            "type", "object",
            "properties", Map.of(),
            "required", new ArrayList<>()
        ));
        tools.add(listFiles);

        Map<String, Object> readFile = new HashMap<>();
        readFile.put("name", "md_read_file");
        readFile.put("description", "读取指定Markdown文件的内容");
        readFile.put("inputSchema", Map.of(
            "type", "object",
            "properties", Map.of(
                "path", Map.of(
                    "type", "string",
                    "description", "文件路径，相对于基础路径，如: tool-service/README.md"
                )
            ),
            "required", Arrays.asList("path")
        ));
        tools.add(readFile);

        Map<String, Object> render = new HashMap<>();
        render.put("name", "md_render");
        render.put("description", "渲染Markdown文件为HTML并返回预览链接");
        render.put("inputSchema", Map.of(
            "type", "object",
            "properties", Map.of(
                "path", Map.of(
                    "type", "string",
                    "description", "文件路径，相对于基础路径，如: tool-service/README.md"
                )
            ),
            "required", Arrays.asList("path")
        ));
        tools.add(render);

        return tools;
    }

    public Object executeTool(String toolName, Map<String, Object> arguments) {
        // Markdown功能未启用时，返回错误提示
        if (!toolServiceProperties.getMarkdown().isEnabled()) {
            return Map.of("success", false, "error", "Markdown预览功能已禁用");
        }

        logger.info("执行MD工具: {}, 参数: {}", toolName, arguments);

        try {
            switch (toolName) {
                case "md_list_files":
                    return handleListFiles();
                case "md_read_file":
                    return handleReadFile(arguments);
                case "md_render":
                    return handleRender(arguments);
                default:
                    return Map.of("error", "未知工具: " + toolName);
            }
        } catch (Exception e) {
            logger.error("MD工具执行错误: {}", e.getMessage(), e);
            return Map.of("error", "工具执行错误: " + e.getMessage());
        }
    }

    private Object handleListFiles() {
        try {
            List<String> files = getMdFiles();
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("total", files.size());
            result.put("files", files);
            result.put("basePath", basePath);
            return result;
        } catch (Exception e) {
            return Map.of("success", false, "error", "获取文件列表失败: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private Object handleReadFile(Map<String, Object> arguments) {
        String path = (String) arguments.get("path");
        if (path == null || path.isEmpty()) {
            return Map.of("success", false, "error", "path参数不能为空");
        }

        try {
            String decodedPath = path.replace("/", "\\");
            Path fullPath = Paths.get(basePath, decodedPath);

            if (!fullPath.toString().startsWith(basePath)) {
                return Map.of("success", false, "error", "路径不安全，拒绝访问");
            }

            if (!Files.exists(fullPath)) {
                return Map.of("success", false, "error", "文件不存在: " + path);
            }

            if (!fullPath.toString().toLowerCase().endsWith(".md")) {
                return Map.of("success", false, "error", "只支持.md文件");
            }

            String content = Files.readString(fullPath);

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("path", path);
            result.put("content", content);
            result.put("lines", content.split("\n").length);
            result.put("previewUrl", "/md-view?path=" + path.replace("\\", "/"));

            return result;
        } catch (IOException e) {
            return Map.of("success", false, "error", "读取文件失败: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private Object handleRender(Map<String, Object> arguments) {
        String path = (String) arguments.get("path");
        if (path == null || path.isEmpty()) {
            return Map.of("success", false, "error", "path参数不能为空");
        }

        try {
            String decodedPath = path.replace("/", "\\");
            Path fullPath = Paths.get(basePath, decodedPath);

            if (!fullPath.toString().startsWith(basePath)) {
                return Map.of("success", false, "error", "路径不安全，拒绝访问");
            }

            if (!Files.exists(fullPath)) {
                return Map.of("success", false, "error", "文件不存在: " + path);
            }

            if (!fullPath.toString().toLowerCase().endsWith(".md")) {
                return Map.of("success", false, "error", "只支持.md文件");
            }

            String content = Files.readString(fullPath);

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("path", path);
            result.put("previewUrl", "/md-view?path=" + path.replace("\\", "/"));
            result.put("downloadUrl", "/md-download?path=" + path.replace("\\", "/"));
            result.put("contentLength", content.length());
            result.put("message", "访问以下链接预览: http://localhost:" + toolServiceProperties.getServerPort() + "/md-view?path=" + path.replace("\\", "/"));

            return result;
        } catch (IOException e) {
            return Map.of("success", false, "error", "渲染文件失败: " + e.getMessage());
        }
    }

    private List<String> getMdFiles() {
        try {
            Path base = Paths.get(basePath);
            List<String> files = new ArrayList<>();
            listMdFilesRecursive(base, base, files, 10);
            Collections.sort(files);
            return files;
        } catch (Exception e) {
            logger.error("列出文件失败: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    private void listMdFilesRecursive(Path base, Path current, List<String> files, int maxDepth) throws IOException {
        if (maxDepth <= 0) return;

        if (Files.isDirectory(current)) {
            try (var stream = Files.list(current)) {
                stream.forEach(path -> {
                    try {
                        String fileName = path.getFileName().toString();
                        if (Files.isDirectory(path)) {
                            if (!fileName.equals("node_modules") && 
                                !fileName.equals(".git") && 
                                !fileName.equals(".idea") && 
                                !fileName.equals("target") && 
                                !fileName.equals("dist") && 
                                !fileName.equals("build") &&
                                !fileName.startsWith(".")) {
                                listMdFilesRecursive(base, path, files, maxDepth - 1);
                            }
                        } else if (fileName.toLowerCase().endsWith(".md")) {
                            String relativePath = base.relativize(path).toString().replace("\\", "/");
                            files.add(relativePath);
                        }
                    } catch (Exception e) {
                        logger.warn("跳过路径: {}", path);
                    }
                });
            }
        }
    }
}
