// ========== Ctrl+F 本地搜索功能 ==========
let searchResults = [];
let currentSearchIndex = -1;
let searchHighlightElements = [];

function initLocalSearch() {
    // 创建搜索框（放到工具栏容器中）
    const searchBoxWrapper = document.createElement('div');
    searchBoxWrapper.className = 'local-search-wrapper';
    searchBoxWrapper.style.display = 'none';

    const searchBox = document.createElement('div');
    searchBox.className = 'local-search-box';
    searchBox.innerHTML = `
        <input type="text" id="localSearchInput" placeholder="在当前文档中搜索..." />
        <div class="search-controls">
            <span class="search-count" id="searchCount"></span>
            <button class="search-nav-btn" id="prevMatch" title="上一个(Shift+Enter)">▲</button>
            <button class="search-nav-btn" id="nextMatch" title="下一个(Enter)">▼</button>
            <button class="search-close-btn" id="closeSearch" title="关闭(Esc)">×</button>
        </div>
    `;
    searchBoxWrapper.appendChild(searchBox);

    // 找到工具栏并在其下方插入
    const toolbar = document.querySelector('.toolbar');
    if (toolbar) {
        toolbar.appendChild(searchBoxWrapper);
    } else {
        document.body.appendChild(searchBoxWrapper);
    }

    // 事件绑定
    document.getElementById('localSearchInput').addEventListener('input', performLocalSearch);
    document.getElementById('prevMatch').addEventListener('click', prevSearchResult);
    document.getElementById('nextMatch').addEventListener('click', nextSearchResult);
    document.getElementById('closeSearch').addEventListener('click', closeLocalSearch);

    // Ctrl+F 打开搜索
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            document.querySelector('.local-search-wrapper').style.display = 'block';
            document.getElementById('localSearchInput').focus();
        }
        if (e.key === 'Escape') {
            closeLocalSearch();
        }
        // 搜索结果导航
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                prevSearchResult();
            } else {
                nextSearchResult();
            }
        }
    });
}

