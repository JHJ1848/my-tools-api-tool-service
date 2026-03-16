package com.example.tool.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "tool-service")
public class ToolServiceProperties {

    private Dameng dameng = new Dameng();
    private Markdown markdown = new Markdown();

    @org.springframework.beans.factory.annotation.Value("${server.port:9527}")
    private int serverPort;

    public static class Dameng {
        private boolean enabled = true;

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }
    }

    public static class Markdown {
        private boolean enabled = true;

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }
    }

    public Dameng getDameng() {
        return dameng;
    }

    public void setDameng(Dameng dameng) {
        this.dameng = dameng;
    }

    public Markdown getMarkdown() {
        return markdown;
    }

    public void setMarkdown(Markdown markdown) {
        this.markdown = markdown;
    }

    public int getServerPort() {
        return serverPort;
    }

    public void setServerPort(int serverPort) {
        this.serverPort = serverPort;
    }
}
