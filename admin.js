(() => {
  'use strict';
  const $ = (selector, root=document) => root.querySelector(selector);
  const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
  const esc = (value='') => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const safeUrl = value => /^(https:\/\/|assets\/)/i.test(value||'') ? esc(value) : 'assets/holding-hands.jpg';
  const clone = o => JSON.parse(JSON.stringify(o));
  function deepMerge(base,override) {
    if (!override || typeof override !== 'object' || Array.isArray(override)) return override ?? clone(base);
    const result=clone(base||{});
    for(const [key,val] of Object.entries(override)) {
      if(val && typeof val==='object' && !Array.isArray(val) && result[key] && typeof result[key]==='object' && !Array.isArray(result[key]))result[key]=deepMerge(result[key],val);
      else result[key]=val;
    }
    return result;
  }
  const cfg=window.LOVE_SITE_CONFIG||{};
  const enabled=!!(cfg.supabaseUrl && cfg.supabasePublishableKey && window.supabase?.createClient);
  const db=enabled ? window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey) : null;
  let state=clone(window.LOVE_DEFAULTS), tab='event', dirty=false, busy=false, uploads=0;
  let assets=[], libraryLoading=false, toastTimer=null;
  const tabs=[
    {id:'event',name:'Names & Countdown',icon:'◷'},
    {id:'words',name:'Love Words & Quiz',icon:'♡'},
    {id:'memories',name:'Photos & Chapters',icon:'▣'},
    {id:'romance',name:'Client V2 · Ribbon & Proposal',icon:'🎀'},
    {id:'timeline',name:'Love Timeline',icon:'✧'},
    {id:'theme',name:'Colors & Music',icon:'♫'},
    {id:'files',name:'Uploaded Files',icon:'⌑'}
  ];
  const editor=$('#editor');
  const getPath = (path) => path.split('.').reduce((acc,key) => acc?.[key],state);
  function setPath(path,value) {
    const segments=path.split('.');let obj=state;
    for(let i=0;i<segments.length-1;i++) {
      if(!obj[segments[i]])obj[segments[i]]={};obj=obj[segments[i]];
    }
    obj[segments[segments.length-1]]=value;markDirty();
  }
  function markDirty(){dirty=true;const status=$('#save-status');status.textContent='Unpublished changes';status.classList.add('dirty');status.classList.remove('busy');}
  function showToast(message){const toast=$('#admin-toast');toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),4000);}
  const field=(label,path,type='text',hint='')=> `<label>${esc(label)}<input type="${type}" data-path="${esc(path)}" value="${esc(getPath(path) ?? '')}" ${type==='date'?'min="1900-01-01"':''}></label>${hint?`<p class="field-note">${esc(hint)}</p>`:''}`;
  const selectField=(label,path,options)=>`<label>${esc(label)}<select data-path="${esc(path)}">${options.map(([value,title])=>`<option value="${esc(value)}" ${getPath(path)===value?'selected':''}>${esc(title)}</option>`).join('')}</select></label>`;
  const area=(label,path,rows=3)=> `<label>${esc(label)}<textarea data-path="${esc(path)}" rows="${rows}">${esc(getPath(path) ?? '')}</textarea></label>`;
  const section=(title,body,help='')=> `<div class="editor-section"><h3>${esc(title)}</h3>${help?`<p class="section-sub">${esc(help)}</p>`:''}${body}</div>`;
  const header=(title,desc)=> `<div class="editor-header"><span class="eyebrow">MAKE IT YOUR OWN · LIVE CONTENT</span><h2>${esc(title)}</h2><p>${esc(desc)}</p></div>`;
  const publishBar=()=>`<div class="publish-strip"><p>♧ When you are happy with your changes, click Publish. Visitors will see the new details instantly without a GitHub update.</p><button class="button button-primary" type="button" data-action="save">Publish Changes ♡</button></div>`;
  // Font presets for the BIG names on the first full page, not the header's small initials.
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
  const HERO_FONT_CHOICES = [
    ['great-vibes','Great Vibes - Romantic Script'],
    ['alex-brush','Alex Brush - Elegant Calligraphy'],
    ['pinyon-script','Pinyon Script - Royal Wedding'],
    ['allura','Allura - Soft Handwriting'],
    ['parisienne','Parisienne - Paris Romance'],
    ['dancing-script','Dancing Script - Playful'],
    ['playfair-display','Playfair Display - Classic Luxury'],
    ['cormorant-garamond','Cormorant Garamond - Editorial'],
    ['italiana','Italiana - Thin & Elegant'],
    ['times-new-roman','Times New Roman - Traditional'],
    ['georgia','Georgia - Classic Serif']
  ];
  function fontNumber(label, path, min, max) {
    return `<label>${esc(label)}<input type="number" min="${min}" max="${max}" step="1" inputmode="numeric" data-path="${esc(path)}" value="${esc(getPath(path))}"></label>`;
  }
  function renderFontStudio() {
    return section('Opening Names - Font Studio', `
      <p class="section-sub">Edit the LARGE Ayyapan & Arthi lettering on the first full website screen. This does NOT change the small A ♡ A header logo.</p>
      <div class="font-studio-previews" aria-label="Live font previews">
        <div class="font-preview-card"><div class="font-preview-tag">DESKTOP STYLE PREVIEW</div><div class="font-preview-names" data-name-preview="desktop"><span data-preview-name="one"></span><em>&amp;</em><span data-preview-name="two"></span></div></div>
        <div class="font-preview-card mobile-sample"><div class="font-preview-tag">MOBILE STYLE PREVIEW</div><div class="font-preview-names" data-name-preview="mobile"><span data-preview-name="one"></span><em>&amp;</em><span data-preview-name="two"></span></div></div>
      </div>
      <div class="form-grid">${selectField('Font Style - Choose from 11 designs','typography.heroFont',HERO_FONT_CHOICES)}${selectField('Capital / Letter Case','typography.heroCase', [['original','As typed (Ayyapan / Arthi)'],['title','Title Case (Ayyapan / Arthi)'],['upper','ALL CAPITAL LETTERS'],['lower','all lowercase']])}</div>
      <div class="form-grid">${selectField('Normal or Italic','typography.heroStyle',[['normal','Normal'],['italic','Italic']])}${fontNumber('Desktop Font Size (60-190 px)','typography.heroDesktopSize',60,190)}</div>
      <div class="form-grid">${fontNumber('Mobile Font Size (38-108 px)','typography.heroMobileSize',38,108)}</div>
      <p class="field-note">The samples above update instantly before publishing. Actual display adjusts to screen width so the names are not cut off. Click Preview after publishing for an exact full-page view.</p>
      <button class="mini-btn" type="button" data-action="reset-name-font">Restore original name font</button>
    `);
  }
  function updateFontPreview() {
    const t = state.typography || {};
    const family = HERO_FONTS[t.heroFont] || HERO_FONTS['great-vibes'];
    const casing = {original:'none', title:'capitalize', upper:'uppercase', lower:'lowercase'}[t.heroCase] || 'none';
    const desktop = Math.max(60,Math.min(190,Number(t.heroDesktopSize) || 134));
    const mobile = Math.max(38,Math.min(108,Number(t.heroMobileSize) || 74));
    $$('.font-preview-names', editor).forEach(sample => {
      const narrowScreen=window.matchMedia('(max-width:700px)').matches;
      const size = sample.dataset.namePreview === 'mobile' ? Math.min(66, mobile * 0.72) : (narrowScreen ? Math.min(61, desktop * 0.43) : Math.min(81, desktop * 0.56));
      sample.style.fontFamily=family;
      sample.style.fontSize=size+'px';
      sample.style.textTransform=casing;
      sample.style.fontStyle=t.heroStyle === 'italic' ? 'italic' : 'normal';
      sample.querySelector('[data-preview-name="one"]').textContent=state.couple.nameOne || 'Ayyapan';
      sample.querySelector('[data-preview-name="two"]').textContent=state.couple.nameTwo || 'Arthi';
    });
  }
  function renderEvent(){
    return header('Your names. Your date. Your forever.','Control the event date, the countdown, the couple names and the words visitors see before your love story opens.')+
      section('The happy couple', `<div class="form-grid">${field('First name','couple.nameOne')}${field('Second name','couple.nameTwo')}</div><div class="form-grid">${field('Story eyebrow / short caption','couple.eyebrow')}${field('Event tag','couple.eventLabel')}</div>${field('City / venue (optional)','couple.city')}`)+
      renderFontStudio()+
      section('Unlock exactly at midnight (IST)', `<div class="form-grid">${field('Engagement date','couple.date','date')}${field('Opening time — Indian Standard Time','couple.time','time')}</div><p class="admin-hint">Set <b>11 November 2026</b> and <b>00:00</b>. Visitors see Days / Hours / Minutes / Seconds before this moment. On or after the date, the whole story stays open — it will not lock again at the next midnight.</p><label class="checkline"><input type="checkbox" data-path="flags.forceOpen" ${state.flags.forceOpen?'checked':''}> Open website immediately, ignoring the countdown (manual override)</label><p class="field-note">Leave this unchecked before 11 November. Use only if you want to publish early.</p>`)+
      section('What visitors see before the unlock',area('Countdown headline','copy.waitingTitle',2)+area('Short emotional countdown message','copy.waitingText',4))+
      section('The first screen after the unlock',area('Opening quote','copy.heroQuote',3)+area('Hero tagline','copy.heroKicker',2)+area('Short line under the first button','copy.heroNote',2)+`<div class="form-grid">${selectField('Name / story alignment','layout.heroAlign', [['left','Left (desktop)'],['center','Center (desktop)']])}${selectField('Hero photo crop / focus','layout.heroFocus', [['top','Top / upper part'],['center','Center'],['bottom','Bottom / lower part']])}</div>`) + publishBar();
  }
  function renderWords(){
    let choices=(state.collegeOptions||[]).map((choice,i)=>`<div class="editor-card"><div class="editor-row"><h4>Choice ${i+1}</h4><div class="mini-buttons"><label class="checkline" style="margin:0"><input type="radio" name="correct-choice" data-action="correct-choice" data-index="${i}" ${choice.correct?'checked':''}> Correct answer</label><button class="mini-btn warn" type="button" data-action="delete-choice" data-index="${i}" ${state.collegeOptions.length<=2?'disabled':''}>Delete</button></div></div>${field('What will visitors see?',`collegeOptions.${i}.label`)}</div>`).join('');
    return header('Words that feel like a heartbeat.','Every quote and message is editable. Use your real college details and personal memories when you are ready.')+
      section('Two hearts becoming one',area('Hearts scene title','copy.heartsTitle',2)+area('Two hearts introduction','copy.heartsQuote',3)+area('Message shown when hearts join','copy.heartsAfter',3)+area('Line beneath the beating hearts','copy.heartTagline',2))+
      section('The college chapter',area('College scene heading','copy.collegeTitle',2)+area('Small romantic first line','copy.collegeIntro',2)+area('College story','copy.collegeStory',5)+area('Quiz question','copy.collegeQuestion',2))+
      section('The little quiz',`<p class="section-sub">Choose one correct answer. A visitor must select it to unlock the photo chapters.</p>${choices}<button class="mini-btn" data-action="add-choice" type="button">+ Add answer option</button>`)+
      section('Four memory chapters & love puzzle',area('Photo memories section title','copy.galleryTitle',2)+area('Intro above the photos','copy.galleryIntro',3)+area('Puzzle title','copy.puzzleTitle',2)+area('Puzzle instructions','copy.puzzleIntro',3)+area('Secret love letter title','copy.puzzleLetterTitle',2)+area('Hidden love letter','copy.puzzleLetter',6))+
      section('The timeline',area('Timeline section title','copy.timelineTitle',2)+area('Timeline introduction','copy.timelineIntro',3)+area('Timeline closing line','copy.timelineOutro',2))+
      section('The final surprise',area('Final screen title','copy.finalTitle',2)+area('Short intro above the final hearts','copy.finalIntro',2)+area('The emotional reveal after hearts touch','copy.finalLead',5)+area('The one beautiful question','copy.finalQuestion',2)+area('Final message heading','copy.finalLetterTitle',3)+area('Complete final love letter','copy.finalLetter',12)+area('Last line of the website','copy.endingLine',2))+
      section('Buttons & micro-messages — all editable',area('Countdown footer','copy.countdownFooter',2)+area('Opening button','copy.ctaStart',2)+area('Join hearts button','copy.ctaHeartJoin',2)+area('Continue from hearts','copy.ctaFirstChapter',2)+area('Continue from college quiz','copy.ctaMemories',2)+area('Continue from gallery','copy.ctaGalleryNext',2)+area('Continue after puzzle','copy.ctaPuzzleNext',2)+area('Continue from timeline','copy.ctaTimelineNext',2)+area('Open final message button','copy.ctaFinal',2)+area('Read again button','copy.ctaRestart',2)) + publishBar();
  }
  function photoCard(photo,i,j){
    return `<div class="photo-tile"><img src="${safeUrl(photo.url)}" alt="Memory photo"><label>Photo caption<input data-path="memories.${i}.photos.${j}.caption" value="${esc(photo.caption||'')}"></label><button type="button" class="mini-btn warn" data-action="delete-photo" data-chapter="${i}" data-photo="${j}">Remove photo ×</button></div>`;
  }
  function renderMemories(){
    const hero=section('Front cover / hero image',`<div class="file-row"><img src="${safeUrl(state.media.hero)}" alt="Hero"><div class="file-actions"><p class="section-sub">This picture appears on the first page and on the countdown background.</p><label>Replace hero photo<input type="file" accept="image/*" data-upload="hero"></label><p class="field-note">JPG / PNG / WebP. Please use a portrait image. 10 MB or less.</p></div></div>`);
    const chapters=(state.memories||[]).map((ch,i)=>`<article class="editor-section"><div class="editor-row"><h3 class="row-title">${esc(ch.title||`Chapter ${i+1}`)}</h3><div class="mini-buttons"><button type="button" class="mini-btn" data-action="move-memory" data-index="${i}" data-dir="-1" ${i===0?'disabled':''}>↑</button><button type="button" class="mini-btn" data-action="move-memory" data-index="${i}" data-dir="1" ${i===state.memories.length-1?'disabled':''}>↓</button><button type="button" class="mini-btn warn" data-action="delete-memory" data-index="${i}" ${state.memories.length<=2?'disabled':''}>Delete chapter</button></div></div><div class="form-grid">${field('Chapter title',`memories.${i}.title`)}${field('Small chapter label',`memories.${i}.kicker`)}</div>${area('Emotional chapter description',`memories.${i}.description`,4)}<div class="divider-line"></div><span class="eyebrow">PHOTOS & INDIVIDUAL CAPTIONS</span><div class="photo-list">${(ch.photos||[]).map((p,j)=>photoCard(p,i,j)).join('')}</div><label>Add photos to this chapter<input type="file" accept="image/*" data-upload="chapter" data-index="${i}" multiple></label><p class="field-note">You can upload more than one image. Visitors can swipe through them inside the chapter.</p></article>`).join('');
    return header('Our beautiful photo chapters.','All supplied pictures are starter illustrations. Replace them with Ayyapan and Arthi’s own photos whenever you want. Add, remove, reorder and caption everything here.') + hero+
      `<div class="admin-hint">The interactive love puzzle uses the first <b>four chapters in order</b>. Move chapters up or down here to decide the correct answer. The default design has four chapters, but you can add more photos within each one.</div>`+
      chapters+`<button class="button button-outline" type="button" data-action="add-memory">+ Add another chapter</button>`+publishBar();
  }
  function renderRomance() {
    const toggles = section('Interactive experience — ON / OFF', `
      <p class="section-sub">Change effects here without editing code. All changes go live only after Publish Changes.</p>
      <label class="checkline"><input type="checkbox" data-path="features.ribbonTransitions" ${state.features.ribbonTransitions?'checked':''}> Ribbon heart transition between chapters (tap to untie)</label>
      <label class="checkline"><input type="checkbox" data-path="features.poetry" ${state.features.poetry?'checked':''}> Show romantic poetry chapter</label>
      <label class="checkline"><input type="checkbox" data-path="features.proposal" ${state.features.proposal?'checked':''}> Show proposal / promise chapter</label>
      <label class="checkline"><input type="checkbox" data-path="features.fallingHearts" ${state.features.fallingHearts?'checked':''}> Show subtle falling hearts on all pages</label>
      ${area('Ribbon heart message','copy.ribbonPrompt',3)}
      <p class="admin-hint">The ribbon works only at unlocked chapter transitions. Quiz and puzzle must still be solved before proceeding.</p>`);

    const photo = (title,key,tip) => `<div class="v2-media-item"><div><span class="eyebrow">${esc(title)}</span><div class="v2-image-preview"><img src="${safeUrl(state.media[key])}" alt="${esc(title)}"></div></div><div class="file-actions"><p class="section-sub">${esc(tip)}</p><label>Upload / replace ${esc(title)}<input type="file" accept="image/jpeg,image/png,image/webp,image/*" data-upload="v2-${esc(key)}"></label><button class="mini-btn" type="button" data-action="reset-v2-media" data-key="${esc(key)}">Use starter illustration</button></div></div>`;

    const cover = section('Two photos immediately after countdown',`
      <p class="section-sub">First the couple's first meeting, then the sitting/talking photograph. The lower photograph reuses your existing Hero Photo, so your uploaded picture is preserved.</p>
      ${photo('First Meet Photo','firstMeet','This appears ABOVE the existing sitting photo on the first story page. Original couple picture can be uploaded later.')}
      <div class="divider-line"></div>
      <div class="admin-hint">Second picture = existing <b>Photos & Chapters → Front cover / hero image</b>. That previous photo is kept exactly as saved in Supabase.</div>
      ${area('First photo heading','copy.meetTitle',2)}${area('First photo caption','copy.meetCaption',3)}
      ${area('Sitting photo heading','copy.sittingTitle',2)}${area('Sitting photo caption','copy.sittingCaption',3)}
      <div class="form-grid">${selectField('First Meet photo display','layout.meetFit',[['contain','Full photo — no cropping'],['cover','Fill frame — may crop']])}${selectField('Sitting / Hero photo display','layout.heroFit',[['contain','Full photo — no cropping'],['cover','Fill frame — may crop']])}</div>`);

    const proposal=section('Romantic Proposal — photo & cinematic reveal',`
      ${photo('Proposal Photo','proposal','An original proposal photo can be supplied later. We only animate the photo gently; we do not alter faces.')}
      ${area('Proposal scene title','copy.proposalTitle',2)}${area('Proposal scene introduction','copy.proposalIntro',4)}${area('Revealed emotional promise','copy.proposalSecret',5)}
      <div class="form-grid">${selectField('Proposal photo display','layout.proposalFit',[['contain','Full photo — no cropping'],['cover','Fill frame — may crop']])}${field('Reveal button text','copy.ctaProposalReveal')}</div>
      ${field('Continue button text','copy.ctaProposalNext')}`);

    const poems=(state.poetry||[]).map((poem,i)=>`<div class="editor-card"><div class="editor-row"><h4>Poetry Card ${i+1}</h4><div class="mini-buttons"><button class="mini-btn" type="button" data-action="move-poem" data-index="${i}" data-dir="-1" ${i===0?'disabled':''}>↑</button><button class="mini-btn" type="button" data-action="move-poem" data-index="${i}" data-dir="1" ${i===(state.poetry.length-1)?'disabled':''}>↓</button><button class="mini-btn warn" type="button" data-action="delete-poem" data-index="${i}" ${state.poetry.length<=1?'disabled':''}>Delete</button></div></div>${field('Short title',`poetry.${i}.title`)}${area('Poem / personal lines',`poetry.${i}.verse`,5)}</div>`).join('');
    const poetry=section('Love poetry & novel-like writing',`
      ${area('Poetry chapter heading','copy.poetryTitle',2)}${area('Poetry introduction','copy.poetryIntro',3)}
      ${poems}<button type="button" class="button button-outline" data-action="add-poem">+ Add poetry card</button>
      ${field('Continue from poetry button','copy.ctaPoetryNext')}
      <p class="field-note">All texts are editable. Replace starter poetry with the couple's own lines when provided.</p>`);

    const gift=section('The sweet final surprise',`
      ${selectField('Choose gift decoration','gifts.style',[['rose-chocolates','Rose between two chocolates (premium)'],['rose-teddy','Rose + chocolate + teddy bear']])}
      ${area('Gift title','copy.giftTitle',2)}${area('Final sweet message','copy.giftMessage',4)}
      <p class="admin-hint">The gift decoration is made with HTML/CSS; no external image is required.</p>`);

    return header('Client Version 2 — your romantic direction.','Manage the first-meet photo, chapter-opening ribbon heart, proposal memory, poetry cards and final rose gifts here. Existing photo uploads and login are preserved.') + toggles+cover+proposal+poetry+gift+publishBar();
  }
  function renderTimeline(){
    const items=(state.timeline||[]).map((item,i)=>`<div class="editor-section"><div class="editor-row"><h3 class="row-title">${esc(item.title || 'New memory')}</h3><div class="mini-buttons"><button class="mini-btn" type="button" data-action="move-time" data-index="${i}" data-dir="-1" ${i===0?'disabled':''}>↑</button><button class="mini-btn" type="button" data-action="move-time" data-index="${i}" data-dir="1" ${i===state.timeline.length-1?'disabled':''}>↓</button><button class="mini-btn warn" type="button" data-action="delete-time" data-index="${i}">Delete</button></div></div><div class="form-grid">${field('Year, date or label',`timeline.${i}.when`)}${field('Milestone title',`timeline.${i}.title`)}</div>${area('Milestone story',`timeline.${i}.description`,4)}<div class="file-row">${item.image?`<img src="${safeUrl(item.image)}" alt="Milestone photo">`:''}<div class="file-actions"><label>Replace milestone picture<input type="file" data-upload="timeline" data-index="${i}" accept="image/*"></label>${item.image?`<button type="button" class="mini-btn warn" data-action="remove-timeline-image" data-index="${i}">Remove picture</button>`:''}</div></div></div>`).join('');
    return header('The years we built together.','Create a meaningful path from college to engagement. Edit each date, write your real milestones, and upload a photo for every special chapter.')+
      `<div class="admin-hint">The sample timeline deliberately avoids inventing college dates. Add the actual college year, first trip, first special day and engagement milestone when you know them.</div>`+items+
      `<button class="button button-outline" data-action="add-time" type="button">+ Add timeline milestone</button>`+publishBar();
  }
  function renderTheme(){
    const themeBtns=Object.entries(window.LOVE_THEMES).map(([id,entry])=>`<button class="theme-chip ${state.theme.preset===id?'selected':''}" type="button" data-action="set-preset" data-preset="${esc(id)}"><div class="theme-colors">${['bg','surface','accent','gold','text'].map(key=>`<span style="background:${esc(entry[key])}"></span>`).join('')}</div><strong>${esc(entry.name)}</strong></button>`).join('');
    const colors=[['bg','Background'],['surface','Cards & Panels'],['accent','Romantic Pink'],['gold','Champagne Gold'],['text','Main Text']].map(([key,title])=>field(title,`theme.${key}`,'color')).join('');
    return header('The atmosphere of your love story.','Choose a luxurious preset, fine-tune every color and change the background music without editing any HTML or CSS.')+
      section('Royal color palettes',`<p class="section-sub">Tap a preset to preview its colors. It becomes live only after you publish changes.</p><div class="theme-grid">${themeBtns}</div><div class="divider-line"></div><h3 style="font-size:1.36rem">Fine-tune your colors</h3><div class="color-grid">${colors}</div>`)+
      section('Background love song',`<label class="checkline"><input type="checkbox" data-path="flags.musicEnabled" ${state.flags.musicEnabled?'checked':''}> Enable music on the public website</label><div class="file-row"><div class="file-actions"><p class="section-sub">Current audio file</p><audio controls src="${safeUrl(state.media.music)}" style="width:100%;max-width:450px"></audio><label>Replace background song<input type="file" data-upload="music" accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg"></label><p class="field-note">Use MP3 for best compatibility; up to 20 MB. Modern browsers require a visitor to tap/click before audio can play.</p><button type="button" class="mini-btn warn" data-action="remove-music">Remove song</button></div></div><p class="admin-hint admin-warning">If you publish commercially released music on a public website, make sure you have permission to use the recording. Your uploaded song is included for preview.</p>`) + publishBar();
  }
  function renderFiles(){
    const cards=assets.map(item=>{
      const url=db.storage.from('site-media').getPublicUrl(`uploads/${item.name}`).data.publicUrl;
      const used=JSON.stringify(state).includes(url);
      const isAudio=/\.(mp3|wav|ogg)$/i.test(item.name);
      return `<div class="asset-card">${isAudio?`<audio controls src="${esc(url)}"></audio>`:`<img src="${esc(url)}" alt="Uploaded asset">`}<p>${esc(item.name)}</p><small>${used?'In use in current editor':'Not referenced in current editor'}</small><button class="mini-btn warn" type="button" data-action="delete-asset" data-file="${esc(item.name)}" ${used?'disabled title="Remove from the story and publish first"':''}>Delete stored file</button></div>`;
    }).join('');
    return header('Your uploaded media library.','Everything you upload is stored separately from GitHub. Remove media from a chapter, publish, then delete its unused source file here if you want.')+
      section('Uploaded pictures & audio',`<div class="editor-row"><p class="section-sub" style="margin:0">${libraryLoading?'Loading files...':`${assets.length} file(s) in the public media bucket.`}</p><button class="mini-btn" type="button" data-action="refresh-assets">↺ Refresh list</button></div><div id="asset-list" class="media-library">${cards||'<p class="admin-empty">No uploaded files yet. Your starting illustrations are bundled inside the GitHub website and are not listed here.</p>'}</div><p class="admin-hint admin-warning">Deleting a stored file is permanent. If it is still referenced by the published website, the delete button will be blocked.</p>`);
  }
  function render(){
    $('#admin-nav').innerHTML=tabs.map(t=>`<button type="button" class="nav-tab ${t.id===tab?'active':''}" data-tab="${t.id}"><span class="tab-icon">${t.icon}</span>${esc(t.name)}</button>`).join('');
    editor.innerHTML=({event:renderEvent,words:renderWords,memories:renderMemories,timeline:renderTimeline,theme:renderTheme,romance:renderRomance,files:renderFiles}[tab])();
    if(tab==='event')updateFontPreview();
    if(tab==='theme')for(const key of ['bg','surface','accent','gold','text']) {
      // Visually update only this admin preview's theme, never mutate the published site until Save.
      document.documentElement.style.setProperty('--'+key,state.theme[key]);
    }
  }
  function shiftItem(collection,index,direction){
    const arr=state[collection],other=index+direction;
    if(!arr || other<0 || other>=arr.length)return;
    [arr[index],arr[other]]=[arr[other],arr[index]];markDirty();render();
  }
  async function uploadAsset(file,kind){
    const isMusic=kind==='music';const max=isMusic?20:10;
    if(file.size>max*1024*1024)throw Error(`This file exceeds ${max} MB. Please reduce its size first.`);
    if(isMusic && !/^audio\//.test(file.type))throw Error('Please select an audio file (MP3 preferred).');
    if(!isMusic && !/^image\//.test(file.type))throw Error('Please select an image file.');
    const uuid=globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.floor(Math.random()*1e6)}`;
    const filename=(file.name||'upload').replace(/[^a-zA-Z0-9._-]+/g,'-').slice(-60);
    const path=`uploads/${Date.now()}-${uuid}-${filename}`;
    const {error}=await db.storage.from('site-media').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
    if(error)throw Error(`Upload failed: ${error.message}. Check the site-media bucket and SQL policies.`);
    return db.storage.from('site-media').getPublicUrl(path).data.publicUrl;
  }
  async function handleUpload(input){
    if(!input.files?.length)return;
    uploads++;
    $('#save-button').disabled=true;
    const status=$('#save-status');status.textContent='Uploading media...';status.classList.add('busy');
    try {
      const target=input.dataset.upload;
      if(target==='hero')state.media.hero=await uploadAsset(input.files[0],'photo');
      if(target==='v2-firstMeet')state.media.firstMeet=await uploadAsset(input.files[0],'photo');
      if(target==='v2-proposal')state.media.proposal=await uploadAsset(input.files[0],'photo');
      if(target==='music'){state.media.music=await uploadAsset(input.files[0],'music');state.flags.musicEnabled=true;}
      if(target==='timeline')state.timeline[Number(input.dataset.index)].image=await uploadAsset(input.files[0],'photo');
      if(target==='chapter') {
        const ch=state.memories[Number(input.dataset.index)];
        ch.photos=ch.photos||[];
        for(const f of [...input.files]) ch.photos.push({id:'photo-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),url:await uploadAsset(f,'photo'),caption:''});
      }
      markDirty();showToast('Uploaded! Click Publish Changes to show it to visitors.');render();
    } catch(err){showToast(err.message||'Upload failed.');console.error(err);}
    finally {uploads--;$('#save-button').disabled=busy||uploads>0; if(uploads===0 && dirty)markDirty();}
  }
  async function loadAssets(){
    if(!db)return;
    libraryLoading=true;if(tab==='files')render();
    const {data,error}=await db.storage.from('site-media').list('uploads',{limit:100,offset:0,sortBy:{column:'created_at',order:'desc'}});
    libraryLoading=false;if(error){showToast('Media list failed: '+error.message);assets=[];}else assets=(data||[]).filter(v=>v.name && v.name!=='.emptyFolderPlaceholder');
    if(tab==='files')render();
  }
  async function deleteAsset(filename){
    const url=db.storage.from('site-media').getPublicUrl('uploads/'+filename).data.publicUrl;
    if(JSON.stringify(state).includes(url)){showToast('Remove this image from the editor and publish your changes before deleting the file.');return;}
    const {data:live,error:fetchError}=await db.from('site_content').select('data').eq('id','main').maybeSingle();
    if(fetchError){showToast('Unable to verify the live site. No file was deleted.');return;}
    if(JSON.stringify(live?.data||{}).includes(url)){showToast('This media is still on the live website. Publish its removal first.');return;}
    if(!confirm(`Permanently delete this stored file?\n\n${filename}`))return;
    const {error}=await db.storage.from('site-media').remove(['uploads/'+filename]);
    if(error)showToast('Could not delete: '+error.message);
    else{showToast('Unused file deleted successfully.');loadAssets();}
  }
  function validate(){
    if(!state.couple.nameOne.trim() || !state.couple.nameTwo.trim())return 'Please enter both names.';
    if(!/^\d{4}-\d{2}-\d{2}$/.test(state.couple.date))return 'Please select a valid date.';
    if(!/^\d{2}:\d{2}$/.test(state.couple.time))return 'Please select a valid opening time.';
    if(!(Number(state.typography?.heroDesktopSize)>=60 && Number(state.typography?.heroDesktopSize)<=190))return 'Desktop name font size must be 60-190 px.';
    if(!(Number(state.typography?.heroMobileSize)>=38 && Number(state.typography?.heroMobileSize)<=108))return 'Mobile name font size must be 38-108 px.';
    if(!state.collegeOptions.some(choice=>choice.correct))return 'Please mark one quiz answer as correct.';
    if(!state.memories?.length)return 'Please keep at least one memory chapter.';
    if(state.features?.poetry && !state.poetry?.length)return 'Please keep at least one poetry card or disable poetry.';
    return '';
  }
  async function publish(){
    if(busy || uploads>0){showToast('Please finish the media upload first.');return;}
    const invalid=validate();if(invalid){showToast(invalid);return;}
    busy=true;$('#save-button').disabled=true;
    $('#save-status').textContent='Publishing...';$('#save-status').classList.add('busy');
    const {error}=await db.from('site_content').upsert({id:'main',data:state,updated_at:new Date().toISOString()},{onConflict:'id'});
    busy=false;$('#save-button').disabled=uploads>0;
    if(error){showToast('Publish failed: '+error.message);markDirty();return;}
    dirty=false;$('#save-status').textContent='All changes published';$('#save-status').classList.remove('dirty','busy');
    showToast('Published! Your visitor website is now updated. ♥');
  }
  async function adminAllowed(user){
    if(!user)return false;
    const {data,error}=await db.from('site_admins').select('user_id').eq('user_id',user.id).maybeSingle();
    return !error && !!data;
  }
  async function showEditor(user){
    if(!await adminAllowed(user)){await db.auth.signOut();$('#admin-login').hidden=false;$('#admin-app').hidden=true;$('#login-message').textContent='This account is not on the authorized admin list. Add your user ID to site_admins in Supabase.';return;}
    const {data,error}=await db.from('site_content').select('data').eq('id','main').maybeSingle();
    if(error){showToast('Database error: '+error.message);state=clone(window.LOVE_DEFAULTS);}else state=deepMerge(window.LOVE_DEFAULTS,data?.data||{});
    $('#admin-loading').hidden=true;$('#admin-setup').hidden=true;$('#admin-login').hidden=true;$('#admin-app').hidden=false;
    dirty=false;render();
  }
  async function boot(){
    if(!enabled){$('#admin-loading').hidden=true;$('#admin-setup').hidden=false;return;}
    try {
      const {data:{user}}=await db.auth.getUser();
      if(user) await showEditor(user);
      else{$('#admin-loading').hidden=true;$('#admin-login').hidden=false;}
    }catch(err){$('#admin-loading').hidden=true;$('#admin-login').hidden=false;$('#login-message').textContent=err.message||'Unable to connect to the admin service.';}
  }
  $('#login-form').addEventListener('submit',async(event)=>{
    event.preventDefault();$('#login-message').textContent='Checking your account...';
    const button=$('#login-button');button.disabled=true;
    try {
      const {data,error}=await db.auth.signInWithPassword({email:$('#login-email').value.trim(),password:$('#login-password').value});
      if(error)throw error;await showEditor(data.user);
    }catch(err){$('#login-message').textContent=err.message||'Sign-in failed.';}
    button.disabled=false;
  });
  $('#admin-nav').addEventListener('click',event=>{
    const btn=event.target.closest('[data-tab]');if(!btn)return;
    tab=btn.dataset.tab;render();window.scrollTo({top:0,behavior:'smooth'});
    if(tab==='files')loadAssets();
  });
  editor.addEventListener('input',event=>{
    const path=event.target.dataset.path;if(!path)return;
    const value=event.target.type==='checkbox'?event.target.checked:event.target.value;
    setPath(path,value);
    if(path.startsWith('theme.'))document.documentElement.style.setProperty('--'+path.split('.')[1],value);
    if(tab==='event' && (path.startsWith('typography.') || path==='couple.nameOne' || path==='couple.nameTwo'))updateFontPreview();
  });
  editor.addEventListener('change',event=>{
    if(event.target.dataset.upload)handleUpload(event.target);
    if(event.target.dataset.action==='correct-choice'){
      state.collegeOptions.forEach((choice,i)=>choice.correct=i===Number(event.target.dataset.index));markDirty();render();
    }
  });
  editor.addEventListener('click',async(event)=>{
    const b=event.target.closest('[data-action]');if(!b || b.disabled)return;
    const action=b.dataset.action,index=Number(b.dataset.index),direction=Number(b.dataset.dir);
    if(action==='save')return publish();
    if(action==='reset-v2-media'){const key=b.dataset.key;if(['firstMeet','proposal'].includes(key)){state.media[key]=window.LOVE_DEFAULTS.media[key];markDirty();render();}return;}
    if(action==='add-poem'){state.poetry.push({id:'poem-'+Date.now(),title:'One more love note',verse:'Write a little poem from your heart...'});markDirty();render();return;}
    if(action==='delete-poem'){if(state.poetry.length>1 && confirm('Delete this poetry card?')){state.poetry.splice(index,1);markDirty();render();}return;}
    if(action==='move-poem'){shiftItem('poetry',index,direction);return;}
    if(action==='reset-name-font'){state.typography=clone(window.LOVE_DEFAULTS.typography);markDirty();render();showToast('Original romantic font restored in editor. Publish to apply.');return;}
    if(action==='add-choice'){state.collegeOptions.push({id:'choice-'+Date.now(),label:'Another lovely possibility',correct:false});markDirty();render();}
    if(action==='delete-choice'){
      const wasCorrect=state.collegeOptions[index].correct;
      state.collegeOptions.splice(index,1);if(wasCorrect)state.collegeOptions[0].correct=true;markDirty();render();
    }
    if(action==='move-memory')shiftItem('memories',index,direction);
    if(action==='delete-memory'){
      if(confirm('Remove this entire chapter from the website? Remember to publish the change.')){state.memories.splice(index,1);markDirty();render();}
    }
    if(action==='add-memory'){
      state.memories.push({id:'memory-'+Date.now(),title:'Another unforgettable chapter',kicker:'ONE MORE MEMORY',description:'Write this little moment in your own words...',photos:[]});markDirty();render();
    }
    if(action==='delete-photo'){
      const ch=state.memories[Number(b.dataset.chapter)];ch.photos.splice(Number(b.dataset.photo),1);markDirty();render();
    }
    if(action==='move-time')shiftItem('timeline',index,direction);
    if(action==='delete-time'){
      if(confirm('Remove this milestone?')){state.timeline.splice(index,1);markDirty();render();}
    }
    if(action==='add-time'){
      state.timeline.push({id:'time-'+Date.now(),when:'ANOTHER BEAUTIFUL DAY',title:'Write this special milestone',description:'What happened on that day?',image:''});markDirty();render();
    }
    if(action==='remove-timeline-image'){state.timeline[index].image='';markDirty();render();}
    if(action==='set-preset'){
      state.theme={preset:b.dataset.preset,...clone(window.LOVE_THEMES[b.dataset.preset])};delete state.theme.name;
      markDirty();render();
    }
    if(action==='remove-music'){state.media.music='';state.flags.musicEnabled=false;markDirty();render();}
    if(action==='refresh-assets')loadAssets();
    if(action==='delete-asset')deleteAsset(b.dataset.file);
  });
  $('#save-button').addEventListener('click',publish);
  $('#preview-button').addEventListener('click',()=>{
    if(dirty)showToast('Preview uses last PUBLISHED content. Publish your changes first.');
    window.open('index.html?preview=1','_blank','noopener');
  });
  $('#logout-button').addEventListener('click',async()=>{
    await db.auth.signOut();$('#admin-app').hidden=true;$('#admin-login').hidden=false;$('#login-password').value='';
    $('#login-message').textContent='Signed out safely.';
  });
  boot();
})();
