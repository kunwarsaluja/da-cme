/* eslint-disable import/no-unresolved, no-restricted-globals, no-use-before-define, no-await-in-loop, no-plusplus, consistent-return, max-len, no-shadow, default-case, no-unused-vars, no-console */
import DA_SDK from 'https://da.live/nx/utils/sdk.js';
import { crawl } from 'https://da.live/nx/public/utils/tree.js';

// CONFIGURATION - Easily configurable settings
const CONFIG = {
  RESULTS_PER_PAGE: 10, // Number of results to show per page
  MAX_PAGINATION_BUTTONS: 5, // Maximum number of page buttons to show
};

const app = {
  context: null,
  token: null,
  results: [],
  selectedFiles: new Set(),
  fileCache: new Map(),
  availablePaths: [],
  orgSiteCache: null, // Cache for org/site configuration
  pagination: {
    currentPage: 1,
    totalPages: 1,
    filteredResults: null,
  },
};

const API = {
  LIST: 'https://admin.da.live/list',
  SOURCE: 'https://admin.da.live/source',
  PREVIEW: 'https://admin.hlx.page/preview',
  LIVE: 'https://admin.hlx.page/live',
};

function parseOrgSite() {
  // First priority: Check if user has entered something in the input (user override)
  const orgSitePath = document.getElementById('org-site-path')?.value?.trim();
  if (orgSitePath) {
    // Parse /org/site format
    const cleanPath = orgSitePath.startsWith('/') ? orgSitePath.slice(1) : orgSitePath;
    const parts = cleanPath.split('/').filter((part) => part.length > 0);

    if (parts.length >= 2) {
      const result = { org: parts[0], site: parts[1] };
      // Cache the user's valid input in memory
      app.orgSiteCache = result;
      return result;
    }
  }

  // Second priority: Try to get from DA context (auto-populate if input is empty)
  const { context } = app;
  if (context && context.org && (context.site || context.repo)) {
    const result = {
      org: context.org,
      site: context.site || context.repo,
    };

    // Auto-populate the input field if it's empty
    const input = document.getElementById('org-site-path');
    if (input && !input.value.trim()) {
      input.value = `/${result.org}/${result.site}`;
    }

    // Cache the context values
    app.orgSiteCache = result;
    return result;
  }

  // Third priority: Try to use cached value from previous valid input
  if (app.orgSiteCache) {
    return app.orgSiteCache;
  }

  // No valid input and no cache - return null to trigger error
  return null;
}

function validateOrgSite() {
  const result = parseOrgSite();
  if (!result) {
    showMessage('Please enter your organization and site in format: /org/site (e.g., /myorg/mysite)', 'error');
    return false;
  }
  return true;
}

function showMessage(text, type = 'info') {
  const toast = document.getElementById('toast');
  const message = document.querySelector('.toast-message');
  const icon = document.querySelector('.toast-icon svg');

  if (!toast || !message || !icon) return;

  // Update message
  message.textContent = text;

  // Update icon based on type
  const icons = {
    success: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
    error: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
    warning: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
    info: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
  };

  icon.innerHTML = `<path d="${icons[type] || icons.info}"/>`;

  // Update toast classes
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');

  // Auto-hide after 5 seconds
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 5000);
}

function updateProgress(percent, text) {
  const container = document.querySelector('.progress-container');
  const fill = document.querySelector('.progress-fill');
  const textEl = document.querySelector('.progress-text');

  if (!container) return;

  if (percent === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  if (fill) fill.style.width = `${percent}%`;
  if (textEl) textEl.textContent = text;
}

async function fetchFiles(basePath = '') {
  const { context, token } = app;
  const orgSite = parseOrgSite();
  if (!orgSite) {
    throw new Error('Organization and site must be configured');
  }
  const { org, site } = orgSite;
  const url = `${API.LIST}/${org}/${site}${basePath}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();

    const htmlFiles = [];
    const includeSubfolders = document.getElementById('include-subfolders')?.checked || false;

    // Get filter options
    const excludePathsInput = document.getElementById('exclude-paths')?.value?.trim() || '';
    const excludePaths = excludePathsInput ? excludePathsInput.split(',').map((p) => p.trim()) : [];
    const modifiedSinceInput = document.getElementById('modified-since')?.value;
    const modifiedSince = modifiedSinceInput ? new Date(modifiedSinceInput) : null;

    data.forEach((item) => {
      if (item.ext === 'html' && item.lastModified) {
        // Check exclude paths
        const isExcluded = excludePaths.some((excludePath) => {
          if (excludePath.startsWith('/')) {
            return item.path.includes(excludePath);
          }
          return item.path.includes(`/${excludePath}`);
        });

        if (isExcluded) return;

        // Check modified since date
        if (modifiedSince) {
          const fileModified = new Date(item.lastModified * 1000); // Convert Unix timestamp
          if (fileModified < modifiedSince) return;
        }

        htmlFiles.push(item);
      }
    });

    // Handle subfolders separately if needed
    if (includeSubfolders) {
      const subfolderPromises = data
        .filter((item) => !item.ext && !item.lastModified && item.name !== '.DS_Store')
        .filter((item) => {
          // Also exclude subfolders that match exclude paths
          const isExcluded = excludePaths.some((excludePath) => {
            if (excludePath.startsWith('/')) {
              return item.path.includes(excludePath);
            }
            return item.path.includes(`/${excludePath}`);
          });
          return !isExcluded;
        })
        .map(async (item) => {
          try {
            return await fetchFiles(item.path.replace(`/${org}/${site}`, ''));
          } catch (error) {
            return [];
          }
        });
      const subfolderResults = await Promise.all(subfolderPromises);
      subfolderResults.forEach((subFiles) => htmlFiles.push(...subFiles));
    }

    return htmlFiles;
  } catch (error) {
    if (basePath === '') {
      showMessage(`Error fetching files: ${error.message}`, 'error');
    }
    return [];
  }
}

async function fetchContent(path) {
  if (app.fileCache.has(path)) {
    return app.fileCache.get(path);
  }

  const { token } = app;
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  const url = `${API.SOURCE}/${cleanPath}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const content = await response.text();
      app.fileCache.set(path, content);
      return content;
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function saveContent(path, content) {
  const { token } = app;
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  const url = `https://admin.da.live/source/${cleanPath}`;

  try {
    const body = new FormData();
    body.append('data', new Blob([content], { type: 'text/html' }));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body,
    });

    return response.ok;
  } catch (error) {
    return false;
  }
}

