package com.example.tool.mcp;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

@Service
public class MarkdownPreviewCacheService {

    private static final long SIDEBAR_CACHE_TTL_MS = 30_000L;

    private final Map<String, SidebarCacheEntry> sidebarCache = new ConcurrentHashMap<>();
    private final Map<String, DocumentCacheEntry> documentCache = new ConcurrentHashMap<>();

    public SidebarCacheResult getSidebarData(String workspacePath,
                                            String scope,
                                            Supplier<SidebarPayload> supplier) {
        String key = normalizeKey(workspacePath) + "::" + normalizeKey(scope);
        long now = System.currentTimeMillis();
        SidebarCacheEntry cached = sidebarCache.get(key);
        if (cached != null && now - cached.cachedAt <= SIDEBAR_CACHE_TTL_MS) {
            return new SidebarCacheResult(cached.payload, true);
        }
        SidebarPayload payload = supplier.get();
        sidebarCache.put(key, new SidebarCacheEntry(payload, now));
        return new SidebarCacheResult(payload, false);
    }

    public DocumentCacheResult getDocumentData(String filePath,
                                               long lastModified,
                                               long fileSize,
                                               Supplier<DocumentPayload> supplier) {
        String key = normalizeKey(filePath);
        DocumentCacheEntry cached = documentCache.get(key);
        if (cached != null && cached.lastModified == lastModified && cached.fileSize == fileSize) {
            return new DocumentCacheResult(cached.payload, true);
        }
        DocumentPayload payload = supplier.get();
        documentCache.put(key, new DocumentCacheEntry(payload, lastModified, fileSize));
        return new DocumentCacheResult(payload, false);
    }

    public void evictDocument(String filePath) {
        documentCache.remove(normalizeKey(filePath));
    }

    public void clearAll() {
        sidebarCache.clear();
        documentCache.clear();
    }

    private String normalizeKey(String value) {
        return String.valueOf(value == null ? "" : value).trim().replace('\\', '/');
    }

    public record SidebarPayload(List<String> files, List<String> directories) {
    }

    public record SidebarCacheResult(SidebarPayload payload, boolean cacheHit) {
    }

    public record DocumentPayload(String title,
                                  String content,
                                  String toc,
                                  List<Map<String, Object>> apiSections) {
    }

    public record DocumentCacheResult(DocumentPayload payload, boolean cacheHit) {
    }

    private record SidebarCacheEntry(SidebarPayload payload, long cachedAt) {
    }

    private record DocumentCacheEntry(DocumentPayload payload, long lastModified, long fileSize) {
    }
}
