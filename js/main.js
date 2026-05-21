// EVOLVE — Shared Utilities

// Mark page for entrance motion before main content paints.
if (document.body && !document.body.classList.contains('wz-page-enter-pending')) {
  document.body.classList.add('wz-page-enter-pending');
}

// ── Active Nav Highlight ──────────────────────────────────────────
function setActiveNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.classList.remove('nav-active');
    if (el.dataset.nav === page) el.classList.add('nav-active');
  });
}

// ── Toast ─────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  let toast = document.getElementById('wz-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'wz-toast';
    toast.className = 'fixed bottom-6 right-6 z-50 px-5 py-3 rounded font-mono text-xs tracking-widest uppercase border-l-4 transition-all duration-300 translate-x-20 opacity-0';
    document.body.appendChild(toast);
  }
  const colors = {
    success: 'bg-[var(--wz-surface)] border-[var(--accent)] text-[var(--accent)]',
    error:   'bg-[var(--wz-surface)] border-red-500 text-red-400',
    info:    'bg-[var(--wz-surface)] border-blue-500 text-blue-400'
  };
  toast.className = `fixed bottom-6 right-6 z-50 px-5 py-3 rounded font-mono text-xs tracking-widest uppercase border-l-4 transition-all duration-300 ${colors[type]}`;
  toast.textContent = msg;
  requestAnimationFrame(() => {
    toast.classList.remove('translate-x-20', 'opacity-0');
    toast.classList.add('translate-x-0', 'opacity-100');
  });
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.add('translate-x-20', 'opacity-0');
  }, 3200);
}

// ── Modal ─────────────────────────────────────────────────────────
function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  if (m._wzModalCloseTimer) {
    clearTimeout(m._wzModalCloseTimer);
    m._wzModalCloseTimer = null;
  }
  m.classList.remove('hidden');
  m.classList.add('flex');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => m.classList.add('modal-overlay--open'));
  });
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove('modal-overlay--open');
  if (m._wzModalCloseTimer) clearTimeout(m._wzModalCloseTimer);
  m._wzModalCloseTimer = setTimeout(() => {
    m.classList.add('hidden');
    m.classList.remove('flex');
    m._wzModalCloseTimer = null;
  }, 220);
}

/** Escape text for safe insertion into HTML attributes / body. */
function wzEscapeHtml(str) {
  if (str == null || str === undefined) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

/**
 * Platform-styled confirm dialog (replaces window.confirm).
 * @returns {Promise<boolean>} true if user confirmed
 */
function showConfirmDialog(opts = {}) {
  const title = opts.title != null ? String(opts.title) : 'Confirm';
  const message = opts.message != null ? String(opts.message) : '';
  const confirmLabel = opts.confirmLabel != null ? String(opts.confirmLabel) : 'Confirm';
  const cancelLabel = opts.cancelLabel != null ? String(opts.cancelLabel) : 'Cancel';
  const variant = opts.variant === 'danger' || opts.variant === 'warning' ? opts.variant : 'neutral';

  const confirmBtnClass =
    variant === 'danger'
      ? 'btn-danger'
      : variant === 'warning'
        ? 'wz-btn-confirm-warning'
        : 'btn-primary';

  return new Promise((resolve) => {
    let overlay = document.getElementById('wz-confirm-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'wz-confirm-overlay';
      overlay.className =
        'modal-overlay hidden fixed inset-0 z-[100] items-center justify-center p-4';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'wz-confirm-title');
      document.body.appendChild(overlay);
    }

    let settled = false;
    function finish(val) {
      if (settled) return;
      settled = true;
      overlay.classList.remove('modal-overlay--open');
      document.removeEventListener('keydown', onKey);
      overlay._wzConfirmBackdrop = null;
      setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
      }, 220);
      resolve(val);
    }

    function onKey(e) {
      if (e.key === 'Escape') finish(false);
    }

    overlay.innerHTML = `
      <div class="wz-card p-7 w-[min(100%,420px)] max-h-[90vh] overflow-y-auto border border-[var(--wz-border)] shadow-xl" onclick="event.stopPropagation()">
        <div class="font-mono text-[10px] text-[var(--wz-muted)] tracking-widest uppercase mb-2">● Confirmation</div>
        <h2 id="wz-confirm-title" class="font-head text-xl font-black tracking-widest uppercase text-[var(--wz-text)] mb-3">${wzEscapeHtml(title)}</h2>
        <p class="font-body text-sm text-[var(--wz-text-secondary)] leading-relaxed mb-6">${wzEscapeHtml(message)}</p>
        <div class="flex flex-wrap gap-3 justify-end">
          <button type="button" class="btn-ghost" data-wz-cancel>${wzEscapeHtml(cancelLabel)}</button>
          <button type="button" class="${confirmBtnClass}" data-wz-confirm>${wzEscapeHtml(confirmLabel)}</button>
        </div>
      </div>`;

    overlay._wzConfirmBackdrop = () => finish(false);

    overlay.onclick = (e) => {
      if (e.target === overlay) finish(false);
    };

    const cancelBtn = overlay.querySelector('[data-wz-cancel]');
    const okBtn = overlay.querySelector('[data-wz-confirm]');
    if (cancelBtn) cancelBtn.onclick = () => finish(false);
    if (okBtn) okBtn.onclick = () => finish(true);

    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlay.classList.add('modal-overlay--open'));
    });
    if (okBtn) okBtn.focus();
  });
}

