const grid = document.getElementById('card-grid');
const modal = document.getElementById('vault-modal');
const modalContent = modal.querySelector('.modal-content');
const lightboxDialog = document.getElementById('lightbox-dialog');
const lightboxImg = lightboxDialog.querySelector('.lightbox-img');
const tooltip = document.getElementById('disclaimer-tooltip');
const countdownBanner = document.getElementById('countdown-banner');

const SCHEDULE = { openDay: 4, closeDay: 0, hour: 10, minute: 0 };

(function initCountdown() {
  function getPTOffset() {
    const now = new Date();
    const utcStr = now.toLocaleString('en-US', { timeZone: 'UTC' });
    const ptStr = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
    return new Date(utcStr).getTime() - new Date(ptStr).getTime();
  }

  const ptOffset = getPTOffset();

  function getNextEvent(now) {
    const ptNow = new Date(now.getTime() - ptOffset);
    const day = ptNow.getUTCDay();
    const weekStart = new Date(Date.UTC(ptNow.getUTCFullYear(), ptNow.getUTCMonth(), ptNow.getUTCDate() - day));

    const openUtc = new Date(weekStart.getTime() + (SCHEDULE.openDay * 86400000) + (SCHEDULE.hour * 3600000) + (SCHEDULE.minute * 60000) + ptOffset);
    let closeUtc = new Date(weekStart.getTime() + (SCHEDULE.closeDay * 86400000) + (SCHEDULE.hour * 3600000) + (SCHEDULE.minute * 60000) + ptOffset);
    if (closeUtc <= openUtc) closeUtc = new Date(closeUtc.getTime() + 7 * 86400000);

    const nowMs = now.getTime();

    if (nowMs >= openUtc.getTime() && nowMs < closeUtc.getTime()) {
      return { open: true, ms: closeUtc.getTime() - nowMs };
    }

    let nextOpen = openUtc.getTime();
    if (nowMs >= nextOpen) nextOpen += 7 * 86400000;
    return { open: false, ms: nextOpen - nowMs };
  }

  function render() {
    const { open, ms } = getNextEvent(new Date());
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;

    const status = open ? 'open' : 'closed';
    const statusText = open ? 'Open' : 'Closed';
    const label = open ? 'Closes in' : 'Opens in';
    countdownBanner.setAttribute('data-status', status);

    let units = '';
    units += `<span class="countdown-unit"><span class="countdown-value">${h}</span><span class="countdown-label">hrs</span></span>`;
    units += `<span class="countdown-unit"><span class="countdown-value">${String(m).padStart(2, '0')}</span><span class="countdown-label">min</span></span>`;
    units += `<span class="countdown-unit"><span class="countdown-value">${String(s).padStart(2, '0')}</span><span class="countdown-label">sec</span></span>`;

    countdownBanner.innerHTML = `<span class="countdown-status">${statusText}</span><span>${label}</span><span class="countdown-timer">${units}</span>`;
  }

  render();
  setInterval(render, 1000);
})();

let lastFocused = null;
let activePopup = null;
let activePopupSlot = null;
let symbolSlots = [null, null, null];
let pinnedBtn = null;

const SLOT_LABELS = ['Left', 'Top', 'Right'];

fetch('data.json')
  .then(r => r.json())
  .then(renderCards);

function isEmpty(v) {
  if (v == null || v === '') return true;
  return Array.isArray(v) && v.length === 0;
}

function esc(s) {
  if (typeof s !== 'string') return String(s);
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function disclaimerHtml(text) {
  if (isEmpty(text)) return '';
  return ` <button class="disclaimer-btn" type="button" data-tip="${esc(text)}" aria-label="More info"><i class="fa-solid fa-circle-info" aria-hidden="true"></i></button>`;
}

function fieldHtml(label, value, disclaimer) {
  if (isEmpty(value)) return '';
  const display = Array.isArray(value) ? value.map(esc).join(', ') : esc(value);
  return `<div class="field"><dt>${esc(label)}</dt><dd>${display}${disclaimerHtml(disclaimer)}</dd></div>`;
}

function renderCards(vaults) {
  vaults.forEach(vault => {
    const card = document.createElement('article');
    card.className = 'vault-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `View Vault ${vault.vault_number} details`);

    let html = `<div class="vault-badge"><span class="vault-number">${vault.vault_number}</span><span class="vault-label">Vault</span></div>`;
    html += '<dl class="card-fields">';
    html += fieldHtml('Keycard', vault.keycard, vault.keycard_disclaimer);
    html += fieldHtml('Security Clearance', vault.security_clearance, vault.security_clearance_disclaimer);
    html += fieldHtml('Batteries', vault.batteries, vault.batteries_disclaimer);
    html += fieldHtml('Coolant', vault.coolant, vault.coolant_disclaimer);
    if (!isEmpty(vault.required_items)) {
      html += fieldHtml('Required Items', vault.required_items, vault.required_items_disclaimer);
    }
    html += '</dl>';

    card.innerHTML = html;

    card.addEventListener('click', () => openModal(vault));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModal(vault);
      }
    });

    grid.appendChild(card);
  });
}

