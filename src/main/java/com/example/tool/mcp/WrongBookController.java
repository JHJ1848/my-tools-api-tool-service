package com.example.tool.mcp;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 错题本控制器 - 提供错题本的查看和编辑功能
 */
@RestController
@RequestMapping("/api")
public class WrongBookController {

    /**
     * 错题本主页面
     */
    @GetMapping("/wrong-book")
    public ResponseEntity<String> wrongBookPage() {
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .body(renderWrongBookPage());
    }

    private String renderWrongBookPage() {
        return "<!DOCTYPE html>\n" +
                "<html lang=\"zh-CN\">\n" +
                "<head>\n" +
                "    <meta charset=\"UTF-8\">\n" +
                "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n" +
                "    <title>错题本</title>\n" +
                "    <style>\n" +
                "        * { margin: 0; padding: 0; box-sizing: border-box; }\n" +
                "        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; min-height: 100vh; }\n" +
                "        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }\n" +
                "        h1 { color: #333; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #4CAF50; }\n" +
                "        .card { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }\n" +
                "        .book-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }\n" +
                "        .book-item { background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 6px; padding: 16px; cursor: pointer; transition: all 0.2s; }\n" +
                "        .book-item:hover { border-color: #4CAF50; box-shadow: 0 4px 12px rgba(76,175,80,0.2); transform: translateY(-2px); }\n" +
                "        .book-title { font-size: 18px; font-weight: 600; color: #333; margin-bottom: 8px; }\n" +
                "        .book-meta { font-size: 13px; color: #888; }\n" +
                "        .btn { background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; }\n" +
                "        .btn:hover { background: #45a049; }\n" +
                "        .btn-secondary { background: #666; }\n" +
                "        .btn-secondary:hover { background: #555; }\n" +
                "        .btn-danger { background: #f44336; }\n" +
                "        .btn-danger:hover { background: #da190b; }\n" +
                "        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; }\n" +
                "        .modal.show { display: flex; align-items: center; justify-content: center; }\n" +
                "        .modal-content { background: white; border-radius: 8px; padding: 24px; width: 90%; max-width: 700px; max-height: 90vh; overflow-y: auto; }\n" +
                "        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }\n" +
                "        .modal-title { font-size: 20px; font-weight: 600; }\n" +
                "        .modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #888; }\n" +
                "        .form-group { margin-bottom: 16px; }\n" +
                "        .form-group label { display: block; margin-bottom: 6px; font-weight: 500; color: #333; }\n" +
                "        .form-group input, .form-group textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }\n" +
                "        .form-group textarea { min-height: 100px; resize: vertical; font-family: inherit; }\n" +
                "        .form-group input:focus, .form-group textarea:focus { outline: none; border-color: #4CAF50; }\n" +
                "        .case-section { background: #f9f9f9; border-left: 4px solid #4CAF50; padding: 16px; margin: 16px 0; border-radius: 0 6px 6px 0; }\n" +
                "        .case-section h3 { color: #333; margin-bottom: 12px; font-size: 16px; }\n" +
                "        .case-content { white-space: pre-wrap; line-height: 1.6; color: #555; }\n" +
                "        .toolbar { display: flex; gap: 10px; margin-bottom: 16px; }\n" +
                "        .case-nav { display: flex; gap: 10px; flex-wrap: wrap; }\n" +
                "        .case-nav-item { background: #e8f5e9; color: #2e7d32; padding: 8px 16px; border-radius: 4px; cursor: pointer; border: 1px solid #c8e6c9; }\n" +
                "        .case-nav-item:hover { background: #c8e6c9; }\n" +
                "        .case-nav-item.active { background: #4CAF50; color: white; border-color: #4CAF50; }\n" +
                "        .error-code { background: #ffebee; color: #c62828; padding: 12px; border-radius: 4px; font-family: monospace; white-space: pre-wrap; margin: 8px 0; }\n" +
                "        .correct-code { background: #e8f5e9; color: #2e7d32; padding: 12px; border-radius: 4px; font-family: monospace; white-space: pre-wrap; margin: 8px 0; }\n" +
                "    </style>\n" +
                "</head>\n" +
                "<body>\n" +
                "    <div class=\"container\">\n" +
                "        <h1>📚 错题本</h1>\n" +
                "        <div class=\"toolbar\">\n" +
                "            <button class=\"btn\" onclick=\"showAddModal()\">+ 新建错题本</button>\n" +
                "        </div>\n" +
                "        <div class=\"card\">\n" +
                "            <div class=\"book-list\" id=\"bookList\">\n" +
                "                <p style=\"color: #888;\">加载中...</p>\n" +
                "            </div>\n" +
                "        </div>\n" +
                "    </div>\n" +
                "\n" +
                "    <!-- 新建/编辑错题本弹窗 -->\n" +
                "    <div class=\"modal\" id=\"bookModal\">\n" +
                "        <div class=\"modal-content\">\n" +
                "            <div class=\"modal-header\">\n" +
                "                <span class=\"modal-title\" id=\"modalTitle\">新建错题本</span>\n" +
                "                <button class=\"modal-close\" onclick=\"closeModal()\">&times;</button>\n" +
                "            </div>\n" +
                "            <div class=\"form-group\">\n" +
                "                <label>标题</label>\n" +
                "                <input type=\"text\" id=\"bookTitle\" placeholder=\"例如：Java开发常见错误\">\n" +
                "            </div>\n" +
                "            <div class=\"form-group\">\n" +
                "                <label>文件名（英文）</label>\n" +
                "                <input type=\"text\" id=\"bookFileName\" placeholder=\"例如：java-errors\">\n" +
                "            </div>\n" +
                "            <div class=\"form-group\">\n" +
                "                <label>1. 背景和目标</label>\n" +
                "                <textarea id=\"caseBackground\" placeholder=\"描述问题的背景和解决目标...\"></textarea>\n" +
                "            </div>\n" +
                "            <div class=\"form-group\">\n" +
                "                <label>2. 错误做法</label>\n" +
                "                <textarea id=\"caseWrong\" placeholder=\"描述错误的做法...\"></textarea>\n" +
                "            </div>\n" +
                "            <div class=\"form-group\">\n" +
                "                <label>3. 正确做法</label>\n" +
                "                <textarea id=\"caseCorrect\" placeholder=\"描述正确的做法...\"></textarea>\n" +
                "            </div>\n" +
                "            <div style=\"text-align: right; margin-top: 20px;\">\n" +
                "                <button class=\"btn btn-secondary\" onclick=\"closeModal()\">取消</button>\n" +
                "                <button class=\"btn\" onclick=\"saveBook()\">保存</button>\n" +
                "            </div>\n" +
                "        </div>\n" +
                "    </div>\n" +
                "\n" +
                "    <!-- 案例详情弹窗 -->\n" +
                "    <div class=\"modal\" id=\"caseModal\">\n" +
                "        <div class=\"modal-content\">\n" +
                "            <div class=\"modal-header\">\n" +
                "                <span class=\"modal-title\" id=\"caseModalTitle\">案例详情</span>\n" +
                "                <button class=\"modal-close\" onclick=\"closeCaseModal()\">&times;</button>\n" +
                "            </div>\n" +
                "            <div class=\"case-section\">\n" +
                "                <h3>1. 背景和目标</h3>\n" +
                "                <div class=\"case-content\" id=\"viewBackground\"></div>\n" +
                "            </div>\n" +
                "            <div class=\"case-section\">\n" +
                "                <h3>2. 错误做法</h3>\n" +
                "                <div class=\"case-content error-code\" id=\"viewWrong\"></div>\n" +
                "            </div>\n" +
                "            <div class=\"case-section\">\n" +
                "                <h3>3. 正确做法</h3>\n" +
                "                <div class=\"case-content correct-code\" id=\"viewCorrect\"></div>\n" +
                "            </div>\n" +
                "            <div style=\"text-align: right; margin-top: 20px;\">\n" +
                "                <button class=\"btn btn-danger\" onclick=\"deleteBook()\">删除</button>\n" +
                "                <button class=\"btn\" onclick=\"editCurrentBook()\">编辑</button>\n" +
                "            </div>\n" +
                "        </div>\n" +
                "    </div>\n" +
                "\n" +
                "    <script>\n" +
                "        let currentBook = null;\n" +
                "        let booksData = [];\n" +
                "\n" +
                "        // 加载错题本列表\n" +
                "        async function loadBooks() {\n" +
                "            try {\n" +
                "                const res = await fetch('/api/wrong-book/list');\n" +
                "                booksData = await res.json();\n" +
                "                renderBooks();\n" +
                "            } catch (e) {\n" +
                "                document.getElementById('bookList').innerHTML = '<p style=\"color: #f44336;\">加载失败: ' + e.message + '</p>';\n" +
                "            }\n" +
                "        }\n" +
                "\n" +
                "        function renderBooks() {\n" +
                "            if (booksData.length === 0) {\n" +
                "                document.getElementById('bookList').innerHTML = '<p style=\"color: #888;\">暂无错题本，点击\"新建错题本\"创建第一个</p>';\n" +
                "                return;\n" +
                "            }\n" +
                "            document.getElementById('bookList').innerHTML = booksData.map(book => `\n" +
                "                <div class=\"book-item\" onclick=\"viewBook('${book.fileName}')\">\n" +
                "                    <div class=\"book-title\">${book.title}</div>\n" +
                "                    <div class=\"book-meta\">案例数量: ${book.caseCount}</div>\n" +
                "                </div>\n" +
                "            `).join('');\n" +
                "        }\n" +
                "\n" +
                "        function showAddModal() {\n" +
                "            currentBook = null;\n" +
                "            document.getElementById('modalTitle').innerText = '新建错题本';\n" +
                "            document.getElementById('bookTitle').value = '';\n" +
                "            document.getElementById('bookFileName').value = '';\n" +
                "            document.getElementById('caseBackground').value = '';\n" +
                "            document.getElementById('caseWrong').value = '';\n" +
                "            document.getElementById('caseCorrect').value = '';\n" +
                "            document.getElementById('bookModal').classList.add('show');\n" +
                "        }\n" +
                "\n" +
                "        function closeModal() {\n" +
                "            document.getElementById('bookModal').classList.remove('show');\n" +
                "        }\n" +
                "        function closeCaseModal() {\n" +
                "            document.getElementById('caseModal').classList.remove('show');\n" +
                "        }\n" +
                "\n" +
                "        async function saveBook() {\n" +
                "            const title = document.getElementById('bookTitle').value.trim();\n" +
                "            const fileName = document.getElementById('bookFileName').value.trim();\n" +
                "            const background = document.getElementById('caseBackground').value.trim();\n" +
                "            const wrongApproach = document.getElementById('caseWrong').value.trim();\n" +
                "            const correctApproach = document.getElementById('caseCorrect').value.trim();\n" +
                "\n" +
                "            if (!title || !fileName) {\n" +
                "                alert('请填写标题和文件名');\n" +
                "                return;\n" +
                "            }\n" +
                "\n" +
                "            const data = { fileName, title, background, wrongApproach, correctApproach };\n" +
                "            const url = currentBook ? '/api/wrong-book/update' : '/api/wrong-book/add';\n" +
                "\n" +
                "            try {\n" +
                "                const res = await fetch(url, {\n" +
                "                    method: 'POST',\n" +
                "                    headers: { 'Content-Type': 'application/json' },\n" +
                "                    body: JSON.stringify(data)\n" +
                "                });\n" +
                "                if (res.ok) {\n" +
                "                    closeModal();\n" +
                "                    loadBooks();\n" +
                "                } else {\n" +
                "                    alert('保存失败');\n" +
                "                }\n" +
                "            } catch (e) {\n" +
                "                alert('保存失败: ' + e.message);\n" +
                "            }\n" +
                "        }\n" +
                "\n" +
                "        async function viewBook(fileName) {\n" +
                "            try {\n" +
                "                const res = await fetch('/api/wrong-book/content?name=' + encodeURIComponent(fileName));\n" +
                "                if (!res.ok) {\n" +
                "                    alert('找不到该错题本');\n" +
                "                    return;\n" +
                "                }\n" +
                "                const content = await res.text();\n" +
                "                parseAndShowContent(content, fileName);\n" +
                "            } catch (e) {\n" +
                "                alert('加载失败: ' + e.message);\n" +
                "            }\n" +
                "        }\n" +
                "\n" +
                "        function parseAndShowContent(content, fileName) {\n" +
                "            // 解析Markdown内容\n" +
                "            const titleMatch = content.match(/^#\\s+(.+)$/m);\n" +
                "            const title = titleMatch ? titleMatch[1] : fileName;\n" +
                "\n" +
                "            const bgMatch = content.match(/### 1\\. 背景和目标\\n\\n([\\s\\S]*?)(?=\\n###|\\n##|\\Z)/);\n" +
                "            const wrongMatch = content.match(/### 2\\. 错误做法\\n\\n([\\s\\S]*?)(?=\\n###|\\n##|\\Z)/);\n" +
                "            const correctMatch = content.match(/### 3\\. 正确做法\\n\\n([\\s\\S]*?)(?=\\n###|\\n##|\\Z)/);\n" +
                "\n" +
                "            currentBook = { fileName, title };\n" +
                "            document.getElementById('caseModalTitle').innerText = title;\n" +
                "            document.getElementById('viewBackground').innerText = bgMatch ? bgMatch[1].trim() : '';\n" +
                "            document.getElementById('viewWrong').innerText = wrongMatch ? wrongMatch[1].trim() : '';\n" +
                "            document.getElementById('viewCorrect').innerText = correctMatch ? correctMatch[1].trim() : '';\n" +
                "            document.getElementById('caseModal').classList.add('show');\n" +
                "        }\n" +
                "\n" +
                "        function editCurrentBook() {\n" +
                "            if (!currentBook) return;\n" +
                "            closeCaseModal();\n" +
                "            showEditModal(currentBook.fileName);\n" +
                "        }\n" +
                "\n" +
                "        async function showEditModal(fileName) {\n" +
                "            try {\n" +
                "                const res = await fetch('/api/wrong-book/content?name=' + encodeURIComponent(fileName));\n" +
                "                const content = await res.text();\n" +
                "\n" +
                "                const titleMatch = content.match(/^#\\s+(.+)$/m);\n" +
                "                const bgMatch = content.match(/### 1\\. 背景和目标\\n\\n([\\s\\S]*?)(?=\\n###|\\n##|\\Z)/);\n" +
                "                const wrongMatch = content.match(/### 2\\. 错误做法\\n\\n([\\s\\S]*?)(?=\\n###|\\n##|\\Z)/);\n" +
                "                const correctMatch = content.match(/### 3\\. 正确做法\\n\\n([\\s\\S]*?)(?=\\n###|\\n##|\\Z)/);\n" +
                "\n" +
                "                currentBook = { fileName };\n" +
                "                document.getElementById('modalTitle').innerText = '编辑错题本';\n" +
                "                document.getElementById('bookTitle').value = titleMatch ? titleMatch[1] : '';\n" +
                "                document.getElementById('bookFileName').value = fileName;\n" +
                "                document.getElementById('bookFileName').disabled = true;\n" +
                "                document.getElementById('caseBackground').value = bgMatch ? bgMatch[1].trim() : '';\n" +
                "                document.getElementById('caseWrong').value = wrongMatch ? wrongMatch[1].trim() : '';\n" +
                "                document.getElementById('caseCorrect').value = correctMatch ? correctMatch[1].trim() : '';\n" +
                "                document.getElementById('bookModal').classList.add('show');\n" +
                "            } catch (e) {\n" +
                "                alert('加载失败: ' + e.message);\n" +
                "            }\n" +
                "        }\n" +
                "\n" +
                "        async function deleteBook() {\n" +
                "            if (!currentBook || !confirm('确定要删除这个错题本吗？')) return;\n" +
                "            try {\n" +
                "                const res = await fetch('/api/wrong-book/delete?fileName=' + encodeURIComponent(currentBook.fileName), {\n" +
                "                    method: 'POST'\n" +
                "                });\n" +
                "                if (res.ok) {\n" +
                "                    closeCaseModal();\n" +
                "                    loadBooks();\n" +
                "                } else {\n" +
                "                    alert('删除失败');\n" +
                "                }\n" +
                "            } catch (e) {\n" +
                "                alert('删除失败: ' + e.message);\n" +
                "            }\n" +
                "        }\n" +
                "\n" +
                "        // 初始化\n" +
                "        loadBooks();\n" +
                "    </script>\n" +
                "</body>\n" +
                "</html>";
    }


