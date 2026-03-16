# 达梦数据库MCP工具服务实现计划

## 项目概述
- **项目类型**: MCP服务器（工具服务）
- **核心功能**: 提供达梦数据库SQL查询能力的MCP工具服务
- **技术栈**: Spring Boot + Dameng JDBC

## 功能需求分析

### 1. 达梦数据库连接配置
- 配置两个数据源：master（主数据源）和sso（SSO数据源）
- 使用DmJdbcDriver18驱动（版本8.1.2.192）
- 数据库地址：127.0.0.1:5236
- 数据库实例：FARMLAND_ENGINEER_QUALITY_INSPECT

### 2. SQL查询工具实现
- 支持SQL查询操作（SELECT）
- 禁止修改操作（UPDATE/DELETE/INSERT）- 查询时驳回
- 返回查询结果

### 3. MCP服务集成
- 将数据库查询能力封装为MCP工具
- 提供统一的工具调用接口

## 实施步骤

### 第一步：项目基础结构搭建
- 创建Spring Boot项目基础结构
- 添加Maven依赖（Spring Boot、Web、Dameng驱动）
- 配置application.yml数据源

### 第二步：数据库配置实现
- 创建DataSource配置类
- 配置多数据源（master和sso）
- 实现数据源切换机制

### 第三步：SQL查询服务实现
- 创建SQL执行服务类
- 实现SQL语句解析和验证（仅允许SELECT）
- 实现查询结果转换为JSON

### 第四步：MCP工具封装
- 创建MCP工具定义
- 实现工具处理器
- 注册工具到MCP服务

### 第五步：测试验证
- 编写单元测试
- 验证查询功能
- 验证修改/删除驳回逻辑

## 技术配置详情

### Maven依赖
```xml
<dependency>
    <groupId>com.dameng</groupId>
    <artifactId>DmJdbcDriver18</artifactId>
    <version>8.1.2.192</version>
</dependency>
```

### 数据源配置
```yaml
spring.datasource.dynamic.datasource.master:
  username: SYSDBA
  password: mll123!@#
  driver-class-name: dm.jdbc.driver.DmDriver
  url: jdbc:dm://127.0.0.1:5236/FARMLAND_ENGINEER_QUALITY_INSPECT?useUnicode=true&characterEncoding=utf-8

spring.datasource.dynamic.datasource.sso:
  username: SYSDBA
  password: mll123!@#
  driver-class-name: dm.jdbc.driver.DmDriver
  url: jdbc:dm://127.0.0.1:5236/FARMLAND_ENGINEER_QUALITY_INSPECT?useUnicode=true&characterEncoding=utf-8
```

## 预计产出文件
1. `pom.xml` - Maven配置
2. `src/main/resources/application.yml` - 应用配置
3. `src/main/java/.../config/DataSourceConfig.java` - 数据源配置
4. `src/main/java/.../service/DatabaseQueryService.java` - 数据库查询服务
5. `src/main/java/.../controller/DatabaseQueryController.java` - 查询控制器
6. `src/main/java/.../mcp/DatabaseToolProvider.java` - MCP工具提供者
