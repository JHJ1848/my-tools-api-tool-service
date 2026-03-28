// ========== Ctrl+F 本地搜索 ==========
let searchResults = [];
let currentSearchIndex = -1;
let searchHighlightElements = [];
let localSearchInitialized = false;

function initLocalSearch() {
    if (!localSearchInitialized) {
        createLocalSearchUi();
        bindLocalSearchEvents();
        localSearchInitialized = true;
    }

    updateLocalSearchPosition();
    refreshLocalSearchAfterContentChange();
}

function createLocalSearchUi() {
    if (document.querySelector('.local-search-wrapper')) return;

    const searchBoxWrapper = document.createElement('div');
    searchBoxWrapper.className = 'local-search-wrapper';
    searchBoxWrapper.style.display = 'none';

    const searchBox = document.createElement('div');
    searchBox.className = 'local-search-box';
    searchBox.innerHTML = `
        <div class="local-search-row">
            <input type="text" id="localSearchInput" placeholder="在当前预览中搜索..." autocomplete="off" />
            <span class="search-count" id="searchCount">0/0</span>
            <button type="button" class="search-nav-btn" id="prevMatch" title="上一个匹配 (Shift+Enter)">▲</button>
            <button type="button" class="search-nav-btn" id="nextMatch" title="下一个匹配 (Enter)">▼</button>
            <button type="button" class="search-close-btn" id="closeSearch" title="关闭 (Esc)">×</button>
        </div>
        <div class="local-search-options">
            <label class="search-option">
                <input type="checkbox" id="localSearchCaseSensitive" />
                <span>区分大小写</span>
            </label>
            <label class="search-option">
                <input type="checkbox" id="localSearchWholeWord" />
                <span>全字匹配</span>
            </label>
        </div>
    `;
    searchBoxWrapper.appendChild(searchBox);
    document.body.appendChild(searchBoxWrapper);
}

function bindLocalSearchEvents() {
    const input = document.getElementById('localSearchInput');
    const caseSensitive = document.getElementById('localSearchCaseSensitive');
    const wholeWord = document.getElementById('localSearchWholeWord');

    input.addEventListener('input', performLocalSearch);
    caseSensitive.addEventListener('change', performLocalSearch);
    wholeWord.addEventListener('change', performLocalSearch);
    document.getElementById('prevMatch').addEventListener('click', prevSearchResult);
    document.getElementById('nextMatch').addEventListener('click', nextSearchResult);
    document.getElementById('closeSearch').addEventListener('click', closeLocalSearch);

    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) prevSearchResult();
            else nextSearchResult();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeLocalSearch();
        }
    });

    window.addEventListener('resize', updateLocalSearchPosition);

    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
            e.preventDefault();
            openLocalSearch();
            return;
        }

        if (e.key === 'Escape' && isLocalSearchOpen()) {
            e.preventDefault();
            closeLocalSearch();
            return;
        }

        if (e.key === 'Enter' && isLocalSearchOpen() && document.activeElement !== input) {
            e.preventDefault();
            if (e.shiftKey) prevSearchResult();
            else nextSearchResult();
        }
    });
}

function openLocalSearch() {
    const wrapper = document.querySelector('.local-search-wrapper');
    if (!wrapper) return;

    wrapper.style.display = 'block';
    updateLocalSearchPosition();

    const input = document.getElementById('localSearchInput');
    input.focus();
    input.select();

    if (input.value.trim()) {
        performLocalSearch();
    } else {
        updateSearchCount();
    }
}

function isLocalSearchOpen() {
    const wrapper = document.querySelector('.local-search-wrapper');
    return !!wrapper && wrapper.style.display !== 'none';
}

function updateLocalSearchPosition() {
    const wrapper = document.querySelector('.local-search-wrapper');
    if (!wrapper) return;

    const toolbar = document.querySelector('.toolbar');
    const tabsBar = document.querySelector('.tabs-bar');
    const top = toolbar
        ? Math.round(toolbar.getBoundingClientRect().bottom + 12)
        : ((tabsBar ? tabsBar.getBoundingClientRect().bottom : 0) + 12);

    wrapper.style.top = `${Math.max(top, 16)}px`;
}

function refreshLocalSearchAfterContentChange() {
    clearSearchHighlights();
    if (isLocalSearchOpen() && document.getElementById('localSearchInput').value.trim()) {
        performLocalSearch();
    } else {
        updateSearchCount();
    }
}

