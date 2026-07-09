(() => {
  const treeEl = document.getElementById('tree');
  const readerEl = document.getElementById('reader');
  const countEl = document.getElementById('doc-count');

  const CONTENT_ROOT = 'content';

  let ROOT = null;
  const nodesByPath = new Map();
  const parentByPath = new Map();
  const openPaths = new Set();
  let currentPath = null; // used to work out swipe/animation direction

  const STAMPS = ['CASE FILE', 'ON RECORD', 'ARCHIVED', 'CLEARED'];

  init();

  async function init() {
    try {
      const res = await fetch('data/index.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('index not found');
      ROOT = await res.json();
      indexNodes(ROOT, null);
      countEl.textContent = `${nodesByPath.size} file${nodesByPath.size === 1 ? '' : 's'} indexed`;
      renderTree();
      bindGlobalNav();
      window.addEventListener('hashchange', route);
      route(true);
    } catch (err) {
      treeEl.innerHTML = `<div class="tree-error">Could not load data/index.json.<br>Run the build script or push to trigger the GitHub Action.</div>`;
      readerEl.innerHTML = `<div class="doc-empty">No index yet. See the sidebar for details.</div>`;
      countEl.textContent = 'index missing';
      console.error(err);
    }
  }

  function indexNodes(node, parent) {
    nodesByPath.set(node.path, node);
    if (parent) parentByPath.set(node.path, parent.path);
    // root and top-level categories start open; everything deeper starts collapsed
    if (node.path === '' || node.path.split('/').length === 1) openPaths.add(node.path);
    (node.children || []).forEach((c) => indexNodes(c, node));
  }

  // ---------- routing ----------

  function route(isInitial) {
    const path = decodeURIComponent(location.hash.replace(/^#/, ''));
    const node = nodesByPath.get(path) || ROOT;
    const parts = node.path ? node.path.split('/') : [];
    let acc = '';
    parts.forEach((p, i) => {
      acc = i === 0 ? p : acc + '/' + p;
      openPaths.add(acc);
    });
    openPaths.add('');
    renderTree();
    renderDoc(node, isInitial ? 'up' : undefined);
  }

  function navigate(path) {
    if (path === currentPath) return;
    location.hash = encodeURIComponent(path);
  }

  function toggleOpen(path) {
    if (openPaths.has(path)) openPaths.delete(path); else openPaths.add(path);
    renderTree();
  }

  // ---------- sibling helpers (power the swipe / prev-next nav) ----------

  function getSiblings(path) {
    const parentPath = parentByPath.get(path);
    if (parentPath === undefined) return [ROOT];
    const parent = nodesByPath.get(parentPath);
    return (parent && parent.children) || [];
  }

  function getAdjacent(path, dir) {
    const siblings = getSiblings(path);
    const idx = siblings.findIndex((s) => s.path === path);
    if (idx === -1) return null;
    const next = siblings[idx + dir];
    return next || null;
  }

  // ---------- sidebar tree ----------

  function renderTree() {
    treeEl.innerHTML = '';
    treeEl.appendChild(buildTreeNode(ROOT, true));
  }

  function buildTreeNode(node, isRoot) {
    const wrap = document.createElement('div');
    wrap.className = 'tree-node';

    const hasChildren = node.children && node.children.length > 0;
    const isOpen = openPaths.has(node.path);
    const activePath = decodeURIComponent(location.hash.replace(/^#/, '')) || '';
    const isActive = (activePath === node.path) || (isRoot && activePath === '');

    if (!isRoot) {
      const row = document.createElement('div');
      row.className = 'tree-row' + (isActive ? ' active' : '');
      row.tabIndex = 0;
      row.setAttribute('role', 'treeitem');
      if (hasChildren) row.setAttribute('aria-expanded', String(isOpen));

      const caret = document.createElement('span');
      caret.className = 'tree-caret' + (hasChildren ? (isOpen ? ' open' : '') : ' leaf');
      caret.textContent = '▸';
      if (hasChildren) {
        caret.addEventListener('click', (e) => {
          e.stopPropagation();
          if (window.Sound) Sound.click();
          toggleOpen(node.path);
        });
      }

      const tab = document.createElement('span');
      tab.className = 'tree-tab' + (node.hasContent ? '' : ' folder-only');

      const label = document.createElement('span');
      label.className = 'tree-label';
      label.textContent = node.title;

      row.append(caret, tab, label);
      row.addEventListener('click', () => {
        if (window.Sound) Sound.click();
        // clicking a category you're already viewing just opens/closes it
        if (hasChildren && node.path === currentPath) {
          toggleOpen(node.path);
          return;
        }
        if (hasChildren) openPaths.add(node.path);
        navigate(node.path);
      });
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.click(); }
      });

      wrap.appendChild(row);
    }

    if (hasChildren) {
      const childWrap = document.createElement('div');
      childWrap.className = 'tree-children' + (isOpen || isRoot ? ' open' : '');
      node.children.forEach((child) => childWrap.appendChild(buildTreeNode(child, false)));
      wrap.appendChild(childWrap);
    }

    return wrap;
  }

  // ---------- document reader ----------

  function renderDoc(node) {
    if (!node) {
      readerEl.innerHTML = `<div class="doc-empty">Nothing here yet.</div>`;
      currentPath = null;
      return;
    }

    currentPath = node.path;
    if (window.Sound) Sound.slide();

    if (!node.hasContent) {
      const list = (node.children || []).map((c) => (
        `<div class="doc-child-link" data-path="${escapeAttr(c.path)}"><span class="arrow">›</span>${escapeHtml(c.title)}</div>`
      )).join('');
      readerEl.innerHTML = `
        <article class="doc-page enter-right">
          <div class="doc-meta">Category</div>
          <h1 class="doc-title">${escapeHtml(node.title)}</h1>
          <div class="doc-divider"></div>
          <div class="doc-children">
            <div class="doc-children-label">Contents</div>
            ${list || '<div class="doc-empty" style="padding:0;text-align:left;">Empty — add a content.txt somewhere inside this folder.</div>'}
          </div>
        </article>`;
      bindChildLinks();
      readerEl.scrollTop = 0;
      return;
    }

    const stamp = STAMPS[hashCode(node.path) % STAMPS.length];
    const childList = (node.children || []).map((c) => (
      `<div class="doc-child-link" data-path="${escapeAttr(c.path)}"><span class="arrow">›</span>${escapeHtml(c.title)}</div>`
    )).join('');

    const headerHtml = node.image ? `
      <div class="doc-header">
        <div class="doc-photo"><img src="${escapeAttr(node.image)}" alt="${escapeAttr(node.title)}" loading="lazy"></div>
        <div class="doc-header-text">
          <h1 class="doc-title">${escapeHtml(node.title)}</h1>
          ${node.tagline ? `<p class="doc-tagline">${inline(node.tagline)}</p>` : ''}
        </div>
      </div>
    ` : `
      <h1 class="doc-title">${escapeHtml(node.title)}</h1>
      ${node.tagline ? `<p class="doc-tagline">${inline(node.tagline)}</p>` : ''}
    `;

    const siblings = getSiblings(node.path);
    const idx = siblings.findIndex((s) => s.path === node.path);
    const prev = idx > 0 ? siblings[idx - 1] : null;
    const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
    const navHtml = siblings.length > 1 ? `
      <div class="doc-nav">
        <button class="doc-nav-btn" data-nav="-1" ${prev ? '' : 'disabled'}>‹ Previous</button>
        <span class="doc-nav-pos">${idx + 1} / ${siblings.length}</span>
        <button class="doc-nav-btn" data-nav="1" ${next ? '' : 'disabled'}>Next ›</button>
      </div>` : '';

    readerEl.innerHTML = `
      <article class="doc-page enter-right">
        <div class="doc-stamp">${stamp}</div>
        <div class="doc-meta">${escapeHtml(node.path || 'root')}</div>
        ${headerHtml}
        <div class="doc-divider"></div>
        <div class="doc-body">${renderBody(node.content, node.path)}</div>
        ${node.children && node.children.length ? `
        <div class="doc-children">
          <div class="doc-children-label">Related</div>
          ${childList}
        </div>` : ''}
        ${navHtml}
      </article>`;
    bindChildLinks();
    bindDocNav();
    readerEl.scrollTop = 0;
  }

  function bindChildLinks() {
    readerEl.querySelectorAll('.doc-child-link').forEach((el) => {
      el.addEventListener('click', () => {
        if (window.Sound) Sound.click();
        navigate(el.dataset.path);
      });
    });
  }

  function bindDocNav() {
    readerEl.querySelectorAll('.doc-nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (window.Sound) Sound.click();
        const dir = parseInt(btn.dataset.nav, 10);
        const adj = getAdjacent(currentPath, dir);
        if (adj) navigate(adj.path);
      });
    });
  }

  // ---------- global swipe + keyboard navigation ----------

  function bindGlobalNav() {
    let touchStartX = null;
    let touchStartY = null;

    readerEl.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    readerEl.addEventListener('touchend', (e) => {
      if (touchStartX === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      touchStartX = null;
      touchStartY = null;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      const dir = dx < 0 ? 1 : -1; // swipe left -> next document
      const adj = getAdjacent(currentPath, dir);
      if (adj) navigate(adj.path);
    }, { passive: true });

    document.addEventListener('keydown', (e) => {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowRight') {
        const adj = getAdjacent(currentPath, 1);
        if (adj) navigate(adj.path);
      } else if (e.key === 'ArrowLeft') {
        const adj = getAdjacent(currentPath, -1);
        if (adj) navigate(adj.path);
      }
    });
  }

  // ---------- tiny markdown-lite renderer ----------
  // Supports: # / ## / ### headings, blank-line paragraphs, "- " lists,
  // ![alt](image.jpg) images, **bold**, *italic*. Everything else is plain text.
  function renderBody(raw, basePath) {
    const lines = raw.replace(/\r\n/g, '\n').split('\n');
    let html = '';
    let para = [];
    let list = [];

    const flushPara = () => {
      if (para.length) {
        html += `<p>${inline(para.join(' '))}</p>`;
        para = [];
      }
    };
    const flushList = () => {
      if (list.length) {
        html += `<ul>${list.map((li) => `<li>${inline(li)}</li>`).join('')}</ul>`;
        list = [];
      }
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (line === '') { flushPara(); flushList(); continue; }

      const img = line.match(/^!\[(.*?)\]\((.*?)\)$/);
      if (img) {
        flushPara(); flushList();
        const alt = img[1];
        const src = resolveImageSrc(img[2], basePath);
        html += `<figure class="doc-figure"><img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" loading="lazy">${alt ? `<figcaption>${inline(alt)}</figcaption>` : ''}</figure>`;
        continue;
      }

      const h = line.match(/^(#{1,3})\s+(.*)$/);
      if (h) {
        flushPara(); flushList();
        const level = h[1].length;
        html += `<h${level}>${inline(h[2])}</h${level}>`;
        continue;
      }

      const li = line.match(/^[-*]\s+(.*)$/);
      if (li) {
        flushPara();
        list.push(li[1]);
        continue;
      }

      flushList();
      para.push(line);
    }
    flushPara(); flushList();
    return html || '<p><em>(empty file)</em></p>';
  }

  function resolveImageSrc(src, basePath) {
    if (/^https?:\/\//i.test(src) || src.startsWith('/')) return src;
    const prefix = basePath ? `${CONTENT_ROOT}/${basePath}/` : `${CONTENT_ROOT}/`;
    return prefix + src;
  }

  function inline(text) {
    let out = escapeHtml(text);
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g, '$1<em>$2</em>');
    out = out.replace(/\|\|(.+?)\|\|/g, (match, hidden) => {
      const bar = '█'.repeat(Math.max(4, hidden.length));
      return `<span class="spoiler" aria-label="redacted">${bar}</span>`;
    });
    return out;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;');
  }
  function hashCode(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }
})();