// Close modal on overlay click
document.addEventListener('click', e => {
  const t = e.target;
  if (t.classList.contains('modal-overlay')) {
    if (t.id === 'wz-confirm-overlay' && typeof t._wzConfirmBackdrop === 'function') {
      t._wzConfirmBackdrop();
      return;
    }
    const id = t.id;
    if (id) closeModal(id);
    else {
      t.classList.add('hidden');
      t.classList.remove('flex');
    }
  }
});

// ── Status Badge Helper ───────────────────────────────────────────
function statusBadge(status) {
  const map = {
    live:      'bg-red-900/30 text-red-400 border border-red-700 animate-pulse',
    open:      'bg-green-900/30 text-green-400 border border-green-700',
    scheduled: 'wz-pill-neutral',
    upcoming:  'wz-pill-neutral',
    completed: 'wz-pill-muted',
    pending:   'bg-amber-900/30 text-amber-400 border border-amber-700',
    approved:  'bg-green-900/30 text-green-400 border border-green-700',
    rejected:  'bg-red-900/30 text-red-400 border border-red-700'
  };
  const labels = {
    live: '● LIVE', open: '● OPEN', scheduled: 'SCHEDULED', upcoming: 'UPCOMING',
    completed: 'COMPLETED', pending: 'PENDING', approved: 'APPROVED', rejected: 'REJECTED'
  };
  return `<span class="font-mono text-[10px] tracking-widest px-2 py-1 rounded-sm ${map[status] || ''}">${labels[status] || status.toUpperCase()}</span>`;
}

// ── Mode Badge ────────────────────────────────────────────────────
function modeBadge(type) {
  const map = {
    ranked: 'bg-amber-900/30 text-amber-400 border border-amber-700',
    br:     'bg-green-900/30 text-green-400 border border-green-700',
    duos:   'bg-blue-900/30 text-blue-400 border border-blue-700',
    solo:   'bg-red-900/30 text-red-400 border border-red-700'
  };
  return `<span class="font-mono text-[10px] tracking-widest px-2 py-1 rounded-sm ${map[type] || 'wz-pill-neutral'}">${WZ.tournaments.find(t=>t.type===type)?.mode || type.toUpperCase()}</span>`;
}

// ── Prize Formatter ───────────────────────────────────────────────
function fmtPrize(n) {
  return 'R ' + Number(n).toLocaleString('en-ZA');
}

// ── Slots Progress ────────────────────────────────────────────────
function slotsBar(registered, slots) {
  const pct = Math.round((registered / slots) * 100);
  const fill =
    pct >= 100
      ? 'wz-slots-fill wz-slots-fill--full'
      : pct >= 75
        ? 'wz-slots-fill wz-slots-fill--warn'
        : 'wz-slots-fill wz-slots-fill--ok';
  return `
    <div class="wz-slots-track">
      <div class="${fill}" style="width:${pct}%"></div>
    </div>
    <p class="wz-slots-caption">${registered}/${slots} Teams${pct >= 100 ? ' · Full' : ''}</p>
  `;
}

