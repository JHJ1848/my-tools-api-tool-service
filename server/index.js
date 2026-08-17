/**
 * MD Preview Tool - Node.js 轻量级文件服务器
 * 
 * 功能：
 * 1. 提供文件读取 API
 * 2. 提供目录列表 API
 * 3. 静态文件服务
 * 
 * 启动：node server/index.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 配置
const CONFIG = {
    PORT: process.env.PORT || 3001,
    BASE_PATH: process.env.BASE_PATH || 'C:\\workspace',
    CORS: '*'
};

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
    // 设置 CORS
    res.setHeader('Access-Control-Allow-Origin', CONFIG.CORS);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // 处理 OPTIONS 请求
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // 解析 URL
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // API 路由
    if (pathname.startsWith('/api/')) {
        handleApi(pathname, parsedUrl.query, req, res);
    } else {
        // 静态文件服务
        handleStatic(pathname, req, res);
    }
});

// API 处理函数
function handleApi(pathname, query, req, res) {
    // 读取文件
    if (pathname === '/api/read-file') {
        const filePath = query.path;
        
        if (!filePath) {
            sendJson(res, 400, { error: '缺少 path 参数' });
            return;
        }

        // 安全检查：确保文件在基础路径内
        const fullPath = path.resolve(filePath);
        if (!fullPath.startsWith(CONFIG.BASE_PATH)) {
            sendJson(res, 403, { error: '路径不安全，拒绝访问' });
            return;
        }

        // 检查文件是否存在
        if (!fs.existsSync(fullPath)) {
            sendJson(res, 404, { error: '文件不存在' });
            return;
        }

        // 检查是否是文件
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) {
            sendJson(res, 400, { error: '不是有效的文件' });
            return;
        }

        // 读取文件内容
        try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            sendJson(res, 200, {
                success: true,
                path: filePath,
                content: content,
                size: stat.size,
                modified: stat.mtime
            });
        } catch (err) {
            sendJson(res, 500, { error: '读取文件失败: ' + err.message });
        }
        return;
    }

    // 列出目录
    if (pathname === '/api/list-directory') {
        const dirPath = query.path || CONFIG.BASE_PATH;
        const depth = parseInt(query.depth) || 1;

        // 安全检查
        const fullPath = path.resolve(dirPath);
        if (!fullPath.startsWith(CONFIG.BASE_PATH)) {
            sendJson(res, 403, { error: '路径不安全，拒绝访问' });
            return;
        }

        // 检查目录是否存在
        if (!fs.existsSync(fullPath)) {
            sendJson(res, 404, { error: '目录不存在' });
            return;
        }

        try {
            const items = listDirectory(fullPath, depth);
            sendJson(res, 200, {
                success: true,
                path: dirPath,
                items: items
            });
        } catch (err) {
            sendJson(res, 500, { error: '读取目录失败: ' + err.message });
        }
        return;
    }

    // 获取配置
    if (pathname === '/api/config') {
        sendJson(res, 200, {
            success: true,
            basePath: CONFIG.BASE_PATH,
            port: CONFIG.PORT
        });
        return;
    }

    // 健康检查
    if (pathname === '/api/health') {
        sendJson(res, 200, { 
            success: true, 
            status: 'ok',
            timestamp: new Date().toISOString()
        });
        return;
    }

    // 未知 API
    sendJson(res, 404, { error: '未知的 API' });
}

// 递归列出目录
function listDirectory(dirPath, depth, currentDepth = 0) {
    if (currentDepth >= depth) return [];

    const items = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        // 跳过隐藏文件和特殊目录
        if (entry.name.startsWith('.') || 
            entry.name === 'node_modules' ||
            entry.name === 'target' ||
            entry.name === 'dist') {
            continue;
        }

        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(CONFIG.BASE_PATH, fullPath);

        const item = {
            name: entry.name,
            path: fullPath,
            relativePath: relativePath,
            isDirectory: entry.isDirectory()
        };

        // 只添加 MD 文件或目录
        if (entry.isDirectory()) {
            item.children = listDirectory(fullPath, depth, currentDepth + 1);
            items.push(item);
        } else if (entry.name.toLowerCase().endsWith('.md')) {
            item.extension = path.extname(entry.name);
            const stat = fs.statSync(fullPath);
            item.size = stat.size;
            item.modified = stat.mtime;
            items.push(item);
        }
    }

    // 排序：目录在前，文件在后，按名称排序
    items.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
    });

    return items;
}

// 静态文件处理
function handleStatic(pathname, req, res) {
    // 默认返回 index.html
    let filePath = pathname === '/' ? '/index.html' : pathname;
    
    // 安全检查
    const fullPath = path.join(__dirname, 'public', filePath);
    if (!fullPath.startsWith(path.join(__dirname, 'public'))) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
        // 返回 404
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>404 Not Found</h1><p>文件不存在</p>');
        return;
    }

    // 获取文件类型
    const ext = path.extname(fullPath).toLowerCase();
    const contentTypes = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.pdf': 'application/pdf',
        '.txt': 'text/plain; charset=utf-8'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    // 读取并返回文件
    fs.readFile(fullPath, (err, data) => {
        if (err) {
            res.writeHead(500);
            res.end('Server Error');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

// 发送 JSON 响应
function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data, null, 2));
}

// 启动服务器
server.listen(CONFIG.PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   📄 MD Preview Tool - Node.js Server                 ║
║                                                       ║
║   ✅ 服务器已启动                                      ║
║   🌐 地址: http://localhost:${CONFIG.PORT}                   ║
║   📁 基础路径: ${CONFIG.BASE_PATH}         ║
║                                                       ║
║   API 接口:                                           ║
║   ├─ GET /api/health          健康检查                ║
║   ├─ GET /api/config          获取配置                ║
║   ├─ GET /api/read-file       读取文件                ║
║   └─ GET /api/list-directory  列出目录                ║
║                                                       ║
║   按 Ctrl+C 停止服务器                                ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
    `);
});

// 错误处理
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ 端口 ${CONFIG.PORT} 已被占用！`);
        console.error('请先停止占用该端口的程序，或修改 CONFIG.PORT');
    } else {
        console.error('❌ 服务器错误:', err);
    }
    process.exit(1);
});