function performLocalSearch() {
    // 清除之前的高亮
    clearSearchHighlights();

    const searchText = document.getElementById('localSearchInput').value.trim();
    if (!searchText) {
        document.getElementById('searchCount').textContent = '';
        return;
    }

    // 只搜索当前显示的内容区域
    const previewArea = document.getElementById('markdown-body');
    const rawArea = document.getElementById('raw-body');
    let contentArea = null;

    if (previewArea && previewArea.style.display !== 'none') {
        contentArea = previewArea;
    } else if (rawArea && rawArea.style.display !== 'none') {
        contentArea = rawArea;
    }

    if (!contentArea) {
        contentArea = document.querySelector('.markdown-body');
    }
    if (!contentArea) return;

    const regex = new RegExp('(' + escapeRegExp(searchText) + ')', 'gi');

    // 获取所有文本节点
    const walker = document.createTreeWalker(contentArea, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    while (walker.nextNode()) {
        const node = walker.currentNode;
        // 跳过script和style
        if (node.parentElement && ['SCRIPT', 'STYLE'].includes(node.parentElement.tagName)) continue;
        textNodes.push(node);
    }

    searchResults = [];
    textNodes.forEach(node => {
        const text = node.textContent;
        let match;
        while ((match = regex.exec(text)) !== null) {
            searchResults.push({
                node: node,
                index: match.index,
                text: match[0]
            });
        }
    });

    // 创建高亮（使用更安全的方式）
    searchResults.forEach((result) => {
        try {
            const span = document.createElement('span');
            span.className = 'search-highlight';

            // 检查节点是否可以被分割
            const node = result.node;
            const text = node.textContent;

            if (node.nodeType === Node.TEXT_NODE && node.parentNode) {
                const before = text.substring(0, result.index);
                const match = result.text;
                const after = text.substring(result.index + match.length);

                const beforeNode = document.createTextNode(before);
                const afterNode = document.createTextNode(after);

                span.textContent = match;

                node.parentNode.insertBefore(beforeNode, node);
                node.parentNode.insertBefore(span, node);
                node.parentNode.insertBefore(afterNode, node);
                node.parentNode.removeChild(node);

                searchHighlightElements.push(span);
            }
        } catch (e) {
            console.log('高亮创建失败:', e);
        }
    });

    currentSearchIndex = searchHighlightElements.length > 0 ? 0 : -1;
    updateSearchCount();
    if (currentSearchIndex >= 0) {
        scrollToSearchResult(currentSearchIndex);
    }
}

function clearSearchHighlights() {
    // 移除所有高亮元素
    const highlights = document.querySelectorAll('.search-highlight');
    highlights.forEach(el => {
        const parent = el.parentNode;
        if (parent) {
            const text = document.createTextNode(el.textContent);
            parent.replaceChild(text, el);
            parent.normalize();
        }
    });
    searchHighlightElements = [];
    searchResults = [];
}

function updateSearchCount() {
    const countEl = document.getElementById('searchCount');
    const total = searchHighlightElements.length;
    if (total > 0) {
        countEl.textContent = (currentSearchIndex + 1) + '/' + total;
    } else {
        countEl.textContent = '0/' + total;
    }
}

function scrollToSearchResult(index) {
    if (index < 0 || index >= searchHighlightElements.length) return;

    // 清除之前的高亮当前状态
    searchHighlightElements.forEach(el => el.classList.remove('current'));

    const currentEl = searchHighlightElements[index];
    currentEl.classList.add('current');

    const contentArea = document.querySelector('.markdown-body');
    const mainRect = document.querySelector('main').getBoundingClientRect();
    const targetRect = currentEl.getBoundingClientRect();
    const tabsHeight = document.querySelector('.tabs-bar').offsetHeight || 0;
    const toolbarHeight = document.querySelector('.toolbar').offsetHeight || 0;
    const offset = tabsHeight + toolbarHeight + 20;

    const deltaY = targetRect.top - mainRect.top - offset;
    contentArea.scrollTop = contentArea.scrollTop + deltaY;
}

function nextSearchResult() {
    if (searchHighlightElements.length === 0) return;
    currentSearchIndex = (currentSearchIndex + 1) % searchHighlightElements.length;
    updateSearchCount();
    scrollToSearchResult(currentSearchIndex);
}

function prevSearchResult() {
    if (searchHighlightElements.length === 0) return;
    currentSearchIndex = (currentSearchIndex - 1 + searchHighlightElements.length) % searchHighlightElements.length;
    updateSearchCount();
    scrollToSearchResult(currentSearchIndex);
}

function closeLocalSearch() {
    clearSearchHighlights();
    document.getElementById('localSearchInput').value = '';
    document.getElementById('searchCount').textContent = '';
    document.querySelector('.local-search-wrapper').style.display = 'none';
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ========== 两下Shift全局搜索功能 ==========
let shiftPressCount = 0;
let shiftPressTimer = null;
let globalSearchResults = [];
let allMdFiles = [];

function initGlobalSearch() {
    // 创建全局搜索弹窗
    const searchModal = document.createElement('div');
    searchModal.id = 'globalSearchModal';
    searchModal.className = 'global-search-modal';
    searchModal.innerHTML = `
        <div class="global-search-container">
            <div class="global-search-header">
                <input type="text" id="globalSearchInput" placeholder="全局搜索..." />
                <button class="global-search-close" id="globalSearchClose">×</button>
            </div>
            <div class="global-search-count" id="globalSearchCount"></div>
            <div class="global-search-results" id="globalSearchResults"></div>
        </div>
    `;
    document.body.appendChild(searchModal);

    // 关闭按钮
    document.getElementById('globalSearchClose').addEventListener('click', closeGlobalSearch);
    searchModal.addEventListener('click', function(e) {
        if (e.target === searchModal) closeGlobalSearch();
    });

    // 监听Shift键
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Shift') {
            shiftPressCount++;

            if (shiftPressCount === 1) {
                shiftPressTimer = setTimeout(() => {
                    shiftPressCount = 0;
                }, 500);
            } else if (shiftPressCount === 2) {
                clearTimeout(shiftPressTimer);
                shiftPressCount = 0;
                openGlobalSearch();
            }
        }
    });

    // 搜索输入
    document.getElementById('globalSearchInput').addEventListener('input', performGlobalSearch);
}

function openGlobalSearch() {
    document.getElementById('globalSearchModal').style.display = 'flex';
    document.getElementById('globalSearchInput').focus();
    // 加载所有MD文件列表
    loadAllMdFiles();
}

function closeGlobalSearch() {
    document.getElementById('globalSearchModal').style.display = 'none';
    document.getElementById('globalSearchInput').value = '';
    document.getElementById('globalSearchCount').textContent = '';
    document.getElementById('globalSearchResults').innerHTML = '';
}

function loadAllMdFiles() {
    fetch('/md-list')
        .then(response => response.json())
        .then(files => {
            allMdFiles = files;
            performGlobalSearch();
        });
}

