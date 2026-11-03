(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const html = (value = '') => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const text = (value = '') => html(value).replace(/\n/g, '<br>');
  const media = value => {
    const str = String(value || '').trim();
    if (/^assets\/[\w.\/-]+$/i.test(str) || /^https:\/\//i.test(str) || /^blob:/i.test(str)) return html(str);
    return 'assets/holding-hands.jpg';
  };
  const copy = object => JSON.parse(JSON.stringify(object));
  function deepMerge(base, override) {
    if (!override || typeof override !== 'object' || Array.isArray(override)) return override ?? copy(base);
    const result = copy(base || {});
    for (const [key, value] of Object.entries(override)) {
      if (value && typeof value === 'object' && !Array.isArray(value) && result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) result[key] = deepMerge(result[key], value);
      else result[key] = value;
    }
    return result;
  }
  const config = window.LOVE_SITE_CONFIG || {};
  const connected = !!(config.supabaseUrl && config.supabasePublishableKey && window.supabase?.createClient);
  const db = connected ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey) : null;
  let data = copy(window.LOVE_DEFAULTS);
  let sceneIndex = 0, maxUnlocked = 0, gateTimer = null;
  let visited = new Set(), merged = false, quizSolved = false, puzzleSolved = false, finalOpened = false;
  let puzzleCards = [], selectedCards = [], modalIndex = 0, modalPhotoIndex = 0;
  let audioStarted = false, previewMode = false, toastTimer = null;
  let clockBase = 0, monotonicBase = 0, clockSynced = false;
  const nowMs = () => clockSynced ? clockBase + (performance.now() - monotonicBase) : Date.now();
  const N = 8;

  function showToast(message) {
    const el = $('#toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3100);
  }
  // Only the BIG opening names (Ayyapan & Arthi), not the small A-heart-A mark.
  const HERO_FONTS = {
    'great-vibes': "'Great Vibes', cursive",
    'alex-brush': "'Alex Brush', cursive",
    'pinyon-script': "'Pinyon Script', cursive",
    'allura': "'Allura', cursive",
    'parisienne': "'Parisienne', cursive",
    'dancing-script': "'Dancing Script', cursive",
    'playfair-display': "'Playfair Display', Georgia, serif",
    'cormorant-garamond': "'Cormorant Garamond', Georgia, serif",
    'italiana': "'Italiana', Georgia, serif",
    'times-new-roman': "'Times New Roman', Times, serif",
    'georgia': 'Georgia, serif'
  };
  function applyHeroTypography() {
    const t = data.typography || {};
    const root = document.documentElement.style;
    const family = HERO_FONTS[t.heroFont] || HERO_FONTS['great-vibes'];
    const casing = { original: 'none', title: 'capitalize', upper: 'uppercase', lower: 'lowercase' }[t.heroCase] || 'none';
    const desktop = Math.max(60, Math.min(190, Number(t.heroDesktopSize) || 134));
    const mobile = Math.max(38, Math.min(108, Number(t.heroMobileSize) || 74));
    root.setProperty('--hero-name-font', family);
    root.setProperty('--hero-name-case', casing);
    root.setProperty('--hero-name-style', t.heroStyle === 'italic' ? 'italic' : 'normal');
    root.setProperty('--hero-name-desktop-size', desktop + 'px');
    root.setProperty('--hero-name-mobile-size', mobile + 'px');
  }
  function theme() {
    for (const key of ['bg', 'surface', 'accent', 'gold', 'text']) {
      const value = data.theme?.[key];
      if (/^#[0-9A-F]{6}$/i.test(value || '')) document.documentElement.style.setProperty('--' + key, value);
    }
    const color = data.theme?.bg || '#160f1d';
    $('meta[name="theme-color"]')?.setAttribute('content', color);
  }
  function eventTimestamp() {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(data.couple?.date || '') ? data.couple.date : '2026-11-11';
    const time = /^\d{2}:\d{2}$/.test(data.couple?.time || '') ? data.couple.time : '00:00';
    return new Date(`${date}T${time}:00+05:30`).getTime(); // ALWAYS Asia/Kolkata (IST)
  }
  function displayDate() {
    const ts = eventTimestamp();
    if (Number.isNaN(ts)) return '11 November 2026';
    return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day:'numeric', month:'long', year:'numeric' }).format(new Date(ts));
  }
  function displayDateTime() {
    const time = data.couple?.time || '00:00';
    const [h,m] = time.split(':').map(Number);
    const hr = ((h + 11) % 12) + 1;
    return `${displayDate()} · ${hr}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'} IST`;
  }
  function isOpen() {
    if (data.flags?.forceOpen === true) return true;
    const key = 'aa-site-ever-opened-v1';
    try { if (localStorage.getItem(key) === 'yes') return true; } catch (_) {}
    if (nowMs() >= eventTimestamp()) {
      try { localStorage.setItem(key, 'yes'); } catch (_) {}
      return true;
    }
    return false;
  }
  function initials() {
    const a = data.couple.nameOne?.trim()?.[0] || 'A';
    const b = data.couple.nameTwo?.trim()?.[0] || 'A';
    return `${html(a)} <i>♥</i> ${html(b)}`;
  }
  function totalPhotos(chapter) { return Array.isArray(chapter.photos) ? chapter.photos : []; }
  function mainImage(chapter) { return media(totalPhotos(chapter)[0]?.url || data.media.hero); }
  function itemImage(item) { return media(item.image || data.media.hero); }

  function renderGate() {
    const g = $('#gate');
    g.style.setProperty('--gate-img', `url("${media(data.media.hero)}")`);
    g.innerHTML = `
      <div class="gate-inner">
        <div class="eyebrow">✧ &nbsp; ${html(data.couple.eventLabel)} &nbsp; ✧</div>
        <div class="gate-initials">${html(data.couple.nameOne)} <b>♡</b> ${html(data.couple.nameTwo)}</div>
        <div class="small-divider" style="justify-content:center">✦</div>
        <h1 class="gate-title">${html(data.copy.waitingTitle)}</h1>
        <p class="gate-sub">${html(data.copy.waitingText)}</p>
        <div class="eyebrow" style="margin:40px 0 -18px">OUR FOREVER BEGINS IN</div>
        <div class="countdown" aria-label="Engagement countdown">
          <div class="time-box"><strong id="days">00</strong><span>Days</span></div>
          <div class="time-box"><strong id="hours">00</strong><span>Hours</span></div>
          <div class="time-box"><strong id="minutes">00</strong><span>Minutes</span></div>
          <div class="time-box"><strong id="seconds">00</strong><span>Seconds</span></div>
        </div>
        <div class="gate-date">✧ ${html(displayDateTime())} ✧</div>
        <p class="helper-note" style="margin-top:28px">${html(data.copy.countdownFooter)}</p>
      </div>`;
    $('#loading').hidden = true; $('#site').hidden = true; g.hidden = false;
    function tick() {
      let ms = eventTimestamp() - nowMs();
      if (ms <= 0 || isOpen()) { clearInterval(gateTimer); gateTimer = null; startStory(); return; }
      const days = Math.floor(ms / 86400000); ms %= 86400000;
      const hrs = Math.floor(ms / 3600000); ms %= 3600000;
      const mins = Math.floor(ms / 60000); ms %= 60000;
      const secs = Math.floor(ms / 1000);
      [['#days',days],['#hours',hrs],['#minutes',mins],['#seconds',secs]].forEach(([id,n]) => $(id).textContent = String(n).padStart(2,'0'));
    }
    tick(); if (!g.hidden && !gateTimer) gateTimer = setInterval(tick, 1000);
  }
  function renderWelcome() {
    return `<section class="scene hero-scene active align-${data.layout?.heroAlign === 'center' ? 'center' : 'left'} focus-${['top','center','bottom'].includes(data.layout?.heroFocus) ? data.layout.heroFocus : 'center'}" data-scene="0">
      <div class="hero-content">
        <span class="eyebrow">✧ ${html(data.couple.eyebrow)} ✧</span>
        <h1 class="hero-names">${html(data.couple.nameOne)}<em>&</em>${html(data.couple.nameTwo)}</h1>
        <h2 class="hero-title">${html(data.copy.heroKicker)}</h2>
        <p class="hero-quote">“${html(data.copy.heroQuote)}”</p>
        <div class="small-divider">♥</div>
        <button class="button button-primary button-large" data-action="begin" type="button">${html(data.copy.ctaStart)} <span>✧</span></button>
        <p class="helper-note" style="margin-top:20px">${html(data.copy.heroNote)}</p>
      </div>
      <div class="hero-image-wrap"><img src="${media(data.media.hero)}" alt="Our love story illustration"><div class="hero-picture-stamp"><span>Forever</span><small>${html(displayDate().toUpperCase())}</small></div></div>
    </section>`;
  }
  function renderHearts() {
    return `<section class="scene hearts-scene" data-scene="1">
      <div class="section-top"><span class="eyebrow">01 · THE INVISIBLE THREAD</span><h2 class="display">${html(data.copy.heartsTitle)}</h2><p class="lead">${html(data.copy.heartsQuote)}</p></div>
      <div id="heart-stage" class="heart-stage ${merged ? 'merged' : ''}" aria-label="Two beating hearts"><span class="heart-core">♥</span><span class="heart-between">✦</span><span class="heart-core">♥</span></div>
      <p class="heart-sentence">${html(data.copy.heartTagline)}</p>
      <button type="button" class="button button-primary" data-action="join-hearts" id="join-btn" ${merged ? 'hidden' : ''}>${html(data.copy.ctaHeartJoin)}</button>
      <div id="after-hearts" class="after-hearts" ${merged ? '' : 'hidden'}><p class="lead" style="margin:18px auto 25px">${html(data.copy.heartsAfter)}</p><button class="button button-outline" data-action="next" type="button">${html(data.copy.ctaFirstChapter)}</button></div>
    </section>`;
  }
  function renderCollege() {
    return `<section class="scene" data-scene="2">
      <div class="college-layout">
        <div class="college-frame-wrap"><div class="college-frame"><img src="${mainImage(data.memories?.[0] || {})}" alt="A sweet first memory"></div><div class="college-note">a little beginning ♡</div></div>
        <div class="college-copy"><span class="eyebrow">02 · THE DAY IT ALL BEGAN</span><h2>${html(data.copy.collegeTitle)}</h2><p class="gold-italic">${html(data.copy.collegeIntro)}</p><p class="lead">${html(data.copy.collegeStory)}</p>
          <div class="quiz-box"><span class="eyebrow">A LITTLE QUESTION, JUST FOR US</span><h3 class="quiz-question">${html(data.copy.collegeQuestion)}</h3><div class="quiz-options">${(data.collegeOptions || []).map((opt,i) => `<button class="quiz-option ${quizSolved && opt.correct ? 'is-correct' : ''}" data-action="quiz-choice" data-choice="${i}" type="button"><span>${String.fromCharCode(65+i)}.</span>${html(opt.label)}</button>`).join('')}</div><div id="quiz-feedback" class="quiz-feedback">${quizSolved ? 'Of course! That was where our forever began. ♡' : 'A correct answer unlocks our beautiful memories.'}</div><button id="college-next" class="button button-primary" type="button" data-action="next" ${quizSolved ? '' : 'hidden'}>${html(data.copy.ctaMemories)}</button></div>
        </div>
      </div>
    </section>`;
  }
  function renderMemories() {
    return `<section class="scene" data-scene="3">
      <div class="section-top"><span class="eyebrow">03 · LITTLE THINGS, BIG FOREVER</span><h2 class="display">${html(data.copy.galleryTitle)}</h2><p class="lead">${html(data.copy.galleryIntro)}</p></div>
      <div id="memory-grid" class="memory-grid">${(data.memories || []).map((chapter, i) => `<button type="button" class="memory-card ${visited.has(chapter.id) ? 'visited' : ''}" data-action="open-memory" data-index="${i}"><img class="memory-cover" src="${mainImage(chapter)}" alt="${html(chapter.title)}"><span class="memory-kicker">${html(chapter.kicker || `CHAPTER ${i+1}`)}</span><span class="memory-title">${html(chapter.title)}</span><span class="memory-bottom">${visited.has(chapter.id) ? '♥ Saved in our hearts' : 'Tap to remember'}<em>↗</em></span></button>`).join('')}</div>
      <p id="memory-visited" class="memory-visited"></p><div class="scene-actions"><button id="gallery-continue" class="button button-primary" data-action="next" type="button" hidden>${html(data.copy.ctaGalleryNext)}</button><span class="helper-note">Open all the memories to unlock the next surprise.</span></div>
    </section>`;
  }
  function shufflePuzzle() {
    puzzleCards = (data.memories || []).slice(0,4).map(m => m.id);
    for (let i = puzzleCards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i+1)); [puzzleCards[i],puzzleCards[j]] = [puzzleCards[j],puzzleCards[i]]; }
    if (puzzleCards.length > 1 && puzzleCards.every((id,idx) => id === data.memories[idx].id)) [puzzleCards[0],puzzleCards[1]] = [puzzleCards[1],puzzleCards[0]];
  }
  function renderPuzzle() {
    return `<section class="scene" data-scene="4">
      <div class="section-top"><span class="eyebrow">04 · THE KEY TO MY HEART</span><h2 class="display">${html(data.copy.puzzleTitle)}</h2><p class="lead">${html(data.copy.puzzleIntro)}</p></div>
      <div class="puzzle-outer"><div class="puzzle-layout"><div class="puzzle-box"><h3 class="puzzle-heading">Little pieces of us ✦</h3><div id="puzzle-pieces" class="puzzle-items"></div></div><div class="puzzle-box"><h3 class="puzzle-heading">Put our story together ♡</h3><div id="puzzle-slots" class="puzzle-items"></div></div></div><p id="puzzle-status" class="puzzle-status"></p><div style="text-align:center"><button type="button" class="button button-outline" data-action="reset-puzzle">↺ Start over</button></div></div>
      <div id="puzzle-letter" class="puzzle-letter" ${puzzleSolved ? '' : 'hidden'}><span class="eyebrow">THE SECRET YOU UNLOCKED · 💌</span><h3>${html(data.copy.puzzleLetterTitle)}</h3><p>${html(data.copy.puzzleLetter)}</p><button type="button" class="button button-primary" data-action="next">${html(data.copy.ctaPuzzleNext)}</button></div>
    </section>`;
  }
  function renderTimeline() {
    return `<section class="scene" data-scene="5">
      <div class="section-top"><span class="eyebrow">05 · FROM THEN TO NOW</span><h2 class="display">${html(data.copy.timelineTitle)}</h2><p class="lead">${html(data.copy.timelineIntro)}</p></div>
      <div class="timeline">${(data.timeline || []).map(item => `<article class="time-row"><div class="time-card">${item.image ? `<img src="${itemImage(item)}" alt="${html(item.title)}" loading="lazy">` : ''}<div class="time-text"><span class="eyebrow">${html(item.when)}</span><h3>${html(item.title)}</h3><p>${html(item.description)}</p></div></div></article>`).join('')}</div>
      <div class="scene-actions"><p class="gold-italic" style="text-align:center;max-width:630px">${html(data.copy.timelineOutro)}</p><button type="button" class="button button-primary" data-action="next">${html(data.copy.ctaTimelineNext)}</button></div>
    </section>`;
  }
  function renderFinal() {
    return `<section class="scene finale-scene" data-scene="6"><div class="section-top"><span class="eyebrow">06 · THE NEXT CHAPTER IS FOREVER</span><h2 class="display">${html(data.copy.finalTitle)}</h2><p class="lead">${html(data.copy.finalIntro)}</p></div>
      <div class="final-hearts ${finalOpened ? 'joined' : ''}" id="final-hearts"><button class="final-heart" type="button" data-action="final-heart" aria-label="Touch the heart to reveal a secret">♥</button><span class="final-heart secondary" aria-hidden="true">♥</span></div>
      <div id="final-secret" class="final-secret" ${finalOpened ? '' : 'hidden'}><p class="lead" style="margin:10px auto 22px">${html(data.copy.finalLead)}</p><h3 class="final-question">${html(data.copy.finalQuestion)}</h3><button type="button" class="button button-primary button-large" data-action="next">${html(data.copy.ctaFinal)}</button></div>
      <p class="helper-note" id="final-hint" ${finalOpened ? 'hidden' : ''}>There is something hidden inside this heartbeat. Touch the heart. ♡</p>
    </section>`;
  }
  function renderLetter() {
    return `<section class="scene final-message-scene" data-scene="7"><div class="final-letter-frame"><span class="eyebrow">07 · A PROMISE FROM MY HEART</span><h1>${html(data.copy.finalLetterTitle)}</h1><div class="letter-salutation">To my forever person,</div><div class="letter-prose">${text(data.copy.finalLetter)}</div><div class="letter-seal">${html(data.couple.nameOne)} & ${html(data.couple.nameTwo)} ♡</div></div><p class="final-bottom">${html(data.copy.endingLine)}</p><p class="helper-note" style="text-align:center;margin-top:18px">${html(displayDate())} · Our engagement, our promise, our forever.</p><div class="scene-actions"><button type="button" class="button button-outline" data-action="restart">${html(data.copy.ctaRestart)}</button></div></section>`;
  }
  function renderApp() {
    $('#scenes').innerHTML = [renderWelcome(),renderHearts(),renderCollege(),renderMemories(),renderPuzzle(),renderTimeline(),renderFinal(),renderLetter()].join('');
    $('#brand-initials').innerHTML = initials();
    $('#footer-names').textContent = `${data.couple.nameOne} ♡ ${data.couple.nameTwo}`;
    $('#footer-date').textContent = displayDate();
    document.title = `${data.couple.nameOne} ♡ ${data.couple.nameTwo} | From College Days to Forever`;
    const audio = $('#our-music');
    if (data.flags?.musicEnabled && data.media?.music) { audio.src = media(data.media.music); $('#audio-toggle').hidden = false; }
    else $('#audio-toggle').hidden = true;
    shufflePuzzle(); refreshPuzzle(); refreshMemoryProgress(); goTo(0, false);
  }
  function startStory() {
    clearInterval(gateTimer); gateTimer = null;
    $('#gate').hidden = true; $('#loading').hidden = true; $('#site').hidden = false;
    renderApp();
    if (previewMode) showToast('Private admin preview — visitors still see the countdown.');
  }
  function goTo(next, scroll = true) {
    if (next < 0 || next > Math.min(maxUnlocked, N-1)) return;
    sceneIndex = next;
    if (sceneIndex === 5) maxUnlocked = Math.max(maxUnlocked, 6); // timeline can proceed to the final surprise
    $$('.scene').forEach(scene => scene.classList.toggle('active', Number(scene.dataset.scene) === sceneIndex));
    $('#progress-label').textContent = `CHAPTER ${String(sceneIndex+1).padStart(2,'0')} / 08`;
    $('#progress-bar').style.width = `${(sceneIndex+1) / N * 100}%`;
    $('#nav-back').disabled = sceneIndex === 0;
    $('#nav-next').disabled = sceneIndex >= maxUnlocked || sceneIndex === N-1;
    const labels = ['Our little forever','Two hearts, one destiny','Where it all began','Memories worth keeping','A secret inside each piece','Every year brought us closer','A question from my heart','The beautiful beginning of forever'];
    $('#chapter-caption').textContent = labels[sceneIndex];
    if (scroll) window.scrollTo({ top:0, behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto':'smooth' });
  }
  function unlock(index) { maxUnlocked = Math.max(maxUnlocked, Math.min(index, N-1)); $('#nav-next').disabled = sceneIndex >= maxUnlocked; }
  function twinkleFrom(x, y, amount=11) {
    const layer = $('#sparkle-layer');
    for (let i=0;i<amount;i++) {
      const heart = document.createElement('span'); heart.className='fly-heart'; heart.textContent=i%3?'♡':'✦';
      heart.style.left = (x + (Math.random()-.5)*160)+'px'; heart.style.top=(y+(Math.random()-.5)*75)+'px';
      heart.style.animationDelay=(i*.07)+'s';heart.style.fontSize=(1+Math.random()*1.6)+'rem';layer.appendChild(heart);
      setTimeout(() => heart.remove(),2400);
    }
  }
  function maybeStartMusic() {
    if (audioStarted || !data.flags?.musicEnabled || !data.media.music) return;
    const audio = $('#our-music');audio.volume=.45;
    audio.play().then(() => {audioStarted=true; setMusicButton();}).catch(() => {audioStarted=false;setMusicButton();});
  }
  function setMusicButton() {
    const playing = !$('#our-music').paused;
    $('#audio-toggle').classList.toggle('playing', playing);
    $('.audio-label').textContent = playing ? 'Music on' : 'Music off';
    $('#audio-toggle').title = playing ? 'Pause music' : 'Play music';
  }
  function refreshMemoryProgress() {
    const total=(data.memories || []).length;
    const count=(data.memories || []).filter(m => visited.has(m.id)).length;
    const label=$('#memory-visited'); if (label) label.textContent = `${count} OF ${total} LITTLE CHAPTERS OPENED ✧`;
    if (count >= total) { const btn=$('#gallery-continue'); if(btn) btn.hidden=false; unlock(4); }
    $$('.memory-card').forEach(el => {
      const chap=data.memories[Number(el.dataset.index)];
      if(!chap) return;
      el.classList.toggle('visited',visited.has(chap.id));
      const span=$('.memory-bottom',el); if(span) span.innerHTML = `${visited.has(chap.id) ? '♥ Saved in our hearts' : 'Tap to remember'}<em>↗</em>`;
    });
  }
  function openModal(i) {
    modalIndex = i; modalPhotoIndex = 0;
    const chapter=data.memories[i];if(!chapter)return;
    visited.add(chapter.id); refreshMemoryProgress();updateModal();$('#photo-modal').hidden=false;document.body.style.overflow='hidden';
  }
  function closeModal() {$('#photo-modal').hidden=true;document.body.style.overflow='';}
  function updateModal() {
    const chapter=data.memories[modalIndex];if(!chapter)return;
    const photos=totalPhotos(chapter);
    const photo=photos[modalPhotoIndex] || {url:data.media.hero,caption:''};
    $('#modal-image').src=media(photo.url);$('#modal-image').alt=chapter.title;
    $('#modal-title').textContent=chapter.title;$('#modal-kicker').textContent=chapter.kicker || 'OUR LITTLE MEMORY';
    $('#modal-description').textContent=chapter.description;$('#modal-caption').textContent=photo.caption || 'The little things we treasure.';
    $('#modal-count').textContent=photos.length > 1 ? `Photo ${modalPhotoIndex+1} of ${photos.length}` : 'A beautiful moment to remember ♡';
    $('#modal-prev').hidden=photos.length<2;$('#modal-next').hidden=photos.length<2;
  }
  function changeModalPhoto(direction) {
    const photos=totalPhotos(data.memories[modalIndex]);if(!photos.length)return;
    modalPhotoIndex=(modalPhotoIndex+direction+photos.length)%photos.length;updateModal();
  }
  function refreshPuzzle() {
    const cardMap=new Map((data.memories || []).map(m=>[m.id,m]));
    const pieceZone=$('#puzzle-pieces'), slotZone=$('#puzzle-slots'); if(!pieceZone || !slotZone) return;
    pieceZone.innerHTML=puzzleCards.map(id=>{
      const m=cardMap.get(id); if(!m)return '';
      if(selectedCards.includes(id))return '<div class="puzzle-slot" aria-hidden="true">♥</div>';
      return `<button class="puzzle-piece" type="button" data-action="puzzle-pick" data-id="${html(id)}" style="background-image:linear-gradient(0deg,rgba(20,10,26,.2),transparent),url('${mainImage(m).replace(/'/g,'%27')}')"><span>${html(m.title)}</span></button>`;
    }).join('');
    slotZone.innerHTML=puzzleCards.map((_,index)=>{
      const id=selectedCards[index], m=cardMap.get(id);
      return id ? `<button type="button" class="puzzle-slot filled" data-action="puzzle-remove" data-slot="${index}"><div><span class="slot-index">${index+1}</span>${html(m?.title || '')}<br><small>tap to remove</small></div></button>` : `<div class="puzzle-slot"><div><span class="slot-index">${index+1}</span>Tap a piece to add it here</div></div>`;
    }).join('');
    const status=$('#puzzle-status'); if(status)status.textContent=puzzleSolved ? 'Perfect. Every piece of us belongs together. ♥' : `${selectedCards.length} of ${puzzleCards.length} memories placed`;
  }
  function choosePiece(id) {
    if (puzzleSolved || selectedCards.includes(id)) return;
    selectedCards.push(id); refreshPuzzle();
    if (selectedCards.length === puzzleCards.length) {
      const correct = selectedCards.every((selected,index)=> selected === data.memories[index].id);
      if(correct) {
        puzzleSolved=true;$('#puzzle-letter').hidden=false;unlock(5);refreshPuzzle();
        twinkleFrom(innerWidth/2,innerHeight/2,20);
        setTimeout(() => $('#puzzle-letter').scrollIntoView({behavior:'smooth',block:'center'}),450);
      } else {
        $('#puzzle-status').textContent='Almost! Remember the order of the four chapters above. Try again ♡';
        setTimeout(() => {if(!puzzleSolved){selectedCards=[];refreshPuzzle();}},1250);
      }
    }
  }
  async function verifyPreview() {
    const local = ['file:'].includes(location.protocol) || ['localhost','127.0.0.1'].includes(location.hostname);
    if (local) return true; // local demo; never opens the published GitHub URL
    if (!new URLSearchParams(location.search).has('preview') || !db) return false;
    try {
      const {data:{user}}=await db.auth.getUser();
      if(!user)return false;
      const {data:admin, error}=await db.from('site_admins').select('user_id').eq('user_id',user.id).maybeSingle();
      return !error && !!admin;
    } catch {return false;}
  }
  async function boot() {
    try {
      if (db) {
        const [result, clock] = await Promise.all([
          db.from('site_content').select('data').eq('id','main').maybeSingle(),
          db.rpc('site_clock')
        ]);
        if(!result.error && result.data?.data) data=deepMerge(window.LOVE_DEFAULTS,result.data.data);
        else if(result.error) console.warn('Supabase read failed:',result.error.message);
        if(!clock.error && Number.isFinite(Number(clock.data))) {
          clockBase=Number(clock.data); monotonicBase=performance.now(); clockSynced=true;
        }
      }
    } catch (err) { console.warn('Could not fetch live website copy:',err); }
    theme();applyHeroTypography();previewMode=await verifyPreview();
    if(previewMode || isOpen()) startStory(); else renderGate();
  }
  $('#scenes').addEventListener('click', event => {
    const target=event.target.closest('[data-action]'); if(!target)return;
    const action=target.dataset.action;
    if(action==='begin'){maybeStartMusic();unlock(1);goTo(1);twinkleFrom(innerWidth/2,innerHeight/2,13);}
    if(action==='join-hearts' && !merged){merged=true;$('#heart-stage').classList.add('merged');target.hidden=true;twinkleFrom(innerWidth/2,innerHeight/2,22);setTimeout(() => {$('#after-hearts').hidden=false;unlock(2);},950);}
    if(action==='next')goTo(sceneIndex+1);
    if(action==='quiz-choice' && !quizSolved){
      const index=Number(target.dataset.choice);const opt=data.collegeOptions?.[index];
      if(opt?.correct){quizSolved=true;target.classList.add('is-correct');$('#quiz-feedback').textContent='Of course! That was where our forever began. ♡';$('#college-next').hidden=false;unlock(3);twinkleFrom(innerWidth/2,innerHeight/2,12);}
      else {target.classList.add('is-wrong');$('#quiz-feedback').textContent='Not quite! A little hint: books, friends, classrooms... and us. ♡';setTimeout(()=>target.classList.remove('is-wrong'),800);}
    }
    if(action==='open-memory')openModal(Number(target.dataset.index));
    if(action==='puzzle-pick')choosePiece(target.dataset.id);
    if(action==='puzzle-remove' && !puzzleSolved){selectedCards.splice(Number(target.dataset.slot),1);refreshPuzzle();}
    if(action==='reset-puzzle' && !puzzleSolved){selectedCards=[];shufflePuzzle();refreshPuzzle();}
    if(action==='final-heart' && !finalOpened){finalOpened=true;$('#final-hearts').classList.add('joined');$('#final-hint').hidden=true;twinkleFrom(innerWidth/2,innerHeight/2,28);setTimeout(()=>{$('#final-secret').hidden=false;unlock(7);},900);}
    if(action==='restart'){goTo(0);}
  });
  $('#nav-back').addEventListener('click',()=>goTo(sceneIndex-1));
  $('#nav-next').addEventListener('click',()=>goTo(sceneIndex+1));
  $('#modal-close').addEventListener('click',closeModal);$('#modal-done').addEventListener('click',closeModal);
  $('#photo-modal').addEventListener('click',event=>{if(event.target.id==='photo-modal')closeModal();});
  $('#modal-prev').addEventListener('click',()=>changeModalPhoto(-1));
  $('#modal-next').addEventListener('click',()=>changeModalPhoto(1));
  document.addEventListener('keydown',event=>{if(!$('#photo-modal').hidden){if(event.key==='Escape')closeModal();if(event.key==='ArrowRight')changeModalPhoto(1);if(event.key==='ArrowLeft')changeModalPhoto(-1);}});
  $('#audio-toggle').addEventListener('click',async()=>{
    const audio=$('#our-music');
    if(audio.paused){audio.volume=.45;try{await audio.play();audioStarted=true;}catch{showToast('Your browser could not play the audio.');}}
    else{audio.pause();audioStarted=false;}setMusicButton();
  });
  boot();
})();