function performLocalSearch() {
    clearSearchHighlights();

    const searchText = document.getElementById('localSearchInput').value.trim();
    if (!searchText) {
        updateSearchCount();
        return;
    }

    const contentArea = getLocalSearchContentArea();
    if (!contentArea) {
        updateSearchCount();
        return;
    }

    const matcher = buildLocalSearchMatcher(searchText);
    const matchGroups = collectSearchMatches(contentArea, matcher);
    searchResults = matchGroups;

    if (!matchGroups.length) {
        updateSearchCount();
        return;
    }

    searchHighlightElements = wrapSearchMatches(matchGroups);
    currentSearchIndex = searchHighlightElements.length > 0 ? 0 : -1;
    updateSearchCount();

    if (currentSearchIndex >= 0) {
        scrollToSearchResult(currentSearchIndex);
    }
}

function getLocalSearchContentArea() {
    const previewArea = document.getElementById('markdown-body');
    if (!previewArea || previewArea.style.display === 'none') return null;
    return previewArea;
}

function buildLocalSearchMatcher(searchText) {
    const caseSensitive = document.getElementById('localSearchCaseSensitive').checked;
    const wholeWord = document.getElementById('localSearchWholeWord').checked;
    const normalizedSearchText = caseSensitive ? searchText : searchText.toLocaleLowerCase();

    return function matcher(text) {
        const sourceText = caseSensitive ? text : text.toLocaleLowerCase();
        const matches = [];
        let startIndex = 0;

        while (startIndex <= sourceText.length) {
            const foundIndex = sourceText.indexOf(normalizedSearchText, startIndex);
            if (foundIndex === -1) break;

            const endIndex = foundIndex + searchText.length;
            if (!wholeWord || isWholeWordBoundary(text, foundIndex, endIndex)) {
                matches.push({ index: foundIndex, length: searchText.length });
            }

            startIndex = foundIndex + Math.max(searchText.length, 1);
        }

        return matches;
    };
}

function collectSearchMatches(contentArea, matcher) {
    const walker = document.createTreeWalker(contentArea, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node.textContent || !node.textContent.trim()) {
                return NodeFilter.FILTER_REJECT;
            }

            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA'].includes(parent.tagName)) {
                return NodeFilter.FILTER_REJECT;
            }
            if (parent.closest('.search-highlight')) {
                return NodeFilter.FILTER_REJECT;
            }

            return NodeFilter.FILTER_ACCEPT;
        }
    });

    const groups = [];
    while (walker.nextNode()) {
        const node = walker.currentNode;
        const matches = matcher(node.textContent);
        if (matches.length) {
            groups.push({ node, matches });
        }
    }

    return groups;
}

function wrapSearchMatches(matchGroups) {
    const highlights = [];

    matchGroups.forEach(({ node, matches }) => {
        const fragment = document.createDocumentFragment();
        const text = node.textContent;
        let cursor = 0;

        matches.forEach(match => {
            if (match.index > cursor) {
                fragment.appendChild(document.createTextNode(text.slice(cursor, match.index)));
            }

            const highlight = document.createElement('mark');
            highlight.className = 'search-highlight';
            highlight.textContent = text.slice(match.index, match.index + match.length);
            fragment.appendChild(highlight);
            highlights.push(highlight);
            cursor = match.index + match.length;
        });

        if (cursor < text.length) {
            fragment.appendChild(document.createTextNode(text.slice(cursor)));
        }

        node.parentNode.replaceChild(fragment, node);
    });

    return highlights;
}

function clearSearchHighlights() {
    const highlights = document.querySelectorAll('.search-highlight');
    highlights.forEach(el => {
        const parent = el.parentNode;
        if (!parent) return;

        parent.replaceChild(document.createTextNode(el.textContent), el);
        parent.normalize();
    });

    searchHighlightElements = [];
    searchResults = [];
    currentSearchIndex = -1;
}

function updateSearchCount() {
    const countEl = document.getElementById('searchCount');
    if (!countEl) return;

    const total = searchHighlightElements.length;
    countEl.textContent = total > 0 ? `${currentSearchIndex + 1}/${total}` : '0/0';
}

function scrollToSearchResult(index) {
    if (index < 0 || index >= searchHighlightElements.length) return;

    searchHighlightElements.forEach(el => el.classList.remove('current'));

    const currentEl = searchHighlightElements[index];
    currentEl.classList.add('current');
    currentEl.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: 'smooth'
    });
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

    const input = document.getElementById('localSearchInput');
    const count = document.getElementById('searchCount');
    const wrapper = document.querySelector('.local-search-wrapper');

    if (input) input.value = '';
    if (count) count.textContent = '0/0';
    if (wrapper) wrapper.style.display = 'none';
}