    private static final Logger logger = LoggerFactory.getLogger(WrongBookController.class);

    private static final String WRONG_BOOK_PATH = "docs/wrong-book";

    /**
     * 获取错题本列表
     */
    @GetMapping("/wrong-book/list")
    public ResponseEntity<List<WrongBookEntry>> listWrongBooks() {
        try {
            Path basePath = Paths.get(WRONG_BOOK_PATH);
            if (!Files.exists(basePath)) {
                return ResponseEntity.ok(new ArrayList<>());
            }

            List<WrongBookEntry> entries = new ArrayList<>();
            Files.list(basePath)
                    .filter(path -> path.toString().endsWith(".md"))
                    .forEach(path -> {
                        try {
                            String content = Files.readString(path);
                            String title = extractTitle(content, path.getFileName().toString());
                            entries.add(new WrongBookEntry(
                                    path.getFileName().toString().replace(".md", ""),
                                    title,
                                    countCases(content)
                            ));
                        } catch (IOException e) {
                            logger.error("读取文件失败: {}", path, e);
                        }
                    });

            return ResponseEntity.ok(entries);
        } catch (Exception e) {
            logger.error("获取错题本列表失败", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * 删除错题本
     */
    @PostMapping("/wrong-book/delete")
    public ResponseEntity<String> deleteBook(@RequestParam String fileName) {
        try {
            Path filePath = Paths.get(WRONG_BOOK_PATH, fileName + ".md");
            if (!Files.exists(filePath)) {
                return ResponseEntity.notFound().build();
            }
            Files.delete(filePath);
            return ResponseEntity.ok("删除成功");
        } catch (IOException e) {
            logger.error("删除错题本失败: {}", fileName, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * 获取错题本内容
     */
    @GetMapping("/wrong-book/content")
    public ResponseEntity<String> getWrongBookContent(@RequestParam(defaultValue = "错题本") String name) {
        try {
            Path filePath = Paths.get(WRONG_BOOK_PATH, name + ".md");
            if (!Files.exists(filePath)) {
                return ResponseEntity.notFound().build();
            }
            String content = Files.readString(filePath);
            return ResponseEntity.ok(content);
        } catch (IOException e) {
            logger.error("读取错题本失败: {}", name, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * 添加新案例
     */
    @PostMapping("/wrong-book/add")
    public ResponseEntity<String> addCase(@RequestBody WrongBookCase caseInfo) {
        try {
            Path filePath = Paths.get(WRONG_BOOK_PATH, caseInfo.getFileName() + ".md");

            StringBuilder content = new StringBuilder();
            content.append("# ").append(caseInfo.getTitle()).append("\n\n");
            content.append("## 案例列表\n\n");
            content.append("> 点击案例标题查看详情\n\n");
            content.append("- [案例1：").append(caseInfo.getTitle()).append("](#案例1)\n\n");
            content.append("## 案例1\n\n");
            content.append("### 1. 背景和目标\n\n");
            content.append(caseInfo.getBackground()).append("\n\n");
            content.append("### 2. 错误做法\n\n");
            content.append(caseInfo.getWrongApproach()).append("\n\n");
            content.append("### 3. 正确做法\n\n");
            content.append(caseInfo.getCorrectApproach()).append("\n");

            Files.writeString(filePath, content.toString(),
                    StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

            return ResponseEntity.ok("添加成功");
        } catch (IOException e) {
            logger.error("添加案例失败", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * 更新案例
     */
    @PostMapping("/wrong-book/update")
    public ResponseEntity<String> updateCase(@RequestBody WrongBookCase caseInfo) {
        try {
            Path filePath = Paths.get(WRONG_BOOK_PATH, caseInfo.getFileName() + ".md");
            if (!Files.exists(filePath)) {
                return ResponseEntity.notFound().build();
            }

            String existingContent = Files.readString(filePath);

            // 更新案例内容 - 使用正则替换
            String updatedContent = updateCaseContent(existingContent, caseInfo);

            Files.writeString(filePath, updatedContent,
                    StandardOpenOption.TRUNCATE_EXISTING);

            return ResponseEntity.ok("更新成功");
        } catch (IOException e) {
            logger.error("更新案例失败", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    private String updateCaseContent(String content, WrongBookCase caseInfo) {
        // 简单替换：更新标题
        content = content.replaceFirst("# .+", "# " + caseInfo.getTitle());

        // 更新各个部分
        Pattern backgroundPattern = Pattern.compile("### 1\\. 背景和目标\\n\\n[\\s\\S]*?(?=\\n###|\\n##|\\Z)");
        Pattern wrongPattern = Pattern.compile("### 2\\. 错误做法\\n\\n[\\s\\S]*?(?=\\n###|\\n##|\\Z)");
        Pattern correctPattern = Pattern.compile("### 3\\. 正确做法\\n\\n[\\s\\S]*?(?=\\n###|\\n##|\\Z)");

        content = backgroundPattern.matcher(content).replaceFirst("### 1. 背景和目标\n\n" + caseInfo.getBackground());
        content = wrongPattern.matcher(content).replaceFirst("### 2. 错误做法\n\n" + caseInfo.getWrongApproach());
        content = correctPattern.matcher(content).replaceFirst("### 3. 正确做法\n\n" + caseInfo.getCorrectApproach());

        return content;
    }

    private String extractTitle(String content, String defaultName) {
        Pattern pattern = Pattern.compile("^#\\s+(.+)$", Pattern.MULTILINE);
        Matcher matcher = pattern.matcher(content);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return defaultName.replace(".md", "");
    }

    private int countCases(String content) {
        Pattern pattern = Pattern.compile("## 案例\\d+");
        Matcher matcher = pattern.matcher(content);
        int count = 0;
        while (matcher.find()) {
            count++;
        }
        return count;
    }

    // 内部类：错题本条目
    public static class WrongBookEntry {
        private String fileName;
        private String title;
        private int caseCount;

        public WrongBookEntry(String fileName, String title, int caseCount) {
            this.fileName = fileName;
            this.title = title;
            this.caseCount = caseCount;
        }

        public String getFileName() { return fileName; }
        public String getTitle() { return title; }
        public int getCaseCount() { return caseCount; }
    }

    // 内部类：错题本案例
    public static class WrongBookCase {
        private String fileName;
        private String title;
        private String background;
        private String wrongApproach;
        private String correctApproach;

        public String getFileName() { return fileName; }
        public void setFileName(String fileName) { this.fileName = fileName; }
        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
        public String getBackground() { return background; }
        public void setBackground(String background) { this.background = background; }
        public String getWrongApproach() { return wrongApproach; }
        public void setWrongApproach(String wrongApproach) { this.wrongApproach = wrongApproach; }
        public String getCorrectApproach() { return correctApproach; }
        public void setCorrectApproach(String correctApproach) { this.correctApproach = correctApproach; }
    }
}
