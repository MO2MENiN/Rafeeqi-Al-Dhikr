// ============================================
// Rafeeqi Al-Dhikr - Main Application Logic with PWA
// ============================================

const App = (function() {
  'use strict';

  // State
  let state = {
    currentSheikh: null,
    currentDhikr: null,
    
    favorites: [],
    lastRead: null,
    settings: {
      darkMode: false,
      fontSize: 1.3,
      vibration: true,
      pwaDismissed: false
    },
    counters: {},
    adminLoggedIn: true,
    azkarData: null
  };

  // PWA State
  let pwaState = {
    deferredPrompt: null,
    isInstalled: false,
    isStandalone: false,
    swRegistration: null,
    
  };

  // DOM Elements cache
  const dom = {};

  // ============================================
  // Initialization
  // ============================================
  function init() {
    loadState();
    initData();
    cacheDOM();
    bindEvents();
    applyTheme();
    initPWA();
    route();
  }

  function initData() {
    state.azkarData = JSON.parse(JSON.stringify(AZKAR_DATA));
    const edits = JSON.parse(localStorage.getItem('rafeeqi_edits') || '{}');
    Object.keys(edits).forEach(sheikhId => {
      if (state.azkarData[sheikhId]) {
        const sheikhEdits = edits[sheikhId];
        Object.keys(sheikhEdits).forEach(catId => {
          const cat = state.azkarData[sheikhId].categories.find(c => c.id === catId);
          if (cat) {
            sheikhEdits[catId].forEach(edit => {
              const idx = cat.azkar.findIndex(a => a.id === edit.id);
              if (idx >= 0) {
                if (edit._deleted) {
                  cat.azkar.splice(idx, 1);
                } else {
                  cat.azkar[idx] = { ...cat.azkar[idx], ...edit };
                }
              } else if (!edit._deleted) {
                cat.azkar.push(edit);
              }
            });
          }
        });
      }
    });
  }

  function cacheDOM() {
    dom.app = document.querySelector('.app-container');
    dom.pages = document.querySelectorAll('.page');
    dom.headerTitle = document.querySelector('.header-title');
    dom.backBtn = document.querySelector('.header-btn.left');
    dom.themeBtn = document.querySelector('.theme-toggle');
    dom.sheikhGrid = document.querySelector('.sheikh-grid');
    dom.sheikhHeaderImg = document.querySelector('.sheikh-header-img');
    dom.sheikhHeaderInfo = document.querySelector('.sheikh-header-info');
    dom.searchInput = document.querySelector('.search-input');
    dom.azkarList = document.querySelector('.azkar-list');
    dom.dhikrText = document.querySelector('.dhikr-text');
    dom.dhikrReference = document.querySelector('.dhikr-reference');
    dom.counterCurrent = document.querySelector('.counter-current');
    dom.counterTarget = document.querySelector('.counter-target');
    dom.counterRing = document.querySelector('.counter-ring');
    dom.counterInner = document.querySelector('.counter-inner');
    dom.favBtn = document.querySelector('.fav-btn');
    dom.favoritesList = document.querySelector('.favorites-list');
    dom.adminTableBody = document.querySelector('.admin-table tbody');
    dom.modalOverlay = document.querySelector('.modal-overlay');
    dom.modalTitle = document.querySelector('.modal-header');
    dom.toast = document.querySelector('.toast');

    dom.appStatus = document.getElementById('app-status');
    dom.themeColor = document.getElementById('theme-color');
  }

  // ============================================
  // PWA Functions
  // ============================================
  function initPWA() {
    // Check if running as standalone app
    pwaState.isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                            window.navigator.standalone === true;

    if (pwaState.isStandalone) {
      showAppStatus();
    }

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js')
        .then(reg => {
          pwaState.swRegistration = reg;
          console.log('[App] SW registered:', reg.scope);

          // Periodic update check (every hour)
          setInterval(() => {
            reg.update();
          }, 3600000);
        })
        .catch(err => console.log('[App] SW registration failed:', err));

      // Listen for messages from SW
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data === 'CACHE_UPDATED') {
          showUpdateBanner();
        }
      });
    }

    // App installed
    window.addEventListener('appinstalled', () => {
      pwaState.deferredPrompt = null;
      pwaState.isInstalled = true;
      showToast('🎉 تم تثبيت التطبيق بنجاح!', 'success');
      showAppStatus();
    });

    // Display mode change
    window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
      pwaState.isStandalone = e.matches;
      if (e.matches) showAppStatus();
    });
  }

  function showAppStatus() {
    if (dom.appStatus) {
      dom.appStatus.classList.add('show');
      setTimeout(() => dom.appStatus.classList.remove('show'), 3000);
    }
  }



  // ============================================
  // Routing
  // ============================================
  function route() {
    const hash = window.location.hash.replace('#', '') || 'home';
    const [page, ...params] = hash.split('/');

    hideAllPages();

    switch(page) {
      case 'home':
        showPage('home');
        renderHome();
        break;
      case 'azkar':
        showPage('azkar');
        renderAzkarList(params[0]);
        break;
      case 'dhikr':
        showPage('dhikr');
        renderDhikr(params[0], params[1], params[2]);
        break;
      case 'favorites':
        showPage('favorites');
        renderFavorites();
        break;
      case 'admin':
        showPage('admin');
        renderAdmin();
        break;
      default:
        showPage('home');
        renderHome();
    }

    updateNav(page);
    window.scrollTo(0, 0);
  }

  function hideAllPages() {
    dom.pages.forEach(p => p.classList.remove('active'));
  }

  function showPage(pageName) {
    const page = document.querySelector(`.page[data-page="${pageName}"]`);
    if (page) page.classList.add('active');
  }

  function updateNav(page) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });
  }

  // ============================================
  // Home Page
  // ============================================
  function renderHome() {
    dom.headerTitle.textContent = 'رفيقي الذكر';
    dom.backBtn.classList.add('hidden');

    if (!dom.sheikhGrid) return;

    dom.sheikhGrid.innerHTML = Object.values(state.azkarData).map(sheikh => {
      const totalAzkar = sheikh.categories.reduce((sum, cat) => sum + cat.azkar.length, 0);
      return `
        <div class="sheikh-card" data-sheikh="${sheikh.id}" onclick="App.goToAzkar('${sheikh.id}')">
          <img src="${sheikh.image}" alt="${sheikh.name}" class="sheikh-avatar" loading="lazy">
          <div class="sheikh-name">${sheikh.shortName}</div>
          <div class="sheikh-title">${sheikh.name}</div>
          <div class="sheikh-count">
            <span>📿</span>
            <span>${totalAzkar} ذكر</span>
          </div>
        </div>
      `;
    }).join('');

    if (state.lastRead) {
      const lastReadCard = document.querySelector('.last-read-card');
      if (lastReadCard) {
        lastReadCard.classList.remove('hidden');
        lastReadCard.onclick = () => {
          App.goToDhikr(state.lastRead.sheikhId, state.lastRead.catId, state.lastRead.dhikrId);
        };
        const titleEl = document.querySelector('.last-read-title');
        if (titleEl) titleEl.textContent = state.lastRead.title;
      }
    }
  }

  function goToAzkar(sheikhId) {
    state.currentSheikh = sheikhId;
    state.currentCategory = 'all';
    window.location.hash = `azkar/${sheikhId}`;
  }

  // ============================================
  // Azkar List Page
  // ============================================
  function renderAzkarList(sheikhId) {
    const sheikh = state.azkarData[sheikhId];
    if (!sheikh) return;

    state.currentSheikh = sheikhId;
    dom.headerTitle.textContent = sheikh.shortName;
    dom.backBtn.classList.remove('hidden');
    dom.backBtn.onclick = () => { window.location.hash = 'home'; };

    if (dom.sheikhHeaderImg) dom.sheikhHeaderImg.src = sheikh.image;
    if (dom.sheikhHeaderInfo) {
      dom.sheikhHeaderInfo.innerHTML = `
        <h2>${sheikh.name}</h2>
        <p>${sheikh.bio}</p>
      `;
    }

    renderAzkarItems(sheikh);

    if (dom.searchInput) {
      dom.searchInput.value = '';
      dom.searchInput.oninput = (e) => searchAzkar(e.target.value, sheikh);
    }
  }



  function renderAzkarItems(sheikh, filterText = '') {
    if (!dom.azkarList) return;

    let azkarToShow = [];

    sheikh.categories.forEach(cat => {
      cat.azkar.forEach(azkar => {
        azkarToShow.push({ ...azkar, categoryId: cat.id, categoryName: cat.name });
      });
    });

    if (filterText) {
      const lower = filterText.toLowerCase();
      azkarToShow = azkarToShow.filter(a => 
        a.title.toLowerCase().includes(lower) || 
        a.text.toLowerCase().includes(lower) ||
        a.tags.some(t => t.toLowerCase().includes(lower))
      );
    }

    if (azkarToShow.length === 0) {
      dom.azkarList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <h3>لا توجد نتائج</h3>
          <p>جرب البحث بكلمات مختلفة</p>
        </div>
      `;
      return;
    }

    dom.azkarList.innerHTML = azkarToShow.map(azkar => `
      <div class="azkar-item" onclick="App.goToDhikr('${sheikh.id}', '${azkar.categoryId}', '${azkar.id}')">
        <div class="azkar-item-title">${azkar.title}</div>
        <div class="azkar-item-preview">${azkar.text.substring(0, 120)}${azkar.text.length > 120 ? '...' : ''}</div>
        <div class="azkar-item-meta">
          <span class="azkar-count-badge">🔁 ${azkar.count}x</span>
          ${azkar.reference ? `<span class="azkar-ref-badge">${azkar.reference}</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  function searchAzkar(query, sheikh) {
    renderAzkarItems(sheikh, query);
  }

  // ============================================
  // Dhikr Detail Page
  // ============================================
  function renderDhikr(sheikhId, catId, dhikrId) {
    const sheikh = state.azkarData[sheikhId];
    if (!sheikh) return;

    const cat = sheikh.categories.find(c => c.id === catId);
    if (!cat) return;

    const dhikr = cat.azkar.find(a => a.id === dhikrId);
    if (!dhikr) return;

    state.currentSheikh = sheikhId;
    state.currentDhikr = dhikr;

    dom.headerTitle.textContent = dhikr.title;
    dom.backBtn.classList.remove('hidden');
    dom.backBtn.onclick = () => { window.location.hash = `azkar/${sheikhId}`; };

    if (dom.dhikrText) {
      dom.dhikrText.textContent = dhikr.text;
      dom.dhikrText.style.fontSize = state.settings.fontSize + 'rem';
    }
    if (dom.dhikrReference) {
      dom.dhikrReference.textContent = dhikr.reference || '';
      dom.dhikrReference.style.display = dhikr.reference ? 'inline-block' : 'none';
    }

    const counterKey = `${sheikhId}_${catId}_${dhikrId}`;
    const currentCount = state.counters[counterKey] || 0;
    updateCounterUI(currentCount, dhikr.count);

    updateFavButton();

    state.lastRead = { sheikhId, catId, dhikrId, title: dhikr.title };
    saveState();

    setupFontSizeControls();
  }

  function goToDhikr(sheikhId, catId, dhikrId) {
    window.location.hash = `dhikr/${sheikhId}/${catId}/${dhikrId}`;
  }

  function updateCounterUI(current, target) {
    if (!dom.counterCurrent || !dom.counterTarget || !dom.counterRing) return;

    dom.counterCurrent.textContent = current;
    dom.counterTarget.textContent = `/ ${target}`;

    const progress = Math.min((current / target) * 100, 100);
    dom.counterRing.style.setProperty('--progress', progress + '%');

    if (current >= target) {
      dom.counterRing.classList.add('complete');
      dom.counterInner.style.background = 'linear-gradient(135deg, var(--secondary), var(--secondary-light))';
    } else {
      dom.counterRing.classList.remove('complete');
      dom.counterInner.style.background = '';
    }
  }

  function incrementCounter() {
    if (!state.currentDhikr) return;

    const { id: dhikrId } = state.currentDhikr;
    const catId = getCurrentCatId();
    const sheikhId = state.currentSheikh;
    const counterKey = `${sheikhId}_${catId}_${dhikrId}`;

    let current = state.counters[counterKey] || 0;
    const target = state.currentDhikr.count;

    if (current < target) {
      current++;
      state.counters[counterKey] = current;
      updateCounterUI(current, target);

      if (state.settings.vibration && navigator.vibrate) {
        navigator.vibrate(15);
      }

      if (current === target) {
        if (state.settings.vibration && navigator.vibrate) {
          navigator.vibrate([50, 100, 50]);
        }
        showToast('🎉 تم إكمال الذكر!', 'success');
        triggerConfetti();
      }

      saveState();
    }
  }

  function triggerConfetti() {
    const colors = ['#D4AF37', '#1B5E20', '#FFFFFF', '#F4D03F'];
    for (let i = 0; i < 30; i++) {
      const confetti = document.createElement('div');
      confetti.style.cssText = `
        position: fixed;
        width: 10px;
        height: 10px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
        left: ${Math.random() * 100}vw;
        top: -10px;
        z-index: 9999;
        pointer-events: none;
        animation: confettiFall ${1 + Math.random() * 2}s linear forwards;
      `;
      document.body.appendChild(confetti);
      setTimeout(() => confetti.remove(), 3000);
    }

    if (!document.getElementById('confetti-style')) {
      const style = document.createElement('style');
      style.id = 'confetti-style';
      style.textContent = `
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  function resetCounter() {
    if (!state.currentDhikr) return;
    const catId = getCurrentCatId();
    const counterKey = `${state.currentSheikh}_${catId}_${state.currentDhikr.id}`;
    state.counters[counterKey] = 0;
    updateCounterUI(0, state.currentDhikr.count);
    saveState();
  }

  function getCurrentCatId() {
    if (!state.currentDhikr || !state.currentSheikh) return '';
    const sheikh = state.azkarData[state.currentSheikh];
    for (const cat of sheikh.categories) {
      if (cat.azkar.find(a => a.id === state.currentDhikr.id)) return cat.id;
    }
    return '';
  }

  function setupFontSizeControls() {
    const decreaseBtn = document.querySelector('.font-decrease');
    const increaseBtn = document.querySelector('.font-increase');
    const sizeLabel = document.querySelector('.font-size-label');

    if (sizeLabel) sizeLabel.textContent = state.settings.fontSize.toFixed(1) + 'rem';

    if (decreaseBtn) {
      decreaseBtn.onclick = () => {
        if (state.settings.fontSize > 0.9) {
          state.settings.fontSize -= 0.1;
          if (dom.dhikrText) dom.dhikrText.style.fontSize = state.settings.fontSize + 'rem';
          if (sizeLabel) sizeLabel.textContent = state.settings.fontSize.toFixed(1) + 'rem';
          saveState();
        }
      };
    }

    if (increaseBtn) {
      increaseBtn.onclick = () => {
        if (state.settings.fontSize < 2.5) {
          state.settings.fontSize += 0.1;
          if (dom.dhikrText) dom.dhikrText.style.fontSize = state.settings.fontSize + 'rem';
          if (sizeLabel) sizeLabel.textContent = state.settings.fontSize.toFixed(1) + 'rem';
          saveState();
        }
      };
    }
  }

  // ============================================
  // Favorites
  // ============================================
  function toggleFavorite() {
    if (!state.currentDhikr || !state.currentSheikh) return;

    const catId = getCurrentCatId();
    const favId = `${state.currentSheikh}_${catId}_${state.currentDhikr.id}`;
    const idx = state.favorites.findIndex(f => f.id === favId);

    if (idx >= 0) {
      state.favorites.splice(idx, 1);
      showToast('❌ تم الإزالة من المفضلة');
    } else {
      state.favorites.push({
        id: favId,
        sheikhId: state.currentSheikh,
        catId: catId,
        dhikrId: state.currentDhikr.id,
        title: state.currentDhikr.title,
        text: state.currentDhikr.text.substring(0, 100) + '...',
        count: state.currentDhikr.count,
        addedAt: Date.now()
      });
      showToast('⭐ تم الإضافة إلى المفضلة', 'success');
    }

    updateFavButton();
    saveState();
  }

  function updateFavButton() {
    if (!dom.favBtn || !state.currentDhikr) return;
    const catId = getCurrentCatId();
    const favId = `${state.currentSheikh}_${catId}_${state.currentDhikr.id}`;
    const isFav = state.favorites.some(f => f.id === favId);
    dom.favBtn.classList.toggle('active', isFav);
    dom.favBtn.querySelector('.icon').textContent = isFav ? '⭐' : '☆';
  }

  function renderFavorites() {
    dom.headerTitle.textContent = 'المفضلة';
    dom.backBtn.classList.add('hidden');

    if (!dom.favoritesList) return;

    if (state.favorites.length === 0) {
      dom.favoritesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⭐</div>
          <h3>لا توجد أذكار مفضلة</h3>
          <p>اضغط على نجمة الذكر لإضافته هنا</p>
        </div>
      `;
      return;
    }

    dom.favoritesList.innerHTML = state.favorites.map(fav => {
      const sheikh = state.azkarData[fav.sheikhId];
      return `
        <div class="azkar-item" onclick="App.goToDhikr('${fav.sheikhId}', '${fav.catId}', '${fav.dhikrId}')">
          <div class="azkar-item-title">${fav.title}</div>
          <div class="azkar-item-preview">${fav.text}</div>
          <div class="azkar-item-meta">
            <span class="azkar-count-badge">🔁 ${fav.count}x</span>
            <span class="azkar-ref-badge">${sheikh ? sheikh.shortName : ''}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // ============================================
  // Share
  // ============================================
  async function shareText() {
    if (!state.currentDhikr) return;

    const text = `${state.currentDhikr.title}\n\n${state.currentDhikr.text}\n\n(التكرار: ${state.currentDhikr.count})\n\nمن تطبيق رفيقي الذكر`;

    if (navigator.share) {
      try {
        await navigator.share({ title: state.currentDhikr.title, text });
      } catch (e) { }
    } else {
      await navigator.clipboard.writeText(text);
      showToast('📋 تم نسخ النص', 'success');
    }
  }

  async function shareImage() {
    if (!state.currentDhikr) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const width = 1080;
    const height = 1080;
    canvas.width = width;
    canvas.height = height;

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#1B5E20');
    gradient.addColorStop(0.5, '#0D3B10');
    gradient.addColorStop(1, '#1B5E20');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(212, 175, 55, 0.15)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      ctx.arc(width/2, height/2, 100 + i * 30, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 8;
    ctx.strokeRect(40, 40, width - 80, height - 80);

    ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 60, width - 120, height - 120);

    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 48px "Noto Kufi Arabic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.currentDhikr.title, width/2, 140);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '36px "Noto Kufi Arabic", sans-serif';

    const words = state.currentDhikr.text.split(' ');
    let line = '';
    let y = 240;
    const maxWidth = width - 160;
    const lineHeight = 60;

    for (const word of words) {
      const testLine = line + word + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line !== '') {
        ctx.fillText(line, width/2, y);
        line = word + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, width/2, y);

    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 40px "Noto Kufi Arabic", sans-serif';
    ctx.fillText(`التكرار: ${state.currentDhikr.count}`, width/2, height - 180);

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '28px "Noto Kufi Arabic", sans-serif';
    ctx.fillText('تطبيق رفيقي الذكر', width/2, height - 100);

    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'dhikr.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: state.currentDhikr.title });
        } catch (e) { }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dhikr_${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('💾 تم حفظ الصورة', 'success');
      }
    });
  }

  // ============================================
  // Admin Panel
  // ============================================
  function renderAdmin() {
    dom.headerTitle.textContent = 'لوحة الإدارة';
    dom.backBtn.classList.remove('hidden');
    dom.backBtn.onclick = () => { window.location.hash = 'home'; };
    renderAdminTable();
  }

  function renderAdminTable() {
    if (!dom.adminTableBody) return;

    let rows = [];
    Object.values(state.azkarData).forEach(sheikh => {
      sheikh.categories.forEach(cat => {
        cat.azkar.forEach(azkar => {
          rows.push({ sheikh, cat, azkar });
        });
      });
    });

    dom.adminTableBody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.azkar.title}</td>
        <td>${r.sheikh.shortName}</td>
        <td>${r.cat.name}</td>
        <td>${r.azkar.count}</td>
        <td>
          <button class="admin-action-btn edit" onclick="App.editDhikr('${r.sheikh.id}', '${r.cat.id}', '${r.azkar.id}')">تعديل</button>
          <button class="admin-action-btn delete" onclick="App.deleteDhikr('${r.sheikh.id}', '${r.cat.id}', '${r.azkar.id}')">حذف</button>
        </td>
      </tr>
    `).join('');
  }



  function editDhikr(sheikhId, catId, dhikrId) {
    const sheikh = state.azkarData[sheikhId];
    const cat = sheikh.categories.find(c => c.id === catId);
    const dhikr = cat.azkar.find(a => a.id === dhikrId);

    dom.modalTitle.textContent = 'تعديل الذكر';
    document.querySelector('#edit-sheikh').value = sheikhId;
    document.querySelector('#edit-cat').value = catId;
    document.querySelector('#edit-id').value = dhikrId;
    document.querySelector('#edit-title').value = dhikr.title;
    document.querySelector('#edit-text').value = dhikr.text;
    document.querySelector('#edit-count').value = dhikr.count;
    document.querySelector('#edit-ref').value = dhikr.reference || '';

    dom.modalOverlay.classList.add('active');
  }

  function saveEdit() {
    const sheikhId = document.querySelector('#edit-sheikh').value;
    const catId = document.querySelector('#edit-cat').value;
    const dhikrId = document.querySelector('#edit-id').value;

    const sheikh = state.azkarData[sheikhId];
    const cat = sheikh.categories.find(c => c.id === catId);
    const dhikr = cat.azkar.find(a => a.id === dhikrId);

    dhikr.title = document.querySelector('#edit-title').value;
    dhikr.text = document.querySelector('#edit-text').value;
    dhikr.count = parseInt(document.querySelector('#edit-count').value) || 1;
    dhikr.reference = document.querySelector('#edit-ref').value;

    const edits = JSON.parse(localStorage.getItem('rafeeqi_edits') || '{}');
    if (!edits[sheikhId]) edits[sheikhId] = {};
    if (!edits[sheikhId][catId]) edits[sheikhId][catId] = [];
    const idx = edits[sheikhId][catId].findIndex(e => e.id === dhikrId);
    if (idx >= 0) edits[sheikhId][catId][idx] = { ...dhikr };
    else edits[sheikhId][catId].push({ ...dhikr });
    localStorage.setItem('rafeeqi_edits', JSON.stringify(edits));

    dom.modalOverlay.classList.remove('active');
    renderAdminTable();
    showToast('✅ تم الحفظ', 'success');
  }

  function deleteDhikr(sheikhId, catId, dhikrId) {
    if (!confirm('هل أنت متأكد من حذف هذا الذكر؟')) return;

    const sheikh = state.azkarData[sheikhId];
    const cat = sheikh.categories.find(c => c.id === catId);
    const idx = cat.azkar.findIndex(a => a.id === dhikrId);
    if (idx >= 0) cat.azkar.splice(idx, 1);

    const edits = JSON.parse(localStorage.getItem('rafeeqi_edits') || '{}');
    if (!edits[sheikhId]) edits[sheikhId] = {};
    if (!edits[sheikhId][catId]) edits[sheikhId][catId] = [];
    const editIdx = edits[sheikhId][catId].findIndex(e => e.id === dhikrId);
    if (editIdx >= 0) edits[sheikhId][catId][editIdx]._deleted = true;
    else edits[sheikhId][catId].push({ id: dhikrId, _deleted: true });
    localStorage.setItem('rafeeqi_edits', JSON.stringify(edits));

    renderAdminTable();
    showToast('🗑️ تم الحذف');
  }

  // ============================================
  // Theme
  // ============================================
  function toggleTheme() {
    state.settings.darkMode = !state.settings.darkMode;
    applyTheme();
    saveState();
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.settings.darkMode ? 'dark' : 'light');
    if (dom.themeBtn) {
      dom.themeBtn.textContent = state.settings.darkMode ? '☀️' : '🌙';
    }
    if (dom.themeColor) {
      dom.themeColor.setAttribute('content', state.settings.darkMode ? '#0D0F0C' : '#37472D');
    }
  }

  // ============================================
  // Toast
  // ============================================
  function showToast(message, type = '') {
    if (!dom.toast) return;
    dom.toast.textContent = message;
    dom.toast.className = 'toast ' + type;
    setTimeout(() => dom.toast.classList.add('show'), 10);
    setTimeout(() => dom.toast.classList.remove('show'), 2500);
  }

  // ============================================
  // Storage
  // ============================================
  function saveState() {
    const toSave = {
      favorites: state.favorites,
      lastRead: state.lastRead,
      settings: state.settings,
      counters: state.counters
    };
    localStorage.setItem('rafeeqi_dhikr_state', JSON.stringify(toSave));
  }

  function loadState() {
    const saved = JSON.parse(localStorage.getItem('rafeeqi_dhikr_state') || '{}');
    state.favorites = saved.favorites || [];
    state.lastRead = saved.lastRead || null;
    state.settings = { ...state.settings, ...(saved.settings || {}) };
    state.counters = saved.counters || {};
  }

  // ============================================
  // Events
  // ============================================
  function bindEvents() {
    window.addEventListener('hashchange', route);

    if (dom.themeBtn) dom.themeBtn.onclick = toggleTheme;

    const counterMain = document.querySelector('.counter-main');
    if (counterMain) counterMain.onclick = incrementCounter;

    const resetBtn = document.querySelector('.reset-btn');
    if (resetBtn) resetBtn.onclick = resetCounter;

    if (dom.favBtn) dom.favBtn.onclick = toggleFavorite;

    const shareBtn = document.querySelector('.share-btn');
    if (shareBtn) shareBtn.onclick = shareText;

    const shareImgBtn = document.querySelector('.share-img-btn');
    if (shareImgBtn) shareImgBtn.onclick = shareImage;



    const saveEditBtn = document.querySelector('.save-edit-btn');
    if (saveEditBtn) saveEditBtn.onclick = saveEdit;

    const cancelEditBtn = document.querySelector('.cancel-edit-btn');
    if (cancelEditBtn) cancelEditBtn.onclick = () => dom.modalOverlay.classList.remove('active');

    if (dom.modalOverlay) {
      dom.modalOverlay.onclick = (e) => {
        if (e.target === dom.modalOverlay) dom.modalOverlay.classList.remove('active');
      };
    }


  }

  // ============================================
  // Public API
  // ============================================
  return {
    init,
    goToAzkar,
    goToDhikr,
    editDhikr,
    deleteDhikr
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