// ── Rank Badge ────────────────────────────────────────────────────
function rankBadge(n) {
  const styles = {
    1: 'bg-amber-900/40 text-amber-400 border border-amber-600',
    2: 'wz-pill-muted-strong',
    3: 'bg-orange-900/40 text-orange-400 border border-orange-700'
  };
  const s = styles[n] || 'wz-pill-muted';
  return `<span class="font-mono text-xs w-7 h-7 inline-flex items-center justify-center rounded-sm ${s}">${n}</span>`;
}

// ── Platform route loader (full-page logo transition, injected via nav.js) ──
function wzAssetPrefix() {
  if (typeof _pathPrefix === 'function') return _pathPrefix();
  const path = window.location.pathname || '';
  if (path.endsWith('index.html') || path === '/' || !path.includes('/pages/')) return '';
  return '../';
}

/** Minimum visible time for the logo overlay (in-page nav + full link navigations). */
function wzRouteLoaderDurationMs() {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
  } catch (_) {
    /* ignore */
  }
  return 2600;
}

function wzShowRouteLoader() {
  const loader = document.getElementById('wz-route-loader');
  if (!loader) return;
  loader.classList.add('wz-route-loader--visible');
  loader.setAttribute('aria-hidden', 'false');
}

function wzHideRouteLoader() {
  const loader = document.getElementById('wz-route-loader');
  if (!loader) return;
  loader.classList.remove('wz-route-loader--visible');
  loader.setAttribute('aria-hidden', 'true');
}

/** Same-origin navigations from JS (e.g. after an action). */
function wzNavigateWithLoader(href) {
  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) {
      window.location.href = url.href;
      return;
    }
    wzShowRouteLoader();
    const ms = wzRouteLoaderDurationMs();
    window.setTimeout(function () {
      window.location.href = url.href;
    }, ms);
  } catch (_) {
    window.location.href = href;
  }
}

function wzAttachGlobalRouteLoaderNav() {
  if (document.documentElement.dataset.wzRouteLoaderNavBound === '1') return;
  document.documentElement.dataset.wzRouteLoaderNavBound = '1';

  document.addEventListener(
    'click',
    function (e) {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;

      if (a.hasAttribute('data-wz-no-loader')) return;
      if (e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      if (a.target === '_blank') return;
      if (a.getAttribute('download') != null) return;

      let url;
      try {
        url = new URL(a.href);
      } catch (_) {
        return;
      }

      if (url.origin !== window.location.origin) return;

      const hrefAttr = (a.getAttribute('href') || '').trim();
      if (
        hrefAttr.startsWith('javascript:') ||
        hrefAttr.startsWith('mailto:') ||
        hrefAttr.startsWith('tel:')
      ) {
        return;
      }

      const cur = new URL(window.location.href);
      if (url.pathname === cur.pathname && url.search === cur.search) {
        return;
      }

      e.preventDefault();
      wzShowRouteLoader();
      const ms = wzRouteLoaderDurationMs();
      window.setTimeout(function () {
        window.location.href = url.href;
      }, ms);
    },
    false
  );
}

// ── Regional loading overlays (async / background work) ───────────
/** Parent element that receives an overlay; inner content can be replaced without removing the overlay. */
function wzResolveLoadingEl(target) {
  if (target == null) return null;
  if (typeof target === 'string') return document.getElementById(target);
  return target;
}

/**
 * Show or hide a loading veil + spinner over a section (host must wrap content that gets innerHTML updates).
 * @param {string|HTMLElement} target — element id or node (use a wrapper id, not the inner grid id).
 * @param {boolean} active
 * @param {{ label?: string, fadeMs?: number }} [opts]
 */
function wzSetLoading(target, active, opts = {}) {
  const el = wzResolveLoadingEl(target);
  if (!el) return;
  const label = opts.label != null ? String(opts.label) : 'Loading';
  const prefix = wzAssetPrefix();
  const logoSrc = prefix + 'assets/EVOLVE%20Logo.png';
  el.classList.add('wz-loading-host');
  let ov = el.querySelector(':scope > .wz-load-overlay');
  if (active) {
    el.classList.add('wz-loading-active');
    el.setAttribute('aria-busy', 'true');
    if (!ov) {
      ov = document.createElement('div');
      ov.className = 'wz-load-overlay';
      ov.setAttribute('role', 'status');
      ov.innerHTML =
        '<div class="wz-load-inner wz-load-inner--brand">' +
        '<div class="wz-load-brand-mark">' +
        '<div class="wz-route-loader-ring wz-load-brand-ring" aria-hidden="true"></div>' +
        '<img src="' +
        logoSrc +
        '" alt="" class="wz-route-loader-logo wz-load-brand-logo"/>' +
        '</div>' +
        '<span class="wz-load-label font-mono text-[10px] tracking-widest uppercase text-[var(--wz-muted)]"></span>' +
        '</div>';
      el.appendChild(ov);
      ov.querySelector('.wz-load-label').textContent = label;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => ov.classList.add('wz-load-overlay--visible'));
      });
    } else {
      const lbl = ov.querySelector('.wz-load-label');
      if (lbl) lbl.textContent = label;
      const img = ov.querySelector('.wz-load-brand-logo');
      if (img) img.src = logoSrc;
      ov.classList.add('wz-load-overlay--visible');
    }
  } else {
    el.setAttribute('aria-busy', 'false');
    el.classList.remove('wz-loading-active');
    if (ov) {
      ov.classList.remove('wz-load-overlay--visible');
      const fadeMs = opts.fadeMs != null ? opts.fadeMs : 280;
      setTimeout(() => {
        ov?.remove();
      }, fadeMs);
    }
  }
}