function performGlobalSearch() {
    const searchText = document.getElementById('globalSearchInput').value.trim();
    const resultsContainer = document.getElementById('globalSearchResults');
    const countContainer = document.getElementById('globalSearchCount');

    if (!searchText) {
        countContainer.textContent = '';
        resultsContainer.innerHTML = '';
        return;
    }

    globalSearchResults = [];
    const searchPromises = allMdFiles.map(file => {
        return fetch('/md-content?path=' + encodeURIComponent(file))
            .then(response => response.text())
            .then(content => {
                const lines = content.split('\n');
                const matches = [];
                lines.forEach((line, idx) => {
                    if (line.toLowerCase().includes(searchText.toLowerCase())) {
                        matches.push({
                            lineNumber: idx + 1,
                            content: line
                        });
                    }
                });
                if (matches.length > 0) {
                    globalSearchResults.push({
                        file: file,
                        matches: matches,
                        count: matches.length,
                        allLines: lines
                    });
                }
            });
    });

    Promise.all(searchPromises).then(() => {
        // 统计总匹配数
        const totalMatches = globalSearchResults.reduce((sum, r) => sum + r.count, 0);
        countContainer.innerHTML = `<span class="match-count">${totalMatches}个匹配</span>`;

        // 渲染结果
        resultsContainer.innerHTML = globalSearchResults.map(result => {
            const fileName = result.file.split(/[\\/]/).pop();
            return `
                <div class="global-result-item">
                    <div class="global-result-header" onclick="toggleGlobalResult(this)">
                        <span class="global-result-name">${fileName}</span>
                        <span class="global-result-count">${result.count}个匹配</span>
                    </div>
                    <div class="global-result-content" style="display:none;">
                        ${result.matches.map(m => {
                            const contextLines = getContextLines(result.allLines, m.lineNumber);
                            return `
                                <div class="global-match-line">
                                    <div class="line-number">${m.lineNumber}</div>
                                    <div class="line-content">
                                        <pre>${escapeHtml(contextLines.before + highlightMatch(m.content, searchText) + contextLines.after)}</pre>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }).join('');
    });
}

function getContextLines(allLines, lineNum) {
    const idx = lineNum - 1;
    const beforeLines = [];
    const afterLines = [];

    for (let i = 1; i <= 10; i++) {
        if (idx - i >= 0) beforeLines.unshift(allLines[idx - i]);
        if (idx + i < allLines.length) afterLines.push(allLines[idx + i]);
    }
    return {
        before: beforeLines.join('\n'),
        after: afterLines.join('\n')
    };
}

function highlightMatch(text, searchText) {
    const regex = new RegExp('(' + escapeRegExp(searchText) + ')', 'gi');
    return text.replace(regex, '<span class="global-highlight">$1</span>');
}

function toggleGlobalResult(header) {
    const content = header.nextElementSibling;
    content.style.display = content.style.display === 'none' ? 'block' : 'none';
}

// 标题跳转对话框
function showGotoDialog() {
    // 检查是否已有对话框
    let dialog = document.getElementById('gotoDialog');
    if (dialog) {
        dialog.style.display = 'flex';
        return;
    }

    dialog = document.createElement('div');
    dialog.id = 'gotoDialog';
    dialog.className = 'global-search-modal';

    // 获取所有标题
    const tocItems = document.querySelectorAll('.toc-item');
    let optionsHtml = '';
    tocItems.forEach(item => {
        const level = item.getAttribute('data-level') || '1';
        const text = item.textContent;
        const id = item.getAttribute('data-id');
        const paddingLeft = (level - 1) * 16;
        optionsHtml += `<div class="goto-option" style="padding-left:${paddingLeft}px" data-id="${id}">${text}</div>`;
    });

    dialog.innerHTML = `
        <div class="global-search-container" style="max-height:400px;">
            <div class="global-search-header">
                <input type="text" id="gotoSearchInput" placeholder="搜索标题..." />
                <button class="global-search-close" id="gotoDialogClose">×</button>
            </div>
            <div class="global-search-results" id="gotoResults" style="max-height:300px;">
                ${optionsHtml}
            </div>
        </div>
    `;
    document.body.appendChild(dialog);

    document.getElementById('gotoDialogClose').addEventListener('click', function() {
        dialog.style.display = 'none';
    });

    dialog.addEventListener('click', function(e) {
        if (e.target === dialog) dialog.style.display = 'none';
    });

    // 搜索过滤
    document.getElementById('gotoSearchInput').addEventListener('input', function(e) {
        const term = e.target.value.toLowerCase();
        const options = document.querySelectorAll('.goto-option');
        options.forEach(opt => {
            if (opt.textContent.toLowerCase().includes(term)) {
                opt.style.display = '';
            } else {
                opt.style.display = 'none';
            }
        });
    });

    // 点击跳转
    document.querySelectorAll('.goto-option').forEach(opt => {
        opt.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            const targetElement = document.getElementById(id);
            const contentArea = document.querySelector('.markdown-body');
            if (targetElement && contentArea) {
                const mainRect = document.querySelector('main').getBoundingClientRect();
                const targetRect = targetElement.getBoundingClientRect();
                const tabsHeight = document.querySelector('.tabs-bar').offsetHeight || 0;
                const toolbarHeight = document.querySelector('.toolbar').offsetHeight || 0;
                const offset = tabsHeight + toolbarHeight + 20;
                const deltaY = targetRect.top - mainRect.top - offset;
                contentArea.scrollTop = contentArea.scrollTop + deltaY;
                // 高亮
                targetElement.classList.add('flash');
                setTimeout(() => targetElement.classList.remove('flash'), 600);
            }
            dialog.style.display = 'none';
        });
    });
}
