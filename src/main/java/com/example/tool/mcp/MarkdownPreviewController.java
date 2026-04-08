package com.example.tool.mcp;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.core.io.ClassPathResource;
import org.springframework.util.StreamUtils;
import org.springframework.util.StringUtils;

import javax.swing.JFileChooser;
import javax.swing.SwingUtilities;
import java.awt.GraphicsEnvironment;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Properties;
import java.util.ArrayList;
import java.util.ArrayDeque;
import java.util.LinkedHashMap;
import java.util.Collections;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
public class MarkdownPreviewController {

    private static final Logger logger = LoggerFactory.getLogger(MarkdownPreviewController.class);
    private static final Pattern CHANGE_MARKER_PATTERN = Pattern.compile("^(.*?)(\\s+/change)\\s*$");
    private static final Pattern HEADING_PATTERN = Pattern.compile("^\\s*(#{1,6})\\s+(.+?)\\s*$");
    private static final Pattern API_NAME_PATTERN = Pattern.compile("^\\s*-\\s*\\*\\*接口名称\\*\\*\\s*:\\s*`?(.+?)`?\\s*$");
    private static final Pattern API_PATH_PATTERN = Pattern.compile("^\\s*-\\s*\\*\\*接口路径\\*\\*\\s*:\\s*`?(.+?)`?\\s*$");
    private static final Pattern API_METHOD_PATTERN = Pattern.compile("^\\s*-\\s*\\*\\*请求方式\\*\\*\\s*:\\s*`?([A-Za-z]+)`?\\s*$");
    private static final Pattern PATH_PARAM_PLACEHOLDER_PATTERN = Pattern.compile("\\{([^{}]+)\\}");
    private static final Pattern CODE_FENCE_PATTERN = Pattern.compile("^\\s*```\\s*(.*?)\\s*$");
    private static final String WORKSPACE_CONFIG_KEY = "markdown.workspace.path";
    
    private static final String FOLDER_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"currentColor\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z\" fill=\"none\"></path></svg>";
    private static final String FILE_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z\"></path><polyline points=\"13 2 13 9 20 9\"></polyline></svg>";

    @Value("${markdown.base-path:D:\\adas\\项目}")
    private String basePath;

    private Path getWorkspaceConfigFile() {
        return Paths.get(System.getProperty("user.home"), ".tool-service", "markdown-preview.properties");
    }

    private Path getDesktopPath() {
        return Paths.get(System.getProperty("user.home"), "Desktop").toAbsolutePath().normalize();
    }

    private Properties loadWorkspaceProperties() {
        Properties properties = new Properties();
        Path configFile = getWorkspaceConfigFile();
        if (!Files.exists(configFile)) {
            return properties;
        }
        try (InputStream inputStream = Files.newInputStream(configFile)) {
            properties.load(inputStream);
        } catch (IOException e) {
            logger.warn("读取工作目录配置失败: {}", configFile, e);
        }
        return properties;
    }

    private void saveWorkspacePath(String workspacePath) throws IOException {
        Path configFile = getWorkspaceConfigFile();
        Files.createDirectories(configFile.getParent());
        Properties properties = loadWorkspaceProperties();
        properties.setProperty(WORKSPACE_CONFIG_KEY, workspacePath);
        try (OutputStream outputStream = Files.newOutputStream(configFile)) {
            properties.store(outputStream, "Markdown preview workspace config");
        }
    }

    private String readConfiguredWorkspacePath() {
        String configured = loadWorkspaceProperties().getProperty(WORKSPACE_CONFIG_KEY, "");
        if (StringUtils.hasText(configured)) {
            return configured.trim();
        }
        return StringUtils.hasText(basePath) ? basePath.trim() : "";
    }

    private Path normalizeAbsoluteDirectory(String rawPath) {
        if (!StringUtils.hasText(rawPath)) {
            return null;
        }
        try {
            Path candidate = Paths.get(rawPath.trim()).toAbsolutePath().normalize();
            if (Files.exists(candidate) && Files.isDirectory(candidate)) {
                return candidate;
            }
        } catch (Exception e) {
            logger.warn("解析工作目录失败: {}", rawPath);
        }
        return null;
    }

    private Map<String, Object> getWorkspaceConfig() {
        String configuredPath = readConfiguredWorkspacePath();
        Path effectivePath = normalizeAbsoluteDirectory(configuredPath);
        boolean fallbackToDesktop = false;
        if (effectivePath == null) {
            effectivePath = getDesktopPath();
            fallbackToDesktop = true;
        }
        Map<String, Object> config = new HashMap<>();
        config.put("configuredPath", configuredPath);
        config.put("effectivePath", effectivePath.toString());
        config.put("exists", normalizeAbsoluteDirectory(configuredPath) != null);
        config.put("fallbackToDesktop", fallbackToDesktop);
        return config;
    }

    private Path getEffectiveWorkspaceBase() {
        Object path = getWorkspaceConfig().get("effectivePath");
        return Paths.get(String.valueOf(path)).toAbsolutePath().normalize();
    }

    private String chooseDirectoryFromSystem() throws Exception {
        if (GraphicsEnvironment.isHeadless()) {
            throw new IllegalStateException("当前运行环境不支持弹出目录选择框");
        }
        final String initialDir = String.valueOf(getWorkspaceConfig().get("effectivePath"));
        final String[] selected = new String[1];
        final Exception[] failure = new Exception[1];
        Runnable chooserTask = () -> {
            try {
                JFileChooser chooser = new JFileChooser(initialDir);
                chooser.setDialogTitle("选择 Markdown 工作目录");
                chooser.setFileSelectionMode(JFileChooser.DIRECTORIES_ONLY);
                chooser.setAcceptAllFileFilterUsed(false);
                int result = chooser.showOpenDialog(null);
                if (result == JFileChooser.APPROVE_OPTION && chooser.getSelectedFile() != null) {
                    selected[0] = chooser.getSelectedFile().getAbsolutePath();
                }
            } catch (Exception e) {
                failure[0] = e;
            }
        };
        if (SwingUtilities.isEventDispatchThread()) {
            chooserTask.run();
        } else {
            SwingUtilities.invokeAndWait(chooserTask);
        }
        if (failure[0] != null) {
            throw failure[0];
        }
        return selected[0];
    }

