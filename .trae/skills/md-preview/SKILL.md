---
name: "md-preview"
description: "Preview local Markdown files from D:\\adas\\项目 directory in browser. Invoke when user wants to view or preview MD files."
---

# Markdown Preview Skill

This skill provides the ability to preview Markdown files from the local `D:\adas\项目` directory through a web browser.

## Service Configuration

- **Service URL**: `http://127.0.0.1:8080`
- **Base Path**: `D:\adas\项目`

## Available Endpoints

### 1. Preview Markdown File
**URL**: `http://127.0.0.1:8080/md-view?path={relative-path}`

Preview a Markdown file by specifying its relative path from `D:\adas\项目`.

**Examples**:
- File: `D:\adas\项目\tool-service\.trae\skills\dm-database-query\SKILL.md`
- URL: `http://127.0.0.1:8080/md-view?path=tool-service/.trae/skills/dm-database-query/SKILL.md`

### 2. List Available Markdown Files
**Endpoint**: `GET http://127.0.0.1:8080/md-list`

## Supported Markdown Syntax

### Headers
```markdown
# H1
## H2
### H3
#### H4
```

### Lists
- Unordered: `-`, `*`, `+`
- Ordered: `1.`, `2.`, `3.`
- Task: `- [ ]`, `- [x]`

### Text Formatting
- **Bold**: `**text**` or `__text__`
- *Italic*: `*text*` or `_text_`
- `Code`: `` `code` ``

### Code Blocks
```markdown
```javascript
console.log('Hello');
```
```

### Blockquotes
```markdown
> This is a quote
```

### Horizontal Rule
```markdown
---
```

### Links & Images
```markdown
[Link text](url)
![Alt text](image-url)
```

### Escape Characters
The following characters can be escaped with `\`:

| Character | Escape |
|-----------|--------|
| \\ | \\\\ |
| ` | \\` |
| * | \\* |
| _ | \\_ |
| { } | \\{ \\} |
| [ ] | \\[ \\] |
| ( ) | \\( \\) |
| # | \\# |
| + | \\+ |
| - | \\- |
| . | \\. |
| ! | \\! |
| | | \\| |

## Features

- **VSCode-style Dark Theme**: Dark theme similar to VSCode
- **Syntax Highlighting**: Code blocks are properly styled
- **Full Markdown Support**: Headers, lists, tables, blockquotes, etc.
- **Local File Access**: Reads files directly from local filesystem
- **Security**: Only allows access to files within the base path (`D:\adas\项目`)
- **No External Dependencies**: Uses built-in Markdown converter

## Testing the Service

```bash
# List available MD files
curl http://127.0.0.1:8080/md-list

# Preview a sample MD file
# (open in browser)
http://127.0.0.1:8080/md-view?path=tool-service/.trae/skills/dm-database-query/SKILL.md
```