function isWholeWordBoundary(text, start, end) {
    const previousChar = start > 0 ? text[start - 1] : '';
    const nextChar = end < text.length ? text[end] : '';
    return !isWordCharacter(previousChar) && !isWordCharacter(nextChar);
}

function isWordCharacter(char) {
    return !!char && /[\p{L}\p{N}_]/u.test(char);
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ========== 双击 Shift 全局搜索 ==========
let shiftPressCount = 0;
let shiftPressTimer = null;
let globalSearchResults = [];
let allMdFiles = [];
let globalSearchInitialized = false;

function initGlobalSearch() {
    if (globalSearchInitialized) return;

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

    document.getElementById('globalSearchClose').addEventListener('click', closeGlobalSearch);
    searchModal.addEventListener('click', function(e) {
        if (e.target === searchModal) closeGlobalSearch();
    });

    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Shift') return;

        shiftPressCount += 1;
        if (shiftPressCount === 1) {
            shiftPressTimer = setTimeout(() => {
                shiftPressCount = 0;
            }, 500);
        } else if (shiftPressCount === 2) {
            clearTimeout(shiftPressTimer);
            shiftPressCount = 0;
            openGlobalSearch();
        }
    });

    document.getElementById('globalSearchInput').addEventListener('input', performGlobalSearch);
    globalSearchInitialized = true;
}

function openGlobalSearch() {
    const modal = document.getElementById('globalSearchModal');
    if (!modal) return;

    modal.style.display = 'flex';
    document.getElementById('globalSearchInput').focus();
    loadAllMdFiles();
}

function closeGlobalSearch() {
    const modal = document.getElementById('globalSearchModal');
    if (!modal) return;

    modal.style.display = 'none';
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
        const totalMatches = globalSearchResults.reduce((sum, r) => sum + r.count, 0);
        countContainer.innerHTML = `<span class="match-count">${totalMatches} 个匹配</span>`;

        resultsContainer.innerHTML = globalSearchResults.map(result => {
            const fileName = result.file.split(/[\\/]/).pop();
            return `
                <div class="global-result-item">
                    <div class="global-result-header" onclick="toggleGlobalResult(this)">
                        <span class="global-result-name">${escapeHtml(fileName)}</span>
                        <span class="global-result-count">${result.count} 个匹配</span>
                    </div>
                    <div class="global-result-content" style="display:none;">
                        ${result.matches.map(m => {
                            const contextLines = getContextLines(result.allLines, m.lineNumber);
                            return `
                                <div class="global-match-line">
                                    <div class="line-number">${m.lineNumber}</div>
                                    <div class="line-content">
                                        <pre>${highlightMatch(escapeHtml(contextLines.before + m.content + contextLines.after), searchText)}</pre>
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

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function toggleGlobalResult(header) {
    const content = header.nextElementSibling;
    content.style.display = content.style.display === 'none' ? 'block' : 'none';
}

// 标题跳转对话框
function showGotoDialog() {
    let dialog = document.getElementById('gotoDialog');
    if (dialog) {
        dialog.style.display = 'flex';
        return;
    }

    dialog = document.createElement('div');
    dialog.id = 'gotoDialog';
    dialog.className = 'global-search-modal';

    const tocItems = document.querySelectorAll('.toc-item');
    let optionsHtml = '';
    tocItems.forEach(item => {
        const level = item.getAttribute('data-level') || '1';
        const text = item.textContent;
        const id = item.getAttribute('data-id');
        const paddingLeft = (level - 1) * 16;
        optionsHtml += `<div class="goto-option" style="padding-left:${paddingLeft}px" data-id="${escapeHtml(id)}">${escapeHtml(text)}</div>`;
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

    document.getElementById('gotoSearchInput').addEventListener('input', function(e) {
        const term = e.target.value.toLowerCase();
        const options = document.querySelectorAll('.goto-option');
        options.forEach(opt => {
            opt.style.display = opt.textContent.toLowerCase().includes(term) ? '' : 'none';
        });
    });

    document.querySelectorAll('.goto-option').forEach(opt => {
        opt.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            const targetElement = document.getElementById(id);
            const contentArea = document.querySelector('.markdown-body');
            if (targetElement && contentArea) {
                targetElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
                targetElement.classList.add('flash');
                setTimeout(() => targetElement.classList.remove('flash'), 600);
            }
            dialog.style.display = 'none';
        });
    });
}
