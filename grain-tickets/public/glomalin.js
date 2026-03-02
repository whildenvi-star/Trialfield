/* ============================================================
   GLOMALIN — Floating Chat Widget IIFE
   Connects to /api/agent/chat SSE endpoint
   Requires: window.GLOMALIN_ENABLED = true (server-injected)
   Optional: window.Chart (Chart.js 4.x for inline charts)
   ============================================================ */
(function () {
  'use strict';

  // Kill-switch guard — if disabled, exit immediately, create no DOM
  if (!window.GLOMALIN_ENABLED) return;

  /* ----------------------------------------------------------
     State
  ---------------------------------------------------------- */
  var conversationHistory = [];
  var sessionKey = generateUUID();
  var isOpen = false;
  var isStreaming = false;
  var dailyLimitReached = false;
  var renderThrottleTimer = null;
  var currentAssistantBubble = null;
  var currentFullText = '';
  var tractorInterval = null;

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /* ----------------------------------------------------------
     DOM Construction
  ---------------------------------------------------------- */

  // Floating button
  var btn = document.createElement('button');
  btn.id = 'glomalin-btn';
  btn.title = 'Ask Glomalin about your grain data';
  btn.innerHTML = [
    '<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">',
    // Cab body
    '  <rect x="8" y="8" width="10" height="8" rx="1" fill="currentColor" opacity="0.9"/>',
    // Cab window
    '  <rect x="9" y="9" width="5" height="4" rx="0.5" fill="var(--bg,#0a0e09)" opacity="0.6"/>',
    // Hood / engine body
    '  <rect x="4" y="12" width="8" height="5" rx="0.5" fill="currentColor"/>',
    // Large rear wheel
    '  <circle cx="16" cy="21" r="5" fill="none" stroke="currentColor" stroke-width="2"/>',
    '  <circle cx="16" cy="21" r="2" fill="currentColor"/>',
    // Small front wheel
    '  <circle cx="5" cy="21" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/>',
    '  <circle cx="5" cy="21" r="1.2" fill="currentColor"/>',
    // Exhaust pipe
    '  <rect x="11" y="4" width="2" height="5" rx="0.5" fill="currentColor"/>',
    '</svg>',
    '<span class="glomalin-dot"></span>'
  ].join('');
  document.body.appendChild(btn);

  // Popup container
  var popup = document.createElement('div');
  popup.id = 'glomalin-popup';
  popup.style.display = 'none';

  // Header
  var header = document.createElement('div');
  header.id = 'glomalin-header';
  header.innerHTML = [
    '<span class="glomalin-title">Glomalin</span>',
    '<div class="glomalin-header-actions">',
    '  <button id="glomalin-clear" class="glomalin-hdr-btn" title="Clear conversation">Clear</button>',
    '  <button id="glomalin-close" class="glomalin-hdr-btn" title="Close">X</button>',
    '</div>'
  ].join('');
  popup.appendChild(header);

  // Warning banner (hidden initially)
  var warningBanner = document.createElement('div');
  warningBanner.id = 'glomalin-warning';
  warningBanner.className = 'glomalin-warning';
  warningBanner.style.display = 'none';
  popup.appendChild(warningBanner);

  // Messages area
  var messages = document.createElement('div');
  messages.id = 'glomalin-messages';
  popup.appendChild(messages);

  // Input row
  var inputRow = document.createElement('div');
  inputRow.id = 'glomalin-input-row';
  inputRow.innerHTML = [
    '<textarea id="glomalin-input" rows="2" placeholder="Ask about your grain data..." autocomplete="off"></textarea>',
    '<button id="glomalin-send" class="glomalin-send-btn" title="Send">Send</button>'
  ].join('');
  popup.appendChild(inputRow);

  document.body.appendChild(popup);

  // Element references
  var inputEl = document.getElementById('glomalin-input');
  var sendBtn = document.getElementById('glomalin-send');
  var clearBtn = document.getElementById('glomalin-clear');
  var closeBtn = document.getElementById('glomalin-close');

  /* ----------------------------------------------------------
     Popup toggle / open / close
  ---------------------------------------------------------- */
  function openPopup() {
    popup.style.display = 'flex';
    isOpen = true;
    scrollToBottom();
    if (!isStreaming && !dailyLimitReached) {
      inputEl.focus();
    }
  }

  function closePopup() {
    popup.style.display = 'none';
    isOpen = false;
  }

  btn.addEventListener('click', function () {
    if (isOpen) { closePopup(); } else { openPopup(); }
  });

  closeBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    closePopup();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) closePopup();
  });

  /* ----------------------------------------------------------
     Drag support
  ---------------------------------------------------------- */
  var isDragging = false;
  var dragOffsetX = 0;
  var dragOffsetY = 0;

  header.addEventListener('mousedown', function (e) {
    if (e.target.closest('button')) return;
    isDragging = true;
    dragOffsetX = e.clientX - popup.getBoundingClientRect().left;
    dragOffsetY = e.clientY - popup.getBoundingClientRect().top;
    header.style.cursor = 'grabbing';
    e.preventDefault();
  });

  document.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    var newLeft = e.clientX - dragOffsetX;
    var newTop = e.clientY - dragOffsetY;
    // Clamp to viewport
    newLeft = Math.max(0, Math.min(window.innerWidth - popup.offsetWidth, newLeft));
    newTop = Math.max(0, Math.min(window.innerHeight - popup.offsetHeight, newTop));
    popup.style.right = 'auto';
    popup.style.bottom = 'auto';
    popup.style.left = newLeft + 'px';
    popup.style.top = newTop + 'px';
  });

  document.addEventListener('mouseup', function () {
    if (isDragging) {
      isDragging = false;
      header.style.cursor = '';
    }
  });

  /* ----------------------------------------------------------
     Clear chat
  ---------------------------------------------------------- */
  clearBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    conversationHistory = [];
    sessionKey = generateUUID();
    messages.innerHTML = '';
    warningBanner.style.display = 'none';
    if (dailyLimitReached) {
      // Re-check in case day rolled over (unlikely but clean)
      addSystemMessage('Chat cleared. Daily limit is still reached — try again tomorrow.');
    }
  });

  /* ----------------------------------------------------------
     Scroll
  ---------------------------------------------------------- */
  function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  /* ----------------------------------------------------------
     Message bubble helpers
  ---------------------------------------------------------- */
  function addUserBubble(text) {
    var div = document.createElement('div');
    div.className = 'glomalin-msg user';
    div.textContent = text;
    messages.appendChild(div);
    scrollToBottom();
    return div;
  }

  function addAssistantBubble() {
    var div = document.createElement('div');
    div.className = 'glomalin-msg assistant';
    messages.appendChild(div);
    scrollToBottom();
    return div;
  }

  function addSystemMessage(text) {
    var div = document.createElement('div');
    div.className = 'glomalin-msg system';
    div.textContent = text;
    messages.appendChild(div);
    scrollToBottom();
    return div;
  }

  function addToolStatus(bubble, toolName) {
    var existing = bubble.querySelector('.glomalin-tool-status');
    if (existing) { existing.textContent = 'Querying ' + toolName + '...'; return; }
    var span = document.createElement('div');
    span.className = 'glomalin-tool-status';
    span.textContent = 'Querying ' + toolName + '...';
    bubble.appendChild(span);
    scrollToBottom();
  }

  /* ----------------------------------------------------------
     ASCII Tractor Loading Animation
  ---------------------------------------------------------- */
  var TRACTOR_FRAMES = [
    '    ~~  ~~\n   ~~~~~~~~\n  ___||____||___\n /  _____  ___ \\\n|__|     |_|  |_|\n  (o)     (o)',
    '   ~~~  ~~\n  ~~~~~~~~~~\n  ___||____||___\n /  _____  ___ \\\n|__|     |_|  |_|\n  (o)     (o)',
    '    ~~  ~~~\n   ~~~~~~~~\n  ___||____||___\n /  _____  ___ \\\n|__|     |_|  |_|\n  (o)     (o)'
  ];

  function showLoadingTractor(bubble) {
    var pre = document.createElement('pre');
    pre.className = 'glomalin-loading';
    pre.textContent = TRACTOR_FRAMES[0];
    bubble.appendChild(pre);
    scrollToBottom();
    var frame = 0;
    tractorInterval = setInterval(function () {
      frame = (frame + 1) % TRACTOR_FRAMES.length;
      pre.textContent = TRACTOR_FRAMES[frame];
    }, 300);
    return pre;
  }

  function stopLoadingTractor() {
    if (tractorInterval) {
      clearInterval(tractorInterval);
      tractorInterval = null;
    }
  }

  /* ----------------------------------------------------------
     Markdown Renderer (hand-rolled, no libraries)
  ---------------------------------------------------------- */
  function renderMessageContent(text) {
    // Extract and store code blocks to protect from inline processing
    var codeBlocks = [];
    var placeholder = '\x00CODEBLOCK\x00';

    // First pass: extract fenced code blocks (```lang ... ```)
    var processedText = text.replace(/```([\w-]*)\n?([\s\S]*?)```/g, function (match, lang, code) {
      var idx = codeBlocks.length;
      codeBlocks.push({ lang: lang.trim().toLowerCase(), code: code });
      return placeholder + idx + '\x00';
    });

    // Escape HTML in the non-code text
    processedText = escapeHtml(processedText);

    // Headers: ### text -> <h4>
    processedText = processedText.replace(/^######\s+(.+)$/gm, '<h6 class="glomalin-h">$1</h6>');
    processedText = processedText.replace(/^#####\s+(.+)$/gm, '<h5 class="glomalin-h">$1</h5>');
    processedText = processedText.replace(/^####\s+(.+)$/gm, '<h4 class="glomalin-h">$1</h4>');
    processedText = processedText.replace(/^###\s+(.+)$/gm, '<h4 class="glomalin-h">$1</h4>');
    processedText = processedText.replace(/^##\s+(.+)$/gm, '<h5 class="glomalin-h">$1</h5>');
    processedText = processedText.replace(/^#\s+(.+)$/gm, '<h6 class="glomalin-h">$1</h6>');

    // Bold: **text**
    processedText = processedText.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');

    // Italic: *text* (not ** — handled above)
    processedText = processedText.replace(/(?<!\*)\*(?!\*)([^*\n]+)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    // Inline code: `code`
    processedText = processedText.replace(/`([^`\n]+)`/g, '<code class="glomalin-inline-code">$1</code>');

    // Tables: lines with | separators
    processedText = renderTables(processedText);

    // Lists: - item or * item
    processedText = renderLists(processedText);

    // Links and deep links: [text](url)
    processedText = processedText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (match, linkText, url) {
      // Deep link pattern: #ticket-NNN or links to ticket numbers
      var deepMatch = url.match(/^#ticket-(\w+)$/);
      if (deepMatch) {
        var ticketId = deepMatch[1];
        return '<a href="#" class="glomalin-deeplink" data-ticket="' + escapeAttr(ticketId) + '" onclick="(function(el){var id=el.getAttribute(\'data-ticket\');window._glomalinNav&&window._glomalinNav(id);})(this);return false;">' + linkText + '</a>';
      }
      return '<a href="' + escapeAttr(url) + '" target="_blank" rel="noopener noreferrer">' + linkText + '</a>';
    });

    // Line breaks: \n -> <br> but not inside placeholders or block elements
    processedText = processedText.replace(/\n(?!<(?:ul|ol|li|table|thead|tbody|tr|th|td|h[1-6]|pre|div))/g, '<br>');

    // Now restore code blocks
    processedText = processedText.replace(/\x00CODEBLOCK\x00(\d+)\x00/g, function (match, idxStr) {
      var idx = parseInt(idxStr, 10);
      var block = codeBlocks[idx];
      return renderCodeBlock(block.lang, block.code);
    });

    return processedText;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderTables(text) {
    // Match markdown tables: lines starting/ending with |
    var lines = text.split('\n');
    var result = [];
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        // Check if next line is separator (|---|---|)
        var tableLines = [line];
        var hasSeparator = false;
        var j = i + 1;
        while (j < lines.length && lines[j].trim().startsWith('|') && lines[j].trim().endsWith('|')) {
          tableLines.push(lines[j]);
          j++;
        }
        // Build table
        if (tableLines.length >= 2 && /^\|[\s\-|:]+\|$/.test(tableLines[1].trim())) {
          hasSeparator = true;
          var headers = parseTableRow(tableLines[0]);
          var tableHtml = '<table class="glomalin-table"><thead><tr>';
          headers.forEach(function (h) { tableHtml += '<th>' + h + '</th>'; });
          tableHtml += '</tr></thead><tbody>';
          for (var k = 2; k < tableLines.length; k++) {
            var cells = parseTableRow(tableLines[k]);
            tableHtml += '<tr>';
            cells.forEach(function (c) { tableHtml += '<td>' + c + '</td>'; });
            tableHtml += '</tr>';
          }
          tableHtml += '</tbody></table>';
          result.push(tableHtml);
          i = j;
          continue;
        }
      }
      result.push(line);
      i++;
    }
    return result.join('\n');
  }

  function parseTableRow(line) {
    var cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
    return cells.map(function (c) { return c.trim(); });
  }

  function renderLists(text) {
    // Group consecutive list items
    var lines = text.split('\n');
    var result = [];
    var inList = false;
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];
      var listMatch = line.match(/^(\s*)([-*])\s+(.+)$/);
      if (listMatch) {
        if (!inList) {
          result.push('<ul class="glomalin-list">');
          inList = true;
        }
        result.push('<li>' + listMatch[3] + '</li>');
      } else {
        if (inList) {
          result.push('</ul>');
          inList = false;
        }
        result.push(line);
      }
      i++;
    }
    if (inList) result.push('</ul>');
    return result.join('\n');
  }

  function renderCodeBlock(lang, code) {
    var unescapedCode = code
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');

    if (lang === 'chartjs') {
      return renderChartBlock(unescapedCode);
    }
    if (lang === 'csv') {
      return renderCsvBlock(unescapedCode);
    }
    // Regular code block
    return '<pre class="glomalin-pre"><code class="glomalin-code lang-' + (lang || 'text') + '">' + escapeHtml(unescapedCode.trim()) + '</code></pre>';
  }

  /* ----------------------------------------------------------
     Chart.js Inline Rendering
  ---------------------------------------------------------- */
  var chartCounter = 0;

  function renderChartBlock(jsonStr) {
    var canvasId = 'glomalin-chart-' + (++chartCounter);
    var wrap = '<div class="glomalin-chart-wrap"><canvas id="' + canvasId + '"></canvas></div>';
    try {
      var config = JSON.parse(jsonStr);
      // Schedule instantiation after DOM insertion
      setTimeout(function () {
        var canvas = document.getElementById(canvasId);
        if (!canvas) return;
        if (!window.Chart) {
          canvas.parentElement.innerHTML = '<pre class="glomalin-pre" style="font-size:0.75rem;color:var(--text-light)">Chart.js not loaded — install chart.min.js</pre>';
          return;
        }
        try {
          // Merge responsive defaults
          if (!config.options) config.options = {};
          config.options.responsive = true;
          config.options.maintainAspectRatio = true;
          if (!config.options.plugins) config.options.plugins = {};
          if (!config.options.plugins.legend) config.options.plugins.legend = { labels: { color: getComputedStyle(document.body).getPropertyValue('--text') || '#a8b8a0' } };

          new window.Chart(canvas, config);
        } catch (err) {
          canvas.parentElement.innerHTML = '<pre class="glomalin-pre" style="font-size:0.75rem;color:var(--danger)">Chart error: ' + escapeHtml(String(err)) + '</pre>';
        }
      }, 50);
    } catch (e) {
      // JSON parse error — show raw
      return '<pre class="glomalin-pre"><code class="glomalin-code lang-json">' + escapeHtml(jsonStr.trim()) + '</code></pre>';
    }
    return wrap;
  }

  /* ----------------------------------------------------------
     CSV Export Block
  ---------------------------------------------------------- */
  var csvCounter = 0;

  function renderCsvBlock(csvStr) {
    var id = 'glomalin-csv-' + (++csvCounter);
    var lines = csvStr.trim().split('\n');
    var previewRows = lines.slice(0, 4); // header + 3 data rows

    var previewHtml = '<table class="glomalin-table glomalin-csv-preview">';
    previewRows.forEach(function (line, idx) {
      var cells = line.split(',').map(function (c) { return c.trim().replace(/^"(.*)"$/, '$1'); });
      if (idx === 0) {
        previewHtml += '<thead><tr>';
        cells.forEach(function (c) { previewHtml += '<th>' + escapeHtml(c) + '</th>'; });
        previewHtml += '</tr></thead><tbody>';
      } else {
        previewHtml += '<tr>';
        cells.forEach(function (c) { previewHtml += '<td>' + escapeHtml(c) + '</td>'; });
        previewHtml += '</tr>';
      }
    });
    if (previewRows.length > 1) previewHtml += '</tbody>';
    previewHtml += '</table>';

    if (lines.length > 4) {
      previewHtml += '<p class="glomalin-csv-more">+ ' + (lines.length - 4) + ' more rows</p>';
    }

    // Store CSV data for download button
    setTimeout(function () {
      var btn2 = document.getElementById(id + '-btn');
      if (!btn2) return;
      btn2.addEventListener('click', function () {
        var blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'glomalin-export.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      });
    }, 50);

    return '<div class="glomalin-csv-wrap">' +
      '<button id="' + id + '-btn" class="glomalin-csv-btn">Export CSV</button>' +
      previewHtml +
      '</div>';
  }

  /* ----------------------------------------------------------
     Deep Link Navigation
  ---------------------------------------------------------- */
  window._glomalinNav = function (ticketId) {
    // Switch to Ticket Log tab
    var listTab = document.querySelector('.tab-btn[data-tab="list"]');
    if (listTab) listTab.click();
    // Search for the ticket
    var searchInput = document.getElementById('filter-search');
    if (searchInput) {
      searchInput.value = ticketId;
      searchInput.dispatchEvent(new Event('input'));
    }
    // Scroll to first match after render
    setTimeout(function () {
      var row = document.querySelector('#ticket-tbody tr');
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  };

  /* ----------------------------------------------------------
     Input event handlers
  ---------------------------------------------------------- */
  sendBtn.addEventListener('click', sendMessage);

  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  function setInputEnabled(enabled) {
    inputEl.disabled = !enabled;
    sendBtn.disabled = !enabled;
    sendBtn.style.opacity = enabled ? '' : '0.4';
  }

  /* ----------------------------------------------------------
     SSE Streaming — sendMessage
  ---------------------------------------------------------- */
  function sendMessage() {
    var text = inputEl.value.trim();
    if (!text || isStreaming || dailyLimitReached) return;

    // Add user bubble
    addUserBubble(text);

    // Push to history
    conversationHistory.push({ role: 'user', content: text });

    // Clear input and disable
    inputEl.value = '';
    setInputEnabled(false);
    isStreaming = true;

    // Show tractor loading animation
    currentAssistantBubble = addAssistantBubble();
    currentFullText = '';
    showLoadingTractor(currentAssistantBubble);

    var history = conversationHistory.slice(-20);

    fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: history, sessionKey: sessionKey })
    }).then(function (response) {
      if (!response.ok) {
        return response.json().catch(function () { return {}; }).then(function (body) {
          throw new Error(body.error || 'Server error ' + response.status);
        });
      }

      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';
      var streamStarted = false;

      function pump() {
        reader.read().then(function (result) {
          if (result.done) {
            finalizeMessage();
            return;
          }

          buffer += decoder.decode(result.value, { stream: true });

          // Split on double newline (SSE event boundary)
          var parts = buffer.split('\n\n');
          buffer = parts.pop(); // keep incomplete tail

          parts.forEach(function (part) {
            if (!part.trim()) return;
            var lines = part.split('\n');
            var eventType = null;
            var dataStr = '';

            lines.forEach(function (line) {
              if (line.startsWith('event: ')) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith('data: ')) {
                dataStr = line.slice(6);
              }
            });

            if (!dataStr) return;

            var data;
            try {
              data = JSON.parse(dataStr);
            } catch (e) {
              return; // malformed SSE data
            }

            handleSseEvent(eventType, data, streamStarted);
            if (eventType === 'text_delta') streamStarted = true;
          });

          pump();
        }).catch(function (err) {
          showStreamError('Connection error: ' + err.message);
        });
      }

      pump();
    }).catch(function (err) {
      showStreamError(err.message || 'Failed to connect to Glomalin agent');
    });
  }

  function handleSseEvent(type, data, streamStarted) {
    if (type === 'text_delta') {
      if (!streamStarted) {
        // First text delta — clear the loading animation
        stopLoadingTractor();
        currentAssistantBubble.innerHTML = '';
      }
      currentFullText += (data.delta || '');
      // Throttled render: update HTML every 100ms to avoid thrashing
      if (!renderThrottleTimer) {
        renderThrottleTimer = setTimeout(function () {
          renderThrottleTimer = null;
          if (currentAssistantBubble) {
            currentAssistantBubble.innerHTML = renderMessageContent(currentFullText);
            scrollToBottom();
          }
        }, 100);
      }
    } else if (type === 'tool_call') {
      addToolStatus(currentAssistantBubble, data.tool || 'data source');
    } else if (type === 'done') {
      finalizeMessage();
    } else if (type === 'warning') {
      showWarningBanner(data.message || data.remaining);
    } else if (type === 'error') {
      showStreamError(data.error || data.message || 'An error occurred');
    }
  }

  function finalizeMessage() {
    stopLoadingTractor();
    if (renderThrottleTimer) {
      clearTimeout(renderThrottleTimer);
      renderThrottleTimer = null;
    }
    // Final render
    if (currentAssistantBubble && currentFullText) {
      currentAssistantBubble.innerHTML = renderMessageContent(currentFullText);
      // Remove tool status lines (they're informational during streaming only)
      var toolStatus = currentAssistantBubble.querySelector('.glomalin-tool-status');
      if (toolStatus) toolStatus.remove();
      scrollToBottom();
    } else if (currentAssistantBubble && !currentFullText) {
      // Empty response — clear loading
      currentAssistantBubble.innerHTML = '<em style="color:var(--text-light);font-size:0.85rem;">No response received.</em>';
    }
    // Push to history
    if (currentFullText) {
      conversationHistory.push({ role: 'assistant', content: currentFullText });
    }
    currentAssistantBubble = null;
    currentFullText = '';
    isStreaming = false;
    setInputEnabled(!dailyLimitReached);
    scrollToBottom();
  }

  function showStreamError(msg) {
    stopLoadingTractor();
    if (renderThrottleTimer) {
      clearTimeout(renderThrottleTimer);
      renderThrottleTimer = null;
    }
    if (currentAssistantBubble) {
      currentAssistantBubble.innerHTML = '<span style="color:var(--danger);">Error: ' + escapeHtml(msg) + '</span>';
    } else {
      addSystemMessage('Error: ' + msg);
    }
    currentAssistantBubble = null;
    currentFullText = '';
    isStreaming = false;
    setInputEnabled(!dailyLimitReached);
    scrollToBottom();
  }

  function showWarningBanner(msgOrRemaining) {
    warningBanner.style.display = 'block';
    if (typeof msgOrRemaining === 'number') {
      warningBanner.textContent = 'Approaching daily limit (' + msgOrRemaining + ' messages left)';
    } else {
      warningBanner.textContent = String(msgOrRemaining);
    }
  }

  /* ----------------------------------------------------------
     Daily cap check on init
  ---------------------------------------------------------- */
  function checkDailyStatus() {
    fetch('/api/agent/status')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.remaining === 0 || data.limitReached) {
          dailyLimitReached = true;
          setInputEnabled(false);
          addSystemMessage('Daily message limit reached. Try again tomorrow!');
        } else if (data.remaining <= 5) {
          showWarningBanner(data.remaining);
        }
      })
      .catch(function () {
        // Status unavailable — allow chat (optimistic)
      });
  }

  checkDailyStatus();

})();