function openModal(vault) {
  lastFocused = document.activeElement;
  symbolSlots = [null, null, null];

  let html = '<div class="modal-header">';
  html += `<h2 id="modal-title">Vault ${vault.vault_number}</h2>`;
  html += '<button class="modal-close" type="button" aria-label="Close dialog">&times;</button>';
  html += '</div><div class="modal-body">';

  const hasMap = !isEmpty(vault.map_screenshot);
  const hasVisual = !isEmpty(vault.visual_screenshot);
  if (hasMap || hasVisual) {
    html += '<div class="modal-screenshots">';
    if (hasMap) {
      html += `<figure class="modal-screenshot"><img src="${esc(vault.map_screenshot)}" alt="Map view of Vault ${vault.vault_number}"><figcaption>Map View${disclaimerHtml(vault.map_screenshot_disclaimer)}</figcaption></figure>`;
    }
    if (hasVisual) {
      html += `<figure class="modal-screenshot"><img src="${esc(vault.visual_screenshot)}" alt="Visual of Vault ${vault.vault_number}"><figcaption>Visual${disclaimerHtml(vault.visual_screenshot_disclaimer)}</figcaption></figure>`;
    }
    html += '</div>';
  }

  html += '<dl class="modal-fields">';
  html += fieldHtml('Location', vault.location, vault.location_disclaimer);

  if (!isEmpty(vault.keycard_screenshot)) {
    html += `<div class="field keycard-row"><dt>Keycard</dt><dd>${esc(vault.keycard)}${disclaimerHtml(vault.keycard_disclaimer)}<img src="${esc(vault.keycard_screenshot)}" alt="${esc(vault.keycard)}" class="keycard-img">${disclaimerHtml(vault.keycard_screenshot_disclaimer)}</dd></div>`;
  } else {
    html += fieldHtml('Keycard', vault.keycard, vault.keycard_disclaimer);
  }

  html += fieldHtml('Security Clearance', vault.security_clearance, vault.security_clearance_disclaimer);
  html += fieldHtml('Batteries', vault.batteries, vault.batteries_disclaimer);
  html += fieldHtml('Coolant', vault.coolant, vault.coolant_disclaimer);

  if (!isEmpty(vault.required_items)) {
    html += fieldHtml('Required Items', vault.required_items, vault.required_items_disclaimer);
  }

  html += fieldHtml('Outside Vault', vault.outside_vault_instructions, vault.outside_vault_instructions_disclaimer);
  html += fieldHtml('Inside Vault', vault.inside_vault_instructions, vault.inside_vault_instructions_disclaimer);
  html += '</dl>';

  if (vault.symbols && vault.symbols.length > 0) {
    html += buildSymbolSelectorHtml(vault);
  }

  html += '</div>';

  modalContent.innerHTML = html;
  setupModalListeners(vault);
  modal.showModal();
  modal.querySelector('.modal-close').focus();
}

function setupModalListeners(vault) {
  modal.querySelector('.modal-close').addEventListener('click', () => modal.close());

  modal.querySelectorAll('.modal-screenshot img').forEach(img => {
    img.addEventListener('click', () => openLightbox(img.src, img.alt));
  });

  modal.querySelectorAll('.keycard-img').forEach(img => {
    img.addEventListener('click', () => openLightbox(img.src, img.alt));
  });

  if (vault.symbols && vault.symbols.length > 0) {
    setupSymbolSelector(vault);
  }
}

function buildSymbolSelectorHtml(vault) {
  let html = '<div class="symbol-selector">';
  html += '<h3>Symbol Sequence</h3>';
  html += '<p class="symbol-hint">Click each slot to record the symbols from the lab monitors. Order: Left \u2192 Top \u2192 Right.</p>';
  html += '<div class="symbol-slots">';
  for (let i = 0; i < (vault.symbol_slots || 3); i++) {
    html += `<div class="symbol-slot-wrap"><button class="symbol-slot" type="button" data-slot="${i}" aria-label="${SLOT_LABELS[i]} symbol slot \u2014 empty"><span class="symbol-slot-placeholder">?</span></button><span class="symbol-slot-label">${SLOT_LABELS[i]}</span></div>`;
  }
  html += '</div>';
  html += '<button class="symbol-clear-btn" type="button">Clear all</button>';
  html += '</div>';
  return html;
}

