# MCP Tool Service

达梦数据库和Markdown预览MCP服务，基于Spring Boot 3.2.0 + Java 17，为AI客户端提供MCP协议服务。

## 功能特性

- **达梦数据库服务**: 支持SQL查询、表结构查看、数据源管理
- **Markdown预览**: 支持MD文件列表、读取、HTML渲染预览
- **MCP协议**: 支持标准JSON-RPC 2.0 MCP协议

## 快速开始

### 构建项目

```bash
mvn clean package
```

### 运行项目

```bash
java -jar target/tool-service-1.0.0.jar
```

服务启动后访问: http://localhost:9527

---

## 用户配置说明

首次使用需要配置以下内容：

### 1. 配置文件目录

在jar包同级目录下创建 `config` 文件夹，并添加以下配置文件：

```
your-app/
├── tool-service-1.0.0.jar
└── config/
    ├── application-dameng.yml   # 达梦数据库配置
    ├── application-md.yml       # Markdown配置
    └── application-mcp.yml      # MCP服务配置
```

### 2. 达梦数据库配置 (application-dameng.yml)

```yaml
spring:
  datasource:
    dynamic:
      primary: master
      datasource:
        master:
          username: ${DAMENG_USERNAME:}      # 数据库用户名
          password: ${DAMENG_PASSWORD:}      # 数据库密码
          driver-class-name: dm.jdbc.driver.DmDriver
          url: jdbc:dm://${DAMENG_HOST:localhost}:${DAMENG_PORT:5236}/${DAMENG_DATABASE:}?useUnicode=true&characterEncoding=utf-8
        sso:
          username: ${DAMENG_USERNAME:}
          password: ${DAMENG_PASSWORD:}
          driver-class-name: dm.jdbc.driver.DmDriver
          url: jdbc:dm://${DAMENG_HOST:localhost}:${DAMENG_PORT:5236}/${DAMENG_DATABASE:}?useUnicode=true&characterEncoding=utf-8
        FARMLAND_ENGINEER_QUALITY_INSPECT:
          username: ${DAMENG_USERNAME:}
          password: ${DAMENG_PASSWORD:}
          driver-class-name: dm.jdbc.driver.DmDriver
          url: jdbc:dm://${DAMENG_HOST:localhost}:${DAMENG_PORT:5236}/${DAMENG_DATABASE_FARMLAND:}?useUnicode=true&characterEncoding=utf-8
```

**必填配置项**:
| 环境变量 | 说明 | 示例值 |
|---------|------|--------|
| `DAMENG_HOST` | 达梦数据库主机地址 | 192.168.88.121 |
| `DAMENG_PORT` | 达梦数据库端口 | 5236 |
| `DAMENG_DATABASE` | 主数据库名称 | SOIL_SURVEY_DATA_APPLY |
| `DAMENG_DATABASE_FARMLAND` | 农田工程质量数据库名 | FARMLAND_ENGINEER_QUALITY_INSPECT |
| `DAMENG_USERNAME` | 数据库用户名 | SYSDBA |
| `DAMENG_PASSWORD` | 数据库密码 | your_password |

### 3. Markdown配置 (application-md.yml)

```yaml
markdown:
  preview:
    root-paths: ${MD_ROOT_PATHS:./docs,./md-files}  # MD文件根目录，多个用逗号分隔
    enable-image-preview: ${MD_ENABLE_IMAGE_PREVIEW:true}
    allowed-extensions: ${MD_ALLOWED_EXTENSIONS:.md,.markdown,.txt}
    max-file-size: ${MD_MAX_FILE_SIZE:10}
```

**可选配置项**:
| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `MD_ROOT_PATHS` | MD文件根目录 | ./docs,./md-files |

### 4. MCP服务配置 (application-mcp.yml)

```yaml
server:
  port: ${SERVER_PORT:9527}  # 服务端口

# 功能模块开关
tool-service:
  # 达梦数据库模块开关 (HTTP + MCP服务)
  dameng:
    enabled: ${TOOL_DAMENG_ENABLED:true}
  # Markdown预览模块开关
  markdown:
    enabled: ${TOOL_MARKDOWN_ENABLED:true}

mcp:
  service:
    enabled: ${MCP_ENABLED:true}
    api-key: ${MCP_API_KEY:}  # API密钥认证
  history:
    enabled: ${MCP_HISTORY_ENABLED:true}
    max-records: ${MCP_HISTORY_MAX_RECORDS:1000}

logging:
  level:
    com.example: ${LOG_LEVEL:INFO}
  file:
    name: ${LOG_FILE_PATH:logs/error.log}
```

**功能开关说明**:
| 环境变量 | 说明 | 默认值 | 可选值 |
|---------|------|--------|--------|
| `TOOL_DAMENG_ENABLED` | 是否启用达梦数据库功能 | true | true/false |
| `TOOL_MARKDOWN_ENABLED` | 是否启用Markdown预览功能 | true | true/false |
| `SERVER_PORT` | 服务端口 | 9527 | 任意可用端口 |
| `MCP_API_KEY` | API密钥（可选） | - | 任意字符串 |

---

## API端点

| 端点 | 说明 |
|------|------|
| `GET /api/health` | 健康检查 |
| `POST /api/mcp/query` | 执行SELECT查询 |
| `POST /api/mcp/update` | 执行DML更新 |
| `POST /api/mcp/execute-sql` | 智能执行SQL |
| `GET /api/mcp/tables` | 获取表列表 |
| `GET /api/mcp/table-info` | 获取表结构 |
| `GET /api/md/list` | 列出MD文件 |
| `GET /preview/md/{path}` | 预览MD文件 |

---

## 配置文件模板

参考 `config-template/` 目录下的模板文件：

- [config-template/application-dameng.yml](config-template/application-dameng.yml)
- [config-template/application-md.yml](config-template/application-md.yml)
- [config-template/application-mcp.yml](config-template/application-mcp.yml)