    private String loadTemplate(String name) {
        try {
            ClassPathResource resource = new ClassPathResource("templates/" + name + ".html");
            return StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            logger.error("加载模板失败: {}", name, e);
            return "Template Error: " + name;
        }
    }

    @GetMapping("/md-view")
    public ResponseEntity<String> viewMarkdown(@RequestParam(required = false) String path) {
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .body(loadTemplate("md-preview"));
    }

    @GetMapping("/api/md/workspace-config")
    public ResponseEntity<Map<String, Object>> getWorkspaceConfigData() {
        return ResponseEntity.ok(getWorkspaceConfig());
    }

    @PostMapping("/api/md/workspace-config")
    public ResponseEntity<Map<String, Object>> saveWorkspaceConfig(@RequestBody Map<String, String> body) {
        try {
            String workspacePath = String.valueOf(body.getOrDefault("path", "")).trim();
            Path directory = normalizeAbsoluteDirectory(workspacePath);
            if (directory == null) {
                return ResponseEntity.badRequest().body(Map.of("success", Boolean.FALSE, "message", "目录不存在或不是有效文件夹"));
            }
            saveWorkspacePath(directory.toString());
            return ResponseEntity.ok(Map.of("success", Boolean.TRUE, "config", getWorkspaceConfig()));
        } catch (Exception e) {
            logger.error("保存工作目录失败", e);
            return ResponseEntity.internalServerError().body(Map.of("success", Boolean.FALSE, "message", e.getMessage()));
        }
    }

    @PostMapping("/api/md/workspace-config/pick-directory")
    public ResponseEntity<Map<String, Object>> pickWorkspaceDirectory() {
        try {
            String selected = chooseDirectoryFromSystem();
            if (!StringUtils.hasText(selected)) {
                return ResponseEntity.ok(Map.of("success", Boolean.FALSE, "cancelled", Boolean.TRUE, "config", getWorkspaceConfig()));
            }
            Path directory = normalizeAbsoluteDirectory(selected);
            if (directory == null) {
                return ResponseEntity.badRequest().body(Map.of("success", Boolean.FALSE, "message", "所选目录无效"));
            }
            saveWorkspacePath(directory.toString());
            return ResponseEntity.ok(Map.of("success", Boolean.TRUE, "config", getWorkspaceConfig()));
        } catch (Exception e) {
            logger.error("选择工作目录失败", e);
            return ResponseEntity.internalServerError().body(Map.of("success", Boolean.FALSE, "message", e.getMessage()));
        }
    }