function getMatchContext(content, index, contextLength = 50) {
  const start = Math.max(0, index - contextLength);
  const end = Math.min(content.length, index + contextLength);
  return content.substring(start, end);
}

function filterContentByTarget(content, targetType, customSelector) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');

    switch (targetType) {
      case 'page-metadata': {
        // Look for metadata table/div at the top of the page
        const metadata = doc.querySelector('.metadata, table[name="metadata"], #metadata');
        return metadata ? metadata.textContent || metadata.innerText || '' : '';
      }

      case 'section-metadata': {
        // Look for section metadata (divs with specific classes or patterns)
        const sections = doc.querySelectorAll('.section-metadata, [class*="section"], [data-aue-type="section"]');
        return Array.from(sections).map((section) => section.textContent || section.innerText || '').join(' ');
      }

      case 'blocks': {
        // Look for block content (divs with specific classes that indicate blocks)
        const blocks = doc.querySelectorAll('.block, [class*="block"], .cards, .hero, .columns, .accordion, .fragment');
        return Array.from(blocks).map((block) => block.textContent || block.innerText || '').join(' ');
      }

      case 'main-content': {
        // Look for main content area, excluding headers, footers, and metadata
        const main = doc.querySelector('main');
        if (main) {
          // Remove metadata and other non-content elements from main
          const mainClone = main.cloneNode(true);
          const metadata = mainClone.querySelector('.metadata, table[name="metadata"], #metadata');
          if (metadata) metadata.remove();
          return mainClone.textContent || mainClone.innerText || '';
        }
        return '';
      }

      case 'custom': {
        if (!customSelector) return '';
        try {
          const elements = doc.querySelectorAll(customSelector);
          return Array.from(elements).map((el) => el.textContent || el.innerText || '').join(' ');
        } catch (e) {
          // Invalid selector
          return '';
        }
      }

      default:
        return content;
    }
  } catch (error) {
    // If DOM parsing fails, return original content
    return content;
  }
}

function replaceTextInElement(element, regex, replaceTerm) {
  // Walk through all text nodes and replace content
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null,
    false,
  );

  const textNodes = [];
  let node = walker.nextNode();
  while (node) {
    textNodes.push(node);
    node = walker.nextNode();
  }

  textNodes.forEach((textNode) => {
    if (textNode.textContent) {
      textNode.textContent = textNode.textContent.replace(regex, replaceTerm);
    }
  });
}

function createSearchRegex(searchTerm, searchType, caseSensitive) {
  let pattern;
  const flags = caseSensitive ? 'g' : 'gi';

  switch (searchType) {
    case 'exact':
      pattern = `\\b${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`;
      break;
    case 'regex':
      pattern = searchTerm; // Use as-is for regex
      break;
    case 'contains':
    default:
      pattern = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      break;
  }

  return new RegExp(pattern, flags);
}

function replaceInTargetedContent(content, searchTerm, replaceTerm, targetType, customSelector) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');

    // Get search options
    const searchType = document.getElementById('search-type')?.value || 'contains';
    const caseSensitive = document.getElementById('case-sensitive')?.checked || false;
    const regex = createSearchRegex(searchTerm, searchType, caseSensitive);

    let targetElements = [];

    switch (targetType) {
      case 'page-metadata': {
        const metadata = doc.querySelector('.metadata, table[name="metadata"], #metadata');
        if (metadata) targetElements = [metadata];
        break;
      }

      case 'section-metadata': {
        targetElements = Array.from(doc.querySelectorAll('.section-metadata, [class*="section"], [data-aue-type="section"]'));
        break;
      }

      case 'blocks': {
        targetElements = Array.from(doc.querySelectorAll('.block, [class*="block"], .cards, .hero, .columns, .accordion, .fragment'));
        break;
      }

      case 'main-content': {
        const main = doc.querySelector('main');
        if (main) {
          targetElements = [main];
          // Remove metadata from replacement scope
          const metadata = main.querySelector('.metadata, table[name="metadata"], #metadata');
          if (metadata) {
            targetElements = Array.from(main.children).filter((child) => child !== metadata);
          }
        }
        break;
      }

      case 'custom': {
        if (customSelector) {
          try {
            targetElements = Array.from(doc.querySelectorAll(customSelector));
          } catch (e) {
            // Invalid selector, return original content
            return content;
          }
        }
        break;
      }
    }

    // Replace text content in target elements
    targetElements.forEach((element) => {
      replaceTextInElement(element, regex, replaceTerm);
    });

    return doc.documentElement.outerHTML;
  } catch (error) {
    // If DOM manipulation fails, return original content
    return content;
  }
}

function formatHTML(html) {
  let formatted = html;
  formatted = formatted.replace(/></g, '>\n<');
  formatted = formatted.replace(/<([^/][^>]*[^/])>/g, '<$1>\n');

  const lines = formatted.split('\n');
  let indentLevel = 0;
  const indentString = '  ';

  const formattedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return '';

    if (trimmed.startsWith('</')) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    const indentedLine = indentString.repeat(indentLevel) + trimmed;

    if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.endsWith('/>')) {
      indentLevel += 1;
    }

    return indentedLine;
  });

  return formattedLines.join('\n');
}

function searchForElements(content, selector) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const elements = doc.querySelectorAll(selector);

    if (elements.length === 0) {
      return { matches: [], updatedContent: content };
    }

    // Create matches for each found element
    const matches = Array.from(elements).map((element, index) => {
      const elementText = element.textContent?.trim() || '';
      const elementHTML = element.outerHTML;

      return {
        index,
        match: `Element ${index + 1}: ${selector}`,
        context: elementText.length > 100 ? `${elementText.substring(0, 100)}...` : elementText,
        line: `Found element: ${selector}`,
        elementHTML: elementHTML.length > 200 ? `${elementHTML.substring(0, 200)}...` : elementHTML,
      };
    });

    return {
      matches,
      updatedContent: content,
      elementCount: elements.length,
      foundElements: true,
    };
  } catch (error) {
    console.error('Error searching for elements:', error);
    return { matches: [], updatedContent: content };
  }
}

