/* ═══════════════════════════════════
   AUDIO
═══════════════════════════════════ */
const audioEl = document.getElementById('audio-el');

['audio-folder-init','audio-files-init','audio-folder-more','audio-files-more'].forEach(id => {
  document.getElementById(id).addEventListener('change', function(e) {
    handleAudioFiles(e.target.files); this.value='';
  });
});

function handleAudioFiles(files) {
  const arr = [...files].filter(f => f.type.startsWith('audio/'));
  if (!arr.length) return;
  const isFirst = S.audioFolders.length === 0;

  arr.forEach(f => {
    const parts = f.webkitRelativePath ? f.webkitRelativePath.split('/') : [];
    const folder = parts.length>=2 ? parts[parts.length-2] : '📂 Uncategorized';
    let g = S.audioFolders.find(x=>x.name===folder);
    if (!g) { g={name:folder, tracks:[], open:true}; S.audioFolders.push(g); }
    g.tracks.push({name:f.name.replace(/\.[^.]+$/,''), url:URL.createObjectURL(f)});
  });

  document.getElementById('audio-ph').style.display     = 'none';
  document.getElementById('audio-player').style.display = 'flex';
  genWave(); renderFolders();
  if (isFirst) loadFolderTrack(0,0);
}

function renderFolders() {
  document.getElementById('folder-list').innerHTML = S.audioFolders.map((f,fi)=>`
    <div class="folder-group">
      <div class="folder-header" onclick="toggleFolder(${fi})" style="color:${f.open?'var(--text)':'var(--muted)'}">
        <span>📁</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.name}</span>
        <span style="font-size:9px;opacity:.6;margin-right:3px">${f.tracks.length}</span>
        <span class="folder-arrow ${f.open?'open':''}">▶</span>
      </div>
      <div class="folder-tracks ${f.open?'open':''}">
        ${f.tracks.map((t,ti)=>`
          <div class="track-item ${fi===S.activeFolder&&ti===S.activeTrack?'active':''}"
               onclick="loadFolderTrack(${fi},${ti})">
            ${fi===S.activeFolder&&ti===S.activeTrack?'▶ ':''}${t.name}
          </div>`).join('')}
      </div>
    </div>`).join('');

  if (S.activeFolder>=0) {
    const f = S.audioFolders[S.activeFolder];
    document.getElementById('track-pos').textContent =
      `${f.name} · ${S.activeTrack+1}/${f.tracks.length}`;
  }
}

function toggleFolder(fi) { S.audioFolders[fi].open=!S.audioFolders[fi].open; renderFolders(); }

function toggleAllFolders() {
  S.allOpen = !S.allOpen;
  S.audioFolders.forEach(f => f.open=S.allOpen);
  document.querySelector('.folder-toggle-all').textContent = S.allOpen ? '⊟ All' : '⊞ All';
  renderFolders();
}

function loadFolderTrack(fi,ti) {
  S.activeFolder=fi; S.activeTrack=ti;
  const t = S.audioFolders[fi].tracks[ti];
  audioEl.src=t.url; audioEl.load();
  document.getElementById('audio-fname').textContent=t.name;
  renderFolders();
  audioEl.play().catch(()=>{});
  document.getElementById('play-btn').textContent='⏸';
}

function togglePlay() {
  if (audioEl.paused) { audioEl.play();  document.getElementById('play-btn').textContent='⏸'; }
  else                { audioEl.pause(); document.getElementById('play-btn').textContent='▶'; }
}
function skipAudio(s) { audioEl.currentTime=Math.max(0,Math.min(audioEl.duration||0,audioEl.currentTime+s)); }
function setSpeed(sp) {
  audioEl.playbackRate=sp;
  document.querySelectorAll('.spd').forEach(b=>b.classList.toggle('active',parseFloat(b.textContent)===sp));
}

/* ── Repeat mode ── */
let repeatMode = 'off'; // 'off' | 'one' | 'folder'

function cycleRepeat() {
  const modes = ['off', 'one', 'folder'];
  repeatMode = modes[(modes.indexOf(repeatMode) + 1) % modes.length];
  const btn = document.getElementById('repeat-btn');
  if (repeatMode === 'off')    { btn.textContent = '🔁'; btn.style.opacity = '.4'; btn.title = 'Repeat: Off'; }
  if (repeatMode === 'one')    { btn.textContent = '🔂'; btn.style.opacity = '1';  btn.title = 'Repeat: One'; }
  if (repeatMode === 'folder') { btn.textContent = '🔁'; btn.style.opacity = '1';  btn.title = 'Repeat: Folder'; }
}

const fmt = s => isNaN(s)?'0:00':`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;

audioEl.addEventListener('timeupdate', () => {
  const p = (audioEl.currentTime/audioEl.duration*100)||0;
  document.getElementById('progress-fg').style.width = p+'%';
  document.getElementById('cur-t').textContent = fmt(audioEl.currentTime);
  document.getElementById('tot-t').textContent = fmt(audioEl.duration);
  tickWave();
});

audioEl.addEventListener('ended', () => {
  document.getElementById('play-btn').textContent='▶';
  const f = S.audioFolders[S.activeFolder];
  if (repeatMode === 'one') {
    // Repeat same track
    audioEl.currentTime = 0;
    audioEl.play().catch(()=>{});
    document.getElementById('play-btn').textContent='⏸';
  } else if (repeatMode === 'folder') {
    // Advance, loop back to start of folder when done
    if (f && S.activeTrack < f.tracks.length - 1) loadFolderTrack(S.activeFolder, S.activeTrack + 1);
    else if (f) loadFolderTrack(S.activeFolder, 0); // wrap to start
  } else {
    // No repeat — advance normally, stop at end
    if (f && S.activeTrack < f.tracks.length - 1) loadFolderTrack(S.activeFolder, S.activeTrack + 1);
    else if (S.activeFolder < S.audioFolders.length - 1) loadFolderTrack(S.activeFolder + 1, 0);
  }
});
document.getElementById('progress-bg').addEventListener('click', function(e) {
  const r=this.getBoundingClientRect();
  audioEl.currentTime=((e.clientX-r.left)/r.width)*audioEl.duration;
});

function genWave() {
  const w=document.getElementById('waveform'); w.innerHTML='';
  for(let i=0;i<24;i++){
    const b=document.createElement('div'); b.className='wb';
    b.style.height=(Math.random()*20+4)+'px'; w.appendChild(b);
  }
}
let wt=0;
function tickWave() {
  if(!audioEl.paused&&++wt%3===0)
    document.querySelectorAll('.wb').forEach(b=>{b.style.height=(Math.random()*20+4)+'px';});
}
