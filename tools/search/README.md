# FindReplace Pro

Bulk find & replace tool with publishing workflow for DA (Document Authoring) platform.

## What It Does

FindReplace Pro helps you search for content across your site, replace it in bulk, and publish the changes. You can search for text or find pages containing specific elements.

## Features

- **Content Search** - Find text in all content, page metadata, section metadata, or block content
- **Element Discovery** - Find pages containing specific CSS selectors (leave search term empty)
- **Advanced Search Types** - Contains, Exact Match, Regular Expression with regex groups ($1, $2)
- **Case Sensitive Search** - Optional case-sensitive matching
- **Bulk Replace** - Select multiple files and replace content
- **Publishing Workflow** - Preview, publish, or unpublish selected files with progress tracking
- **Smart Filtering** - Filter results by file path or content
- **Pagination** - Results pagination (configurable page size)
- **Result Accordion** - Collapse/expand individual result matches
- **File Filters** - Exclude paths and filter by modification date
- **Auto-Configuration** - Auto-detects org/site from DA context
- **Session Memory** - Remembers settings during session

## How to Use

### 1. Configure
1. **Org/Site**: Auto-detects from DA context or enter `/org/site` format
2. **Base Path**: Optional - limit search to specific folder
3. **File Filters**: Expand to exclude paths or filter by modification date

### 2. Search
1. **Search For**: Enter text to find (or leave empty for element discovery)
2. **Target Content**: Choose All Content, Page Metadata, Block Content, or Custom Selector
3. **Search Type**: Contains, Exact Match, or Regular Expression
4. **Options**: Enable case-sensitive search if needed

### 3. Scan & Filter
1. Click **"Scan Files"** to search your site
2. Use **filter box** to narrow results by path or content
3. Use **accordion toggles** to expand/collapse individual file matches
4. Navigate with **pagination** if many results

### 4. Select & Execute
**For content changes:**
1. Select files using checkboxes (or use Select All/Clear Selection)
2. Enter **replacement text** (use $1, $2 for regex groups)
3. Click **"Execute Replace"**

**For publishing:**
1. Select files to publish
2. Choose operation: **Preview/Publish/Unpublish**
3. Click operation button (shows count: "Publish Selected (3)")
4. Monitor progress and results

## Examples

### Find all pages with hero blocks
- **Target Content**: Custom Selector
- **Custom CSS Selector**: `.hero`
- **Search For**: (leave empty)

### Remove "- CME Group" from titles
- **Target Content**: Page Metadata Only
- **Search Type**: Contains
- **Search For**: `- CME Group`
- **Replace With**: (empty to remove)

### Regex: Reformat phone numbers
- **Search Type**: Regular Expression
- **Search For**: `(\d{3})-(\d{3})-(\d{4})`
- **Replace With**: `($1) $2-$3`
- **Result**: `312-555-1234` → `(312) 555-1234`

### Regex: Swap name format
- **Search Type**: Regular Expression
- **Search For**: `([A-Z][a-z]+), ([A-Z][a-z]+)`
- **Replace With**: `$2 $1`
- **Result**: `Smith, John` → `John Smith`

### Filter and bulk publish
1. Search for content
2. Filter results: type `/blog` to show only blog pages
3. Select All → Publish Selected (15)

## File Organization

- `search.html` - Main app interface
- `search/search.css` - Styles
- `search/search.js` - App logic
- `search/README.md` - This documentation

## Technical Notes

- **Authentication**: Uses DA SDK for secure access
- **Publishing**: Integrates with AEM Admin API (admin.hlx.page)
- **File Types**: Currently supports HTML files only (JSON support planned)
- **Content Filtering**: Excludes technical attributes (href, src, class, id, data-*, etc.)
- **Branch Logic**: Uses 'main' branch for publish/unpublish, current branch for preview
- **Performance**: File caching, pagination (10 results/page), parallel processing
- **Configuration**: Auto-detects org/site from DA context, configurable via CONFIG object
- **Memory**: Session-based caching for org/site and search settings