function searchInContent(content, searchTerm, replaceTerm = '') {
  const targetType = document.getElementById('target-type')?.value || 'all';
  const customSelector = document.getElementById('custom-selector')?.value?.trim();

  // Handle element-only search for custom selectors
  if (targetType === 'custom' && !searchTerm && customSelector) {
    return searchForElements(content, customSelector);
  }

  if (!searchTerm) return { matches: [], updatedContent: content };

  let contentForSearch = content;

  // Filter content based on target type
  if (targetType !== 'all') {
    contentForSearch = filterContentByTarget(content, targetType, customSelector);
  }

  // Remove URLs and attributes from search content
  contentForSearch = contentForSearch
    .replace(/href="[^"]*"/gi, '')
    .replace(/src="[^"]*"/gi, '')
    .replace(/srcset="[^"]*"/gi, '')
    .replace(/data-src="[^"]*"/gi, '')
    .replace(/action="[^"]*"/gi, '')
    .replace(/url\([^)]*\)/gi, '')
    .replace(/https?:\/\/[^\s<>"']+/gi, '')
    .replace(/<a[^>]*>[^<]*<\/a>/gi, '')
    .replace(/data-[^=]*="[^"]*"/gi, '')
    .replace(/class="[^"]*"/gi, '')
    .replace(/id="[^"]*"/gi, '');

  // Get search options
  const searchType = document.getElementById('search-type')?.value || 'contains';
  const caseSensitive = document.getElementById('case-sensitive')?.checked || false;
  const regex = createSearchRegex(searchTerm, searchType, caseSensitive);

  const matches = [];
  let match = regex.exec(contentForSearch);

  while (match !== null) {
    matches.push({
      match: match[0],
      index: match.index,
      line: contentForSearch.substring(0, match.index).split('\n').length,
      context: getMatchContext(contentForSearch, match.index, 50),
    });
    match = regex.exec(contentForSearch);
  }

  let updatedContent = content;
  if (replaceTerm && matches.length > 0) {
    if (targetType === 'all') {
      // For 'all' content, use the existing simple replacement approach
      const urlPlaceholders = [];
      let tempContent = content;

      tempContent = tempContent.replace(/href="[^"]*"/gi, (matchedText) => {
        const placeholder = `__HREF_${urlPlaceholders.length}__`;
        urlPlaceholders.push(matchedText);
        return placeholder;
      });

      tempContent = tempContent.replace(/src="[^"]*"/gi, (matchedText) => {
        const placeholder = `__SRC_${urlPlaceholders.length}__`;
        urlPlaceholders.push(matchedText);
        return placeholder;
      });

      tempContent = tempContent.replace(/https?:\/\/[^\s<>"']+/gi, (matchedText) => {
        const placeholder = `__URL_${urlPlaceholders.length}__`;
        urlPlaceholders.push(matchedText);
        return placeholder;
      });

      updatedContent = tempContent.replace(regex, replaceTerm);

      urlPlaceholders.forEach((originalUrl, index) => {
        updatedContent = updatedContent.replace(`__HREF_${index}__`, originalUrl);
        updatedContent = updatedContent.replace(`__SRC_${index}__`, originalUrl);
        updatedContent = updatedContent.replace(`__URL_${index}__`, originalUrl);
      });
    } else {
      // For targeted content, use DOM-based replacement
      updatedContent = replaceInTargetedContent(content, searchTerm, replaceTerm, targetType, customSelector);
    }
  }

  return { matches, updatedContent };
}