function setupSymbolSelector(vault) {
  const popup = document.createElement('div');
  popup.className = 'symbol-popup';
  popup.setAttribute('role', 'listbox');
  popup.setAttribute('aria-label', 'Select a symbol');
  popup.hidden = true;

  vault.symbols.forEach((sym, i) => {
    const opt = document.createElement('button');
    opt.className = 'symbol-option';
    opt.type = 'button';
    opt.setAttribute('role', 'option');
    const name = sym.name || 'Symbol ' + (i + 1);
    opt.setAttribute('aria-label', name);

    if (!isEmpty(sym.image)) {
      const img = document.createElement('img');
      img.src = sym.image;
      img.alt = name;
      opt.appendChild(img);
    } else {
      opt.textContent = name;
    }

    opt.addEventListener('click', e => {
      e.stopPropagation();
      const slotBtn = activePopupSlot;
      const slotIndex = parseInt(slotBtn.dataset.slot);
      symbolSlots[slotIndex] = i;

      popup.hidden = true;
      activePopup = null;
      activePopupSlot = null;

      if (!isEmpty(sym.image)) {
        slotBtn.innerHTML = `<img src="${esc(sym.image)}" alt="${esc(name)}">`;
      } else {
        slotBtn.innerHTML = `<span class="symbol-slot-text">${esc(name)}</span>`;
      }
      slotBtn.classList.add('filled');
      slotBtn.setAttribute('aria-label', `${SLOT_LABELS[slotIndex]} symbol slot \u2014 ${name}`);
    });

    popup.appendChild(opt);
  });

  popup.addEventListener('keydown', e => {
    const opts = [...popup.querySelectorAll('.symbol-option')];
    const cur = opts.indexOf(document.activeElement);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      opts[(cur + 1) % opts.length].focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      opts[(cur - 1 + opts.length) % opts.length].focus();
    }
  });

  modal.querySelectorAll('.symbol-slot').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (activePopup && activePopupSlot === btn) {
        closeSymbolPopup();
        return;
      }
      closeSymbolPopup();
      btn.closest('.symbol-slot-wrap').appendChild(popup);
      popup.hidden = false;
      activePopup = popup;
      activePopupSlot = btn;
    });
  });

  modal.querySelector('.symbol-clear-btn').addEventListener('click', () => {
    symbolSlots = [null, null, null];
    closeSymbolPopup();
    modal.querySelectorAll('.symbol-slot').forEach((btn, i) => {
      btn.innerHTML = '<span class="symbol-slot-placeholder">?</span>';
      btn.classList.remove('filled');
      btn.setAttribute('aria-label', `${SLOT_LABELS[i]} symbol slot \u2014 empty`);
    });
  });
}

function closeSymbolPopup() {
  if (!activePopup) return;
  const btn = activePopupSlot;
  activePopup.hidden = true;
  activePopup = null;
  activePopupSlot = null;
  if (btn) btn.focus();
}

function openLightbox(src, alt) {
  lightboxImg.src = src;
  lightboxImg.alt = alt;
  lightboxDialog.showModal();
}

function closeLightbox() {
  lightboxDialog.close();
  lightboxImg.src = '';
}

function closeAllDisclaimers() {
  tooltip.classList.remove('visible');
  tooltip.setAttribute('aria-hidden', 'true');
  pinnedBtn = null;
}

modal.addEventListener('cancel', e => {
  if (activePopup) {
    e.preventDefault();
    closeSymbolPopup();
  }
});

modal.addEventListener('close', () => {
  closeSymbolPopup();
  closeAllDisclaimers();
  document.body.appendChild(tooltip);
  if (lastFocused) {
    lastFocused.focus();
    lastFocused = null;
  }
});

modal.addEventListener('click', e => {
  if (e.target === modal) modal.close();
});

lightboxDialog.addEventListener('click', e => {
  if (e.target === lightboxDialog) closeLightbox();
});

lightboxDialog.querySelector('.lightbox-close').addEventListener('click', closeLightbox);

lightboxDialog.addEventListener('close', () => {
  lightboxImg.src = '';
});

const hoverSupported = window.matchMedia('(hover: hover)').matches;
if (hoverSupported) {
  document.addEventListener('mouseenter', e => {
    const btn = e.target.closest('.disclaimer-btn');
    if (!btn || pinnedBtn) return;
    showTooltip(btn);
  }, true);

  document.addEventListener('mouseleave', e => {
    const btn = e.target.closest('.disclaimer-btn');
    if (!btn || pinnedBtn) return;
    closeAllDisclaimers();
  }, true);
}

document.addEventListener('click', e => {
  const btn = e.target.closest('.disclaimer-btn');
  if (btn) {
    if (pinnedBtn === btn) {
      closeAllDisclaimers();
    } else {
      pinnedBtn = btn;
      showTooltip(btn);
    }
    return;
  }
  if (pinnedBtn) closeAllDisclaimers();

  if (activePopup && !e.target.closest('.symbol-popup') && !e.target.closest('.symbol-slot')) {
    closeSymbolPopup();
  }
});

function showTooltip(btn) {
  const text = btn.dataset.tip;
  if (!text) return;

  const host = btn.closest('dialog[open]') || document.body;
  if (tooltip.parentElement !== host) host.appendChild(tooltip);

  tooltip.textContent = text;
  tooltip.classList.add('visible');
  tooltip.setAttribute('aria-hidden', 'false');

  const btnRect = btn.getBoundingClientRect();
  tooltip.style.top = '0';
  tooltip.style.left = '0';
  const tipRect = tooltip.getBoundingClientRect();
  const pad = 8;

  let left = btnRect.left + btnRect.width / 2 - tipRect.width / 2;
  left = Math.max(pad, Math.min(left, window.innerWidth - tipRect.width - pad));

  let top = btnRect.top - tipRect.height - 8;
  if (top < pad) top = btnRect.bottom + 8;

  tooltip.style.top = top + 'px';
  tooltip.style.left = left + 'px';
}
