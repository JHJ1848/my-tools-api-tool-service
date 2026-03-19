package com.example.tool.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Configuration
@ConditionalOnProperty(name = "tool-service.dameng.enabled", havingValue = "true", matchIfMissing = true)
public class DataSourceConfig {

    private static final Logger logger = LoggerFactory.getLogger(DataSourceConfig.class);
    private final Map<String, DataSource> dataSourceCache = new ConcurrentHashMap<>();

    @Value("${spring.datasource.dynamic.datasource.master.url:jdbc:dm://127.0.0.1:5236}")
    private String masterUrl;

    @Value("${spring.datasource.dynamic.datasource.master.username:SYSDBA}")
    private String masterUsername;

    @Value("${spring.datasource.dynamic.datasource.master.password:}")
    private String masterPassword;

    @Value("${spring.datasource.dynamic.datasource.master.driver-class-name:dm.jdbc.driver.DmDriver}")
    private String masterDriverClassName;

    @Value("${spring.datasource.dynamic.datasource.sso.url:jdbc:dm://127.0.0.1:5236}")
    private String ssoUrl;

    @Value("${spring.datasource.dynamic.datasource.sso.username:SYSDBA}")
    private String ssoUsername;

    @Value("${spring.datasource.dynamic.datasource.sso.password:}")
    private String ssoPassword;

    @Value("${spring.datasource.dynamic.datasource.sso.driver-class-name:dm.jdbc.driver.DmDriver}")
    private String ssoDriverClassName;

    @Value("${DM_DB_HOST:127.0.0.1}")
    private String externalDbHost;

    @Value("${DM_DB_PORT:5236}")
    private String externalDbPort;

    @Value("${DM_DB_NAME:SOIL_SURVEY_DATA_APPLY}")
    private String externalDbName;

    @Value("${DM_DB_USERNAME:SYSDBA}")
    private String externalDbUsername;

    @Value("${DM_DB_PASSWORD:}")
    private String externalDbPassword;

    @Value("${DM_DB_ENABLED:false}")
    private boolean externalDbEnabled;

    @Bean
    public DataSource masterDataSource() {
        String url = resolveMasterUrl();
        String username = resolveMasterUsername();
        String password = resolveMasterPassword();
        return createDataSource(url, username, password, masterDriverClassName, "master-pool");
    }

    @Bean
    public DataSource ssoDataSource() {
        String url = resolveSsoUrl();
        String username = resolveSsoUsername();
        String password = resolveSsoPassword();
        return createDataSource(url, username, password, ssoDriverClassName, "sso-pool");
    }

    @Bean
    @Primary
    public DataSource dataSource() {
        return masterDataSource();
    }

    private String resolveMasterUrl() {
        if (externalDbEnabled) {
            String newUrl = buildExternalDbUrl(externalDbName);
            logger.info("使用外部数据库配置 - Master URL: {}", newUrl);
            return newUrl;
        }
        return masterUrl;
    }

    private String resolveSsoUrl() {
        if (externalDbEnabled) {
            String newUrl = buildExternalDbUrl(externalDbName);
            logger.info("使用外部数据库配置 - SSO URL: {}", newUrl);
            return newUrl;
        }
        return ssoUrl;
    }

    private String resolveMasterUsername() {
        if (externalDbEnabled && !externalDbUsername.isEmpty()) {
            return externalDbUsername;
        }
        return masterUsername;
    }

    private String resolveSsoUsername() {
        if (externalDbEnabled && !externalDbUsername.isEmpty()) {
            return externalDbUsername;
        }
        return ssoUsername;
    }

    private String resolveMasterPassword() {
        if (externalDbEnabled && !externalDbPassword.isEmpty()) {
            return externalDbPassword;
        }
        return masterPassword;
    }

    private String resolveSsoPassword() {
        if (externalDbEnabled && !externalDbPassword.isEmpty()) {
            return externalDbPassword;
        }
        return ssoPassword;
    }

    private String buildExternalDbUrl(String databaseName) {
        return String.format("jdbc:dm://%s:%s/%s?useUnicode=true&characterEncoding=utf-8",
                externalDbHost, externalDbPort, databaseName);
    }

    private DataSource createDataSource(String url, String username, String password, String driverClassName, String poolName) {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(url);
        config.setUsername(username);
        config.setPassword(password);
        config.setDriverClassName(driverClassName);
        config.setPoolName(poolName);
        
        config.setMaximumPoolSize(10);
        config.setMinimumIdle(2);
        config.setConnectionTimeout(30000);
        config.setIdleTimeout(600000);
        config.setMaxLifetime(1800000);
        config.setConnectionTestQuery("SELECT 1");
        config.setAutoCommit(true);
        
        logger.info("创建数据源: {} -> {}", poolName, url);
        return new HikariDataSource(config);
    }

    private String getDbUrl(String databaseName) {
        if (externalDbEnabled) {
            return buildExternalDbUrl(databaseName);
        }
        return "jdbc:dm://" + externalDbHost + ":" + externalDbPort + "/" + databaseName + "?useUnicode=true&characterEncoding=utf-8";
    }

    public DataSource getDataSource(String name) {
        if (name == null || name.isEmpty()) {
            return masterDataSource();
        }

        if (dataSourceCache.containsKey(name)) {
            return dataSourceCache.get(name);
        }

        if ("master".equals(name)) {
            return masterDataSource();
        } else if ("sso".equals(name)) {
            return ssoDataSource();
        }

        try {
            String url = getDbUrl(name);
            String username = resolveMasterUsername();
            String password = resolveMasterPassword();
            DataSource ds = createDataSource(url, username, password, masterDriverClassName, name + "-pool");
            dataSourceCache.put(name, ds);
            logger.info("动态创建数据源: {} -> {}", name, url);
            return ds;
        } catch (Exception e) {
            logger.error("创建数据源失败: {}", name, e);
            return masterDataSource();
        }
    }

    /**
     * 获取外部数据库配置（安全版本 - 不包含敏感信息）
     */
    public Map<String, String> getExternalDbConfig() {
        return Map.of(
            "enabled", String.valueOf(externalDbEnabled),
            "host", externalDbHost,
            "port", externalDbPort,
            "database", externalDbName
        );
    }

    /**
     * 检查外部数据库是否已配置（不返回敏感信息）
     */
    public boolean isExternalDbConfigured() {
        return externalDbEnabled;
    }

    /**
     * 获取所有已配置的数据源名称列表
     */
    public List<String> getConfiguredDataSources() {
        List<String> sources = new ArrayList<>();
        sources.add("master");
        sources.add("sso");
        // 如果启用了外部数据库，添加外部数据库名称
        if (externalDbEnabled && externalDbName != null && !externalDbName.isEmpty()) {
            if (!sources.contains(externalDbName)) {
                sources.add(externalDbName);
            }
        }
        return sources;
    }
}