    @GetMapping("/api/md/preview-data")
    public ResponseEntity<Map<String, Object>> getPreviewData(@RequestParam(required = false) String path,
                                                              @RequestParam(required = false, defaultValue = "") String scope) {
        try {
            String decodedPath = normalizeRelativePath(path);
            String normalizedScope = normalizeRelativePath(scope);
            List<String> files = getMdFiles(normalizedScope);
            String htmlContent = "";
            String tocHtml = renderTocHtml(List.of());
            String safeTitle = "Markdown 预览";
            List<Map<String, Object>> apiSections = List.of();

            if (StringUtils.hasText(decodedPath)) {
                Path fullPath = resolveMarkdownPath(decodedPath);
                if (fullPath == null || !Files.exists(fullPath)) {
                    return ResponseEntity.notFound().build();
                }
                String content = Files.readString(fullPath);
                safeTitle = decodedPath.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
                htmlContent = convertMarkdownToHtml(content);
                tocHtml = renderTocHtml(extractTableOfContents(content));
                apiSections = extractApiSections(content);
            }

            String sidebarHtml = buildTreeHtml(files, decodedPath, normalizedScope);

            Map<String, Object> data = new HashMap<>();
            data.put("title", safeTitle);
            data.put("content", htmlContent);
            data.put("sidebar", sidebarHtml);
            data.put("toc", tocHtml);
            data.put("path", decodedPath);
            data.put("scope", normalizedScope);
            data.put("directories", getMdDirectories());
            data.put("apiSections", apiSections);
            data.put("apiSectionsVersion", 1);
            data.put("workspaceConfig", getWorkspaceConfig());

            return ResponseEntity.ok(data);
        } catch (Exception e) {
            logger.error("获取预览数据失败", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/md-download")
    public ResponseEntity<Resource> downloadMarkdown(@RequestParam String path) {
        try {
            String decodedPath = normalizeRelativePath(path);
            Path fullPath = resolveMarkdownPath(decodedPath);

            if (fullPath == null || !Files.exists(fullPath)) {
                return ResponseEntity.notFound().build();
            }
            
            Resource resource = new UrlResource(fullPath.toUri());
            String filename = fullPath.getFileName().toString();
            String encodedFilename = java.net.URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20");
            
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
            String decodedPath = normalizeRelativePath(path);
            Path fullPath = resolveMarkdownPath(decodedPath);

            if (fullPath == null || !Files.exists(fullPath)) {
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
    public List<String> listMdFiles(@RequestParam(required = false, defaultValue = "") String scope) {
        return getMdFiles(normalizeRelativePath(scope));
    }

    @GetMapping("/api/md/directories")
    public List<String> listMdDirectories() {
        return getMdDirectories();
    }

    private List<String> getMdFiles() {
        return getMdFiles("");
    }

    private List<String> getMdFiles(String scope) {
        try {
            Path base = resolveScopePath(scope);
            if (base == null || !Files.exists(base) || !Files.isDirectory(base)) {
                return new ArrayList<>();
            }
            List<String> files = new ArrayList<>();
            listMdFilesRecursive(base, base, files, 10);
            Collections.sort(files);
            return files;
        } catch (Exception e) {
            logger.error("列出文件失败: {}", e.getMessage());
            return List.of("Error: " + e.getMessage());
        }
    }

    @PostMapping("/api/md/save-content")
    public ResponseEntity<Map<String, Object>> saveMarkdownContent(@RequestParam String path,
                                                                   @RequestBody Map<String, String> body) {
        try {
            String decodedPath = normalizeRelativePath(path);
            Path fullPath = resolveMarkdownPath(decodedPath);
            if (fullPath == null || !Files.exists(fullPath)) {
                return ResponseEntity.notFound().build();
            }
            String content = body.getOrDefault("content", "");
            Files.writeString(fullPath, content, StandardCharsets.UTF_8);
            return ResponseEntity.ok(Map.of("success", Boolean.TRUE, "path", decodedPath));
        } catch (Exception e) {
            logger.error("保存 Markdown 失败", e);
            return ResponseEntity.internalServerError().body(Map.of("success", Boolean.FALSE, "message", e.getMessage()));
        }
    }

    private List<String> getMdDirectories() {
        try {
            List<String> files = getMdFiles();
            Set<String> directories = new LinkedHashSet<>();
            directories.add("");
            for (String file : files) {
                int lastSlash = file.lastIndexOf('/');
                if (lastSlash <= 0) {
                    continue;
                }
                String current = file.substring(0, lastSlash);
                while (current != null && !current.isEmpty()) {
                    directories.add(current);
                    int slashIndex = current.lastIndexOf('/');
                    current = slashIndex > -1 ? current.substring(0, slashIndex) : "";
                }
            }
            List<String> values = new ArrayList<>(directories);
            values.sort(String::compareToIgnoreCase);
            values.remove("");
            values.add(0, "");
            return values;
        } catch (Exception e) {
            logger.error("鍒楀嚭鐩綍澶辫触: {}", e.getMessage());
            return List.of("");
        }
    }

    private String normalizeRelativePath(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String normalized = value.replace("\\", "/").replaceAll("/+", "/").trim();
        while (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        if (normalized.contains("..")) {
            return "";
        }
        return normalized;
    }

    private Path resolveScopePath(String scope) {
        try {
            Path base = getEffectiveWorkspaceBase();
            if (scope == null || scope.isBlank()) {
                return base;
            }
            Path resolved = base.resolve(scope.replace("/", "\\")).normalize();
            if (!resolved.startsWith(base)) {
                return null;
            }
            return resolved;
        } catch (Exception e) {
            logger.warn("Scope 瑙ｆ瀽澶辫触: {}", scope);
            return null;
        }
    }

    private Path resolveMarkdownPath(String relativePath) {
        return resolveScopePath(relativePath);
    }

    private List<Map<String, Object>> extractApiSections(String md) {
        List<Map<String, Object>> sections = new ArrayList<>();
        if (md == null || md.isBlank()) {
            return sections;
        }

        String[] lines = md.split("\\r?\\n", -1);
        Map<String, Integer> anchorCounts = new HashMap<>();
        String currentH3Text = "";
        String currentH3Id = "";
        String currentApiName = "";
        String currentApiPath = "";
        String currentApiMethod = "";

        for (int i = 0; i < lines.length; i++) {
            String line = stripChangeMarker(lines[i]);

            Matcher nameMatcher = API_NAME_PATTERN.matcher(line);
            if (nameMatcher.matches()) {
                currentApiName = nameMatcher.group(1).trim();
            }

            Matcher pathMatcher = API_PATH_PATTERN.matcher(line);
            if (pathMatcher.matches()) {
                currentApiPath = normalizeApiPath(pathMatcher.group(1).trim());
            }

            Matcher methodMatcher = API_METHOD_PATTERN.matcher(line);
            if (methodMatcher.matches()) {
                currentApiMethod = methodMatcher.group(1).trim().toUpperCase();
            }

            Matcher headingMatcher = HEADING_PATTERN.matcher(line);
            if (!headingMatcher.matches()) {
                continue;
            }

            int level = headingMatcher.group(1).length();
            String headingText = stripChangeMarker(headingMatcher.group(2)).trim();
            String headingId = generateUniqueAnchorId(headingText, anchorCounts);

            if (level <= 2) {
                currentH3Text = "";
                currentH3Id = "";
                currentApiName = "";
                currentApiPath = "";
                currentApiMethod = "";
                continue;
            }

            if (level == 3) {
                currentH3Text = headingText;
                currentH3Id = headingId;
                currentApiName = "";
                currentApiPath = "";
                currentApiMethod = "";
                continue;
            }

            if (level != 4) {
                continue;
            }

            String sectionType = null;
            if ("请求参数".equals(headingText)) {
                sectionType = "requestParams";
            } else if ("请求体".equals(headingText)) {
                sectionType = "requestBody";
            }
            if (sectionType == null) {
                continue;
            }

            SectionParseResult parsed = parseSectionBlock(lines, i + 1);
            List<Map<String, Object>> params = parseTableParams(parsed.tableRows);

            Map<String, Object> section = new LinkedHashMap<>();
            section.put("sectionType", sectionType);
            section.put("headingText", headingText);
            section.put("headingId", headingId);
            section.put("interfaceTitle", !currentApiName.isBlank() ? currentApiName : currentH3Text);
            section.put("interfaceHeadingText", currentH3Text);
            section.put("interfaceHeadingId", currentH3Id);
            section.put("path", currentApiPath);
            section.put("method", currentApiMethod);
            section.put("pathParams", extractPathParams(currentApiPath, params));
            section.put("params", params);
            section.put("bodyExample", "requestBody".equals(sectionType) ? parsed.jsonExample : "");
            section.put("sourceLine", i + 1);
            sections.add(section);
        }
        return sections;
    }

    private String normalizeApiPath(String path) {
        if (path == null || path.isBlank()) {
            return "";
        }
        String value = path.trim();
        if (!value.startsWith("/")) {
            value = "/" + value;
        }
        return value.replaceAll("/+", "/");
    }

    private List<Map<String, Object>> extractPathParams(String apiPath, List<Map<String, Object>> params) {
        List<Map<String, Object>> values = new ArrayList<>();
        if (apiPath == null || apiPath.isBlank()) {
            return values;
        }

        Map<String, Map<String, Object>> paramsByName = new HashMap<>();
        for (Map<String, Object> row : params) {
            Object name = row.get("name");
            if (name != null) {
                paramsByName.put(String.valueOf(name), row);
            }
        }

        Matcher matcher = PATH_PARAM_PLACEHOLDER_PATTERN.matcher(apiPath);
        while (matcher.find()) {
            String key = matcher.group(1).trim();
            Map<String, Object> detail = paramsByName.getOrDefault(key, new LinkedHashMap<>());
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("name", key);
            item.put("type", String.valueOf(detail.getOrDefault("type", "string")));
            item.put("required", detail.getOrDefault("required", "是"));
            item.put("description", String.valueOf(detail.getOrDefault("description", "")));
            values.add(item);
        }
        return values;
    }

    private SectionParseResult parseSectionBlock(String[] lines, int startIndex) {
        SectionParseResult result = new SectionParseResult();
        List<String[]> tableRows = new ArrayList<>();
        boolean inCodeBlock = false;
        String codeLang = "";
        StringBuilder codeBuffer = new StringBuilder();

        for (int i = startIndex; i < lines.length; i++) {
            String line = stripChangeMarker(lines[i]);
            Matcher headingMatcher = HEADING_PATTERN.matcher(line);
            if (headingMatcher.matches() && headingMatcher.group(1).length() <= 4 && !inCodeBlock) {
                break;
            }

            Matcher codeMatcher = CODE_FENCE_PATTERN.matcher(line);
            if (codeMatcher.matches()) {
                if (!inCodeBlock) {
                    inCodeBlock = true;
                    codeLang = String.valueOf(codeMatcher.group(1)).trim().toLowerCase();
                    codeBuffer.setLength(0);
                } else {
                    inCodeBlock = false;
                    if ("json".equals(codeLang) && result.jsonExample.isEmpty()) {
                        result.jsonExample = codeBuffer.toString().trim();
                    }
                }
                continue;
            }

            if (inCodeBlock) {
                codeBuffer.append(line).append("\n");
                continue;
            }

            if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
                tableRows.add(parseTableCells(line));
            } else if (!tableRows.isEmpty() && !line.trim().isEmpty()) {
                if (result.tableRows.isEmpty()) {
                    result.tableRows = cleanTableRows(tableRows);
                }
                tableRows = new ArrayList<>();
            }
        }

        if (!tableRows.isEmpty() && result.tableRows.isEmpty()) {
            result.tableRows = cleanTableRows(tableRows);
        }
        return result;
    }

    private List<String[]> cleanTableRows(List<String[]> rows) {
        List<String[]> cleaned = new ArrayList<>();
        for (String[] row : rows) {
            if (row.length == 0) {
                continue;
            }
            boolean allAlignChars = true;
            for (String cell : row) {
                String value = cell.trim();
                if (value.isEmpty()) {
                    continue;
                }
                if (!value.matches("[:\\-]+")) {
                    allAlignChars = false;
                    break;
                }
            }
            if (!allAlignChars) {
                cleaned.add(row);
            }
        }
        return cleaned;
    }

    private String[] parseTableCells(String line) {
        String trimmed = line.trim();
        if (trimmed.startsWith("|")) {
            trimmed = trimmed.substring(1);
        }
        if (trimmed.endsWith("|")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        String[] raw = trimmed.split("\\|", -1);
        for (int i = 0; i < raw.length; i++) {
            raw[i] = raw[i].trim();
        }
        return raw;
    }

    private List<Map<String, Object>> parseTableParams(List<String[]> rows) {
        List<Map<String, Object>> values = new ArrayList<>();
        if (rows == null || rows.size() <= 1) {
            return values;
        }

        String[] header = rows.get(0);
        for (int i = 1; i < rows.size(); i++) {
            String[] row = rows.get(i);
            String name = readColumnValue(header, row, "参数名", 0);
            if (name.isBlank()) {
                continue;
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("name", name);
            item.put("required", readColumnValue(header, row, "必选", 1));
            item.put("type", readColumnValue(header, row, "类型", 2));
            item.put("description", readColumnValue(header, row, "说明", 3));
            values.add(item);
        }
        return values;
    }

    private String readColumnValue(String[] header, String[] row, String columnName, int fallbackIndex) {
        int index = -1;
        for (int i = 0; i < header.length; i++) {
            if (columnName.equals(header[i])) {
                index = i;
                break;
            }
        }
        if (index < 0) {
            index = fallbackIndex;
        }
        return index >= 0 && index < row.length ? row[index].trim() : "";
    }

    private static class SectionParseResult {
        private List<String[]> tableRows = new ArrayList<>();
        private String jsonExample = "";
    }

    private static class ListContext {
        private final int indent;
        private final boolean ordered;
        private boolean itemOpen;

        private ListContext(int indent, boolean ordered) {
            this.indent = indent;
            this.ordered = ordered;
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
                            if (!fileName.equals("node_modules") && !fileName.equals(".git") && !fileName.equals(".idea") && !fileName.equals("target") && !fileName.equals("dist") && !fileName.equals("build") && !fileName.startsWith(".")) {
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

    private String generateUniqueAnchorId(String headingText, Map<String, Integer> anchorCounts) {
        String baseAnchorId = generateAnchorId(headingText);
        int nextIndex = anchorCounts.getOrDefault(baseAnchorId, 0) + 1;
        anchorCounts.put(baseAnchorId, nextIndex);
        return nextIndex == 1 ? baseAnchorId : baseAnchorId + "-" + nextIndex;
    }

    private boolean isChangeMarked(String line) {
        return line != null && CHANGE_MARKER_PATTERN.matcher(line).matches();
    }

    private String stripChangeMarker(String line) {
        if (line == null) return "";
        Matcher matcher = CHANGE_MARKER_PATTERN.matcher(line);
        return matcher.matches() ? matcher.group(1) : line;
    }

    private String changeClass(boolean changed) {
        return changed ? " class=\"md-change-line\"" : "";
    }

    private List<Map<String, Object>> extractTableOfContents(String md) {
        List<Map<String, Object>> toc = new ArrayList<>();
        Map<String, Integer> anchorCounts = new HashMap<>();
        for (String line : md.split("\n")) {
            Matcher matcher = HEADING_PATTERN.matcher(line);
            if (matcher.matches()) {
                int level = matcher.group(1).length();
                String text = stripChangeMarker(matcher.group(2)).trim();
                String id = generateUniqueAnchorId(text, anchorCounts);
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
        if (toc.isEmpty()) return "<div class=\"toc-empty\">暂无标题目录</div>";
        StringBuilder html = new StringBuilder();
        html.append("<div class=\"toc-header\">目录</div><div class=\"toc-list\">");
        int currentLevel = 0;
        for (Map<String, Object> heading : toc) {
            int level = (int) heading.get("level");
            String text = (String) heading.get("text");
            String id = (String) heading.get("id");
            String circleClass = "";
            if (level == 1) circleClass = " toc-circle-h1";
            else if (level == 2) circleClass = " toc-circle-h2";
            else if (level == 3) circleClass = " toc-circle-h3";
            if (level > currentLevel) {
                for (int i = currentLevel; i < level; i++) html.append("<div class=\"toc-item-container\">");
            } else if (level < currentLevel) {
                for (int i = currentLevel; i > level; i--) html.append("</div>");
            }
            html.append("<a href=\"#").append(id).append("\" class=\"toc-item toc-level-").append(level).append(circleClass).append("\" data-id=\"").append(id).append("\">")
                .append(escapeHtml(text)).append("</a>");
            currentLevel = level;
        }
        for (int i = 0; i < currentLevel; i++) html.append("</div>");
        html.append("</div>");
        return html.toString();
    }

    private int getIndentWidth(String text) {
        int indent = 0;
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (ch == ' ') {
                indent++;
            } else if (ch == '\t') {
                indent += 4;
            } else {
                break;
            }
        }
        return indent;
    }

    private void openList(StringBuilder html, Deque<ListContext> listStack, int indent, boolean ordered) {
        html.append(ordered ? "<ol>\n" : "<ul>\n");
        listStack.push(new ListContext(indent, ordered));
    }

    private void closeTopList(StringBuilder html, Deque<ListContext> listStack) {
        if (listStack.isEmpty()) return;
        ListContext context = listStack.pop();
        if (context.itemOpen) {
            html.append("</li>\n");
        }
        html.append(context.ordered ? "</ol>\n" : "</ul>\n");
    }

    private void closeAllLists(StringBuilder html, Deque<ListContext> listStack) {
        while (!listStack.isEmpty()) {
            closeTopList(html, listStack);
        }
    }

    private void closeOpenListItem(StringBuilder html, Deque<ListContext> listStack) {
        ListContext current = listStack.peek();
        if (current != null && current.itemOpen) {
            html.append("</li>\n");
            current.itemOpen = false;
        }
    }

    private void ensureListContext(StringBuilder html, Deque<ListContext> listStack, int indent, boolean ordered) {
        while (!listStack.isEmpty() && indent < listStack.peek().indent) {
            closeTopList(html, listStack);
        }
        if (!listStack.isEmpty() && indent == listStack.peek().indent) {
            if (listStack.peek().ordered != ordered) {
                closeTopList(html, listStack);
            } else {
                closeOpenListItem(html, listStack);
            }
        }
        if (listStack.isEmpty() || indent > listStack.peek().indent) {
            openList(html, listStack, indent, ordered);
        }
    }

    private void appendListItem(StringBuilder html, Deque<ListContext> listStack, String content, boolean changed, boolean taskItem, boolean checked) {
        html.append("<li");
        if (taskItem) {
            html.append(" class=\"task-list-item");
            if (changed) {
                html.append(" md-change-line");
            }
            html.append("\"");
        } else if (changed) {
            html.append(" class=\"md-change-line\"");
        }
        html.append(">");
        if (taskItem) {
            html.append("<input type=\"checkbox\" ");
            if (checked) {
                html.append("checked ");
            }
            html.append("disabled>");
        }
        html.append(content);
        ListContext current = listStack.peek();
        if (current != null) {
            current.itemOpen = true;
        }
    }

    private boolean isHorizontalRule(String line) {
        String trimmed = line == null ? "" : line.trim();
        if (trimmed.isEmpty()) {
            return false;
        }
        return trimmed.matches("^(?:-{3,}|\\*{3,}|_{3,}|(?:-\\s*){3,}|(?:\\*\\s*){3,}|(?:_\\s*){3,})$");
    }

    private String normalizeLooseListSyntax(String md) {
        StringBuilder normalized = new StringBuilder();
        String[] lines = md.split("\n", -1);
        boolean inCodeFence = false;
        boolean inFrontMatterBlock = false;
        for (int i = 0; i < lines.length; i++) {
            String originalLine = lines[i];
            String trimmed = originalLine.trim();
            if (trimmed.matches("^```\\s*.*$")) {
                inCodeFence = !inCodeFence;
                normalized.append(originalLine);
                if (i < lines.length - 1) {
                    normalized.append('\n');
                }
                continue;
            }
            if (trimmed.startsWith("<div class=\"front-matter\">")) {
                inFrontMatterBlock = true;
            }
            String line = originalLine;
            if (!inCodeFence && !inFrontMatterBlock) {
                line = line
                        .replaceFirst("^(\\s*[-*+])(?![-*+\\s])(\\S.*)$", "$1 $2")
                        .replaceFirst("^(\\s*\\d+\\.)(?!\\s)(\\S.*)$", "$1 $2");
            }
            normalized.append(line);
            if (trimmed.endsWith("</div>")) {
                inFrontMatterBlock = false;
            }
            if (i < lines.length - 1) {
                normalized.append('\n');
            }
        }
        return normalized.toString();
    }

    private String convertMarkdownToHtml(String md) {
        md = normalizeLooseListSyntax(handleFrontMatter(md));
        StringBuilder html = new StringBuilder();
        String[] lines = md.split("\\r?\\n");
        boolean inCodeBlock = false, inBlockquote = false, pendingListBreak = false;
        StringBuilder blockquoteContent = new StringBuilder();
        Deque<ListContext> listStack = new ArrayDeque<>();
        List<String[]> tableBuffer = new ArrayList<>();
        List<Boolean> tableChanged = new ArrayList<>();
        String[] tableAlign = null;
        boolean inTable = false;
        Pattern codeBlockPattern = Pattern.compile("^\\s*```\\s*(.*?)\\s*$");
        Pattern unorderedListPattern = Pattern.compile("^(\\s*)([-*+])(?:\\s+(.*)|((?![-*+])\\S.*))$");
        Pattern orderedListPattern = Pattern.compile("^(\\s*)(\\d+)\\.\\s+(.*)$");
        Pattern taskListPattern = Pattern.compile("^(\\s*)([-*+])\\s*\\[([ xX])\\]\\s+(.*)$");
        Pattern headingPattern = Pattern.compile("^\\s*(#{1,6})\\s+(.+?)\\s*$");
        Pattern blockquotePattern = Pattern.compile("^>\\s*(.*)$");
        Map<String, Integer> anchorCounts = new HashMap<>();
        for (int i = 0; i < lines.length; i++) {
            String rawLine = lines[i];
            boolean changed = isChangeMarked(rawLine);
            String line = stripChangeMarker(rawLine);
            if (line.startsWith("<table>")) { html.append(line).append("\n"); continue; }
            Matcher codeBlockMatcher = codeBlockPattern.matcher(line);
            if (codeBlockMatcher.matches()) {
                closeOpenListItem(html, listStack);
                if (inTable) { html.append(renderTable(tableBuffer, tableAlign, tableChanged)); tableBuffer.clear(); tableChanged.clear(); inTable = false; }
                if (!inCodeBlock) {
                    closeAllLists(html, listStack);
                    if (inBlockquote) { html.append(processBlockquote(blockquoteContent.toString())); blockquoteContent.setLength(0); inBlockquote = false; }
                    String lang = codeBlockMatcher.group(1);
                    html.append("<pre").append(changeClass(changed)).append("><code class=\"language-").append(lang != null && !lang.isEmpty() ? lang : "").append("\">");
                    inCodeBlock = true;
                } else {
                    html.append("</code></pre>\n");
                    inCodeBlock = false;
                }
                continue;
            }
            if (inCodeBlock) { html.append(escapeHtml(line)).append("\n"); continue; }
            boolean isTableAlignRow = isTableAlignmentLine(line);
            if (isTableRow(line) && !isTableAlignRow) {
                closeOpenListItem(html, listStack);
                closeAllLists(html, listStack);
                if (!inTable) { inTable = true; tableBuffer.clear(); }
                String[] cells = line.split("\\|");
                List<String> cellList = new ArrayList<>();
                for (String cell : cells) { String trimmed = cell.trim(); if (!trimmed.isEmpty() || cellList.size() > 0) cellList.add(trimmed); }
                if (!cellList.isEmpty()) {
                    tableBuffer.add(cellList.toArray(new String[0]));
                    tableChanged.add(changed);
                }
                continue;
            }
            if (isTableAlignRow && inTable) {
                String[] parts = line.split("\\|");
                tableAlign = new String[parts.length];
                for (int j = 0; j < parts.length; j++) {
                    String trimmed = parts[j].trim();
                    if (trimmed.startsWith(":") && trimmed.endsWith(":")) tableAlign[j] = "center";
                    else if (trimmed.endsWith(":")) tableAlign[j] = "right";
                    else tableAlign[j] = "left";
                }
                continue;
            }
            if (!line.startsWith("|") && inTable) { html.append(renderTable(tableBuffer, tableAlign, tableChanged)); tableBuffer.clear(); tableChanged.clear(); inTable = false; }
            if (isHorizontalRule(line)) {
                closeOpenListItem(html, listStack);
                closeAllLists(html, listStack);
                if (inBlockquote) { html.append(processBlockquote(blockquoteContent.toString())); blockquoteContent.setLength(0); inBlockquote = false; }
                html.append("<hr").append(changeClass(changed)).append(">\n");
                continue;
            }
            Matcher blockquoteMatcher = blockquotePattern.matcher(line);
            if (blockquoteMatcher.matches()) {
                closeOpenListItem(html, listStack);
                closeAllLists(html, listStack);
                if (!inBlockquote) { inBlockquote = true; }
                blockquoteContent.append(blockquoteMatcher.group(1)).append("\n");
                continue;
            } else if (inBlockquote && !line.trim().isEmpty()) {
                html.append(processBlockquote(blockquoteContent.toString()));
                blockquoteContent.setLength(0);
                inBlockquote = false;
            }
            Matcher taskMatcher = taskListPattern.matcher(line);
            if (taskMatcher.matches()) {
                int indent = getIndentWidth(taskMatcher.group(1));
                ensureListContext(html, listStack, indent, false);
                appendListItem(html, listStack, processInlineInList(taskMatcher.group(4)), changed, true, taskMatcher.group(3).equalsIgnoreCase("x"));
                pendingListBreak = false;
                continue;
            }
            Matcher unorderedMatcher = unorderedListPattern.matcher(line);
            if (unorderedMatcher.matches()) {
                int indent = getIndentWidth(unorderedMatcher.group(1));
                String unorderedContent = unorderedMatcher.group(3) != null ? unorderedMatcher.group(3) : unorderedMatcher.group(4);
                ensureListContext(html, listStack, indent, false);
                appendListItem(html, listStack, processInlineInList(unorderedContent == null ? "" : unorderedContent.trim()), changed, false, false);
                pendingListBreak = false;
                continue;
            }
            Matcher orderedMatcher = orderedListPattern.matcher(line);
            if (orderedMatcher.matches()) {
                int indent = getIndentWidth(orderedMatcher.group(1));
                ensureListContext(html, listStack, indent, true);
                appendListItem(html, listStack, processInlineInList(orderedMatcher.group(3)), changed, false, false);
                pendingListBreak = false;
                continue;
            }
            if (!listStack.isEmpty() && listStack.peek().itemOpen && !line.trim().isEmpty() && !pendingListBreak) {
                html.append("<br>").append(processInlineInList(line.trim()));
                pendingListBreak = false;
                continue;
            }
            Matcher headingMatcher = headingPattern.matcher(line);
            if (headingMatcher.matches()) {
                closeOpenListItem(html, listStack);
                closeAllLists(html, listStack);
                if (inBlockquote) { html.append(processBlockquote(blockquoteContent.toString())); blockquoteContent.setLength(0); inBlockquote = false; }
                if (inTable) { html.append(renderTable(tableBuffer, tableAlign, tableChanged)); tableBuffer.clear(); tableChanged.clear(); inTable = false; }
                int level = headingMatcher.group(1).length();
                String headingText = headingMatcher.group(2);
                String anchorId = generateUniqueAnchorId(headingText, anchorCounts);
                html.append("<h").append(level);
                if (changed) {
                    html.append(" class=\"md-change-line\"");
                }
                html.append(" id=\"").append(anchorId).append("\">").append(processInline(headingText)).append("</h").append(level).append(">\n");
                continue;
            }
            if (line.trim().isEmpty()) {
                if (!listStack.isEmpty()) {
                    closeOpenListItem(html, listStack);
                    pendingListBreak = true;
                    continue;
                }
                if (inBlockquote) { html.append(processBlockquote(blockquoteContent.toString())); blockquoteContent.setLength(0); inBlockquote = false; }
                if (inTable) { html.append(renderTable(tableBuffer, tableAlign, tableChanged)); tableBuffer.clear(); tableChanged.clear(); inTable = false; }
                html.append("<br>\n");
            } else {
                if (pendingListBreak) {
                    closeAllLists(html, listStack);
                    pendingListBreak = false;
                }
                closeOpenListItem(html, listStack);
                closeAllLists(html, listStack);
                if (inBlockquote) { html.append(processBlockquote(blockquoteContent.toString())); blockquoteContent.setLength(0); inBlockquote = false; }
                if (inTable) { html.append(renderTable(tableBuffer, tableAlign, tableChanged)); tableBuffer.clear(); tableChanged.clear(); inTable = false; }
                html.append("<p").append(changeClass(changed)).append(">").append(processInline(line)).append("</p>\n");
            }
        }
        closeOpenListItem(html, listStack);
        if (inTable && !tableBuffer.isEmpty()) html.append(renderTable(tableBuffer, tableAlign, tableChanged));
        closeAllLists(html, listStack);
        if (inBlockquote) html.append(processBlockquote(blockquoteContent.toString()));
        return html.toString();
    }

    private String renderListItem(String content, boolean changed, boolean taskItem, boolean checked) {
        if (taskItem) {
            return new StringBuilder()
                    .append("<li class=\"task-list-item")
                    .append(changed ? " md-change-line" : "")
                    .append("\"><input type=\"checkbox\" ")
                    .append(checked ? "checked" : "")
                    .append(" disabled>")
                    .append(content)
                    .append("</li>\n")
                    .toString();
        }
        return new StringBuilder()
                .append("<li")
                .append(changeClass(changed))
                .append(">")
                .append(content)
                .append("</li>\n")
                .toString();
    }
    
    private boolean isTableRow(String line) {
        String trimmed = line.trim();
        return trimmed.startsWith("|") && trimmed.endsWith("|") && (trimmed.substring(1, trimmed.length() - 1).contains("|") || !trimmed.trim().isEmpty());
    }
    
    private boolean isTableAlignmentLine(String line) {
        String trimmed = line.trim();
        if (!trimmed.startsWith("|")) return false;
        for (String part : trimmed.split("\\|")) { if (!part.trim().isEmpty() && !part.trim().matches("[:\\-]+")) return false; }
        return true;
    }

    private String renderTable(List<String[]> rows, String[] align, List<Boolean> changedRows) {
        if (rows.isEmpty()) return "";
        StringBuilder sb = new StringBuilder("<table>\n");
        if (!rows.isEmpty()) {
            sb.append("<thead>\n<tr").append(!changedRows.isEmpty() && Boolean.TRUE.equals(changedRows.get(0)) ? " class=\"md-change-line\"" : "").append(">");
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
                boolean changed = i < changedRows.size() && Boolean.TRUE.equals(changedRows.get(i));
                sb.append("<tr").append(changed ? " class=\"md-change-line\"" : "").append(">");
                for (int j = 0; j < rows.get(i).length; j++) {
                    String cellAlign = (align != null && j < align.length) ? align[j] : "left";
                    sb.append("<td align=\"").append(cellAlign).append("\">").append(processInline(rows.get(i)[j])).append("</td>");
                }
                sb.append("</tr>\n");
            }
            sb.append("</tbody>\n");
        }
        return sb.append("</table>\n").toString();
    }

    private String handleFrontMatter(String md) {
        if (md.startsWith("---")) {
            int endIndex = md.indexOf("---", 3);
            if (endIndex > 0) {
                return "<div class=\"front-matter\"><pre><code>" + escapeHtml(md.substring(3, endIndex).trim()) + "</code></pre></div>\n" + md.substring(endIndex + 3);
            }
        }
        return md;
    }

    private String processBlockquote(String content) {
        if (content == null || content.trim().isEmpty()) return "";
        StringBuilder result = new StringBuilder("<blockquote>\n");
        for (String line : content.split("\n")) { if (!line.trim().isEmpty()) result.append("<p>").append(processInline(line)).append("</p>\n"); }
        return result.append("</blockquote>\n").toString();
    }

    private String processInlineInList(String text) { return processInline(text); }

    private String processInline(String text) {
        text = processBackslashEscapes(text);
        text = text.replaceAll("__([^_]+)__", "<strong>$1</strong>").replaceAll("\\*\\*([^*]+)\\*\\*", "<strong>$1</strong>");
        text = text.replaceAll("_([^_]+)_", "<em>$1</em>").replaceAll("\\*([^*]+)\\*", "<em>$1</em>");
        text = text.replaceAll("`([^`]+)`", "<code>$1</code>");
        text = text.replaceAll("!\\[([^\\]]*)\\]\\(([^)]+)\\)", "<img src=\"$2\" alt=\"$1\">");
        text = text.replaceAll("\\[([^\\]]+)\\]\\(([^)]+)\\)", "<a href=\"$2\">$1</a>");
        return text;
    }

    private String processBackslashEscapes(String text) {
        return text.replaceAll("\\\\\\\\", "&#92;").replaceAll("\\\\`", "&#96;").replaceAll("\\\\\\*", "&#42;").replaceAll("\\\\_", "&#95;")
                   .replaceAll("\\\\\\{", "&#123;").replaceAll("\\\\\\}", "&#125;").replaceAll("\\\\\\[", "&#91;").replaceAll("\\\\\\]", "&#93;")
                   .replaceAll("\\\\\\(", "&#40;").replaceAll("\\\\\\)", "&#41;").replaceAll("\\\\#", "&#35;").replaceAll("\\\\\\+", "&#43;")
                   .replaceAll("\\\\-", "&#45;").replaceAll("\\\\\\.", "&#46;").replaceAll("\\\\!", "&#33;").replaceAll("\\\\\\|", "&#124;");
    }

    private String escapeHtml(String text) {
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;");
    }

    private String renderError(String message) {
        return loadTemplate("error").replace("{{message}}", message.replace("<", "&lt;").replace(">", "&gt;"));
    }

    private String buildTreeHtml(List<String> files, String currentPath, String currentScope) {
        Map<String, Object> tree = new HashMap<>();
        for (String file : files) {
            String[] parts = file.split("/");
            Map<String, Object> current = tree;
            for (int i = 0; i < parts.length; i++) {
                if (i == parts.length - 1) current.put(parts[i], file);
                else current = (Map<String, Object>) current.computeIfAbsent(parts[i], k -> new HashMap<String, Object>());
            }
        }
        StringBuilder sb = new StringBuilder();
        sb.append("<div class=\"sidebar-header\"><div class=\"sidebar-header-row\"><span class=\"sidebar-title\">Markdown 文件列表</span></div><div class=\"directory-switcher\" id=\"directory-switcher\" data-scope=\"")
          .append(escapeHtml(currentScope))
          .append("\"></div></div><div class=\"search-box\">")
          .append("<input type=\"text\" class=\"search-input\" id=\"search-input\" placeholder=\"搜索...\">")
          .append("<button class=\"locate-btn\" id=\"locate-btn\" title=\"定位到当前文件\">⌖</button></div>")
          .append("<div class=\"file-list\">");
        buildTreeHtmlRecursive(tree, sb, "", currentPath);
        return sb.append("</div>").toString();
    }

    private void buildTreeHtmlRecursive(Map<String, Object> node, StringBuilder sb, String path, String currentPath) {
        List<String> keys = new ArrayList<>(node.keySet());
        Collections.sort(keys);
        for (String key : keys) {
            Object value = node.get(key);
            String currentFilePath = path.isEmpty() ? key : path + "/" + key;
            if (value instanceof Map) {
                sb.append("<div class=\"tree-folder\" data-path=\"").append(escapeHtml(currentFilePath)).append("\">")
                  .append("<span class=\"tree-toggle\">▶</span><span class=\"tree-icon folder-icon\">").append(FOLDER_SVG).append("</span>")
                  .append(escapeHtml(key)).append("</div><div class=\"tree-children\" data-path=\"").append(escapeHtml(currentFilePath)).append("\">");
                buildTreeHtmlRecursive((Map<String, Object>) value, sb, currentFilePath, currentPath);
                sb.append("</div>");
            } else {
                String filePath = (String) value;
                String normalizedFilePath = filePath.replace("\\", "/");
                String normalizedCurrentPath = currentPath == null ? "" : currentPath.replace("\\", "/");
                String activeClass = normalizedFilePath.equalsIgnoreCase(normalizedCurrentPath) ? " active" : "";
                try {
                    String encodedPath = java.net.URLEncoder.encode(filePath, "UTF-8").replace("+", "%20");
                    sb.append("<div class=\"tree-file-row").append(activeClass).append("\" data-path=\"").append(escapeHtml(filePath)).append("\" data-name=\"").append(escapeHtml(key)).append("\">")
                      .append("<a href=\"/md-view?path=").append(encodedPath).append("\" class=\"tree-file").append(activeClass).append("\" data-path=\"").append(escapeHtml(filePath)).append("\" data-name=\"").append(escapeHtml(key)).append("\">")
                      .append("<span class=\"tree-icon file-icon\">").append(FILE_SVG).append("</span><span class=\"tree-file-name\">").append(escapeHtml(key)).append("</span></a>")
                      .append("<div class=\"tree-file-actions\">")
                      .append("<button type=\"button\" class=\"tree-file-action tree-copy-name\" data-path=\"").append(escapeHtml(filePath)).append("\" data-name=\"").append(escapeHtml(key)).append("\" title=\"复制文件名到剪贴板\" aria-label=\"复制文件名到剪贴板\"><svg viewBox=\"0 0 16 16\" aria-hidden=\"true\"><rect x=\"5\" y=\"2.5\" width=\"8.5\" height=\"10.5\" rx=\"1.8\"></rect><path d=\"M3.5 11.5H3A1.5 1.5 0 0 1 1.5 10V4A1.5 1.5 0 0 1 3 2.5h5\"></path></svg></button>")
                      .append("<button type=\"button\" class=\"tree-file-action tree-copy-url\" data-path=\"").append(escapeHtml(filePath)).append("\" data-name=\"").append(escapeHtml(key)).append("\" title=\"复制文件链接到剪贴板\" aria-label=\"复制文件链接到剪贴板\"><svg viewBox=\"0 0 16 16\" aria-hidden=\"true\"><path d=\"M6.2 9.8 9.8 6.2\"></path><path d=\"M6 12.5H4.3A2.8 2.8 0 0 1 1.5 9.7 2.8 2.8 0 0 1 4.3 6.9H6\"></path><path d=\"M10 9.1h1.7a2.8 2.8 0 0 0 2.8-2.8 2.8 2.8 0 0 0-2.8-2.8H10\"></path></svg></button>")
                      .append("</div></div>");
                } catch (Exception e) {}
            }
        }
    }
}
