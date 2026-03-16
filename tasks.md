# MCP 工具服务模块实现任务

## 任务清单

### 任务1: 创建MCP协议处理器
- [ ] 1.1 创建McpJsonRpcController - 处理JSON-RPC 2.0请求
- [ ] 1.2 实现McpProtocolHandler - MCP协议核心逻辑
- [ ] 1.3 实现McpServerCapability - 服务端能力定义

### 任务2: 实现MD预览MCP工具
- [ ] 2.1 创建MarkdownMcpTool - MD预览工具封装
- [ ] 2.2 实现md_list_files工具方法
- [ ] 2.3 实现md_read_file工具方法
- [ ] 2.4 实现md_render工具方法

### 任务3: 实现数据库查询MCP工具
- [ ] 3.1 创建DatabaseMcpTool - 数据库工具封装
- [ ] 3.2 实现dm_query工具方法
- [ ] 3.3 实现dm_execute_sql工具方法
- [ ] 3.4 实现dm_list_tables工具方法
- [ ] 3.5 实现dm_table_info工具方法
- [ ] 3.6 实现dm_list_datasources工具方法

### 任务4: 支持外部数据库配置
- [ ] 4.1 修改DataSourceConfig支持环境变量覆盖
- [ ] 4.2 创建ExternalDbConfig类读取外部配置
- [ ] 4.3 配置application.yml支持外部配置注入

### 任务5: 创建MCP配置模板
- [ ] 5.1 创建claude-desktop-mcp-config.json
- [ ] 5.2 创建cursor-mcp-config.json
- [ ] 5.3 创建env-config-mcp-template.json

### 任务6: 单元测试与验证
- [ ] 6.1 测试MCP协议初始化流程
- [ ] 6.2 测试工具列表接口
- [ ] 6.3 测试工具调用接口
- [ ] 6.4 测试外部配置生效

---

## 实现顺序

1. 任务1 - MCP协议处理器（基础）
2. 任务2 - MD预览工具
3. 任务3 - 数据库查询工具
4. 任务4 - 外部配置支持
5. 任务5 - 配置模板
6. 任务6 - 测试验证