async function scanFiles() {
  // Reset pagination for new search
  resetPagination();

  // Validate org/site configuration first
  if (!validateOrgSite()) {
    return;
  }

  const searchTerm = document.getElementById('search-term')?.value?.trim();
  const targetType = document.getElementById('target-type')?.value || 'all';
  const customSelector = document.getElementById('custom-selector')?.value?.trim();

  // For custom selector, allow element-only searches (no search term required)
  if (!searchTerm && targetType !== 'custom') {
    showMessage('Please enter a search term', 'error');
    return;
  }

  if (targetType === 'custom' && !customSelector) {
    showMessage('Please enter a CSS selector when using Custom Selector mode', 'error');
    return;
  }

  const replaceTerm = document.getElementById('replace-term')?.value || '';
  const basePath = document.getElementById('search-path')?.value?.trim() || '';

  try {
    const searchPath = basePath ? `in ${basePath}` : 'across entire site';
    showMessage(`Scanning files ${searchPath}...`, 'info');
    updateProgress(10, 'Fetching file list...');

    const files = await fetchFiles(basePath);

    if (files.length === 0) {
      showMessage('No HTML files found', 'error');
      updateProgress(0, '');
      return;
    }

    app.results = [];
    let filesScanned = 0;
    let matchesFound = 0;

    const processFile = async (file, index) => {
      updateProgress(20 + (index / files.length) * 70, `Scanning ${file.name}...`);

      const content = await fetchContent(file.path);
      if (!content) return null;

      const result = searchInContent(content, searchTerm, replaceTerm);
      if (result.matches.length > 0) {
        return {
          file,
          matches: result.matches,
          originalContent: content,
          updatedContent: result.updatedContent,
          selected: false,
          foundElements: result.foundElements || false,
          elementCount: result.elementCount || 0,
        };
      }
      return null;
    };

    const results = await Promise.all(files.map(processFile));
    app.results = results.filter((result) => result !== null);

    filesScanned = files.length;
    matchesFound = app.results.reduce((total, result) => total + result.matches.length, 0);

    updateProgress(100, 'Scan complete!');

    // Update UI
    document.getElementById('files-scanned').textContent = filesScanned;
    document.getElementById('matches-found').textContent = matchesFound;
    document.getElementById('files-affected').textContent = app.results.length;

    displayResults();
    document.querySelector('.results-container').style.display = 'block';

    const executeBtn = document.getElementById('execute-btn');
    const exportBtn = document.getElementById('export-btn');
    const bulkPublishBtn = document.getElementById('bulk-publish-btn');
    if (executeBtn) executeBtn.disabled = app.results.length === 0;
    if (exportBtn) exportBtn.disabled = app.results.length === 0;
    if (bulkPublishBtn) bulkPublishBtn.disabled = app.results.length === 0;

    const targetType = document.getElementById('target-type')?.value || 'all';
    const targetLabel = document.querySelector(`#target-type option[value="${targetType}"]`)?.textContent || 'All Content';
    const customSelector = document.getElementById('custom-selector')?.value?.trim();

    let message;
    if (targetType === 'custom' && !searchTerm && customSelector) {
      const totalElements = app.results.reduce((total, result) => total + (result.elementCount || 0), 0);
      message = `Found ${totalElements} ${customSelector} elements in ${app.results.length} files`;
    } else {
      message = `Found ${matchesFound} matches in ${app.results.length} files (searching: ${targetLabel})`;
    }

    showMessage(message, 'success');
  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
    updateProgress(0, '');
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateActionButtons() {
  const hasSelected = app.selectedFiles.size > 0;
  const executeBtn = document.getElementById('execute-btn');
  const exportBtn = document.getElementById('export-btn');
  const bulkPublishBtn = document.getElementById('bulk-publish-btn');

  if (executeBtn) executeBtn.disabled = !hasSelected;
  if (exportBtn) exportBtn.disabled = !hasSelected;
  if (bulkPublishBtn) bulkPublishBtn.disabled = !hasSelected;

  // Update button text with count
  updateBulkButtonText();
  updateExportButtonText();
}

function displayResults(filteredResults = null) {
  const list = document.getElementById('results-list');
  if (!list) return;

  list.innerHTML = '';

  // Use filtered results if provided, otherwise use all results
  const resultsToShow = filteredResults || app.results;

  // Store filtered results for pagination
  app.pagination.filteredResults = filteredResults;

  if (resultsToShow.length === 0) {
    const message = filteredResults ? 'No results match the filter' : 'No matches found';
    list.innerHTML = `<div style="padding: 20px; text-align: center;">${message}</div>`;
    hidePagination();
    return;
  }

  // Calculate pagination
  const totalResults = resultsToShow.length;
  const totalPages = Math.ceil(totalResults / CONFIG.RESULTS_PER_PAGE);
  const currentPage = Math.min(app.pagination.currentPage, totalPages);
  const startIndex = (currentPage - 1) * CONFIG.RESULTS_PER_PAGE;
  const endIndex = Math.min(startIndex + CONFIG.RESULTS_PER_PAGE, totalResults);

  // Get results for current page
  const pageResults = resultsToShow.slice(startIndex, endIndex);

  // Update pagination state
  app.pagination.currentPage = currentPage;
  app.pagination.totalPages = totalPages;

  pageResults.forEach((result, displayIndex) => {
    // Find the original index in app.results for proper event handling
    const originalIndex = app.results.indexOf(result);
    const item = document.createElement('div');
    item.className = 'result-item';

    const replaceTerm = document.getElementById('replace-term')?.value || '';
    const searchTerm = document.getElementById('search-term')?.value || '';

    const matchesHtml = result.matches.map((match) => {
      // Handle element-only searches differently
      if (result.foundElements && !searchTerm) {
        return `
          <div class="result-preview element-preview">
            <strong>${escapeHtml(match.match)}</strong>
            <br><small style="color: #666;">Content: ${escapeHtml(match.context)}</small>
            ${match.elementHTML ? `<br><small style="color: #888; font-family: monospace;">${escapeHtml(match.elementHTML)}</small>` : ''}
          </div>
        `;
      }

      // Regular text search highlighting
      let highlightedContext = escapeHtml(match.context);
      if (searchTerm) {
        const regex = new RegExp(`(${escapeHtml(searchTerm).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        highlightedContext = highlightedContext.replace(regex, '<span class="highlight-old">$1</span>');
      }

      return `
        <div class="result-preview">
          Line ${match.line}: ...${highlightedContext}...
          ${replaceTerm ? `<br><small style="color: #007aff;">Replace with: <span class="highlight-new">${escapeHtml(replaceTerm)}</span></small>` : ''}
        </div>
      `;
    }).join('');

    const matchCount = result.matches.length;
    const isExpanded = result.expanded === true; // Default to collapsed

    item.innerHTML = `
      <input type="checkbox" class="result-checkbox" data-index="${originalIndex}" ${result.selected ? 'checked' : ''}>
      <div class="result-content">
        <div class="result-header" data-result-index="${originalIndex}">
          <div class="result-path">${result.file.path}</div>
          <div class="result-meta">
            <span class="match-count">${matchCount} match${matchCount !== 1 ? 'es' : ''}</span>
            <div class="result-toggle">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.41 8.84L12 13.42l4.59-4.58L18 10.25l-6 6-6-6z"/>
              </svg>
            </div>
          </div>
        </div>
        <div class="result-matches ${isExpanded ? 'expanded' : 'collapsed'}">
          ${matchesHtml}
        </div>
      </div>
    `;

    // Set initial state
    if (isExpanded) {
      item.classList.add('expanded');
    }

    const checkbox = item.querySelector('.result-checkbox');
    checkbox.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.index, 10);
      app.results[idx].selected = e.target.checked;

      if (e.target.checked) {
        app.selectedFiles.add(idx);
      } else {
        app.selectedFiles.delete(idx);
      }

      updateActionButtons();
    });

    // Add accordion toggle functionality
    const resultHeader = item.querySelector('.result-header');
    resultHeader.addEventListener('click', (e) => {
      // Don't trigger if clicking on checkbox
      if (e.target.closest('.result-checkbox')) return;

      const idx = parseInt(resultHeader.dataset.resultIndex, 10);
      const matchesContainer = item.querySelector('.result-matches');
      const isCurrentlyExpanded = item.classList.contains('expanded');

      // Toggle state
      if (isCurrentlyExpanded) {
        item.classList.remove('expanded');
        matchesContainer.classList.remove('expanded');
        matchesContainer.classList.add('collapsed');
        app.results[idx].expanded = false;
      } else {
        item.classList.add('expanded');
        matchesContainer.classList.remove('collapsed');
        matchesContainer.classList.add('expanded');
        app.results[idx].expanded = true;
      }
    });

    list.appendChild(item);
  });

  // Update pagination controls
  updatePagination(totalResults, startIndex + 1, endIndex);
}

function filterResults() {
  const filterInput = document.getElementById('filter-results');
  if (!filterInput) return;

  // Reset to first page when filtering
  app.pagination.currentPage = 1;

  const filterText = filterInput.value.toLowerCase().trim();

  if (!filterText) {
    // Show all results if filter is empty
    displayResults();
    return;
  }

  // Filter results based on file path or match content
  const filteredResults = app.results.filter((result) => {
    // Check if file path matches
    if (result.file.path.toLowerCase().includes(filterText)) {
      return true;
    }

    // Check if any match content includes the filter text
    return result.matches.some((match) => match.context.toLowerCase().includes(filterText)
             || match.match.toLowerCase().includes(filterText));
  });

  // Display filtered results
  displayResults(filteredResults);
}

function updatePagination(totalResults, startIndex, endIndex) {
  const container = document.getElementById('pagination-container');
  const infoText = document.getElementById('pagination-info-text');
  const pageNumbers = document.getElementById('page-numbers');
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');

  if (!container || !infoText || !pageNumbers || !prevBtn || !nextBtn) return;

  // Show pagination if more than one page
  if (app.pagination.totalPages > 1) {
    container.style.display = 'flex';

    // Update info text
    infoText.textContent = `Showing ${startIndex}-${endIndex} of ${totalResults} results`;

    // Update prev/next buttons
    prevBtn.disabled = app.pagination.currentPage === 1;
    nextBtn.disabled = app.pagination.currentPage === app.pagination.totalPages;

    // Generate page numbers
    generatePageNumbers();
  } else {
    container.style.display = 'none';
  }
}

function hidePagination() {
  const container = document.getElementById('pagination-container');
  if (container) container.style.display = 'none';
}

function generatePageNumbers() {
  const pageNumbers = document.getElementById('page-numbers');
  if (!pageNumbers) return;

  pageNumbers.innerHTML = '';

  const { currentPage, totalPages } = app.pagination;
  const maxButtons = CONFIG.MAX_PAGINATION_BUTTONS;

  // Calculate start and end pages to display
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  const endPage = Math.min(totalPages, startPage + maxButtons - 1);

  // Adjust start if we're near the end
  if (endPage === totalPages) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  // Add first page and ellipsis if needed
  if (startPage > 1) {
    addPageButton(1);
    if (startPage > 2) {
      addEllipsis();
    }
  }

  // Add page buttons
  for (let i = startPage; i <= endPage; i++) {
    addPageButton(i, i === currentPage);
  }

  // Add ellipsis and last page if needed
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      addEllipsis();
    }
    addPageButton(totalPages);
  }
}

function addPageButton(pageNum, isActive = false) {
  const pageNumbers = document.getElementById('page-numbers');
  const button = document.createElement('button');
  button.className = `page-btn ${isActive ? 'active' : ''}`;
  button.textContent = pageNum;
  button.addEventListener('click', () => goToPage(pageNum));
  pageNumbers.appendChild(button);
}

function addEllipsis() {
  const pageNumbers = document.getElementById('page-numbers');
  const ellipsis = document.createElement('span');
  ellipsis.className = 'page-ellipsis';
  ellipsis.textContent = '...';
  pageNumbers.appendChild(ellipsis);
}

function goToPage(pageNum) {
  app.pagination.currentPage = pageNum;
  displayResults(app.pagination.filteredResults);
}

function resetPagination() {
  app.pagination.currentPage = 1;
  app.pagination.totalPages = 1;
  app.pagination.filteredResults = null;
}

async function executeReplace() {
  const selected = app.results.filter((r) => r.selected);

  if (selected.length === 0) {
    showMessage('No files selected', 'error');
    return;
  }

  const searchTerm = document.getElementById('search-term')?.value?.trim();
  const replaceTerm = document.getElementById('replace-term')?.value?.trim();

  if (!searchTerm || !replaceTerm) {
    showMessage('Both search and replace terms are required', 'error');
    return;
  }

  // eslint-disable-next-line no-alert
  if (!confirm(`Replace "${searchTerm}" with "${replaceTerm}" in ${selected.length} files? This cannot be undone.`)) {
    return;
  }

  try {
    let successCount = 0;

    const replacePromises = selected.map(async (result, index) => {
      updateProgress((index / selected.length) * 100, `Updating ${result.file.path.split('/').pop()}...`);

      const replaceResult = searchInContent(result.originalContent, searchTerm, replaceTerm);
      const success = await saveContent(result.file.path, replaceResult.updatedContent);
      return success;
    });

    const results = await Promise.all(replacePromises);
    successCount = results.filter(Boolean).length;

    // Clear entire cache after replace operations to ensure fresh content on next search
    app.fileCache.clear();

    updateProgress(100, 'Complete!');
    showMessage(`Updated ${successCount}/${selected.length} files successfully!`, 'success');
  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
    updateProgress(0, '');
  }
}

async function handleSingleFileOperation(operationType, path, context, org, site, token) {
  let apiUrl;
  const method = operationType === 'unpublish' ? 'DELETE' : 'POST';

  // Use 'main' for publish/unpublish operations, current branch for preview
  const branch = (operationType === 'publish' || operationType === 'unpublish') ? 'main' : (context.ref || 'main');

  if (operationType === 'preview') {
    apiUrl = `${API.PREVIEW}/${org}/${site}/${branch}${path}`;
  } else if (operationType === 'publish' || operationType === 'unpublish') {
    apiUrl = `${API.LIVE}/${org}/${site}/${branch}${path}`;
  }

  updateProgress(50, `${operationType}ing single file: ${path}`);

  const response = await fetch(apiUrl, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`${operationType} failed: ${response.status} ${response.statusText}`);
  }

  updateProgress(100, `${operationType} completed!`);
  showMessage(`Successfully ${operationType}ed: ${path}`, 'success');
}

async function handleBulkUnpublish(paths, context, site, token) {
  updateProgress(30, 'Processing unpublish requests...');

  // Use 'main' for unpublish operations
  const branch = 'main';

  const unpublishPromises = paths.map(async (path, index) => {
    const url = `${API.LIVE}/${context.org}/${site}/${branch}${path}`;
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const progress = 30 + ((60 * (index + 1)) / paths.length);
      updateProgress(progress, `Unpublished ${index + 1}/${paths.length}: ${path}`);

      return { path, success: response.ok, status: response.status };
    } catch (error) {
      return { path, success: false, error: error.message };
    }
  });

  const results = await Promise.all(unpublishPromises);
  const successful = results.filter((r) => r.success).length;

  updateProgress(100, 'Unpublish completed!');
  showMessage(`Unpublished ${successful}/${paths.length} files`, successful === paths.length ? 'success' : 'warning');
}

async function handleBulkOperation(operationType, paths, context, org, site, token) {
  const method = 'POST';
  let apiUrl;

  // Use 'main' for publish operations, current branch for preview
  const branch = operationType === 'publish' ? 'main' : (context.ref || 'main');

  if (operationType === 'preview') {
    apiUrl = `${API.PREVIEW}/${org}/${site}/${branch}/*`;
  } else if (operationType === 'publish') {
    apiUrl = `${API.LIVE}/${org}/${site}/${branch}/*`;
  } else if (operationType === 'unpublish') {
    return handleBulkUnpublish(paths, context, org, site, token);
  }

  updateProgress(30, `Sending bulk ${operationType} request...`);

  const payload = {
    forceUpdate: true,
    paths,
    delete: false,
  };

  const response = await fetch(apiUrl, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Bulk ${operationType} failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();

  updateProgress(90, 'Processing...');

  if (result.job) {
    updateProgress(100, `Bulk ${operationType} job started: ${result.job}`);
    showMessage(`Bulk ${operationType} job initiated for ${paths.length} files. Job ID: ${result.job}`, 'success');
  } else {
    updateProgress(100, `Bulk ${operationType} completed!`);
    showMessage(`Bulk ${operationType} completed for ${paths.length} files`, 'success');
  }
}

async function bulkOperation() {
  const operationType = document.getElementById('bulk-operation-type')?.value || 'preview';
  const selected = app.results.filter((result) => result.selected);

  if (selected.length === 0) {
    showMessage('Please select files to process', 'error');
    return;
  }

  // Validate org/site configuration
  if (!validateOrgSite()) {
    return;
  }

  // eslint-disable-next-line no-alert
  const confirmed = confirm(`Are you sure you want to ${operationType} ${selected.length} files?`);
  if (!confirmed) return;

  const { context, token } = app;
  const { org, site } = parseOrgSite();

  try {
    updateProgress(10, 'Starting operation...');

    // Prepare paths for API calls
    const paths = selected.map((result) => {
      // Convert from full path to relative path expected by Admin API
      let { path } = result.file;
      // Remove org/site prefix if present
      const prefix = `/${context.org}/${site}`;
      if (path.startsWith(prefix)) {
        path = path.substring(prefix.length);
      }
      // Remove .html extension for API
      if (path.endsWith('.html')) {
        path = path.substring(0, path.length - 5);
      }
      return path;
    });

    updateProgress(20, `Preparing ${operationType} operation...`);

    // Decide between single file API vs bulk API based on count
    if (selected.length === 1) {
      // Use single file API for one file
      await handleSingleFileOperation(operationType, paths[0], context, org, site, token);
    } else {
      // Use bulk API for multiple files
      await handleBulkOperation(operationType, paths, context, org, site, token);
    }

    // Hide progress after delay
    setTimeout(() => {
      updateProgress(0, '');
    }, 3000);
  } catch (error) {
    showMessage(`${operationType} failed: ${error.message}`, 'error');
    updateProgress(0, '');
  }
}

async function exportResults() {
  const selected = app.results.filter((r) => r.selected);

  if (selected.length === 0) {
    showMessage('No files selected', 'error');
    return;
  }

  showMessage(`Downloading ${selected.length} files...`, 'info');
  updateProgress(10, 'Preparing downloads...');

  try {
    // Download individual HTML files with proper formatting
    for (let i = 0; i < selected.length; i++) {
      const result = selected[i];
      const fileName = result.file.path.split('/').pop(); // Get filename from path
      const rawContent = result.updatedContent || result.originalContent;

      // Format the HTML for better readability
      const formattedContent = formatHTML(rawContent);

      const blob = new Blob([formattedContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Update progress
      const progress = 20 + ((70 * (i + 1)) / selected.length);
      updateProgress(progress, `Downloaded ${i + 1}/${selected.length}: ${fileName}`);

      // Small delay between downloads to avoid browser blocking
      await new Promise((resolve) => {
        setTimeout(resolve, 200);
      });
    }

    updateProgress(100, 'Export completed!');
    showMessage(`Downloaded ${selected.length} files!`, 'success');

    // Hide progress after a delay
    setTimeout(() => {
      updateProgress(0, '');
    }, 2000);
  } catch (error) {
    showMessage(`Export failed: ${error.message}`, 'error');
  }
}

async function loadFolderTree() {
  try {
    const { token } = app;
    if (!token) {
      return;
    }
    
    // Use user's org/site configuration instead of DA context
    const orgSite = parseOrgSite();
    if (!orgSite) {
      return;
    }
    
    const folders = new Set();
    const { org, site } = orgSite;
    const path = `/${org}/${site}`;

    const { results } = crawl({
      path,
      callback: (file) => {
        // Extract folder path from file path
        const filePath = file.path.replace(`/${org}/${site}`, '');
        const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
        if (folderPath && folderPath !== '/') {
          folders.add(folderPath);

          // Also add parent paths
          const parts = folderPath.split('/').filter(Boolean);
          for (let i = 1; i < parts.length; i++) {
            const parentPath = `/${parts.slice(0, i).join('/')}`;
            folders.add(parentPath);
          }
        }
      },
      throttle: 10,
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    // Add timeout protection
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Folder tree load timeout')), 30000);
    });

    await Promise.race([results, timeoutPromise]);

    // Store folders globally for autocomplete
    app.availablePaths = Array.from(folders).sort();

    // Setup autocomplete
    setupPathAutocomplete();
  } catch (error) {
    showMessage('Could not load folder structure for autocomplete', 'error');
    app.availablePaths = [];
  }
}

function setupPathAutocomplete() {
  const pathInput = document.getElementById('search-path');
  const pathContainer = pathInput.parentElement;

  // Create autocomplete container
  let autocompleteContainer = document.getElementById('autocomplete-container');
  if (!autocompleteContainer) {
    autocompleteContainer = document.createElement('div');
    autocompleteContainer.id = 'autocomplete-container';
    autocompleteContainer.style.position = 'relative';
    autocompleteContainer.style.width = '100%';

    // Create suggestions list
    const suggestionsList = document.createElement('div');
    suggestionsList.id = 'suggestions-list';
    suggestionsList.style.position = 'absolute';
    suggestionsList.style.top = '100%';
    suggestionsList.style.left = '0';
    suggestionsList.style.right = '0';
    suggestionsList.style.background = 'white';
    suggestionsList.style.border = '1px solid #e5e5e7';
    suggestionsList.style.borderTop = 'none';
    suggestionsList.style.borderRadius = '0 0 8px 8px';
    suggestionsList.style.maxHeight = '200px';
    suggestionsList.style.overflowY = 'auto';
    suggestionsList.style.zIndex = '1000';
    suggestionsList.style.display = 'none';
    suggestionsList.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';

    // Wrap input in autocomplete container
    pathInput.parentNode.insertBefore(autocompleteContainer, pathInput);
    autocompleteContainer.appendChild(pathInput);
    autocompleteContainer.appendChild(suggestionsList);
  }

  const suggestionsList = document.getElementById('suggestions-list');
  let selectedIndex = -1;

  // Update placeholder
  pathInput.placeholder = 'Type to search folders (e.g., /drafts, /fragments)';

  function showSuggestions(query) {
    if (!app.availablePaths || query.length < 1) {
      suggestionsList.style.display = 'none';
      return;
    }

    const filtered = app.availablePaths.filter((path) => path.toLowerCase().includes(query.toLowerCase())).slice(0, 10); // Limit to 10 suggestions

    if (filtered.length === 0) {
      suggestionsList.style.display = 'none';
      return;
    }

    suggestionsList.innerHTML = '';
    selectedIndex = -1;

    filtered.forEach((path, index) => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.style.padding = '8px 12px';
      item.style.cursor = 'pointer';
      item.style.borderBottom = index < filtered.length - 1 ? '1px solid #f0f0f0' : 'none';
      item.textContent = path;

      item.addEventListener('mouseenter', () => {
        // Remove previous selection
        suggestionsList.querySelectorAll('.suggestion-item').forEach((i) => {
          i.style.background = '';
        });
        item.style.background = '#f0f8ff';
        selectedIndex = index;
      });

      item.addEventListener('click', () => {
        pathInput.value = path;
        suggestionsList.style.display = 'none';
        pathInput.focus();
      });

      suggestionsList.appendChild(item);
    });

    suggestionsList.style.display = 'block';
  }

  function hideSuggestions() {
    setTimeout(() => {
      suggestionsList.style.display = 'none';
    }, 150);
  }

  // Input event handler
  pathInput.addEventListener('input', (e) => {
    showSuggestions(e.target.value);
  });

  // Focus handler
  pathInput.addEventListener('focus', () => {
    if (pathInput.value) {
      showSuggestions(pathInput.value);
    }
  });

  // Blur handler
  pathInput.addEventListener('blur', hideSuggestions);

  // Keyboard navigation
  pathInput.addEventListener('keydown', (e) => {
    const items = suggestionsList.querySelectorAll('.suggestion-item');

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      updateSelection(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      updateSelection(items);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      const selectedItem = items[selectedIndex];
      if (selectedItem) {
        pathInput.value = selectedItem.textContent;
        suggestionsList.style.display = 'none';
      }
    } else if (e.key === 'Escape') {
      suggestionsList.style.display = 'none';
      pathInput.blur();
    }
  });

  function updateSelection(items) {
    items.forEach((item, index) => {
      item.style.background = index === selectedIndex ? '#f0f8ff' : '';
    });
  }
}

function updateBulkButtonText() {
  const select = document.getElementById('bulk-operation-type');
  const buttonText = document.getElementById('bulk-btn-text');

  if (select && buttonText) {
    const operation = select.value;
    const operationText = operation.charAt(0).toUpperCase() + operation.slice(1);

    // Count selected files
    const selectedCount = app.results.filter((result) => result.selected).length;

    if (selectedCount > 0) {
      buttonText.textContent = `${operationText} Selected (${selectedCount})`;
    } else {
      buttonText.textContent = `${operationText} Selected`;
    }
  }
}

function updateExportButtonText() {
  const buttonText = document.getElementById('export-btn-text');

  if (buttonText) {
    // Count selected files
    const selectedCount = app.results.filter((result) => result.selected).length;

    if (selectedCount > 0) {
      buttonText.textContent = `Export Files (${selectedCount})`;
    } else {
      buttonText.textContent = 'Export Files';
    }
  }
}

function toggleAccordion(contentId) {
  const content = document.getElementById(contentId);
  const card = content.closest('.accordion-card');

  if (content && card) {
    const isExpanded = card.classList.contains('expanded');

    if (isExpanded) {
      // Collapse
      card.classList.remove('expanded');
      content.style.display = 'none';
    } else {
      // Expand
      card.classList.add('expanded');
      content.style.display = 'block';
    }
  }
}

function setupEventListeners() {
  const scanBtn = document.getElementById('scan-btn');
  const executeBtn = document.getElementById('execute-btn');
  const exportBtn = document.getElementById('export-btn');
  const bulkPublishBtn = document.getElementById('bulk-publish-btn');
  const toggleAll = document.getElementById('toggle-all');
  const clearSelection = document.getElementById('clear-selection');
  const expandAll = document.getElementById('expand-all');
  const collapseAll = document.getElementById('collapse-all');

  if (scanBtn) scanBtn.addEventListener('click', scanFiles);
  if (executeBtn) executeBtn.addEventListener('click', executeReplace);
  if (exportBtn) exportBtn.addEventListener('click', exportResults);
  if (bulkPublishBtn) bulkPublishBtn.addEventListener('click', bulkOperation);

  // Update button text when dropdown changes
  const bulkOperationSelect = document.getElementById('bulk-operation-type');
  if (bulkOperationSelect) {
    bulkOperationSelect.addEventListener('change', updateBulkButtonText);
    updateBulkButtonText(); // Set initial text
  }

  // Set initial export button text
  updateExportButtonText();

  // Filter results functionality
  const filterInput = document.getElementById('filter-results');
  if (filterInput) {
    filterInput.addEventListener('input', filterResults);
    filterInput.addEventListener('keyup', filterResults);
  }

  // Pagination functionality
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (app.pagination.currentPage > 1) {
        goToPage(app.pagination.currentPage - 1);
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (app.pagination.currentPage < app.pagination.totalPages) {
        goToPage(app.pagination.currentPage + 1);
      }
    });
  }

  // Accordion functionality
  const accordionHeaders = document.querySelectorAll('.accordion-header[data-accordion-target]');
  accordionHeaders.forEach((header) => {
    header.addEventListener('click', () => {
      const targetId = header.getAttribute('data-accordion-target');
      toggleAccordion(targetId);
    });
  });

  // Help modal functionality
  const helpBtn = document.querySelector('.help-btn');
  const helpModal = document.getElementById('help-modal');
  const modalClose = document.querySelector('.modal-close');

  if (helpBtn && helpModal) {
    helpBtn.addEventListener('click', () => {
      helpModal.classList.remove('hidden');
    });
  }

  if (modalClose && helpModal) {
    modalClose.addEventListener('click', () => {
      helpModal.classList.add('hidden');
    });
  }

  // Close modal on overlay click
  if (helpModal) {
    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) {
        helpModal.classList.add('hidden');
      }
    });
  }

  // Load folder tree on-demand when user focuses on base path field
  const searchPathInput = document.getElementById('search-path');
  if (searchPathInput) {
    let folderTreeLoaded = false;
    searchPathInput.addEventListener('focus', () => {
      if (!folderTreeLoaded) {
        folderTreeLoaded = true;
        loadFolderTree().catch(() => {
          // Silently fail, autocomplete just won't be available
        });
      }
    });

    // Also reload folder tree when org/site changes
    const orgSiteInput = document.getElementById('org-site-path');
    if (orgSiteInput) {
      orgSiteInput.addEventListener('blur', () => {
        // Reset flag so tree reloads with new org/site
        folderTreeLoaded = false;
      });
    }
  }

  if (toggleAll) {
    toggleAll.addEventListener('click', () => {
      const checkboxes = document.querySelectorAll('.result-checkbox');
      const allChecked = Array.from(checkboxes).every((cb) => cb.checked);

      checkboxes.forEach((cb, index) => {
        cb.checked = !allChecked;
        if (app.results[index]) {
          app.results[index].selected = !allChecked;
        }

        if (!allChecked) {
          app.selectedFiles.add(index);
        } else {
          app.selectedFiles.delete(index);
        }
      });

      updateActionButtons();
    });
  }

  if (clearSelection) {
    clearSelection.addEventListener('click', () => {
      document.querySelectorAll('.result-checkbox').forEach((cb, index) => {
        cb.checked = false;
        if (app.results[index]) {
          app.results[index].selected = false;
        }
      });
      app.selectedFiles.clear();
      updateActionButtons();
    });
  }

  if (expandAll) {
    expandAll.addEventListener('click', () => {
      document.querySelectorAll('.result-item').forEach((item) => {
        const matchesContainer = item.querySelector('.result-matches');
        const resultHeader = item.querySelector('.result-header');
        const idx = parseInt(resultHeader.dataset.resultIndex, 10);

        item.classList.add('expanded');
        matchesContainer.classList.remove('collapsed');
        matchesContainer.classList.add('expanded');
        if (app.results[idx]) {
          app.results[idx].expanded = true;
        }
      });
    });
  }

  if (collapseAll) {
    collapseAll.addEventListener('click', () => {
      document.querySelectorAll('.result-item').forEach((item) => {
        const matchesContainer = item.querySelector('.result-matches');
        const resultHeader = item.querySelector('.result-header');
        const idx = parseInt(resultHeader.dataset.resultIndex, 10);

        item.classList.remove('expanded');
        matchesContainer.classList.remove('expanded');
        matchesContainer.classList.add('collapsed');
        if (app.results[idx]) {
          app.results[idx].expanded = false;
        }
      });
    });
  }

  const targetType = document.getElementById('target-type');
  if (targetType) {
    targetType.addEventListener('change', (e) => {
      const customSelector = document.querySelector('.custom-selector');
      const searchTermHelp = document.getElementById('search-term-help');
      const searchTermTextarea = document.getElementById('search-term');

      if (customSelector) {
        customSelector.style.display = e.target.value === 'custom' ? 'block' : 'none';
      }

      if (searchTermHelp) {
        searchTermHelp.style.display = e.target.value === 'custom' ? 'block' : 'none';
      }

      if (searchTermTextarea) {
        if (e.target.value === 'custom') {
          searchTermTextarea.placeholder = 'Optional: Enter text to find within elements, or leave empty to find all pages with these elements';
        } else {
          searchTermTextarea.placeholder = 'Enter text to find (supports regex when search type is set to Regular Expression)';
        }
      }
    });
  }

  const toastCloseBtn = document.querySelector('.toast-close');
  if (toastCloseBtn) {
    toastCloseBtn.addEventListener('click', () => {
      document.getElementById('toast').classList.add('hidden');
    });
  }
}

async function init() {
  try {
    const { context, token, actions } = await DA_SDK;

    app.context = context;
    app.token = token;
    app.actions = actions;

    setupEventListeners();

    // Initialize org/site from DA context or show ready message
    const orgSite = parseOrgSite();
    if (orgSite) {
      showMessage(`Search & Replace app ready! Using ${orgSite.org}/${orgSite.site}`, 'success');
    } else {
      showMessage('Search & Replace app ready! Please configure your org/site.', 'success');
    }

    // Folder tree will be loaded on-demand when user focuses on base path field
  } catch (error) {
    showMessage('Failed to initialize app', 'error');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
