package com.example.tool.mcp;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@RestController
public class MarkdownPreviewController {

    private static final Logger logger = LoggerFactory.getLogger(MarkdownPreviewController.class);
    
    private static final String FOLDER_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"currentColor\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z\" fill=\"none\"></path></svg>";
    private static final String FILE_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z\"></path><polyline points=\"13 2 13 9 20 9\"></polyline></svg>";

    @Value("${markdown.base-path:D:\\adas\\项目}")
    private String basePath;

    @GetMapping("/md-view")
    public ResponseEntity<String> viewMarkdown(@RequestParam String path) {
        try {
            String decodedPath = path.replace("/", "\\");
            Path fullPath = Paths.get(basePath, decodedPath);
            
            logger.info("请求预览 MD 文件: {}", fullPath.toString());

            if (!fullPath.toString().startsWith(basePath)) {
                return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(renderError("路径不安全，拒绝访问"));
            }

            if (!Files.exists(fullPath)) {
                return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(renderError("文件不存在: " + decodedPath));
            }

            if (!fullPath.toString().toLowerCase().endsWith(".md")) {
                return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(renderError("只支持 .md 文件"));
            }

            String content = Files.readString(fullPath);
            List<String> files = getMdFiles(); // 获取文件列表

            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_HTML)
                    .body(renderPage(decodedPath, content, files));

        } catch (IOException e) {
            logger.error("读取文件失败: {}", e.getMessage());
            return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(renderError("读取文件失败: " + e.getMessage()));
        } catch (Exception e) {
            logger.error("处理失败: {}", e.getMessage());
            return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(renderError("处理失败: " + e.getMessage()));
        }
    }

    @GetMapping("/md-download")
    public ResponseEntity<Resource> downloadMarkdown(@RequestParam String path) {
        try {
            String decodedPath = path.replace("/", "\\");
            Path fullPath = Paths.get(basePath, decodedPath);
            
            if (!fullPath.toString().startsWith(basePath)) {
                return ResponseEntity.status(403).build();
            }
            
            if (!Files.exists(fullPath)) {
                return ResponseEntity.notFound().build();
            }
            
            Resource resource = new UrlResource(fullPath.toUri());
            String filename = fullPath.getFileName().toString();
            String encodedFilename = java.net.URLEncoder.encode(filename, java.nio.charset.StandardCharsets.UTF_8).replace("+", "%20");
            
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encodedFilename)
                    .body(resource);
        } catch (Exception e) {
            logger.error("下载文件失败: {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/md-content")
    public ResponseEntity<String> getMarkdownContent(@RequestParam String path) {
        try {
            String decodedPath = path.replace("/", "\\");
            Path fullPath = Paths.get(basePath, decodedPath);
            
            if (!fullPath.toString().startsWith(basePath)) {
                return ResponseEntity.status(403).body("Access Denied");
            }
            
            if (!Files.exists(fullPath)) {
                return ResponseEntity.notFound().build();
            }
            
            String content = Files.readString(fullPath);
            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(content);
        } catch (Exception e) {
            logger.error("获取文件内容失败: {}", e.getMessage());
            return ResponseEntity.internalServerError().body("Error: " + e.getMessage());
        }
    }

    @GetMapping("/md-list")
    public List<String> listMdFiles() {
        return getMdFiles();
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
            return List.of("Error: " + e.getMessage());
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
                            // 过滤不需要的目录
                            if (!fileName.equals("node_modules") && 
                                !fileName.equals(".git") && 
                                !fileName.equals(".idea") && 
                                !fileName.equals("target") && 
                                !fileName.equals("dist") && 
                                !fileName.equals("build") &&
                                !fileName.startsWith(".")) { // 忽略隐藏目录
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

    private String generateAnchorId(String headingText) {
        return headingText.toLowerCase()
                .replaceAll("[^\\u4e00-\\u9fa5a-z0-9\\s-]", "")
                .replaceAll("[\\s-]+", "-")
                .trim();
    }

    private List<Map<String, Object>> extractTableOfContents(String md) {
        List<Map<String, Object>> toc = new ArrayList<>();
        Pattern headingPattern = Pattern.compile("^\\s*(#{1,6})\\s+(.+?)\\s*$");
        
        for (String line : md.split("\n")) {
            Matcher matcher = headingPattern.matcher(line);
            if (matcher.matches()) {
                int level = matcher.group(1).length();
                String text = matcher.group(2).trim();
                String id = generateAnchorId(text);
                
                Map<String, Object> heading = new HashMap<>();
                heading.put("level", level);
                heading.put("text", text);
                heading.put("id", id);
                toc.add(heading);
            }
        }
        return toc;
    }

    private String renderTocHtml(List<Map<String, Object>> toc) {
        if (toc.isEmpty()) {
            return "<div class=\"toc-empty\">暂无标题目录</div>";
        }
        
        StringBuilder html = new StringBuilder();
        html.append("<div class=\"toc-header\">目录</div>");
        html.append("<div class=\"toc-list\">");
        
        int currentLevel = 0;
        for (Map<String, Object> heading : toc) {
            int level = (int) heading.get("level");
            String text = (String) heading.get("text");
            String id = (String) heading.get("id");
            
            if (level > currentLevel) {
                for (int i = currentLevel; i < level; i++) {
                    html.append("<div class=\"toc-item-container\">");
                }
            } else if (level < currentLevel) {
                for (int i = currentLevel; i > level; i--) {
                    html.append("</div>");
                }
            }
            
            html.append("<a href=\"#").append(id).append("\" class=\"toc-item toc-level-").append(level).append("\" data-id=\"").append(id).append("\">");
            html.append(escapeHtml(text));
            html.append("</a>");
            
            currentLevel = level;
        }
        
        for (int i = 0; i < currentLevel; i++) {
            html.append("</div>");
        }
        
        html.append("</div>");
        return html.toString();
    }

    private String renderPage(String currentPath, String content, List<String> files) {
        String safeTitle = currentPath.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
        String htmlContent = convertMarkdownToHtml(content);
        
        // 生成树形结构侧边栏 HTML
        String sidebarHtml = buildTreeHtml(files, currentPath);
        
        // 提取标题目录
        List<Map<String, Object>> toc = extractTableOfContents(content);
        String tocHtml = renderTocHtml(toc);

        return "<!DOCTYPE html>\n" +
                "<html lang=\"zh-CN\">\n" +
                "<head>\n" +
                "    <meta charset=\"UTF-8\">\n" +
                "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n" +
                "    <title>" + safeTitle + "</title>\n" +
                "    <link rel=\"stylesheet\" href=\"https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css\">\n" +
                "    <script src=\"https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js\"></script>\n" +
                "    <script src=\"https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/json.min.js\"></script>\n" +
                "    <script src=\"https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/java.min.js\"></script>\n" +
                "    <script src=\"https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/xml.min.js\"></script>\n" +
                "    <script src=\"https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/bash.min.js\"></script>\n" +
                "    <style>\n" +
                "        * { box-sizing: border-box; }\n" +
                "        body {\n" +
                "            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;\n" +
                "            background-color: #1e1e1e;\n" +
                "            color: #d4d4d4;\n" +
                "            margin: 0;\n" +
                "            padding: 0;\n" +
                "            height: 100vh;\n" +
                "            overflow: hidden;\n" +
                "        }\n" +
                "        .layout {\n" +
                "            display: flex;\n" +
                "            height: 100%;\n" +
                "        }\n" +
                "        .sidebar {\n" +
                "            width: 300px;\n" +
                "            background-color: #252526;\n" +
                "            border-right: 1px solid #333;\n" +
                "            display: flex;\n" +
                "            flex-direction: column;\n" +
                "            overflow: hidden;\n" +
                "            flex-shrink: 0;\n" +
                "        }\n" +
                "        .toc-sidebar {\n" +
                "            width: 220px;\n" +
                "            background-color: #252526;\n" +
                "            border-right: 1px solid #333;\n" +
                "            display: flex;\n" +
                "            flex-direction: column;\n" +
                "            overflow: hidden;\n" +
                "            flex-shrink: 0;\n" +
                "        }\n" +
                "        .toc-header {\n" +
                "            padding: 10px 16px;\n" +
                "            font-weight: 600;\n" +
                "            font-size: 14px;\n" +
                "            color: #cccccc;\n" +
                "            background-color: #2d2d2d;\n" +
                "            border-bottom: 1px solid #333;\n" +
                "        }\n" +
                "        .toc-list {\n" +
                "            flex: 1;\n" +
                "            overflow-y: auto;\n" +
                "            padding: 8px 0;\n" +
                "        }\n" +
                "        .toc-item {\n" +
                "            display: block;\n" +
                "            padding: 5px 16px;\n" +
                "            color: #969696;\n" +
                "            text-decoration: none;\n" +
                "            font-size: 13px;\n" +
                "            white-space: nowrap;\n" +
                "            overflow: hidden;\n" +
                "            text-overflow: ellipsis;\n" +
                "            cursor: pointer;\n" +
                "            border-left: 2px solid transparent;\n" +
                "        }\n" +
                "        /* 目录条纹背景 */\n" +
                "        .toc-list .toc-item:nth-child(odd) { background-color: #1e1e1e; }\n" +
                "        .toc-list .toc-item:nth-child(even) { background-color: #252526; }\n" +
                "        .toc-item:hover {\n" +
                "            background-color: #2a2d2e;\n" +
                "            color: #e0e0e0;\n" +
                "        }\n" +
                "        .toc-item.active {\n" +
                "            background-color: #37373d;\n" +
                "            color: #ffffff;\n" +
                "            border-left-color: #007fd4;\n" +
                "        }\n" +
                "        /* 标题闪光效果 */\n" +
                "        @keyframes headingFlash {\n" +
                "            0% { box-shadow: 0 0 20px 10px rgba(255,255,255,0.7); }\n" +
                "            50% { box-shadow: 0 0 10px 5px rgba(255,255,255,0.3); }\n" +
                "            100% { box-shadow: none; }\n" +
                "        }\n" +
                "        .heading-flash {\n" +
                "            animation: headingFlash 0.5s ease-out;\n" +
                "        }\n" +
                "        /* 调用按钮样式 */\n" +
                "        .invoke-params-btn {\n" +
                "            padding: 6px 16px;\n" +
                "            background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);\n" +
                "            color: white;\n" +
                "            border: none;\n" +
                "            border-radius: 4px;\n" +
                "            cursor: pointer;\n" +
                "            font-size: 13px;\n" +
                "            font-weight: 500;\n" +
                "        }\n" +
                "        .invoke-params-btn:hover {\n" +
                "            opacity: 0.9;\n" +
                "            transform: translateY(-1px);\n" +
                "        }\n" +
                "        /* 可编辑表格样式 */\n" +
                "        .editable-params-table {\n" +
                "            background-color: #f8f8f8;\n" +
                "        }\n" +
                "        .editable-params-table td[contenteditable=\"true\"] {\n" +
                "            transition: background-color 0.2s, outline 0.2s;\n" +
                "        }\n" +
                "        .editable-table-header {\n" +
                "            color: #333;\n" +
                "            font-weight: 600;\n" +
                "            font-size: 14px;\n" +
                "        }\n" +
                "        .add-row-btn {\n" +
                "            padding: 4px 12px;\n" +
                "            background: #2196F3;\n" +
                "            color: white;\n" +
                "            border: none;\n" +
                "            border-radius: 4px;\n" +
                "            cursor: pointer;\n" +
                "            font-size: 12px;\n" +
                "        }\n" +
                "        .add-row-btn:hover {\n" +
                "            background: #1976D2;\n" +
                "        }\n" +
                "        .delete-row-btn {\n" +
                "            padding: 2px 6px;\n" +
                "            background: #f44336;\n" +
                "            color: white;\n" +
                "            border: none;\n" +
                "            border-radius: 3px;\n" +
                "            cursor: pointer;\n" +
                "            font-size: 11px;\n" +
                "        }\n" +
                "        .delete-row-btn:hover {\n" +
                "            background: #d32f2f;\n" +
                "        }\n" +
                "        .toc-level-1 { font-weight: 600; font-size: 14px; }\n" +
                "        .toc-level-2 { padding-left: 24px; }\n" +
                "        .toc-level-3 { padding-left: 32px; font-size: 12px; }\n" +
                "        .toc-level-4 { padding-left: 40px; font-size: 12px; }\n" +
                "        .toc-level-5 { padding-left: 48px; font-size: 12px; }\n" +
                "        .toc-level-6 { padding-left: 56px; font-size: 12px; }\n" +
                "        .toc-empty {\n" +
                "            padding: 20px;\n" +
                "            color: #858585;\n" +
                "            font-size: 13px;\n" +
                "            text-align: center;\n" +
                "        }\n" +
                "        .sidebar-header {\n" +
                "            padding: 10px 16px;\n" +
                "            font-weight: 600;\n" +
                "            font-size: 14px;\n" +
                "            color: #cccccc;\n" +
                "            background-color: #2d2d2d;\n" +
                "            border-bottom: 1px solid #333;\n" +
                "        }\n" +
                "        .search-box {
                "            padding: 10px;\n" +
                "            background-color: #252526;\n" +
                "            border-bottom: 1px solid #333;\n" +
                "            display: flex;\n" +
                "            align-items: center;\n" +
                "            gap: 8px;\n" +
                "        }\n" +
                "        .search-input {\n" +
                "            width: 100%;\n" +
                "            padding: 6px 10px;\n" +
                "            background-color: #3c3c3c;\n" +
                "            border: 1px solid #3c3c3c;\n" +
                "            color: #cccccc;\n" +
                "            border-radius: 4px;\n" +
                "            outline: none;\n" +
                "            font-size: 13px;\n" +
                "        }\n" +
                "        .search-input:focus {\n" +
                "            border-color: #007fd4;\n" +
                "        }\n" +
                "        .search-input::placeholder {\n" +
                "            color: #858585;\n" +
                "        }\n" +
                "        /* Ctrl+F 本地搜索样式 */\n" +
                "        .local-search-wrapper {\n" +
                "            position: fixed;\n" +
                "            top: 50px;\n" +
                "            left: 50%;\n" +
                "            transform: translateX(-50%);\n" +
                "            z-index: 1000;\n" +
                "        }\n" +
                "        .local-search-box {\n" +
                "            display: flex;\n" +
                "            align-items: center;\n" +
                "            background: #2d2d30;\n" +
                "            border: 1px solid #3c3c3c;\n" +
                "            border-radius: 6px;\n" +
                "            padding: 8px 12px;\n" +
                "            box-shadow: 0 4px 12px rgba(0,0,0,0.3);\n" +
                "            gap: 8px;\n" +
                "        }\n" +
                "        .local-search-box input {\n" +
                "            width: 400px;\n" +
                "            height: 32px;\n" +
                "            padding: 0 10px;\n" +
                "            background: #3c3c3c;\n" +
                "            border: 1px solid #505050;\n" +
                "            border-radius: 4px;\n" +
                "            color: #cccccc;\n" +
                "            font-size: 14px;\n" +
                "            outline: none;\n" +
                "        }\n" +
                "        .local-search-box input:focus {\n" +
                "            border-color: #007fd4;\n" +
                "        }\n" +
                "        .search-controls {\n" +
                "            display: flex;\n" +
                "            align-items: center;\n" +
                "            gap: 6px;\n" +
                "        }\n" +
                "        .search-count {\n" +
                "            color: #858585;\n" +
                "            font-size: 12px;\n" +
                "            min-width: 40px;\n" +
                "        }\n" +
                "        .search-nav-btn, .search-close-btn {\n" +
                "            width: 24px;\n" +
                "            height: 24px;\n" +
                "            border: none;\n" +
                "            border-radius: 4px;\n" +
                "            cursor: pointer;\n" +
                "            font-size: 12px;\n" +
                "        }\n" +
                "        .search-nav-btn {\n" +
                "            background: #3c3c3c;\n" +
                "            color: #cccccc;\n" +
                "        }\n" +
                "        .search-nav-btn:hover {\n" +
                "            background: #505050;\n" +
                "        }\n" +
                "        .search-close-btn {\n" +
                "            background: transparent;\n" +
                "            color: #858585;\n" +
                "            font-size: 16px;\n" +
                "        }\n" +
                "        .search-close-btn:hover {\n" +
                "            color: #cccccc;\n" +
                "        }\n" +
                "        .search-highlight {\n" +
                "            background: rgba(144, 238, 144, 0.4);\n" +
                "            border-radius: 2px;\n" +
                "        }\n" +
                "        .search-highlight.current {\n" +
                "            background: rgba(76, 175, 80, 0.6);\n" +
                "        }\n" +
                "        /* 双击Shift全局搜索弹窗样式 */\n" +
                "        .global-search-modal {\n" +
                "            display: none;\n" +
                "            position: fixed;\n" +
                "            top: 0;\n" +
                "            left: 0;\n" +
                "            width: 100%;\n" +
                "            height: 100%;\n" +
                "            background: rgba(0,0,0,0.5);\n" +
                "            z-index: 2000;\n" +
                "            justify-content: center;\n" +
                "            align-items: flex-start;\n" +
                "            padding-top: 80px;\n" +
                "        }\n" +
                "        .global-search-container {\n" +
                "            width: 700px;\n" +
                "            max-height: 70vh;\n" +
                "            background: #252526;\n" +
                "            border: 1px solid #3c3c3c;\n" +
                "            border-radius: 8px;\n" +
                "            overflow: hidden;\n" +
                "            box-shadow: 0 8px 32px rgba(0,0,0,0.4);\n" +
                "        }\n" +
                "        .global-search-header {\n" +
                "            display: flex;\n" +
                "            align-items: center;\n" +
                "            padding: 12px 16px;\n" +
                "            border-bottom: 1px solid #3c3c3c;\n" +
                "            gap: 12px;\n" +
                "        }\n" +
                "        .global-search-header input {\n" +
                "            flex: 1;\n" +
                "            height: 36px;\n" +
                "            padding: 0 12px;\n" +
                "            background: #3c3c3c;\n" +
                "            border: 1px solid #505050;\n" +
                "            border-radius: 4px;\n" +
                "            color: #cccccc;\n" +
                "            font-size: 14px;\n" +
                "            outline: none;\n" +
                "        }\n" +
                "        .global-search-header input:focus {\n" +
                "            border-color: #007fd4;\n" +
                "        }\n" +
                "        .global-search-close {\n" +
                "            width: 28px;\n" +
                "            height: 28px;\n" +
                "            border: none;\n" +
                "            background: transparent;\n" +
                "            color: #858585;\n" +
                "            font-size: 20px;\n" +
                "            cursor: pointer;\n" +
                "            border-radius: 4px;\n" +
                "        }\n" +
                "        .global-search-close:hover {\n" +
                "            background: #3c3c3c;\n" +
                "            color: #cccccc;\n" +
                "        }\n" +
                "        .global-search-count {\n" +
                "            padding: 8px 16px;\n" +
                "            border-bottom: 1px solid #3c3c3c;\n" +
                "            font-size: 12px;\n" +
                "            color: #858585;\n" +
                "        }\n" +
                "        .match-count {\n" +
                "            color: #4CAF50;\n" +
                "        }\n" +
                "        .global-search-results {\n" +
                "            max-height: calc(70vh - 120px);\n" +
                "            overflow-y: auto;\n" +
                "        }\n" +
                "        .global-result-item {\n" +
                "            border-bottom: 1px solid #3c3c3c;\n" +
                "        }\n" +
                "        .global-result-header {\n" +
                "            display: flex;\n" +
                "            justify-content: space-between;\n" +
                "            align-items: center;\n" +
                "            padding: 10px 16px;\n" +
                "            cursor: pointer;\n" +
                "            background: #2d2d30;\n" +
                "        }\n" +
                "        .global-result-header:hover {\n" +
                "            background: #37373d;\n" +
                "        }\n" +
                "        .global-result-name {\n" +
                "            color: #e0e0e0;\n" +
                "            font-size: 13px;\n" +
                "        }\n" +
                "        .global-result-count {\n" +
                "            color: #858585;\n" +
                "            font-size: 12px;\n" +
                "        }\n" +
                "        .global-result-content {\n" +
                "            padding: 8px 0;\n" +
                "            background: #1e1e1e;\n" +
                "        }\n" +
                "        .global-match-line {\n" +
                "            display: flex;\n" +
                "            padding: 4px 16px;\n" +
                "        }\n" +
                "        .global-match-line:hover {\n" +
                "            background: #2a2d2e;\n" +
                "        }\n" +
                "        .global-match-line .line-number {\n" +
                "            width: 40px;\n" +
                "            color: #858585;\n" +
                "            font-size: 12px;\n" +
                "            flex-shrink: 0;\n" +
                "        }\n" +
                "        .global-match-line .line-content {\n" +
                "            flex: 1;\n" +
                "            overflow: hidden;\n" +
                "        }\n" +
                "        .global-match-line pre {\n" +
                "            margin: 0;\n" +
                "            font-size: 12px;\n" +
                "            color: #cccccc;\n" +
                "            white-space: pre-wrap;\n" +
                "            word-break: break-all;\n" +
                "        }\n" +
                "        .global-highlight {\n" +
                "            background: rgba(255, 235, 59, 0.4);\n" +
                "            border-radius: 2px;\n" +
                "        }\n" +
                "        /* 标题跳转对话框 */\n" +
                "        .goto-option {\n" +
                "            padding: 8px 16px;\n" +
                "            cursor: pointer;\n" +
                "            font-size: 13px;\n" +
                "            color: #cccccc;\n" +
                "        }\n" +
                "        .goto-option:hover {\n" +
                "            background: #2a2d2e;\n" +
                "        }\n" +
                "        .current-file-info {\n" +
                "            padding: 8px 16px;\n" +
                "            background-color: #252526;\n" +
                "            border-bottom: 1px solid #333;\n" +
                "            display: flex;\n" +
                "            align-items: center;\n" +
                "            justify-content: space-between;\n" +
                "            font-size: 12px;\n" +
                "            color: #858585;\n" +
                "        }\n" +
                "        .current-path {\n" +
                "            white-space: nowrap;\n" +
                "            overflow: hidden;\n" +
                "            text-overflow: ellipsis;\n" +
                "            margin-right: 8px;\n" +
                "            flex: 1;\n" +
                "            text-align: left;\n" +
                "            font-size: 11px;\n" +
                "            color: #858585;\n" +
                "        }\n" +
                "        .breadcrumb-title { color: #569cd6; margin-left: 8px; font-weight: 500; }\n" +
                "        .breadcrumb-separator { color: #858585; margin: 0 4px; }\n" +
                "        /* Tabs Styles */\n" +
                "        .tabs-bar {\n" +
                "            display: flex;\n" +
                "            background-color: #252526;\n" +
                "            border-bottom: 1px solid #333;\n" +
                "            overflow-x: auto;\n" +
                "            flex-shrink: 0;\n" +
                "            height: 35px;\n" +
                "        }\n" +
                "        .tab {\n" +
                "            padding: 0 12px;\n" +
                "            background-color: #2d2d2d;\n" +
                "            color: #969696;\n" +
                "            border-right: 1px solid #252526;\n" +
                "            cursor: pointer;\n" +
                "            display: flex;\n" +
                "            align-items: center;\n" +
                "            font-size: 13px;\n" +
                "            white-space: nowrap;\n" +
                "            user-select: none;\n" +
                "            height: 100%;\n" +
                "            min-width: 100px;\n" +
                "            max-width: 200px;\n" +
                "        }\n" +
                "        .tab:hover {\n" +
                "            background-color: #3e3e42;\n" +
                "            color: #e0e0e0;\n" +
                "        }\n" +
                "        .tab.active {\n" +
                "            background-color: #1e1e1e;\n" +
                "            color: #ffffff;\n" +
                "            border-top: 1px solid #007fd4;\n" +
                "        }\n" +
                "        .tab-title {\n" +
                "            overflow: hidden;\n" +
                "            text-overflow: ellipsis;\n" +
                "            flex: 1;\n" +
                "        }\n" +
                "        .tab-close {\n" +
                "            margin-left: 8px;\n" +
                "            border-radius: 4px;\n" +
                "            padding: 2px;\n" +
                "            width: 18px;\n" +
                "            height: 18px;\n" +
                "            display: flex;\n" +
                "            align-items: center;\n" +
                "            justify-content: center;\n" +
                "            font-size: 14px;\n" +
                "            line-height: 1;\n" +
                "            opacity: 0.7;\n" +
                "        }\n" +
                "        .tab-close:hover {\n" +
                "            background-color: #4e4e52;\n" +
                "            color: white;\n" +
                "            opacity: 1;\n" +
                "        }\n" +
                "        /* Toolbar Styles */\n" +
                "        .toolbar {\n" +
                "            display: flex;\n" +
                "            align-items: center;\n" +
                "            padding: 6px 16px;\n" +
                "            background-color: #1e1e1e;\n" +
                "            border-bottom: 1px solid #333;\n" +
                "            justify-content: space-between;\n" +
                "            gap: 10px;\n" +
                "        }\n" +
                "        .toolbar-left { display: flex; align-items: center; flex: 1; overflow: hidden; }\n" +
                "        .toolbar-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }\n" +
                "        .tool-btn {\n" +
                "            background-color: #2d2d2d;\n" +
                "            color: #cccccc;\n" +
                "            border: 1px solid #3e3e42;\n" +
                "            padding: 4px 10px;\n" +
                "            border-radius: 3px;\n" +
                "            font-size: 12px;\n" +
                "            cursor: pointer;\n" +
                "            display: flex;\n" +
                "            align-items: center;\n" +
                "            gap: 6px;\n" +
                "        }\n" +
                "        .tool-btn:hover {\n" +
                "            background-color: #3e3e42;\n" +
                "            color: #ffffff;\n" +
                "        }\n" +
                "        .tool-btn.active {\n" +
                "            background-color: #094771;\n" +
                "            border-color: #094771;\n" +
                "            color: #ffffff;\n" +
                "        }\n" +
                "        .raw-body {\n" +
                "            display: none;\n" +
                "            flex: 1;\n" +
                "            overflow-y: auto;\n" +
                "            padding: 20px;\n" +
                "            white-space: pre-wrap;\n" +
                "            font-family: Consolas, \"Courier New\", monospace;\n" +
                "            color: #d4d4d4;\n" +
                "            background-color: #1e1e1e;\n" +
                "            font-size: 13px;\n" +
                "        }\n" +
                "        .context-menu {\n" +
                "            display: none;\n" +
                "            position: absolute;\n" +
                "            background-color: #252526;\n" +
                "            border: 1px solid #454545;\n" +
                "            box-shadow: 0 2px 8px rgba(0,0,0,0.5);\n" +
                "            z-index: 1000;\n" +
                "            min-width: 160px;\n" +
                "            padding: 4px 0;\n" +
                "            border-radius: 4px;\n" +
                "        }\n" +
                "        .menu-item {\n" +
                "            padding: 6px 12px;\n" +
                "            cursor: pointer;\n" +
                "            font-size: 13px;\n" +
                "            color: #cccccc;\n" +
                "        }\n" +
                "        .menu-item:hover {\n" +
                "            background-color: #094771;\n" +
                "            color: white;\n" +
                "        }\n" +
                "        .locate-btn {\n" +
                "            background: none;\n" +
                "            border: none;\n" +
                "            color: #cccccc;\n" +
                "            cursor: pointer;\n" +
                "            padding: 4px;\n" +
                "            border-radius: 4px;\n" +
                "            flex-shrink: 0;\n" +
                "        }\n" +
                "        .locate-btn:hover {\n" +
                "            background-color: #37373d;\n" +
                "            color: #ffffff;\n" +
                "        }\n" +
                "        .file-list {\n" +
                "            flex: 1;\n" +
                "            overflow-y: auto;\n" +
                "            padding: 5px 0;\n" +
                "        }\n" +
                "        .file-item {\n" +
                "            display: block;\n" +
                "            padding: 6px 16px;\n" +
                "            color: #969696;\n" +
                "            text-decoration: none;\n" +
                "            font-size: 13px;\n" +
                "            white-space: nowrap;\n" +
                "            overflow: hidden;\n" +
                "            text-overflow: ellipsis;\n" +
                "            cursor: pointer;\n" +
                "        }\n" +
                "        .file-item:hover {\n" +
                "            background-color: #2a2d2e;\n" +
                "            color: #e0e0e0;\n" +
                "        }\n" +
                "        .file-item.active {\n" +
                "            background-color: #37373d;\n" +
                "            color: #ffffff;\n" +
                "            border-left: 2px solid #007fd4;\n" +
                "            padding-left: 14px;\n" +
                "        }\n" +
                "        .content {\n" +
                "            flex: 1;\n" +
                "            overflow: hidden;\n" +
                "            display: flex;\n" +
                "            flex-direction: column;\n" +
                "            background-color: #1e1e1e;\n" +
                "        }\n" +
                "        .markdown-body {\n" +
                "            flex: 1;\n" +
                "            overflow-y: auto;\n" +
                "            padding: 30px 50px;\n" +
                "            max-width: 900px;\n" +
                "            margin: 0 auto;\n" +
                "            line-height: 1.6;\n" +
                "            width: 100%;\n" +
                "        }\n" +
                "        /* 右侧请求面板 */\n" +
                "        .request-panel {\n" +
                "            width: 0;\n" +
                "            overflow: hidden;\n" +
                "            background-color: #2d2d2d;\n" +
                "            border-left: 1px solid #404040;\n" +
                "            display: flex;\n" +
                "            flex-direction: column;\n" +
                "            transition: width 0.3s ease;\n" +
                "        }\n" +
                "        .request-panel.expanded { width: 450px; }\n" +
                "        .request-panel-header {\n" +
                "            padding: 10px 15px;\n" +
                "            background: #383838;\n" +
                "            border-bottom: 1px solid #404040;\n" +
                "            display: flex;\n" +
                "            align-items: center;\n" +
                "            justify-content: space-between;\n" +
                "        }\n" +
                "        .request-panel-title { color: #e0e0e0; font-size: 14px; font-weight: 500; }\n" +
                "        .request-panel-close { color: #808080; cursor: pointer; font-size: 18px; }\n" +
                "        .request-panel-close:hover { color: #ffffff; }\n" +
                "        .request-config {\n" +
                "            padding: 15px;\n" +
                "            background: #333333;\n" +
                "            border-bottom: 1px solid #404040;\n" +
                "        }\n" +
                "        .request-config-row {\n" +
                "            display: flex;\n" +
                "            align-items: center;\n" +
                "            margin-bottom: 10px;\n" +
                "        }\n" +
                "        .request-config-row:last-child { margin-bottom: 0; }\n" +
                "        .request-config-label { color: #b0b0b0; font-size: 13px; width: 60px; flex-shrink: 0; }\n" +
                "        .request-config-input {\n" +
                "            flex: 1;\n" +
                "            background: #1e1e1e;\n" +
                "            border: 1px solid #505050;\n" +
                "            border-radius: 6px;\n" +
                "            color: #e0e0e0;\n" +
                "            padding: 6px 10px;\n" +
                "            font-size: 13px;\n" +
                "        }\n" +
                "        .request-config-input:focus { outline: none; border-color: #007acc; }\n" +
                "        .request-method { width: 80px; margin-right: 8px; }\n" +
                "        .request-url { flex: 1; }\n" +
                "        .request-buttons {\n" +
                "            padding: 10px 15px;\n" +
                "            background: #333333;\n" +
                "            border-bottom: 1px solid #404040;\n" +
                "            display: flex;\n" +
                "            gap: 10px;\n" +
                "        }\n" +
                "        .request-btn {\n" +
                "            padding: 8px 16px;\n" +
                "            border: none;\n" +
                "            border-radius: 6px;\n" +
                "            cursor: pointer;\n" +
                "            font-size: 13px;\n" +
                "            transition: all 0.2s;\n" +
                "        }\n" +
                "        .request-btn-primary { background: #007acc; color: white; }\n" +
                "        .request-btn-primary:hover { background: #005a9e; }\n" +
                "        .request-btn-secondary { background: #505050; color: #e0e0e0; }\n" +
                "        .request-btn-secondary:hover { background: #606060; }\n" +
                "        .request-body {\n" +
                "            flex: 1;\n" +
                "            display: flex;\n" +
                "            flex-direction: column;\n" +
                "            overflow: hidden;\n" +
                "        }\n" +
                "        .request-body-label {\n" +
                "            padding: 8px 15px;\n" +
                "            background: #333333;\n" +
                "            color: #b0b0b0;\n" +
                "            font-size: 12px;\n" +
                "            border-bottom: 1px solid #404040;\n" +
                "        }\n" +
                "        .request-body textarea {\n" +
                "            flex: 1;\n" +
                "            background: #1e1e1e;\n" +
                "            border: none;\n" +
                "            color: #e0e0e0;\n" +
                "            padding: 15px;\n" +
                "            font-family: 'Consolas', 'Monaco', monospace;\n" +
                "            font-size: 13px;\n" +
                "            resize: none;\n" +
                "        }\n" +
                "        .request-body textarea:focus { outline: none; }\n" +
                "        .response-body {\n" +
                "            flex: 1;\n" +
                "            display: flex;\n" +
                "            flex-direction: column;\n" +
                "            overflow: hidden;\n" +
                "            border-top: 1px solid #404040;\n" +
                "        }\n" +
                "        .response-header {\n" +
                "            padding: 8px 15px;\n" +
                "            background: #333333;\n" +
                "            color: #b0b0b0;\n" +
                "            font-size: 12px;\n" +
                "            display: flex;\n" +
                "            justify-content: space-between;\n" +
                "            align-items: center;\n" +
                "        }\n" +
                "        .response-status { color: #4ec9b0; }\n" +
                "        .response-status.error { color: #f44747; }\n" +
                "        .response-body-content {\n" +
                "            flex: 1;\n" +
                "            overflow: auto;\n" +
                "            background: #1e1e1e;\n" +
                "            padding: 15px;\n" +
                "        }\n" +
                "        .response-body-content pre {\n" +
                "            margin: 0;\n" +
                "            color: #d4d4d4;\n" +
                "            font-family: 'Consolas', 'Monaco', monospace;\n" +
                "            font-size: 12px;\n" +
                "            white-space: pre-wrap;\n" +
                "            word-break: break-all;\n" +
                "        }\n" +
                "        .request-panel-toggle {\n" +
                "            position: fixed;\n" +
                "            right: 20px;\n" +
                "            bottom: 20px;\n" +
                "            width: 50px;\n" +
                "            height: 50px;\n" +
                "            background: #383838;\n" +
                "            border: 1px solid #505050;\n" +
                "            border-radius: 50%;\n" +
                "            display: flex;\n" +
                "            align-items: center;\n" +
                "            justify-content: center;\n" +
                "            cursor: pointer;\n" +
                "            color: #e0e0e0;\n" +
                "            font-size: 20px;\n" +
                "            box-shadow: 0 2px 8px rgba(0,0,0,0.3);\n" +
                "            z-index: 1000;\n" +
                "        }\n" +
                "        .request-panel-toggle:hover { background: #404040; color: #ffffff; }\n" +
                "        /* Scrollbar styles */\n" +
                "        ::-webkit-scrollbar {\n" +
                "            width: 10px;\n" +
                "            height: 10px;\n" +
                "        }\n" +
                "        ::-webkit-scrollbar-thumb {\n" +
                "            background: #424242;\n" +
                "            border-radius: 5px;\n" +
                "        }\n" +
                "        ::-webkit-scrollbar-track {\n" +
                "            background: #1e1e1e;\n" +
                "        }\n" +
                "        .sidebar ::-webkit-scrollbar-track {\n" +
                "            background: #252526;\n" +
                "        }\n" +
                "        h1, h2, h3, h4, h5, h6 { color: #569cd6; margin-top: 24px; }\n" +
                "        h1 { border-bottom: 1px solid #404040; padding-bottom: 8px; }\n" +
                "        h2 { border-bottom: 1px solid #30363d; padding-bottom: 6px; }\n" +
                "        h3 { border-bottom: 1px solid #30363d; padding-bottom: 4px; }\n" +
                "        a { color: #4ec9b0; text-decoration: none; }\n" +
                "        a:hover { text-decoration: underline; }\n" +
                "        code { background: #2d2d2d; color: #ce9178; padding: 2px 6px; border-radius: 3px; font-family: Consolas, 'Courier New', monospace; }\n" +
                "        pre { background: #1e1e1e; border: 1px solid #404040; padding: 15px; border-radius: 6px; overflow-x: auto; }\n" +
                "        pre code { background: transparent; padding: 0; }\n" +
                "        blockquote { border-left: 3px solid #569cd6; color: #808080; margin: 15px 0; padding-left: 15px; background: #252525; padding: 10px 15px; }\n" +
                "        table { border-collapse: collapse; width: 100%; margin: 15px 0; }\n" +
                "        th, td { border: 1px solid #404040; padding: 8px 12px; text-align: left; }\n" +
                "        th { background: #2d2d2d; color: #569cd6; }\n" +
                "        tr:nth-child(even) { background: #252525; }\n" +
                "        th[align=\"center\"], td[align=\"center\"] { text-align: center; }\n" +
                "        th[align=\"right\"], td[align=\"right\"] { text-align: right; }\n" +
                "        hr { border-top: 1px solid #404040; margin: 20px 0; }\n" +
                "        img { max-width: 100%; }\n" +
                "        ul, ol { padding-left: 30px; }\n" +
                "        li { margin: 5px 0; }\n" +
                "        ul li { list-style-type: disc; }\n" +
                "        ol li { list-style-type: decimal; }\n" +
                "        strong { color: #569cd6; }\n" +
                "        em { color: #ce9178; }\n" +
"        .task-list-item { list-style-type: none; margin-left: -20px; }\n" +
                "        .task-list-item input { margin-right: 8px; }\n" +
                "        .front-matter { background: #252525; padding: 10px; border-radius: 4px; margin-bottom: 20px; }\n" +
                "        .front-matter code { background: transparent; color: #ce9178; }\n" +
                "        .tree-item { cursor: pointer; }\n" +
                "        /* 文件树条纹背景 */\n" +
                "        .tree-children .tree-file:nth-child(odd) { background-color: #1e1e1e; }\n" +
                "        .tree-children .tree-file:nth-child(even) { background-color: #252526; }\n" +
                "        .tree-children .tree-folder:nth-child(odd) { background-color: #1e1e1e; }\n" +
                "        .tree-children .tree-folder:nth-child(even) { background-color: #252526; }\n" +
                "        .tree-folder { \n" +
                "            display: flex; \n" +
                "            align-items: center; \n" +
                "            padding: 5px 16px;\n" +
                "            color: #969696;\n" +
                "            font-size: 13px;\n" +
                "            user-select: none;\n" +
                "        }\n" +
                "        .tree-folder:hover { background-color: #2a2d2e; color: #e0e0e0; }\n" +
                "        .tree-toggle {\n" +
                "            width: 16px;\n" +
                "            height: 16px;\n" +
                "            display: inline-flex;\n" +
                "            align-items: center;\n" +
                "            justify-content: center;\n" +
                "            margin-right: 2px;\n" +
                "            font-size: 10px;\n" +
                "            color: #808080;\n" +
                "            transition: transform 0.15s ease;\n" +
                "        }\n" +
                "        .tree-icon {\n" +
                "            display: inline-flex;\n" +
                "            align-items: center;\n" +
                "            justify-content: center;\n" +
                "            margin-right: 6px;\n" +
                "            width: 16px;\n" +
                "            height: 16px;\n" +
                "            flex-shrink: 0;\n" +
                "        }\n" +
                "        .folder-icon {\n" +
                "            color: #dcb67a;\n" +
                "        }\n" +
                "        .file-icon {\n" +
                "            color: #519aba;\n" +
                "        }\n" +
                "        .tree-toggle.expanded { transform: rotate(90deg); }\n" +
                "        .tree-children { display: none; padding-left: 12px; }\n" +
                "        .tree-children.expanded { display: block; }\n" +
                "        .tree-file {\n" +
                "            display: block;\n" +
                "            padding: 5px 16px 5px 32px;\n" +
                "            color: #969696;\n" +
                "            text-decoration: none;\n" +
                "            font-size: 13px;\n" +
                "            white-space: nowrap;\n" +
                "            overflow: hidden;\n" +
                "            text-overflow: ellipsis;\n" +
                "        }\n" +
                "        .tree-file:hover { background-color: #2a2d2e; color: #e0e0e0; }\n" +
                "        .tree-file.active {\n" +
                "            background-color: #37373d;\n" +
                "            color: #ffffff;\n" +
                "            border-left: 2px solid #007fd4;\n" +
                "        }\n" +
                "    </style>\n" +
                "</head>\n" +
                "<body>\n" +
                "    <div class=\"layout\">\n" +
                "        <aside class=\"sidebar\">\n" +
                "            " + sidebarHtml + "\n" +
                "        </aside>\n" +
                "        <aside class=\"toc-sidebar\">\n" +
                "            " + tocHtml + "\n" +
                "        </aside>\n" +
                "    <main class=\"content\">\n" +
                "        <div class=\"tabs-bar\"></div>\n" +
                "        <div class=\"toolbar\">\n" +
                "            <div class=\"toolbar-left\">\n" +
                "                <div class=\"current-path\" id=\"breadcrumb-path\" title=\"" + safeTitle + "\">" + safeTitle + "</div>\n" +
                "            </div>\n" +
                "            <div class=\"toolbar-right\">\n" +
                "                <div class=\"tool-btn active\" id=\"btn-preview\" onclick=\"toggleView('preview')\">预览模式</div>\n" +
                "                <div class=\"tool-btn\" id=\"btn-raw\" onclick=\"toggleView('raw')\">原文本</div>\n" +
                "                <div style=\"width: 1px; height: 16px; background: #3e3e42; margin: 0 4px;\"></div>\n" +
                "                <div class=\"tool-btn\" onclick=\"downloadFile()\">📥 下载</div>\n" +
                "            </div>\n" +
                "        </div>\n" +
                "        <div class=\"markdown-body\" id=\"markdown-body\">\n" +
                "                " + htmlContent + "\n" +
                "            </div>\n" +
                "        <div class=\"raw-body\" id=\"raw-body\"></div>\n" +
                "    </main>\n" +
                "    <!-- 右侧请求面板 -->\n" +
                "    <aside class=\"request-panel\" id=\"request-panel\">\n" +
                "        <div class=\"request-panel-header\">\n" +
                "            <span class=\"request-panel-title\">API 请求工具</span>\n" +
                "            <span class=\"request-panel-close\" onclick=\"toggleRequestPanel()\">×</span>\n" +
                "        </div>\n" +
                "        <div class=\"request-config\">\n" +
                "            <div class=\"request-config-row\">\n" +
                "                <span class=\"request-config-label\">IP</span>\n" +
                "                <input type=\"text\" class=\"request-config-input\" id=\"req-ip\" placeholder=\"127.0.0.1\" value=\"127.0.0.1\">\n" +
                "            </div>\n" +
                "            <div class=\"request-config-row\">\n" +
                "                <span class=\"request-config-label\">Port</span>\n" +
                "                <input type=\"text\" class=\"request-config-input\" id=\"req-port\" placeholder=\"8080\" value=\"9527\">\n" +
                "            </div>\n" +
                "            <div class=\"request-config-row\">\n" +
                "                <span class=\"request-config-label\">方法</span>\n" +
                "                <input type=\"text\" class=\"request-config-input request-method\" id=\"req-method\" placeholder=\"GET\" value=\"GET\">\n" +
                "                <input type=\"text\" class=\"request-config-input request-url\" id=\"req-url\" placeholder=\"/api/path\" value=\"/api/mcp/query\">\n" +
                "            </div>\n" +
                "        </div>\n" +
                "        <div class=\"request-buttons\">\n" +
                "            <button class=\"request-btn request-btn-primary\" onclick=\"sendRequest()\">发送请求</button>\n" +
                "            <button class=\"request-btn request-btn-secondary\" onclick=\"clearRequest()\">清空</button>\n" +
                "        </div>\n" +
                "        <div class=\"request-body\">\n" +
                "            <div class=\"request-body-label\">请求体 (JSON)</div>\n" +
                "            <textarea id=\"req-body\" placeholder='{\"key\": \"value\"}'></textarea>\n" +
                "        </div>\n" +
                "        <div class=\"response-body\">\n" +
                "            <div class=\"response-header\">\n" +
                "                <span>响应结果</span>\n" +
                "                <span class=\"response-status\" id=\"res-status\"></span>\n" +
                "            </div>\n" +
                "            <div class=\"response-body-content\">\n" +
                "                <pre id=\"res-content\">点击\"发送请求\"查看结果</pre>\n" +
                "            </div>\n" +
                "        </div>\n" +
                "    </aside>\n" +
                "    <!-- 请求面板切换按钮 -->\n" +
                "    <div class=\"request-panel-toggle\" onclick=\"toggleRequestPanel()\" title=\"API请求工具\">🚀</div>\n" +
                "    </div>\n" +
                "    <div id=\"tab-context-menu\" class=\"context-menu\">\n" +
                "        <div class=\"menu-item\" id=\"menu-close-current\">关闭当前 (Ctrl+W)</div>\n" +
                "        <div class=\"menu-item\" id=\"menu-close-all\">关闭所有</div>\n" +
                "    </div>\n" +
                "    <script src=\"/md-search.js\"></script>\n" +
                "    <script>\n" +
                "        const TABS_KEY = 'md-preview-open-tabs';\n" +
                "        \n" +
                "        // 处理请求参数标题 - 添加调用按钮和可编辑表格\n" +
                "        function initRequestParams() {\n" +
                "            // 查找包含\"请求参数\"的标题\n" +
                "            const headings = document.querySelectorAll('.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6');\n" +
                "            headings.forEach(heading => {\n" +
                "                if (heading.textContent.includes('请求参数')) {\n" +
                "                    // 查找该标题后面的表格\n" +
                "                    let nextElement = heading.nextElementSibling;\n" +
                "                    let table = null;\n" +
                "                    while (nextElement) {\n" +
                "                        if (nextElement.tagName === 'TABLE') {\n" +
                "                            table = nextElement;\n" +
                "                            break;\n" +
                "                        }\n" +
                "                        // 跳过空段落\n" +
                "                        if (nextElement.tagName === 'P' && nextElement.textContent.trim() === '') {\n" +
                "                            nextElement = nextElement.nextElementSibling;\n" +
                "                            continue;\n" +
                "                        }\n" +
                "                        // 如果遇到下一个标题，说明没有表格\n" +
                "                        if (nextElement.tagName.match(/^H[1-6]$/i)) {\n" +
                "                            break;\n" +
                "                        }\n" +
                "                        nextElement = nextElement.nextElementSibling;\n" +
                "                    }\n" +
                "                    if (table) {\n" +
                "                        // 添加调用按钮（居右，绿色）\n" +
                "                        const invokeBtn = document.createElement('div');\n" +
                "                        invokeBtn.innerHTML = '<button id=\"invokeParamsBtn\" class=\"invoke-params-btn\">📞 调用</button>';\n" +
                "                        invokeBtn.style.textAlign = 'right';\n" +
                "                        invokeBtn.style.marginBottom = '10px';\n" +
                "                        table.parentNode.insertBefore(invokeBtn, table);\n" +
                "                        // 克隆表格作为可编辑版本\n" +
                "                        const editableTable = table.cloneNode(true);\n" +
                "                        editableTable.classList.add('editable-params-table');\n" +
                "                        editableTable.style.marginTop = '10px';\n" +
                "                        // 使表格单元格可编辑\n" +
                "                        const rows = editableTable.querySelectorAll('tr');\n" +
                "                        rows.forEach((row, rowIndex) => {\n" +
                "                            if (rowIndex === 0) {\n" +
                "                                // 表头添加操作列\n" +
                "                                const th = document.createElement('th');\n" +
                "                                th.textContent = '操作';\n" +
                "                                th.style.width = '60px';\n" +
                "                                row.appendChild(th);\n" +
                "                            } else {\n" +
                "                                // 数据行添加操作按钮\n" +
                "                                const td = document.createElement('td');\n" +
                "                                td.style.textAlign = 'center';\n" +
                "                                td.innerHTML = '<button class=\"delete-row-btn\" title=\"删除行\">✕</button>';\n" +
                "                                row.appendChild(td);\n" +
                "                                // 使除最后一列外的所有单元格可编辑\n" +
                "                                const cells = row.querySelectorAll('td');\n" +
                "                                cells.forEach((cell, cellIndex) => {\n" +
                "                                    if (cellIndex < cells.length - 1) {\n" +
                "                                        cell.contentEditable = 'true';\n" +
                "                                        cell.style.cursor = 'text';\n" +
                "                                        cell.style.backgroundColor = '#f8f8f8';\n" +
                "                                        cell.addEventListener('focus', function() {\n" +
                "                                            this.style.backgroundColor = '#ffffff';\n" +
                "                                            this.style.outline = '2px solid #4CAF50';\n" +
                "                                        });\n" +
                "                                        cell.addEventListener('blur', function() {\n" +
                "                                            this.style.backgroundColor = '#f8f8f8';\n" +
                "                                            this.style.outline = 'none';\n" +
                "                                        });\n" +
                "                                    }\n" +
                "                                });\n" +
                "                            }\n" +
                "                        });\n" +
                "                        // 添加表格标题和操作按钮\n" +
                "                        const tableHeader = document.createElement('div');\n" +
                "                        tableHeader.className = 'editable-table-header';\n" +
                "                        tableHeader.innerHTML = '<span>可编辑参数</span><button id=\"addParamRowBtn\" class=\"add-row-btn\">+ 添加行</button>';\n" +
                "                        tableHeader.style.display = 'flex';\n" +
                "                        tableHeader.style.justifyContent = 'space-between';\n" +
                "                        tableHeader.style.alignItems = 'center';\n" +
                "                        tableHeader.style.marginBottom = '8px';\n" +
                "                        tableHeader.style.marginTop = '20px';\n" +
                "                        // 插入可编辑表格\n" +
                "                        table.parentNode.insertBefore(tableHeader, editableTable);\n" +
                "                        table.parentNode.insertBefore(editableTable, table.nextSibling);\n" +
                "                        // 添加行按钮事件\n" +
                "                        setTimeout(() => {\n" +
                "                            const addBtn = document.getElementById('addParamRowBtn');\n" +
                "                            const delBtns = document.querySelectorAll('.delete-row-btn');\n" +
                "                            if (addBtn) {\n" +
                "                                addBtn.addEventListener('click', function() {\n" +
                "                                    const tbody = editableTable.querySelector('tbody');\n" +
                "                                    if (tbody) {\n" +
                "                                        const newRow = tbody.insertRow();\n" +
                "                                        const headerRow = editableTable.querySelector('thead tr');\n" +
                "                                        const colCount = headerRow.children.length - 1; // 减去操作列\n" +
                "                                        for (let i = 0; i < colCount; i++) {\n" +
                "                                            const cell = newRow.insertCell(i);\n" +
                "                                            cell.contentEditable = 'true';\n" +
                "                                            cell.style.backgroundColor = '#f8f8f8';\n" +
                "                                            cell.style.cursor = 'text';\n" +
                "                                            cell.addEventListener('focus', function() {\n" +
                "                                                this.style.backgroundColor = '#ffffff';\n" +
                "                                                this.style.outline = '2px solid #4CAF50';\n" +
                "                                            });\n" +
                "                                            cell.addEventListener('blur', function() {\n" +
                "                                                this.style.backgroundColor = '#f8f8f8';\n" +
                "                                                this.style.outline = 'none';\n" +
                "                                            });\n" +
                "                                        }\n" +
                "                                        const actionCell = newRow.insertCell(colCount);\n" +
                "                                        actionCell.style.textAlign = 'center';\n" +
                "                                        actionCell.innerHTML = '<button class=\"delete-row-btn\" title=\"删除行\">✕</button>';\n" +
                "                                        // 新行删除按钮事件\n" +
                "                                        actionCell.querySelector('.delete-row-btn').addEventListener('click', function() {\n" +
                "                                            newRow.remove();\n" +
                "                                        });\n" +
                "                                    }\n" +
                "                                });\n" +
                "                            }\n" +
                "                            // 删除行按钮事件\n" +
                "                            delBtns.forEach(btn => {\n" +
                "                                btn.addEventListener('click', function() {\n" +
                "                                    this.closest('tr').remove();\n" +
                "                                });\n" +
                "                            });\n" +
                "                        }, 100);\n" +
                "                    }\n" +
                "                }\n" +
                "            });\n" +
                "        }\n" +
                "        \n" +
                "        function initToc() {\n" +
                "            const tocItems = document.querySelectorAll('.toc-item');\n" +
                "            tocItems.forEach(item => {\n" +
                "                item.addEventListener('click', function(e) {\n" +
                "                    e.preventDefault();\n" +
                "                    const targetId = this.getAttribute('href').substring(1);\n" +
                "                    const targetElement = document.getElementById(targetId);\n" +
                "                    const contentArea = document.querySelector('.markdown-body');\n" +
                "                    if (targetElement && contentArea) {\n" +
                "                        const mainRect = document.querySelector('main').getBoundingClientRect();\n" +
                "                        const targetRect = targetElement.getBoundingClientRect();\n" +
                "                        // 动态计算顶部偏移量 (Tabs + Toolbar + 20px padding)\n" +
                "                        const tabsHeight = document.querySelector('.tabs-bar').offsetHeight || 0;\n" +
                "                        const toolbarHeight = document.querySelector('.toolbar').offsetHeight || 0;\n" +
                "                        const offset = tabsHeight + toolbarHeight + 20;\n" +
                "                        const deltaY = targetRect.top - mainRect.top - offset;\n" +
                "                        contentArea.scrollTop = contentArea.scrollTop + deltaY;\n" +
                "                        // 闪光效果\n" +
                "                        setTimeout(() => {\n" +
                "                            targetElement.classList.add('heading-flash');\n" +
                "                            setTimeout(() => targetElement.classList.remove('heading-flash'), 600);\n" +
                "                        }, 100);\n" +
                "                    }\n" +
                "                    document.querySelectorAll('.toc-item.active').forEach(el => el.classList.remove('active'));\n" +
                "                    this.classList.add('active');\n" +
                "                });\n" +
                "            });\n" +
                "        }\n" +
                "        \n" +
                "        function initTocScrollSpy() {\n" +
                "            const contentArea = document.querySelector('.markdown-body');\n" +
                "            if (!contentArea) return;\n" +
                "            \n" +
                "            const tocItems = document.querySelectorAll('.toc-item');\n" +
                "            const headings = [];\n" +
                "            tocItems.forEach(item => {\n" +
                "                const id = item.getAttribute('data-id');\n" +
                "                const heading = document.getElementById(id);\n" +
                "                if (heading) {\n" +
                "                    headings.push({ element: heading, item: item });\n" +
                "                }\n" +
                "            });\n" +
                "            \n" +
                "            if (headings.length === 0) return;\n" +
                "            \n" +
                "            function updateActiveHeading() {\n" +
                "                const contentRect = contentArea.getBoundingClientRect();\n" +
                "                const threshold = 60;\n" +
                "                let currentHeadingIndex = -1;\n" +
                "                \n" +
                "                for (let i = 0; i < headings.length; i++) {\n" +
                "                    const headingRect = headings[i].element.getBoundingClientRect();\n" +
                "                    const relativeTop = headingRect.top - contentRect.top;\n" +
                "                    \n" +
                "                    if (relativeTop <= threshold) {\n" +
                "                        currentHeadingIndex = i;\n" +
                "                    } else {\n" +
                "                        break;\n" +
                "                    }\n" +
                "                }\n" +
                "                \n" +
                "                if (currentHeadingIndex === -1 && headings.length > 0) {\n" +
                "                    currentHeadingIndex = 0;\n" +
                "                }\n" +
                "                \n" +
                "                const currentHeading = headings[currentHeadingIndex];\n" +
                "                document.querySelectorAll('.toc-item.active').forEach(el => el.classList.remove('active'));\n" +
                "                if (currentHeading && currentHeading.item) {\n" +
                "                    currentHeading.item.classList.add('active');\n" +
                "                    \n" +
                "                    // 更新面包屑/路径层级结构\n" +
                "                    const breadcrumbEl = document.getElementById('breadcrumb-path');\n" +
                "                    if (breadcrumbEl) {\n" +
                "                        const fullPath = breadcrumbEl.getAttribute('title');\n" +
                "                        const hierarchy = [];\n" +
                "                        const currentLevel = parseInt(currentHeading.item.className.match(/toc-level-(\\d+)/)[1]);\n" +
                "                        \n" +
                "                        // 查找当前标题及其上层标题\n" +
                "                        let tempIndex = currentHeadingIndex;\n" +
                "                        let lastLevel = currentLevel + 1;\n" +
                "                        \n" +
                "                        // 只需要 1, 2, 3 级标题\n" +
                "                        const targetLevels = [1, 2, 3];\n" +
                "                        const levelTitles = { 1: '', 2: '', 3: '' };\n" +
                "                        \n" +
                "                        for (let i = currentHeadingIndex; i >= 0; i--) {\n" +
                "                            const h = headings[i];\n" +
                "                            const level = parseInt(h.item.className.match(/toc-level-(\\d+)/)[1]);\n" +
                "                            if (targetLevels.includes(level) && !levelTitles[level]) {\n" +
                "                                levelTitles[level] = h.item.textContent;\n" +
                "                            }\n" +
                "                        }\n" +
                "                        \n" +
                "                        let breadcrumbHtml = fullPath;\n" +
                "                        if (levelTitles[1]) breadcrumbHtml += ' <span class=\"breadcrumb-separator\">#</span><span class=\"breadcrumb-title\">' + levelTitles[1] + '</span>';\n" +
                "                        if (levelTitles[2]) breadcrumbHtml += ' <span class=\"breadcrumb-separator\">##</span><span class=\"breadcrumb-title\">' + levelTitles[2] + '</span>';\n" +
                "                        if (levelTitles[3]) breadcrumbHtml += ' <span class=\"breadcrumb-separator\">###</span><span class=\"breadcrumb-title\">' + levelTitles[3] + '</span>';\n" +
                "                        \n" +
                "                        breadcrumbEl.innerHTML = breadcrumbHtml;\n" +
                "                    }\n" +
                "                }\n" +
                "            }\n" +
                "            \n" +
                "            contentArea.addEventListener('scroll', function() {\n" +
                "                clearTimeout(window.tocScrollTimeout);\n" +
                "                window.tocScrollTimeout = setTimeout(updateActiveHeading, 100);\n" +
                "            });\n" +
                "            \n" +
                "            updateActiveHeading();\n" +
                "        }\n" +
                "        \n" +
                "        function getTabs() {\n" +
                "            return JSON.parse(localStorage.getItem(TABS_KEY) || '[]');\n" +
                "        }\n" +
                "        \n" +
                "        function saveTabs(tabs) {\n" +
                "            localStorage.setItem(TABS_KEY, JSON.stringify(tabs));\n" +
                "        }\n" +
                "        \n" +
                "        let targetTabPath = null;\n" +
                "        \n" +
                "        function renderTabs() {\n" +
                "            const tabs = getTabs();\n" +
                "            const container = document.querySelector('.tabs-bar');\n" +
                "            if (!container) return;\n" +
                "            container.innerHTML = '';\n" +
                "            \n" +
                "            const pathEl = document.getElementById('breadcrumb-path');\n" +
                "            const currentPath = pathEl ? pathEl.getAttribute('title') : '';\n" +
                "            \n" +
                "            tabs.forEach(path => {\n" +
                "                const name = path.split(/[\\\\/]/).pop();\n" +
                "                const div = document.createElement('div');\n" +
                "                div.className = 'tab' + (path === currentPath ? ' active' : '');\n" +
                "                div.onclick = () => {\n" +
                "                    if (path !== currentPath) window.location.href = '/md-view?path=' + encodeURIComponent(path);\n" +
                "                };\n" +
                "                \n" +
                "                div.addEventListener('contextmenu', (e) => {\n" +
                "                    e.preventDefault();\n" +
                "                    targetTabPath = path;\n" +
                "                    const contextMenu = document.getElementById('tab-context-menu');\n" +
                "                    contextMenu.style.display = 'block';\n" +
                "                    contextMenu.style.left = e.pageX + 'px';\n" +
                "                    contextMenu.style.top = e.pageY + 'px';\n" +
                "                });\n" +
                "                \n" +
                "                const span = document.createElement('div');\n" +
                "                span.className = 'tab-title';\n" +
                "                span.textContent = name;\n" +
                "                span.title = path;\n" +
                "                div.appendChild(span);\n" +
                "                \n" +
                "                const close = document.createElement('div');\n" +
                "                close.className = 'tab-close';\n" +
                "                close.textContent = '×';\n" +
                "                close.onclick = (e) => {\n" +
                "                    e.stopPropagation();\n" +
                "                    closeTab(path);\n" +
                "                };\n" +
                "                div.appendChild(close);\n" +
                "                \n" +
                "                container.appendChild(div);\n" +
                "            });\n" +
                "        }\n" +
                "        \n" +
                "        function closeAllTabs() {\n" +
                "            saveTabs([]);\n" +
                "            window.location.href = '/md-list';\n" +
                "        }\n" +
                "        \n" +
                "        function downloadFile() {\n" +
                "            const pathEl = document.getElementById('breadcrumb-path');\n" +
                "            const currentPath = pathEl ? pathEl.getAttribute('title') : '';\n" +
                "            if (currentPath) {\n" +
                "                window.location.href = '/md-download?path=' + encodeURIComponent(currentPath);\n" +
                "            }\n" +
                "        }\n" +
                "        \n" +
                "        async function toggleView(mode) {\n" +
                "            const previewBtn = document.getElementById('btn-preview');\n" +
                "            const rawBtn = document.getElementById('btn-raw');\n" +
                "            const markdownBody = document.getElementById('markdown-body');\n" +
                "            const rawBody = document.getElementById('raw-body');\n" +
                "            \n" +
                "            if (mode === 'preview') {\n" +
                "                previewBtn.classList.add('active');\n" +
                "                rawBtn.classList.remove('active');\n" +
                "                markdownBody.style.display = 'block';\n" +
                "                rawBody.style.display = 'none';\n" +
                "            } else {\n" +
                "                previewBtn.classList.remove('active');\n" +
                "                rawBtn.classList.add('active');\n" +
                "                markdownBody.style.display = 'none';\n" +
                "                rawBody.style.display = 'block';\n" +
                "                \n" +
                "                if (!rawBody.textContent) {\n" +
                "                    const pathEl = document.getElementById('breadcrumb-path');\n" +
                "                    const currentPath = pathEl ? pathEl.getAttribute('title') : '';\n" +
                "                    if (currentPath) {\n" +
                "                        try {\n" +
                "                            const response = await fetch('/md-content?path=' + encodeURIComponent(currentPath));\n" +
                "                            if (response.ok) {\n" +
                "                                rawBody.textContent = await response.text();\n" +
                "                            } else {\n" +
                "                                rawBody.textContent = '无法加载内容';\n" +
                "                            }\n" +
                "                        } catch (e) {\n" +
                "                            rawBody.textContent = '加载失败: ' + e.message;\n" +
                "                        }\n" +
                "                    }\n" +
                "                }\n" +
                "            }\n" +
                "        }\n" +
                "        \n" +
                "        document.addEventListener('click', () => {\n" +
                "            const contextMenu = document.getElementById('tab-context-menu');\n" +
                "            if (contextMenu) contextMenu.style.display = 'none';\n" +
                "        });\n" +
                "        \n" +
                "        document.addEventListener('keydown', (e) => {\n" +
                "            if ((e.ctrlKey || e.metaKey) && e.key === 'w') {\n" +
                "                e.preventDefault();\n" +
                "                const pathEl = document.getElementById('breadcrumb-path');\n" +
                "                const currentPath = pathEl ? pathEl.getAttribute('title') : '';\n" +
                "                if (currentPath) closeTab(currentPath);\n" +
                "            }\n" +
                "        });\n" +
                "        \n" +
                "        function addTab(path) {\n" +
                "            let tabs = getTabs();\n" +
                "            if (!tabs.includes(path)) {\n" +
                "                tabs.push(path);\n" +
                "                saveTabs(tabs);\n" +
                "            }\n" +
                "        }\n" +
                "        \n" +
                "        // Init context menu\n" +
                "        const closeCurrentBtn = document.getElementById('menu-close-current');\n" +
                "        if (closeCurrentBtn) {\n" +
                "            closeCurrentBtn.onclick = () => {\n" +
                "                if (targetTabPath) closeTab(targetTabPath);\n" +
                "            };\n" +
                "        }\n" +
                "        const closeAllBtn = document.getElementById('menu-close-all');\n" +
                "        if (closeAllBtn) {\n" +
                "            closeAllBtn.onclick = () => {\n" +
                "                closeAllTabs();\n" +
                "            };\n" +
                "        }\n" +
                "        \n" +
                "        function closeTab(path) {\n" +
                "            let tabs = getTabs();\n" +
                "            const index = tabs.indexOf(path);\n" +
                "            if (index > -1) {\n" +
                "                tabs.splice(index, 1);\n" +
                "                saveTabs(tabs);\n" +
                "                \n" +
                "                const pathEl = document.getElementById('breadcrumb-path');\n" +
                "                const currentPath = pathEl ? pathEl.getAttribute('title') : '';\n" +
                "                \n" +
                "                if (path === currentPath) {\n" +
                "                    if (tabs.length > 0) {\n" +
                "                        const nextPath = tabs[Math.min(index, tabs.length - 1)];\n" +
                "                        window.location.href = '/md-view?path=' + encodeURIComponent(nextPath);\n" +
                "                    } else {\n" +
                "                        window.location.href = '/md-list';\n" +
                "                    }\n" +
                "                } else {\n" +
                "                    renderTabs();\n" +
                "                }\n" +
                "            }\n" +
                "        }\n" +
                "\n" +
                "        document.addEventListener('DOMContentLoaded', function() {\n" +
                "            if (window.hljs) hljs.highlightAll();\n" +
                "            // Init tabs\n" +
                "            const pathEl = document.getElementById('breadcrumb-path');\n" +
                "            const currentPath = pathEl ? pathEl.getAttribute('title') : '';\n" +
                "            if (currentPath) {\n" +
                "                addTab(currentPath);\n" +
                "                renderTabs();\n" +
                "            }\n" +
                "            // Init TOC\n" +
                "            initToc();\n" +
                "            initTocScrollSpy();\n" +
                "            // Init Search\n" +
                "            initLocalSearch();\n" +
                "            // 处理请求参数 - 添加调用按钮和可编辑表格\n" +
                "            initRequestParams();\n" +
                "\n" +
                "            const searchInput = document.getElementById('search-input');\n" +
                "            if (searchInput) {\n" +
                "                searchInput.addEventListener('input', function(e) {\n" +
                "                    const term = e.target.value.toLowerCase();\n" +
                "                    const allFiles = document.querySelectorAll('.tree-file');\n" +
                "                    const allFolders = document.querySelectorAll('.tree-folder');\n" +
                "                    const allChildren = document.querySelectorAll('.tree-children');\n" +
                "                    if (!term) {\n" +
                "                        allFiles.forEach(el => el.style.display = '');\n" +
                "                        allFolders.forEach(el => el.style.display = '');\n" +
                "                        allChildren.forEach(el => el.style.display = '');\n" +
                "                        return;\n" +
                "                    }\n" +
                "                    allFiles.forEach(el => el.style.display = 'none');\n" +
                "                    allFolders.forEach(el => el.style.display = 'none');\n" +
                "                    allChildren.forEach(el => el.style.display = 'none');\n" +
                "                    allFiles.forEach(file => {\n" +
                "                        if (file.textContent.toLowerCase().includes(term)) {\n" +
                "                            file.style.display = '';\n" +
                "                            let parent = file.parentElement;\n" +
                "                            while(parent) {\n" +
                "                                if (parent.classList.contains('tree-children')) {\n" +
                "                                    parent.classList.add('expanded');\n" +
                "                                    parent.style.display = 'block';\n" +
                "                                    if (parent.previousElementSibling) {\n" +
                "                                        parent.previousElementSibling.style.display = '';\n" +
                "                                        const toggle = parent.previousElementSibling.querySelector('.tree-toggle');\n" +
                "                                        if (toggle) toggle.classList.add('expanded');\n" +
                "                                    }\n" +
                "                                }\n" +
                "                                parent = parent.parentElement;\n" +
                "                                if (!parent || !parent.closest('.file-list')) break;\n" +
                "                            }\n" +
                "                        }\n" +
                "                    });\n" +
                "                });\n" +
                "            }\n" +
                "            const expandedPaths = JSON.parse(localStorage.getItem('md-preview-expanded-paths') || '[]');\n" +
                "            expandedPaths.forEach(path => {\n" +
                "                const folder = document.querySelector(`.tree-folder[data-path=\"${CSS.escape(path)}\"]`);\n" +
                "                const children = document.querySelector(`.tree-children[data-path=\"${CSS.escape(path)}\"]`);\n" +
                "                if (folder && children) {\n" +
                "                    children.classList.add('expanded');\n" +
                "                    const toggle = folder.querySelector('.tree-toggle');\n" +
                "                    if (toggle) toggle.classList.add('expanded');\n" +
                "                }\n" +
                "            });\n" +
                "            const fileList = document.querySelector('.file-list');\n" +
                "            if (fileList) {\n" +
                "                const savedScroll = localStorage.getItem('md-preview-sidebar-scroll');\n" +
                "                if (savedScroll) {\n" +
                "                    fileList.scrollTop = parseInt(savedScroll, 10);\n" +
                "                }\n" +
                "                fileList.addEventListener('scroll', () => {\n" +
                "                    localStorage.setItem('md-preview-sidebar-scroll', fileList.scrollTop);\n" +
                "                });\n" +
                "            }\n" +
                "            const activeItem = document.querySelector('.tree-file.active');\n" +
                "            if (activeItem) {\n" +
                "                const locateBtn = document.getElementById('locate-btn');\n" +
                "                if (locateBtn) {\n" +
                "                    locateBtn.addEventListener('click', function() {\n" +
                "                        const searchInput = document.getElementById('search-input');\n" +
                "                        if (searchInput && searchInput.value) {\n" +
                "                            searchInput.value = '';\n" +
                "                            searchInput.dispatchEvent(new Event('input'));\n" +
                "                        }\n" +
                "                        activeItem.scrollIntoView({ block: 'center', behavior: 'smooth' });\n" +
                "                        let parent = activeItem.parentElement;\n" +
                "                        while (parent) {\n" +
                "                            if (parent.classList && parent.classList.contains('tree-children')) {\n" +
                "                                parent.classList.add('expanded');\n" +
                "                                parent.style.display = '';\n" +
                "                                if (parent.previousElementSibling) {\n" +
                "                                    parent.previousElementSibling.style.display = '';\n" +
                "                                    const toggle = parent.previousElementSibling.querySelector('.tree-toggle');\n" +
                "                                    if (toggle) toggle.classList.add('expanded');\n" +
                "                                }\n" +
                "                            }\n" +
                "                            parent = parent.parentElement;\n" +
                "                            if (!parent || !parent.closest('.file-list')) break;\n" +
                "                        }\n" +
                "                    });\n" +
                "                }\n" +
                "                let parent = activeItem.parentElement;\n" +
                "                while (parent) {\n" +
                "                    if (parent.classList && parent.classList.contains('tree-children')) {\n" +
                "                        parent.classList.add('expanded');\n" +
                "                        const path = parent.getAttribute('data-path');\n" +
                "                        if (path && !expandedPaths.includes(path)) expandedPaths.push(path);\n" +
                "                        const toggle = parent.previousElementSibling.querySelector('.tree-toggle');\n" +
                "                        if (toggle) toggle.classList.add('expanded');\n" +
                "                    }\n" +
                "                    parent = parent.parentElement;\n" +
                "                }\n" +
                "                localStorage.setItem('md-preview-expanded-paths', JSON.stringify(expandedPaths));\n" +
                "            }\n" +
                "            document.querySelectorAll('.tree-folder').forEach(folder => {\n" +
                "                folder.addEventListener('click', function(e) {\n" +
                "                    e.preventDefault();\n" +
                "                    const toggle = this.querySelector('.tree-toggle');\n" +
                "                    const children = this.nextElementSibling;\n" +
                "                    const path = this.getAttribute('data-path');\n" +
                "                    if (children && children.classList.contains('tree-children')) {\n" +
                "                        const isExpanded = children.classList.toggle('expanded');\n" +
                "                        toggle.classList.toggle('expanded');\n" +
                "                        const currentPaths = JSON.parse(localStorage.getItem('md-preview-expanded-paths') || '[]');\n" +
                "                        if (isExpanded) {\n" +
                "                            if (!currentPaths.includes(path)) currentPaths.push(path);\n" +
                "                        } else {\n" +
                "                            const index = currentPaths.indexOf(path);\n" +
                "                            if (index > -1) currentPaths.splice(index, 1);\n" +
                "                        }\n" +
                "                        localStorage.setItem('md-preview-expanded-paths', JSON.stringify(currentPaths));\n" +
                "                    }\n" +
                "                });\n" +
                "            });\n" +
                "        });\n" +
                "    </script>\n" +
                "</body>\n" +
                "</html>";
    }

    private String convertMarkdownToHtml(String md) {
        md = handleFrontMatter(md);
        
        StringBuilder html = new StringBuilder();
        String[] lines = md.split("\n");
        
        boolean inCodeBlock = false;
        boolean inList = false;
        boolean inOrderedList = false;
        boolean inBlockquote = false;
        StringBuilder blockquoteContent = new StringBuilder();
        
        List<String[]> tableBuffer = new ArrayList<>();
        String[] tableAlign = null;
        boolean inTable = false;
        
        Pattern codeBlockPattern = Pattern.compile("^\\s*```\\s*(.*?)\\s*$");
        Pattern unorderedListPattern = Pattern.compile("^(\\s*)([-*+])\\s+(.*)$");
        Pattern orderedListPattern = Pattern.compile("^(\\s*)(\\d+)\\.\\s+(.*)$");
        Pattern taskListPattern = Pattern.compile("^(\\s*)([-*+])\\s+\\[([ xX])\\]\\s+(.*)$");
        Pattern hrPattern = Pattern.compile("^\\s*([-*_]){3,}$");
        Pattern headingPattern = Pattern.compile("^\\s*(#{1,6})\\s+(.+?)\\s*$");
        Pattern blockquotePattern = Pattern.compile("^>\\s*(.*)$");
        
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i];
            
            if (line.startsWith("<table>")) {
                html.append(line).append("\n");
                continue;
            }
            
            Matcher codeBlockMatcher = codeBlockPattern.matcher(line);
            if (codeBlockMatcher.matches()) {
                if (inTable) {
                    html.append(renderTable(tableBuffer, tableAlign));
                    tableBuffer.clear();
                    inTable = false;
                }
                if (!inCodeBlock) {
                    if (inList) { html.append(inOrderedList ? "</ol>\n" : "</ul>\n"); inList = false; inOrderedList = false; }
                    if (inBlockquote) { html.append(processBlockquote(blockquoteContent.toString())); blockquoteContent.setLength(0); inBlockquote = false; }
                    String lang = codeBlockMatcher.group(1);
                    if (lang != null && !lang.isEmpty()) {
                        html.append("<pre><code class=\"language-").append(lang).append("\">");
                    } else {
                        html.append("<pre><code>");
                    }
                    inCodeBlock = true;
                } else {
                    html.append("</code></pre>\n");
                    inCodeBlock = false;
                }
                continue;
            }
            
            if (inCodeBlock) {
                html.append(escapeHtml(line)).append("\n");
                continue;
            }
            
            boolean isTableAlignRow = isTableAlignmentLine(line);
            
            if (isTableRow(line) && !isTableAlignRow) {
                if (!inTable) {
                    inTable = true;
                    tableBuffer.clear();
                }
                String[] cells = line.split("\\|");
                List<String> cellList = new ArrayList<>();
                for (String cell : cells) {
                    String trimmed = cell.trim();
                    if (!trimmed.isEmpty() || cellList.size() > 0) {
                        cellList.add(trimmed);
                    }
                }
                if (!cellList.isEmpty()) {
                    tableBuffer.add(cellList.toArray(new String[0]));
                }
                continue;
            }
            
            if (isTableAlignRow && inTable) {
                String[] parts = line.split("\\|");
                tableAlign = new String[parts.length];
                for (int j = 0; j < parts.length; j++) {
                    String trimmed = parts[j].trim();
                    if (trimmed.startsWith(":") && trimmed.endsWith(":")) {
                        tableAlign[j] = "center";
                    } else if (trimmed.endsWith(":")) {
                        tableAlign[j] = "right";
                    } else if (trimmed.startsWith(":")) {
                        tableAlign[j] = "left";
                    } else {
                        tableAlign[j] = "left";
                    }
                }
                continue;
            }
            
            if (!line.startsWith("|") && inTable) {
                html.append(renderTable(tableBuffer, tableAlign));
                tableBuffer.clear();
                inTable = false;
            }
            
            Matcher hrMatcher = hrPattern.matcher(line.trim());
            if (hrMatcher.matches() && line.trim().length() >= 3) {
                if (inList) { html.append(inOrderedList ? "</ol>\n" : "</ul>\n"); inList = false; inOrderedList = false; }
                if (inBlockquote) { html.append(processBlockquote(blockquoteContent.toString())); blockquoteContent.setLength(0); inBlockquote = false; }
                html.append("<hr>\n");
                continue;
            }
            
            Matcher blockquoteMatcher = blockquotePattern.matcher(line);
            if (blockquoteMatcher.matches()) {
                if (!inBlockquote) {
                    if (inList) { html.append(inOrderedList ? "</ol>\n" : "</ul>\n"); inList = false; inOrderedList = false; }
                    inBlockquote = true;
                }
                blockquoteContent.append(blockquoteMatcher.group(1)).append("\n");
                continue;
            } else if (inBlockquote && !line.trim().isEmpty()) {
                html.append(processBlockquote(blockquoteContent.toString()));
                blockquoteContent.setLength(0);
                inBlockquote = false;
            }
            
            Matcher taskMatcher = taskListPattern.matcher(line);
            if (taskMatcher.matches()) {
                if (!inList || inOrderedList) { 
                    if (inList) html.append(inOrderedList ? "</ol>\n" : "</ul>\n"); 
                    html.append("<ul>\n"); 
                    inList = true; 
                    inOrderedList = false; 
                }
                String checked = taskMatcher.group(3).equals("x") || taskMatcher.group(3).equals("X") ? "checked" : "";
                html.append("<li class=\"task-list-item\"><input type=\"checkbox\" ").append(checked).append(" disabled>")
                   .append(processInlineInList(taskMatcher.group(4))).append("</li>\n");
                continue;
            }
            
            Matcher unorderedMatcher = unorderedListPattern.matcher(line);
            if (unorderedMatcher.matches()) {
                if (!inList || inOrderedList) { 
                    if (inList) html.append(inOrderedList ? "</ol>\n" : "</ul>\n"); 
                    html.append("<ul>\n"); 
                    inList = true; 
                    inOrderedList = false; 
                }
                html.append("<li>").append(processInlineInList(unorderedMatcher.group(3))).append("</li>\n");
                continue;
            }
            
            Matcher orderedMatcher = orderedListPattern.matcher(line);
            if (orderedMatcher.matches()) {
                if (!inList || !inOrderedList) { 
                    if (inList) html.append(inOrderedList ? "</ol>\n" : "</ul>\n"); 
                    html.append("<ol>\n"); 
                    inList = true; 
                    inOrderedList = true; 
                }
                html.append("<li>").append(processInlineInList(orderedMatcher.group(3))).append("</li>\n");
                continue;
            }
            
            Matcher headingMatcher = headingPattern.matcher(line);
            if (headingMatcher.matches()) {
                if (inList) { html.append(inOrderedList ? "</ol>\n" : "</ul>\n"); inList = false; inOrderedList = false; }
                if (inBlockquote) { html.append(processBlockquote(blockquoteContent.toString())); blockquoteContent.setLength(0); inBlockquote = false; }
                if (inTable) { html.append(renderTable(tableBuffer, tableAlign)); tableBuffer.clear(); inTable = false; }
                int level = headingMatcher.group(1).length();
                String headingText = headingMatcher.group(2);
                String anchorId = generateAnchorId(headingText);
                html.append("<h").append(level).append(" id=\"").append(anchorId).append("\">")
                    .append(processInline(headingText))
                    .append("</h").append(level).append(">\n");
                continue;
            }
            
            if (line.trim().isEmpty()) {
                if (inList) { html.append(inOrderedList ? "</ol>\n" : "</ul>\n"); inList = false; inOrderedList = false; }
                if (inBlockquote) { html.append(processBlockquote(blockquoteContent.toString())); blockquoteContent.setLength(0); inBlockquote = false; }
                if (inTable) { html.append(renderTable(tableBuffer, tableAlign)); tableBuffer.clear(); inTable = false; }
                html.append("<br>\n");
            } else {
                if (inList) { html.append(inOrderedList ? "</ol>\n" : "</ul>\n"); inList = false; inOrderedList = false; }
                if (inBlockquote) { html.append(processBlockquote(blockquoteContent.toString())); blockquoteContent.setLength(0); inBlockquote = false; }
                if (inTable) { html.append(renderTable(tableBuffer, tableAlign)); tableBuffer.clear(); inTable = false; }
                html.append("<p>").append(processInline(line)).append("</p>\n");
            }
        }
        
        if (inTable && !tableBuffer.isEmpty()) {
            html.append(renderTable(tableBuffer, tableAlign));
        }
        if (inList) html.append(inOrderedList ? "</ol>\n" : "</ul>\n");
        if (inBlockquote) html.append(processBlockquote(blockquoteContent.toString()));
        
        return html.toString();
    }
    
    private boolean isTableRow(String line) {
        String trimmed = line.trim();
        if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
            return false;
        }
        String content = trimmed.substring(1, trimmed.length() - 1);
        return content.contains("|") || !content.trim().isEmpty();
    }
    
    private boolean isTableAlignmentLine(String line) {
        String trimmed = line.trim();
        if (!trimmed.startsWith("|")) {
            return false;
        }
        String[] parts = trimmed.split("\\|");
        for (String part : parts) {
            String content = part.trim();
            if (content.isEmpty()) continue;
            if (!content.matches("[:\\-]+")) {
                return false;
            }
        }
        return true;
    }

    private String renderTable(List<String[]> rows, String[] align) {
        if (rows.isEmpty()) return "";
        
        StringBuilder sb = new StringBuilder("<table>\n");
        
        if (rows.size() > 0) {
            sb.append("<thead>\n<tr>");
            String[] header = rows.get(0);
            for (int i = 0; i < header.length; i++) {
                String cellAlign = (align != null && i < align.length) ? align[i] : "left";
                sb.append("<th align=\"").append(cellAlign).append("\">").append(processInline(header[i])).append("</th>");
            }
            sb.append("</tr>\n</thead>\n");
        }
        
        if (rows.size() > 1) {
            sb.append("<tbody>\n");
            for (int i = 1; i < rows.size(); i++) {
                sb.append("<tr>");
                String[] row = rows.get(i);
                for (int j = 0; j < row.length; j++) {
                    String cellAlign = (align != null && j < align.length) ? align[j] : "left";
                    sb.append("<td align=\"").append(cellAlign).append("\">").append(processInline(row[j])).append("</td>");
                }
                sb.append("</tr>\n");
            }
            sb.append("</tbody>\n");
        }
        
        sb.append("</table>\n");
        return sb.toString();
    }

    private String handleFrontMatter(String md) {
        if (md.startsWith("---")) {
            int endIndex = md.indexOf("---", 3);
            if (endIndex > 0) {
                String frontMatter = md.substring(3, endIndex).trim();
                String content = md.substring(endIndex + 3);
                StringBuilder fmHtml = new StringBuilder();
                fmHtml.append("<div class=\"front-matter\"><pre><code>");
                fmHtml.append(escapeHtml(frontMatter));
                fmHtml.append("</code></pre></div>\n");
                return fmHtml + content;
            }
        }
        return md;
    }

    private String processBlockquote(String content) {
        if (content == null || content.trim().isEmpty()) return "";
        String[] lines = content.split("\n");
        StringBuilder result = new StringBuilder("<blockquote>\n");
        for (String line : lines) {
            if (!line.trim().isEmpty()) {
                result.append("<p>").append(processInline(line)).append("</p>\n");
            }
        }
        result.append("</blockquote>\n");
        return result.toString();
    }

    private String processInlineInList(String text) {
        text = processBackslashEscapes(text);
        
        text = text.replaceAll("__([^_]+)__", "<strong>$1</strong>");
        text = text.replaceAll("\\*\\*([^*]+)\\*\\*", "<strong>$1</strong>");
        
        text = text.replaceAll("_([^_]+)_", "<em>$1</em>");
        text = text.replaceAll("\\*([^*]+)\\*", "<em>$1</em>");
        
        text = text.replaceAll("`([^`]+)`", "<code>$1</code>");
        
        text = text.replaceAll("!\\[([^\\]]*)\\]\\(([^)]+)\\)", "<img src=\"$2\" alt=\"$1\">");
        text = text.replaceAll("\\[([^\\]]+)\\]\\(([^)]+)\\)", "<a href=\"$2\">$1</a>");
        
        return text;
    }

    private String processInline(String text) {
        text = processBackslashEscapes(text);
        
        text = text.replaceAll("__([^_]+)__", "<strong>$1</strong>");
        text = text.replaceAll("\\*\\*([^*]+)\\*\\*", "<strong>$1</strong>");
        
        text = text.replaceAll("_([^_]+)_", "<em>$1</em>");
        text = text.replaceAll("\\*([^*]+)\\*", "<em>$1</em>");
        
        text = text.replaceAll("`([^`]+)`", "<code>$1</code>");
        
        text = text.replaceAll("!\\[([^\\]]*)\\]\\(([^)]+)\\)", "<img src=\"$2\" alt=\"$1\">");
        text = text.replaceAll("\\[([^\\]]+)\\]\\(([^)]+)\\)", "<a href=\"$2\">$1</a>");
        
        return text;
    }

    private String processBackslashEscapes(String text) {
        text = text.replaceAll("\\\\\\\\", "&#92;");
        text = text.replaceAll("\\\\`", "&#96;");
        text = text.replaceAll("\\\\\\*", "&#42;");
        text = text.replaceAll("\\\\_", "&#95;");
        text = text.replaceAll("\\\\\\{", "&#123;");
        text = text.replaceAll("\\\\\\}", "&#125;");
        text = text.replaceAll("\\\\\\[", "&#91;");
        text = text.replaceAll("\\\\\\]", "&#93;");
        text = text.replaceAll("\\\\\\(", "&#40;");
        text = text.replaceAll("\\\\\\)", "&#41;");
        text = text.replaceAll("\\\\#", "&#35;");
        text = text.replaceAll("\\\\\\+", "&#43;");
        text = text.replaceAll("\\\\-", "&#45;");
        text = text.replaceAll("\\\\\\.", "&#46;");
        text = text.replaceAll("\\\\!", "&#33;");
        text = text.replaceAll("\\\\\\|", "&#124;");
        
        return text;
    }

    private String escapeHtml(String text) {
        return text.replace("&", "&amp;")
                   .replace("<", "&lt;")
                   .replace(">", "&gt;")
                   .replace("\"", "&quot;")
                   .replace("'", "&#39;");
    }

    private String renderError(String message) {
        return "<!DOCTYPE html>\n" +
                "<html>\n" +
                "<head>\n" +
                "    <meta charset=\"UTF-8\">\n" +
                "    <title>Error</title>\n" +
                "    <style>\n" +
                "        body { font-family: sans-serif; background: #1e1e1e; color: #f44747; padding: 40px; }\n" +
                "        .error { background: #2d2d2d; padding: 20px; border-radius: 6px; max-width: 600px; margin: 0 auto; border: 1px solid #f44747; }\n" +
                "    </style>\n" +
                "</head>\n" +
                "<body>\n" +
                "    <div class=\"error\">\n" +
                "        <h1>错误</h1>\n" +
                "        <p>" + message.replace("<", "&lt;").replace(">", "&gt;") + "</p>\n" +
                "    </div>\n" +
                "</body>\n" +
                "</html>";
    }

    private String buildTreeHtml(List<String> files, String currentPath) {
        Map<String, Object> tree = new HashMap<>();
        
        for (String file : files) {
            String[] parts = file.split("/");
            Map<String, Object> current = tree;
            for (int i = 0; i < parts.length; i++) {
                String part = parts[i];
                if (i == parts.length - 1) {
                    current.put(part, file);
                } else {
                    if (!current.containsKey(part)) {
                        Map<String, Object> newDir = new HashMap<>();
                        current.put(part, newDir);
                    }
                    @SuppressWarnings("unchecked")
                    Map<String, Object> next = (Map<String, Object>) current.get(part);
                    current = next;
                }
            }
        }
        
        StringBuilder sb = new StringBuilder();
        sb.append("<div class=\"sidebar-header\">Markdown 文件列表</div>");
        sb.append("<div class=\"search-box\">");
        sb.append("<input type=\"text\" class=\"search-input\" id=\"search-input\" placeholder=\"搜索...\">");
        sb.append("<button class=\"locate-btn\" id=\"locate-btn\" title=\"定位到当前文件\">🎯</button>");
        sb.append("</div>");
        sb.append("<div class=\"file-list\">");
        buildTreeHtmlRecursive(tree, sb, "", currentPath);
        sb.append("</div>");
        
        return sb.toString();
    }

    private void buildTreeHtmlRecursive(Map<String, Object> node, StringBuilder sb, String path, String currentPath) {
        List<String> keys = new ArrayList<>(node.keySet());
        Collections.sort(keys);
        
        for (String key : keys) {
            Object value = node.get(key);
            String currentFilePath = path.isEmpty() ? key : path + "/" + key;
            
            if (value instanceof Map) {
                sb.append("<div class=\"tree-folder\" data-path=\"").append(escapeHtml(currentFilePath)).append("\">");
                sb.append("<span class=\"tree-toggle\">▶</span>");
                sb.append("<span class=\"tree-icon folder-icon\">").append(FOLDER_SVG).append("</span>");
                sb.append(escapeHtml(key));
                sb.append("</div>");
                sb.append("<div class=\"tree-children\" data-path=\"").append(escapeHtml(currentFilePath)).append("\">");
                @SuppressWarnings("unchecked")
                Map<String, Object> dirMap = (Map<String, Object>) value;
                buildTreeHtmlRecursive(dirMap, sb, currentFilePath, currentPath);
                sb.append("</div>");
            } else {
                String filePath = (String) value;
                String activeClass = filePath.replace("\\", "/").equals(currentPath.replace("\\", "/")) ? " active" : "";
                String encodedPath = java.net.URLEncoder.encode(filePath, java.nio.charset.StandardCharsets.UTF_8).replace("+", "%20");
                sb.append("<a href=\"/md-view?path=").append(encodedPath)
                  .append("\" class=\"tree-file").append(activeClass).append("\">");
                sb.append("<span class=\"tree-icon file-icon\">").append(FILE_SVG).append("</span>");
                sb.append(escapeHtml(key))
                  .append("</a>");
            }
        }
    }
}