/**
 * Runs an async function with loading overlay; enforces a minimum visible time to avoid flicker.
 * @param {string|HTMLElement} target
 * @param {() => Promise<*>} fn
 * @param {{ label?: string, minMs?: number, fadeMs?: number }} [opts]
 */
async function wzWithLoading(target, fn, opts = {}) {
  const minMs = opts.minMs != null ? opts.minMs : 240;
  const t0 = Date.now();
  wzSetLoading(target, true, opts);
  try {
    const out = await fn();
    const dt = Date.now() - t0;
    if (dt < minMs) await new Promise(r => setTimeout(r, minMs - dt));
    return out;
  } finally {
    wzSetLoading(target, false, opts);
  }
}

// ── Global page entrance reveal ───────────────────────────────────
function wzApplyPageEntranceReveal() {
  const body = document.body;
  if (!body) return;
  if (body.dataset.wzPageRevealApplied === '1') return;
  body.dataset.wzPageRevealApplied = '1';

  const prefersReducedMotion =
    !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (prefersReducedMotion) {
    body.classList.remove('wz-page-enter-pending');
    body.classList.add('wz-page-enter-active');
    return;
  }

  const targets = [];
  const main = document.querySelector('main');
  if (main) {
    targets.push(
      ...Array.from(main.children).filter((el) => {
        if (!el || !el.classList) return false;
        if (el.classList.contains('wz-load-overlay')) return false;
        return true;
      })
    );
  }
  const footer = document.querySelector('footer');
  if (footer) targets.push(footer);
  if (!targets.length && main) targets.push(main);

  targets.forEach((el, idx) => {
    el.classList.add('wz-page-reveal-item');
    el.style.setProperty('--wz-reveal-delay', `${Math.min(idx * 55, 420)}ms`);
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      body.classList.add('wz-page-enter-active');
      body.classList.remove('wz-page-enter-pending');
      targets.forEach((el) => el.classList.add('wz-page-reveal-item--in'));
    });
  });
}

// ── Page-ready init ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setActiveNav();
  wzAttachGlobalRouteLoaderNav();
  wzApplyPageEntranceReveal();
  // Keyboard: Escape closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach((m) => {
        if (m.classList.contains('hidden')) return;
        const id = m.id;
        if (id) closeModal(id);
        else {
          m.classList.add('hidden');
          m.classList.remove('flex');
        }
      });
    }
  });
});
