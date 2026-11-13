/* Los Santos Phone — 100% local frontend, multiplayer API/WebSocket backend. */
'use strict';
const $ = (sel) => document.querySelector(sel);
const app = $('#app'), overlay = $('#overlay'), toastArea = $('#toastArea');
const S = {
  token: localStorage.getItem('ls_token') || '', user: null, mod: false,
  gateStep: 'code', entryCode: '', view: 'home', cache: {}, settings: {},
  phone: '', tab: 'players', search: '', call: null, ws: null,
  photoUrls: {}, dial: '', bootUser: null, ringing: null, loading: true
};
const JOB_ICONS = {'Chauffeur de taxi':'🚕','Mécanicien':'🔧','Livreur':'📦','Policier LSPD':'🚓','Ambulancier':'🚑','Agent de sécurité':'🛡️','Commerçant':'🏪'};
const ICONS = {
 phone:'<path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3 5.18 2 2 0 0 1 5 3h3a2 2 0 0 1 2 1.72l.4 2.81a2 2 0 0 1-.57 1.7L8.1 10.9a16 16 0 0 0 5 5l1.67-1.73a2 2 0 0 1 1.7-.57l2.81.4A2 2 0 0 1 22 16.92Z"/>',
 message:'<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/>',
 users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
 camera:'<path d="M14.5 4h-5L7.5 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.5l-2-3Z"/><circle cx="12" cy="14" r="3.5"/>',
 image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
 settings:'<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06-1.82 1.82-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.05 1.56V21H9v-.09A1.7 1.7 0 0 0 7.95 19.35a1.7 1.7 0 0 0-1.87.34l-.06.06L4.2 17.93l.06-.06A1.7 1.7 0 0 0 4.6 16a1.7 1.7 0 0 0-1.56-1.05H3v-2.9h.04A1.7 1.7 0 0 0 4.6 11a1.7 1.7 0 0 0-.34-1.87L4.2 9.07l1.82-1.82.06.06a1.7 1.7 0 0 0 1.87.34A1.7 1.7 0 0 0 9 6.09V6h6v.09a1.7 1.7 0 0 0 1.05 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06 1.82 1.82-.06.06A1.7 1.7 0 0 0 19.4 11a1.7 1.7 0 0 0 1.56 1.05H21v2.9h-.04A1.7 1.7 0 0 0 19.4 15Z"/>',
 briefcase:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12c5 3 13 3 18 0"/>',
 bank:'<path d="m3 9 9-6 9 6M3 9h18M5 9v10M10 9v10M14 9v10M19 9v10M3 21h18"/>',
 store:'<path d="m5 8 7-5 7 5-7 13L5 8Z"/><path d="M5 8h14M9 8l3 13M15 8l-3 13"/>',
 shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
 info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7h.01"/>',
 back:'<path d="m15 18-6-6 6-6"/>',
 add:'<path d="M12 5v14M5 12h14"/>',
 send:'<path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13"/>',
 close:'<path d="M18 6 6 18M6 6l12 12"/>',
 trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
 callend:'<path d="M21 15v4a2 2 0 0 1-2 2 16 16 0 0 1-16-16 2 2 0 0 1 2-2h4v4l-2 2a13 13 0 0 0 8 8l2-2h4"/>',
 arrow:'<path d="M5 12h14M12 5l7 7-7 7"/>',
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
 music:'<path d="M9 18V5l12-2v13M9 8l12-2"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
 logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
 lock:'<rect x="5" y="11" width="14" height="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
 star:'<path d="m12 2 3 7 7 .6-5.4 5 1.6 7.4L12 18l-6.2 4 1.6-7.4L2 9.6 9 9l3-7Z"/>',
 wifi:'<path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8.5 16a6 6 0 0 1 7 0M12 20h.01"/>',
 signal:'<path d="M2 20v-3M6 20v-6M10 20v-9M14 20V8"/>',
 battery:'<rect x="2" y="7" width="19" height="10" rx="2"/><path d="M23 11v2"/><rect x="4" y="9" width="14" height="6" rx="1" fill="currentColor" stroke="none"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
 globe:'<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2c5 6 5 14 0 20M12 2c-5 6-5 14 0 20"/>'
};
function icon(name,cls='') {return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]||ICONS.info}</svg>`;}
function esc(x) {return String(x ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function money(n) {return Number(n||0).toLocaleString('fr-FR')+' $';}
function clock() {return new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});}
function dateText(s) {if(!s)return '';let d=new Date(String(s).replace(' ','T')+'Z');return isNaN(d)?String(s):d.toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}
function contactLabel(phone, def='') {return (S.cache.contacts||[]).find(c=>c.phone===phone)?.label || def || phone;}
function initials(n) {return String(n||'LS').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();}
function setLoading() {app.innerHTML='<div class="loading"><div class="spinner"></div><span>Connexion au réseau de Los Santos…</span></div>';}
async function api(path,options={}) {
 const {raw=false,...opts}=options;
 let headers={...(opts.headers||{})};
 if(S.token)headers.Authorization='Bearer '+S.token;
 if(opts.body && !(opts.body instanceof Blob) && typeof opts.body!=='string') {opts.body=JSON.stringify(opts.body);headers['Content-Type']='application/json';}
 const res=await fetch('/api'+path,{...opts,headers});
 if(!res.ok){let detail='Une erreur est survenue.';try{let body=await res.json();detail=body.detail||detail;}catch{};
  if(res.status===401 && S.user){logoutLocal();}
  throw new Error(typeof detail==='string'?detail:'Vérifie les informations.');}
 return raw?res.blob():res.json();
}
function toast(message,bad=false){const node=document.createElement('div');node.className='toast'+(bad?' error':'');node.innerHTML=`<span class="tiny-icon">${icon(bad?'close':'bell')}</span><span>${esc(message)}</span>`;toastArea.append(node);setTimeout(()=>node.remove(),4600);}
function fail(e){console.error(e);toast(e.message||'Erreur de connexion.',true);}
function showConfirm(title,desc,yesText,yesAction,details={}){
 S.dialog={title,desc,yesText,yesAction,details};renderOverlay();
}
function closeDialog(){S.dialog=null;renderOverlay();}
function statusBar(dark=false){return `<div class="status ${dark?'status-dark':'status-white'}"><span id="clock">${clock()}</span><div class="island"></div><span class="status-right">${icon('signal')}${icon('wifi')}${icon('battery')}</span></div>`;}
function indicator(dark=true){return `<button class="home-indicator ${dark?'':'white'}" data-action="home" aria-label="Revenir à l’accueil"></button>`;}
function header(title,sub='',action=''){return `<div class="app-header"><button class="go-back" data-action="home" aria-label="Accueil">${icon('back')}</button><div class="app-header-title">${esc(title)}${sub?`<span class="app-header-subtitle">${esc(sub)}</span>`:''}</div>${action}</div>`;}
function page(title,body,sub='',action=''){return `<div class="app-view">${header(title,sub,action)}<div class="app-scroll">${body}</div></div>${statusBar(true)}${indicator()}`;}
function empty(emoji,title,desc){return `<div class="empty"><span class="large">${emoji}</span><b>${esc(title)}</b><p>${esc(desc)}</p></div>`;}
function appIcon(id,title,bg1,bg2,ico,badge='',emoji=false){return `<button class="app-tile" data-action="open" data-view="${esc(id)}"><span class="app-icon" style="--bg1:${bg1};--bg2:${bg2}">${emoji?`<span class="emoji">${ico}</span>`:icon(ico)}${badge?`<span class="count">${badge}</span>`:''}</span><span class="app-name">${esc(title)}</span></button>`;}
function section(title){return `<div class="section-label">${esc(title)}</div>`;}
function field(label,name,opts={}){
 const type=opts.type||'text',placeholder=opts.placeholder||'',required=opts.required===false?'':'required',value=opts.value??'';
 if(opts.select){return `<label class="field"><span class="field-label">${esc(label)}</span><select name="${esc(name)}" ${required}>${opts.select.map(o=>`<option value="${esc(o)}" ${o===value?'selected':''}>${esc(o)}</option>`).join('')}</select></label>`;}
 if(opts.textarea)return `<label class="field"><span class="field-label">${esc(label)}</span><textarea name="${esc(name)}" placeholder="${esc(placeholder)}" maxlength="${opts.max||1000}" ${required}>${esc(value)}</textarea></label>`;
 return `<label class="field"><span class="field-label">${esc(label)}</span><input name="${esc(name)}" type="${type}" placeholder="${esc(placeholder)}" maxlength="${opts.max||100}" ${opts.min?`min="${opts.min}"`:''} ${opts.maxNum?`max="${opts.maxNum}"`:''} value="${esc(value)}" ${required} ${opts.autocomplete?`autocomplete="${esc(opts.autocomplete)}"`:'autocomplete="off"'} /></label>`;
}
function renderAuth(){let html='';
 if(S.gateStep==='code')html=`<div class="auth-logo">LS<span>.</span></div><span class="auth-kicker">LOS SANTOS NETWORK</span><h1 class="auth-title">Ton RP.<br>Ton téléphone.</h1><p class="auth-lead">Tout l’univers de Los Santos, même sans Discord. Entre le code d’accès pour activer ton téléphone RP.</p><form class="auth-card" data-form="access"><h2>Déverrouiller le téléphone</h2><p>Saisis le code à 4 chiffres donné par le serveur.</p>${field('Code d’accès','code',{type:'password',placeholder:'••••',max:4})}<button class="primary-btn" style="margin-top:15px">Continuer ${icon('arrow')}</button></form><div class="auth-bottom">LOS SANTOS • RÉSEAU PRIVÉ</div>`;
 if(S.gateStep==='choice')html=`<div class="auth-logo">LS<span>.</span></div><span class="auth-kicker">VOTRE IDENTITÉ RP</span><h1 class="auth-title">Bienvenue à<br>Los Santos.</h1><p class="auth-lead">Crée ton identité RP ou retrouve ton téléphone existant. Ton numéro te suivra à chaque connexion.</p><div class="auth-card"><h2>Comment veux-tu commencer ?</h2><p>Ton aventure commence ici.</p><button class="primary-btn" data-action="authStep" data-step="register">Créer mon personnage ${icon('arrow')}</button><button class="btn-light" data-action="authStep" data-step="login" style="width:100%;margin-top:11px">J’ai déjà un téléphone</button></div><div class="auth-bottom">Tu rejoins l’univers de Los Santos RP.</div>`;
 if(S.gateStep==='register')html=`<span class="auth-kicker">NOUVEL HABITANT</span><h1 class="auth-title">Crée ton<br>personnage.</h1><p class="auth-lead">Ces informations serviront à ton identité sur le serveur.</p><form class="auth-card stack" data-form="register"><h2>Fiche du personnage</h2>${field('Nom et prénom RP','rp_name',{placeholder:'Ex. Alex Moretti',max:50})}<div class="card-row">${field('Âge RP','age',{type:'number',placeholder:'25',min:10,maxNum:120})}${field('Genre','gender',{select:['Masculin','Féminin','Autre']})}</div>${field('Description du personnage','bio',{textarea:true,placeholder:'Apparence, personnalité, histoire…',max:1000})}${field('Expérience RP précédente','experience',{textarea:true,placeholder:'Débutant ou expériences sur d’autres RP…',max:600})}${field('Pseudo PlayStation / joueur','gamertag',{placeholder:'Ex. azerti',max:45})}${field('Ton code PIN personnel','pin',{type:'password',placeholder:'4 à 10 chiffres',max:10})}<p class="form-note">Garde ton PIN pour te reconnecter avec le numéro attribué. Les messages RP peuvent être consultés par la modération.</p><button class="primary-btn">Créer mon téléphone ${icon('arrow')}</button><div class="auth-bottom"><button type="button" data-action="authStep" data-step="choice">Retour</button></div></form>`;
 if(S.gateStep==='login')html=`<span class="auth-kicker">RETOUR À LOS SANTOS</span><h1 class="auth-title">Content de<br>te revoir.</h1><p class="auth-lead">Récupère ton téléphone, tes messages et ton argent avec ton numéro et ton PIN personnel.</p><form class="auth-card stack" data-form="login"><h2>Connexion</h2>${field('Numéro de téléphone','phone',{placeholder:'555-0100',max:12})}${field('Code PIN personnel','pin',{type:'password',placeholder:'Ton code secret',max:10})}<button class="primary-btn">Ouvrir mon téléphone ${icon('arrow')}</button><div class="auth-bottom"><button type="button" data-action="authStep" data-step="choice">Retour</button></div></form>`;
 app.innerHTML=`<div class="auth-screen"><div class="auth-pattern"></div><div class="auth-content">${html}</div></div>${statusBar()}${indicator(false)}`;
}
function renderIntro(){let name=esc(S.user?.rp_name||'Citoyen');app.innerHTML=`<div class="intro-screen"><div class="intro-badge"><div class="intro-inner"><span class="star">★</span><small>LOS SANTOS</small><small>POLICE DEPARTMENT</small></div></div><div class="intro-hello">VILLE DE LOS SANTOS</div><h1 class="intro-title">BIENVENUE<br>À LOS SANTOS</h1><div class="intro-name">${name}</div><div class="intro-num">${esc(S.user?.phone)}</div><p class="xs" style="margin-top:21px;color:#b1bfd1">Ton numéro personnel vient d’être activé.</p><div class="intro-loading"></div></div>${statusBar()}${indicator(false)}`;}
function renderHome(){let wallpaper=S.settings.wallpaper||'violet';const greeting=S.user?.rp_name?.split(' ')[0]||'Citoyen';let unread=(S.cache.conversations||[]).reduce((a,c)=>a+Number(c.unread||0),0);
 let custom=(S.cache.store?.apps||[]).slice(0,12).map(a=>appIcon('custom:'+a.id,a.name,'#4671ae','#8c5cdd','globe')).join('');
 app.innerHTML=`<div class="wallpaper ${esc(wallpaper)}"></div><div class="home-content"><div class="home-greeting"><div class="eyebrow">LOS SANTOS • RP CITY</div><h1>Salut, ${esc(greeting)} <span style="font-size:23px">✌️</span></h1><p>Ton aventure continue. Fais comme chez toi.</p></div><div class="weather-widget"><div><strong>Los Santos</strong><small>Réseau RP connecté <span style="color:#80f4c7">●</span></small></div><div class="widget-right"><div class="big">LS</div><small>${esc(S.user?.phone)}</small></div></div><div class="app-grid">${appIcon('bank','Maze Bank','#24687c','#113f51','bank')}${appIcon('jobs','Pôle Emploi','#3475ed','#134db7','briefcase')}${appIcon('store','App Store','#4789fa','#9763ff','store')}${appIcon('contacts','Contacts','#c2a8ff','#795cdc','users')}${appIcon('photos','Photos','#ff8cb4','#d7588b','image')}${appIcon('camera','Appareil photo','#778197','#444b69','camera')}${appIcon('settings','Réglages','#7b879b','#333e5c','settings')}${appIcon('mod','Modération','#3a3c54','#191a35','shield')}${custom}</div></div><div class="dock">${appIcon('phone','Téléphone','#55e6a0','#23b26e','phone')}${appIcon('messages','Messages','#52d5a8','#29a178','message',unread>0?Math.min(unread,99):'')}${appIcon('contacts','Contacts','#bea5ff','#7d5de8','users')}${appIcon('store','App Store','#65acff','#7263e7','store')}</div>${statusBar()}${indicator(false)}`;
}
function renderContacts(){let c=S.cache.contacts||[];return page('Contacts',`${section('Mon répertoire')}<form class="form-panel stack" data-form="contact"><h3 style="margin:0;font-size:14px">Ajouter un contact</h3>${field('Nom du contact','label',{placeholder:'Ex. Sam le mécano',max:50})}${field('Numéro Los Santos','phone',{placeholder:'555-0101',max:12})}<button class="primary-btn">Enregistrer le contact</button></form>${section('Contacts enregistrés • '+c.length)}${c.length?c.map(o=>`<div class="list-row"><div class="avatar">${esc(initials(o.label))}</div><div class="list-text"><strong>${esc(o.label)}</strong><small class="phone-number">${esc(o.phone)}</small></div><button class="list-action" data-action="chatWith" data-phone="${esc(o.phone)}" aria-label="Message">${icon('message')}</button><button class="list-action" data-action="call" data-phone="${esc(o.phone)}" aria-label="Appeler">${icon('phone')}</button><button class="list-action" data-action="deleteContact" data-id="${o.id}" aria-label="Supprimer">${icon('trash')}</button></div>`).join(''):empty('👥','Ton répertoire est vide','Ajoute le numéro d’un joueur pour le contacter.')}`);}
function renderMessages(){let c=S.cache.conversations||[];return page('Messages',`${section('Discussions')}<button class="primary-btn" style="width:100%;margin-bottom:17px" data-action="newMessage">${icon('add')} Nouvelle conversation</button>${c.length?c.map(x=>`<button class="list-row" data-action="chatWith" data-phone="${esc(x.phone)}"><div class="avatar green">${esc(initials(contactLabel(x.phone,x.rp_name)))}</div><div class="list-text"><strong>${esc(contactLabel(x.phone,x.rp_name))}</strong><small>${x.mine?'Vous : ':''}${esc(x.last_text)}</small></div><div style="text-align:right;flex:none"><div class="xs muted">${esc(dateText(x.last_time))}</div>${x.unread?`<div class="unread-dot" style="float:right;margin-top:7px">${x.unread}</div>`:''}</div></button>`).join(''):empty('💬','Aucun message','Commence une conversation en saisissant un numéro RP.')}`);}
function renderChat(){let thread=S.cache.thread||{messages:[],person:{phone:S.phone,rp_name:S.phone}};const person=thread.person;const messages=thread.messages||[];
 app.innerHTML=`<div class="app-view">${header(contactLabel(person.phone,person.rp_name),person.phone,`<button class="app-header-action" data-action="call" data-phone="${esc(person.phone)}">${icon('phone')}</button>`)}<div class="chat-area"><div class="chat-messages" id="chatMessages"><div class="chat-date">Messages privés • conversations RP modérables</div>${messages.map(m=>`<div class="bubble-row ${m.sender_id===S.user.id?'mine':''}"><div class="bubble">${esc(m.body).replace(/\n/g,'<br>')}<span class="bubble-time">${esc(dateText(m.created_at))}</span></div></div>`).join('')||empty('💬','À toi de jouer','Envoie le premier message.')}</div><form class="chat-compose" data-form="message"><input name="body" autocomplete="off" maxlength="1200" placeholder="Écrire un message…" required aria-label="Nouveau message"><button class="send-btn" aria-label="Envoyer">${icon('send')}</button></form></div></div>${statusBar(true)}${indicator()}`;
 requestAnimationFrame(()=>{let container=$('#chatMessages');if(container)container.scrollTop=container.scrollHeight;});
}
function renderDialer(){let c=S.cache.calls||[];let numbers=['1','2','3','4','5','6','7','8','9','*','0','#'];let subs=['','ABC','DEF','GHI','JKL','MNO','PQRS','TUV','WXYZ','','+',''];return page('Téléphone',`<input id="dialInput" class="dial-input" value="${esc(S.dial)}" inputmode="tel" placeholder="Numéro" maxlength="12" aria-label="Numéro à appeler"><div class="dial-sub">Appelle un numéro RP : 555-0100</div><div class="dial-pad">${numbers.map((x,i)=>`<button class="dial-key" data-action="digit" data-digit="${x}">${x}<span>${subs[i]}</span></button>`).join('')}</div><div class="dial-actions"><button class="round-back" data-action="erase" aria-label="Effacer">${icon('back')}</button><button class="round-call" data-action="callDial" aria-label="Appeler">${icon('phone')}</button><button class="round-back" data-action="newContact" aria-label="Ajouter contact">${icon('users')}</button></div>${section('Appels récents')}${c.length?c.map(r=>{let incoming=r.callee_id===S.user.id;let phone=incoming?r.caller_phone:r.callee_phone;let name=incoming?r.caller_name:r.callee_name;return `<button class="list-row" data-action="call" data-phone="${esc(phone)}"><div class="avatar">${incoming?'↙':'↗'}</div><div class="list-text"><strong>${esc(contactLabel(phone,name))}</strong><small>${incoming?'Entrant':'Sortant'} • ${esc(r.status)} • ${esc(dateText(r.started_at))}</small></div><span class="xs muted">${icon('phone')}</span></button>`;}).join(''):empty('📞','Pas encore d’appel','Les appels récents apparaîtront ici.')}`);}
function renderBank(){const data=S.cache.bank||{balance:S.user.balance,transactions:[]};let txs=data.transactions||[];return page('Maze Bank',`<div class="bank-hero"><div class="bank-wordmark">MAZE<span> BANK</span> <small style="font-size:8px;opacity:.6">LOS SANTOS</small></div><div class="bank-label">SOLDE DISPONIBLE</div><div class="bank-balance">${money(data.balance)}</div><div class="bank-number">COMPTE RP • ${esc(S.user.phone)}</div></div><form class="form-panel stack" data-form="transfer"><h3 style="font-size:15px;margin:0">Effectuer un virement</h3>${field('Numéro du destinataire','phone',{placeholder:'555-0101',max:12})}${field('Montant en $','amount',{type:'number',min:1,placeholder:'Ex. 250'})}${field('Motif (facultatif)','memo',{placeholder:'Achat d’un véhicule…',required:false,max:100})}<button class="primary-btn">Envoyer le virement ${icon('arrow')}</button></form>${section('Historique bancaire')}${txs.length?`<div class="card">${txs.map(t=>{let plus=t.to_id===S.user.id && t.from_id!==S.user.id;let side=plus?(t.sender_name||'Modération'):(t.receiver_name||'Modération');return `<div class="transaction"><span class="tx-icon">${icon(plus?'add':'arrow')}</span><span style="flex:1;min-width:0"><strong>${esc(t.memo||'Virement')}</strong><small>${esc(side)} • ${esc(dateText(t.created_at))}</small></span><span class="amount ${plus?'plus':''}">${plus?'+':'−'}${money(t.amount)}</span></div>`}).join('')}</div>`:empty('💳','Aucune opération','Tes transferts et crédits s’afficheront ici.')}`);}
function renderJobs(){let d=S.cache.jobs||{jobs:[],requests:[],current:'Sans emploi'};let pending=d.requests?.find(r=>r.status==='pending');return page('Pôle Emploi',`<div class="job-banner"><small>LOS SANTOS • SERVICE PUBLIC</small><h2>Trouve ta voie dans la ville.</h2><p>Métier actuel : <b>${esc(d.current)}</b></p></div>${pending?`<div class="card" style="border-color:#f2da91"><b class="small">⏳ Candidature en attente</b><p>${esc(pending.job)} • validation par la modération</p></div>`:''}${section('Offres disponibles')}${d.jobs.map(j=>`<div class="card job-card"><div class="job-icon">${JOB_ICONS[j.name]||'💼'}</div><div class="job-data"><strong>${esc(j.name)}</strong><small>Rémunération RP : <span class="salary">${money(j.salary)} / service*</span></small></div><button class="primary-btn small-btn" data-action="applyJob" data-job="${esc(j.name)}" ${pending?'disabled':''}>Postuler</button></div>`).join('')}<p class="form-note">*Salaires indicatifs pour le roleplay. Les paiements ne sont pas automatisés : la modération gère les salaires. Les candidatures doivent être validées.</p>${section('Mes candidatures')}${(d.requests||[]).length?d.requests.map(r=>`<div class="card card-row"><b class="small">${esc(r.job)}</b><span class="status-tag ${r.status}">${r.status==='pending'?'En attente':r.status==='approved'?'Acceptée':'Refusée'}</span></div>`).join(''):empty('🧾','Aucune candidature','Choisis un métier et postule.')}`);}
function renderStore(){let d=S.cache.store||{apps:[],requests:[]};return page('App Store',`<div class="store-banner">${icon('store')}<div><h2>App Store RP</h2><p>Imagine les prochaines applications de ton serveur.</p></div></div>${section('Applications disponibles')}<div class="card"><div class="card-row"><span class="avatar">LS</span><div style="flex:1"><b class="small">Applications officielles</b><p style="margin:3px 0">Messages, téléphone, banque, emplois…</p></div><span class="pill ok">Installées</span></div></div>${(d.apps||[]).map(a=>`<div class="card card-row"><div class="avatar green">${icon('globe')}</div><div style="flex:1;min-width:0"><b class="small">${esc(a.name)}</b><p>${esc(a.description)}</p></div><button class="btn-light" data-action="open" data-view="custom:${a.id}">Ouvrir</button></div>`).join('')}${section('Proposer une nouvelle appli')}<form class="form-panel stack" data-form="appRequest">${field('Nom de ton application','name',{placeholder:'Ex. Weazel News',max:45})}${field('Ce que cette appli doit faire','description',{textarea:true,placeholder:'Décris ses fonctionnalités et son utilité en RP…',max:500})}<button class="primary-btn">Envoyer ma proposition</button></form>${section('Mes demandes')}${d.requests?.length?d.requests.map(r=>`<div class="card card-row"><div style="flex:1"><b class="small">${esc(r.name)}</b><p>${esc(r.description)}</p></div><span class="status-tag ${r.status}">${r.status==='pending'?'En attente':r.status==='approved'?'Publiée':'Refusée'}</span></div>`).join(''):empty('✨','Pas encore de demande','Les idées validées apparaîtront sur les téléphones RP.')}`);}
function renderPhotos(){let p=S.cache.photos||[];return page('Photos',`<div class="photo-tools"><div><h3 style="margin:4px 0;font-size:17px">Ma galerie</h3><small class="muted">${p.length} photo${p.length>1?'s':''} privée${p.length>1?'s':''}</small></div><label class="primary-btn photo-upload">${icon('add')} Importer<input id="photoFile" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Importer une photo"></label></div>${p.length?`<div class="photo-grid">${p.map(x=>`<button class="photo-tile" data-action="openPhoto" data-id="${x.id}"><img data-photo="${x.id}" src="${esc(S.photoUrls[x.id]||'')}" loading="lazy" alt="Photo RP du ${esc(dateText(x.created_at))}"></button>`).join('')}</div>`:empty('📸','Ta galerie est vide','Prends une photo ou importe une image depuis ton appareil.')}<p class="form-note" style="margin-top:17px">Les photos sont personnelles. Elles sont enregistrées sur le serveur et non visibles par les autres joueurs.</p>`);}
function renderCamera(){return page('Appareil photo',`<div style="background:linear-gradient(160deg,#171729,#47405e);border-radius:23px;min-height:330px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;text-align:center;padding:25px">${icon('camera')}<h2 style="font-size:20px;margin:17px 0 4px">Capture ton RP.</h2><p style="color:#c5c1dc;font-size:12px;line-height:1.6">Prends une photo avec ton téléphone réel. Elle sera enregistrée dans ta galerie Los Santos.</p><label class="primary-btn photo-upload" style="margin-top:15px">Ouvrir l’appareil photo<input id="photoFile" type="file" accept="image/*" capture="environment" aria-label="Prendre une photo"></label></div><button class="btn-light" style="width:100%;margin-top:15px" data-action="open" data-view="photos">Voir la galerie</button>`);}
function renderSettings(){let cfg=S.settings;return page('Réglages',`${section('Mon identité RP')}<div class="card card-row"><div class="avatar dark">${esc(initials(S.user.rp_name))}</div><div style="flex:1"><b>${esc(S.user.rp_name)}</b><p class="phone-number">${esc(S.user.phone)}</p><span class="xs muted">${esc(S.user.gamertag)} • ${esc(S.user.job)}</span></div></div>${section('Notifications et sonneries')}<div class="card"><div class="setting-row"><div class="setting-icon">${icon('bell')}</div><div class="info"><strong>Notifications</strong><small>Messages et appels pendant la connexion</small></div><label class="switch"><input id="settingNotify" type="checkbox" ${cfg.notifications?'checked':''}><span class="track"></span></label></div><div class="setting-row"><div class="setting-icon">${icon('music')}</div><div class="info"><strong>Sons</strong><small>Activer les sonneries RP</small></div><label class="switch"><input id="settingSounds" type="checkbox" ${cfg.sounds?'checked':''}><span class="track"></span></label></div><div class="setting-row"><div class="setting-icon">${icon('phone')}</div><div class="info"><strong>Sonnerie</strong><small>Choisis ta mélodie</small></div><select id="settingRingtone" class="field-input" style="width:120px;font-size:12px;padding:8px"><option ${cfg.ringtone==='Neon'?'selected':''}>Neon</option><option ${cfg.ringtone==='Classique'?'selected':''}>Classique</option><option ${cfg.ringtone==='Pulse'?'selected':''}>Pulse</option><option ${cfg.ringtone==='Calme'?'selected':''}>Calme</option></select></div><button class="btn-light" data-action="previewRingtone" style="margin:12px 0 2px">${icon('music')} Écouter la sonnerie</button></div>${section('Fond d’écran')}<div class="card"><div class="wallpapers">${['violet','sunset','ocean','midnight'].map(c=>`<button class="wallpaper-option ${c} ${cfg.wallpaper===c?'selected':''}" data-action="wallpaper" data-wallpaper="${c}" aria-label="Fond d'écran ${c}"></button>`).join('')}</div></div>${section('Compte et sécurité')}<div class="card"><div class="setting-row"><div class="setting-icon">${icon('lock')}</div><div class="info"><strong>PIN personnel</strong><small>Conserve-le pour retrouver ton numéro.</small></div></div><div class="setting-row"><div class="setting-icon">${icon('shield')}</div><div class="info"><strong>Modération RP</strong><small>Les modérateurs autorisés peuvent consulter les messages et les journaux d’appels.</small></div></div></div><button class="btn-danger" style="width:100%;padding:14px;margin-top:8px" data-action="logout">${icon('logout')} Se déconnecter</button><p class="form-note" style="margin-top:16px;text-align:center">LOS SANTOS PHONE • VERSION 1.0</p>`);}
function renderCustom(){let id=Number(S.view.split(':')[1]);let a=(S.cache.store?.apps||[]).find(x=>x.id===id);if(!a)return page('Application',empty('📱','Application introuvable','Retourne sur l’App Store.'));
 return page(a.name,`<div style="margin:35px 0 25px;text-align:center"><div class="avatar" style="height:100px;width:100px;border-radius:24px;margin:auto;background:linear-gradient(130deg,#5474c9,#b370e6);color:white">${icon('globe')}</div><h2>${esc(a.name)}</h2></div><div class="card"><h3>À propos de cette application</h3><p>${esc(a.description)}</p></div><div class="card" style="background:#f2efff"><b class="small" style="color:#684fc1">📱 Application approuvée</b><p>Cette application a été ajoutée par la modération. Ses fonctions personnalisées pourront être développées dans une prochaine version.</p></div>`);}
function renderMod(){if(!S.mod)return page('Modération',`<div class="mod-lock"><div class="lock-icon">${icon('shield')}</div><h2>Espace modérateur</h2><p>Contrôle des joueurs, soldes, candidatures, demandes d’applications et historiques RP.</p><form class="stack" data-form="modUnlock" style="margin-top:25px">${field('Code modérateur','code',{type:'password',placeholder:'Code administrateur',max:30})}<button class="primary-btn">Déverrouiller les outils</button></form><p class="form-note" style="margin-top:17px">L’accès est contrôlé sur le serveur. Toutes les actions sensibles sont historisées.</p></div>`);
 let tabs=[['players','Joueurs'],['messages','Messages'],['calls','Appels'],['jobs','Emplois'],['apps','Applis'],['audit','Journal']];let d=S.cache.mod||{};
 let output='';
 if(S.tab==='players'){let players=(d.players||[]).filter(p=>(p.rp_name+' '+p.phone+' '+p.gamertag).toLowerCase().includes(S.search.toLowerCase()));output=`<input class="search" id="modSearch" placeholder="Rechercher nom, numéro ou pseudo…" value="${esc(S.search)}" aria-label="Rechercher joueur">${section(`${players.length} joueur(s)`)}${players.map(p=>`<div class="card mod-card"><div class="card-row"><div class="avatar ${p.banned?'':'dark'}">${esc(initials(p.rp_name))}</div><div style="flex:1;min-width:0"><b class="small">${esc(p.rp_name)}</b><div class="xs muted">${esc(p.phone)} • ${esc(p.gamertag)}</div></div><span class="status-tag ${p.banned?'rejected':'approved'}">${p.banned?'Banni':'Actif'}</span></div><p>${esc(p.job)} • ${money(p.balance)} • ${p.age} ans RP</p><div class="mod-actions"><button class="btn-light" data-action="modMoney" data-id="${p.id}" data-name="${esc(p.rp_name)}">${icon('bank')} Ajuster l’argent</button><button class="${p.banned?'btn-outline':'btn-danger'}" data-action="modBan" data-id="${p.id}" data-banned="${p.banned?'false':'true'}" data-name="${esc(p.rp_name)}">${p.banned?'Débannir':'Bannir'}</button></div></div>`).join('')}`;}
 if(S.tab==='messages')output=`<div class="card" style="background:#f9f4ff"><b class="small">Confidentialité RP</b><p>Les joueurs sont informés à l’inscription que les modérateurs autorisés peuvent consulter les messages RP.</p></div>${section('Derniers messages échangés')}${(d.messages||[]).map(m=>`<div class="card mod-card"><div class="card-row"><b class="xs">${esc(m.sender_name)} → ${esc(m.receiver_name)}</b><span class="xs muted">${esc(dateText(m.created_at))}</span></div><div class="xs muted">${esc(m.sender_phone)} → ${esc(m.receiver_phone)}</div><div class="mod-quote">${esc(m.body)}</div></div>`).join('')||empty('💬','Aucun message','Les échanges RP apparaîtront ici.')}`;
 if(S.tab==='calls')output=`${section('Historique des appels')}${(d.calls||[]).map(c=>`<div class="card mod-card"><div class="card-row"><b class="small">${esc(c.caller_name)} → ${esc(c.callee_name)}</b><span class="pill">${esc(c.status)}</span></div><p>${esc(c.caller_phone)} → ${esc(c.callee_phone)}</p><span class="xs muted">${esc(dateText(c.started_at))}</span></div>`).join('')||empty('📞','Aucun appel','Les appels des joueurs seront journalisés.')}`;
 if(S.tab==='jobs')output=`${section('Candidatures')}${(d.requests?.jobs||[]).map(r=>`<div class="card mod-card"><div class="card-row"><b class="small">${esc(r.rp_name)}</b><span class="status-tag ${r.status}">${r.status==='pending'?'En attente':r.status==='approved'?'Acceptée':'Refusée'}</span></div><p>${esc(r.job)} • ${esc(r.phone)}</p>${r.status==='pending'?`<div class="mod-actions"><button class="primary-btn small-btn" data-action="jobDecision" data-id="${r.id}" data-decision="approved">Accepter</button><button class="btn-danger" data-action="jobDecision" data-id="${r.id}" data-decision="rejected">Refuser</button></div>`:''}</div>`).join('')||empty('💼','Aucune candidature','Les demandes de métiers apparaîtront ici.')}`;
 if(S.tab==='apps')output=`${section('Demandes App Store')}${(d.requests?.apps||[]).map(r=>`<div class="card mod-card"><div class="card-row"><b class="small">${esc(r.name)}</b><span class="status-tag ${r.status}">${r.status==='pending'?'En attente':r.status==='approved'?'Publiée':'Refusée'}</span></div><p>${esc(r.rp_name)} • ${esc(r.phone)}</p><div class="mod-quote">${esc(r.description)}</div>${r.status==='pending'?`<div class="mod-actions"><button class="primary-btn small-btn" data-action="appDecision" data-id="${r.id}" data-decision="approved">Publier</button><button class="btn-danger" data-action="appDecision" data-id="${r.id}" data-decision="rejected">Refuser</button></div>`:''}</div>`).join('')||empty('📱','Pas de demande','Les idées des joueurs apparaîtront ici.')}`;
 if(S.tab==='audit')output=`${section('Actions de modération')}${(d.requests?.actions||[]).map(a=>`<div class="card mod-card"><div class="card-row"><b class="small">${esc(a.action)}</b><span class="xs muted">${esc(dateText(a.created_at))}</span></div><p>Modérateur : ${esc(a.actor_name)} • Joueur ID : ${a.target_id||'—'}</p><div class="xs muted">${esc(a.detail)}</div></div>`).join('')||empty('🛡️','Aucune action','Les événements sensibles seront sauvegardés.')}`;
 return page('Modération',`<div class="subtabs">${tabs.map(([id,n])=>`<button class="subtab ${S.tab===id?'active':''}" data-action="modTab" data-tab="${id}">${n}</button>`).join('')}</div>${output}`,'OUTILS ADMINISTRATEUR',`<button class="app-header-action" data-action="modRefresh" aria-label="Actualiser">↻</button>`);
}
function renderOverlay(){if(S.call){let c=S.call;overlay.innerHTML=`<div class="call-overlay"><div class="call-avatar">${esc(initials(c.name))}</div><h2>${esc(c.name||'Numéro inconnu')}</h2><p class="phone-number">${esc(c.phone)}</p><div class="call-status">${c.phase==='incoming'?'Appel entrant…':c.phase==='dialing'?'Appel en cours…':c.phase==='connecting'?'Connexion audio…':'En communication'}</div><div class="call-buttons">${c.phase==='incoming'?`<div class="call-button-wrap"><button class="call-circle decline" data-action="hangup" aria-label="Refuser">${icon('phone')}</button><small>Refuser</small></div><div class="call-button-wrap"><button class="call-circle accept" data-action="acceptCall" aria-label="Décrocher">${icon('phone')}</button><small>Répondre</small></div>`:`<div class="call-button-wrap"><button class="call-circle decline" data-action="hangup" aria-label="Raccrocher">${icon('phone')}</button><small>Raccrocher</small></div>`}</div></div>`;return;}
 if(!S.dialog){overlay.innerHTML='';return;}
 let d=S.dialog;let content='';
 if(d.mode==='newMessage')content=`<form class="stack" data-form="newMessage">${field('Numéro de téléphone','phone',{placeholder:'555-0101',max:12})}<button class="primary-btn">Ouvrir la discussion</button></form>`;
 else if(d.mode==='money')content=`<form class="stack" data-form="modMoney"><p>Ajuster le solde du joueur <b>${esc(d.details.name)}</b>. Saisis un montant positif pour ajouter de l’argent ou négatif pour en retirer.</p>${field('Montant ($)','amount',{type:'number',placeholder:'Ex. 2000 ou -500'})}<button class="primary-btn">Appliquer l’ajustement</button></form>`;
 else if(d.mode==='photo'){content=`<img class="photo-full" src="${esc(S.photoUrls[d.details.id]||'')}" alt="Photo RP"><div class="dialog-actions"><button class="btn-danger" data-action="deletePhoto" data-id="${d.details.id}">${icon('trash')} Supprimer</button><button class="btn-light" data-action="closeDialog">Fermer</button></div>`;}
 else content=`<p>${esc(d.desc)}</p><div class="dialog-actions"><button class="btn-outline" data-action="closeDialog">Annuler</button><button class="primary-btn small-btn" data-action="confirmDialog">${esc(d.yesText||'Confirmer')}</button></div>`;
 overlay.innerHTML=`<div class="dialog-mask" data-action="mask"><div class="dialog" role="dialog" aria-modal="true" aria-label="${esc(d.title)}"><h3>${esc(d.title)}</h3>${content}</div></div>`;
}
function render(){if(S.loading){setLoading();return;}
 if(!S.user){renderAuth();return;}
 if(S.bootUser){renderIntro();return;}
 if(S.view==='home'){renderHome();renderOverlay();return;}
 let html='';
 switch(S.view){case 'contacts':html=renderContacts();break;case 'messages':html=renderMessages();break;
 case 'chat':renderChat();renderOverlay();return;
 case 'phone':html=renderDialer();break;case 'bank':html=renderBank();break;case 'jobs':html=renderJobs();break;
 case 'store':html=renderStore();break;case 'photos':html=renderPhotos();break;case 'camera':html=renderCamera();break;
 case 'settings':html=renderSettings();break;case 'mod':html=renderMod();break;
 default:html=renderCustom();}
 app.innerHTML=html;renderOverlay();if(S.view==='photos')hydratePhotos();}
async function load(view){
 if(view==='home'){const [store,conversations,contacts]=await Promise.all([api('/store'),api('/conversations'),api('/contacts')]);Object.assign(S.cache,{store,conversations,contacts});}
 else if(view==='messages')S.cache.conversations=await api('/conversations');
 else if(view==='chat'){S.cache.thread=await api('/messages/'+encodeURIComponent(S.phone));S.cache.conversations=await api('/conversations');}
 else if(view==='phone')S.cache.calls=await api('/calls');
 else if(view==='contacts')S.cache.contacts=await api('/contacts');
 else if(view==='bank')S.cache.bank=await api('/bank');
 else if(view==='jobs')S.cache.jobs=await api('/jobs');
 else if(view==='store'||view.startsWith('custom:'))S.cache.store=await api('/store');
 else if(view==='photos')S.cache.photos=await api('/photos');
 else if(view==='mod'&&S.mod)await loadMod();
}
async function loadMod(){let d=S.cache.mod||{};
 if(S.tab==='players')d.players=await api('/mod/players');
 else if(S.tab==='messages')d.messages=await api('/mod/messages');
 else if(S.tab==='calls')d.calls=await api('/mod/calls');
 else if(['jobs','apps','audit'].includes(S.tab))d.requests=await api('/mod/requests');
 S.cache.mod=d;
}
async function open(view,params={}){if(!S.user)return;S.view=view;if(params.phone)S.phone=params.phone;try{await load(view);render();}catch(e){fail(e);render();}}
async function refreshMe(){let me=await api('/me');S.user=me.user;S.settings=me.settings;S.mod=me.moderator;}
function logoutLocal(){clearRing();cleanCall();if(S.ws){try{S.ws.close();}catch{}S.ws=null;}localStorage.removeItem('ls_token');S.token='';S.user=null;S.mod=false;S.entryCode='';S.cache={};S.gateStep='code';S.view='home';S.dialog=null;S.loading=false;render();}
async function logout(){try{await api('/logout',{method:'POST'});}catch{}logoutLocal();}
function startIntro(){S.bootUser=true;render();setTimeout(async()=>{S.bootUser=false;try{await load('home');}catch(e){fail(e);}render();},2800);}
async function hydratePhotos(){for(const p of S.cache.photos||[]){if(!S.photoUrls[p.id]){try{const blob=await api('/photos/'+p.id+'/file',{raw:true});S.photoUrls[p.id]=URL.createObjectURL(blob);}catch(e){console.warn(e);}}
 const im=$(`img[data-photo="${p.id}"]`);if(im&&S.photoUrls[p.id])im.src=S.photoUrls[p.id];}}
function browserAlert(title,body){if(!S.settings.notifications)return;toast(title+' — '+body);
 if('Notification' in window&&Notification.permission==='granted'&&document.visibilityState!=='visible'){
  try{new Notification(title,{body,icon:'/static/icon.svg',tag:'ls-rp-notif'});}catch{} }
 if(S.settings.sounds)playTune(false);
}
let audioCtx;
function tone(freq,time,dur=.12,vol=.06){try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type='sine';osc.frequency.setValueAtTime(freq,audioCtx.currentTime+time);gain.gain.setValueAtTime(.001,audioCtx.currentTime+time);gain.gain.exponentialRampToValueAtTime(vol,audioCtx.currentTime+time+.012);gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+time+dur);osc.connect(gain);gain.connect(audioCtx.destination);osc.start(audioCtx.currentTime+time);osc.stop(audioCtx.currentTime+time+dur+.02);}catch(e){console.warn('Son indisponible',e);}}
function playTune(call=false){if(!S.settings.sounds)return;let mode=S.settings.ringtone||'Neon';let notes=mode==='Classique'?[660,880,660,880]:mode==='Pulse'?[530,530,790,790]:mode==='Calme'?[440,530,660]:[740,940,1110,940];let step=call?.19:.095;notes.slice(0,call?4:2).forEach((n,i)=>tone(n,i*step,call?.16:.08,call?.055:.038));}
function startRing(){clearRing();playTune(true);S.ringing=setInterval(()=>playTune(true),1900);}
function clearRing(){if(S.ringing){clearInterval(S.ringing);S.ringing=null;}}
function connectWS(){if(!S.token)return;if(S.ws){try{S.ws.close();}catch{}}
 const proto=location.protocol==='https:'?'wss:':'ws:';
 let socket=new WebSocket(proto+'//'+location.host+'/ws?token='+encodeURIComponent(S.token));S.ws=socket;
 socket.onmessage=async ev=>{try{await onRealtime(JSON.parse(ev.data));}catch(e){console.error(e);}};
 socket.onclose=()=>{if(S.ws!==socket||!S.user)return;S.ws=null;setTimeout(()=>{if(S.user&&S.token&&!S.ws)connectWS();},2300);};
}
async function onRealtime(e){if(e.type==='account:banned'){toast('Ton compte a été banni.',true);logoutLocal();return;}
 if(e.type==='message:new'){
  if(e.from!==S.user.phone)browserAlert('Message de '+e.from_name,e.body.substring(0,90));
  if(S.view==='chat'&&(S.phone===e.from||S.phone===e.to))await load('chat');
  else if(['messages','home'].includes(S.view))await load(S.view);
  render();return;
 }
 if(e.type==='call:incoming'){
  if(S.call){try{await api('/calls/'+e.call_id+'/reject',{method:'POST'});}catch{}return;}
  S.call={id:e.call_id,phone:e.from,name:e.from_name,phase:'incoming',direction:'incoming',pc:null,stream:null};startRing();renderOverlay();
  if(S.settings.notifications)browserAlert('Appel entrant',e.from_name+' • '+e.from);return;
 }
 if(e.type==='call:accepted'&&S.call&&e.call_id===S.call.id){clearRing();S.call.phase='connecting';renderOverlay();
  if(S.call.direction==='outgoing'){try{setupPeer();let offer=await S.call.pc.createOffer();await S.call.pc.setLocalDescription(offer);sendSignal('offer',offer);}catch(err){fail(err);await endCall(true);}}return;}
 if(['call:rejected','call:ended'].includes(e.type)&&S.call&&e.call_id===S.call.id){let msg=e.type==='call:rejected'?'Appel refusé.':'Appel terminé.';finishCall();toast(msg);if(S.view==='phone')open('phone');return;}
 if(e.type==='rtc:signal'&&S.call&&e.call_id===S.call.id){await handleRTC(e);return;}
 if(e.type==='bank:received')browserAlert('Maze Bank','Virement reçu : '+money(e.amount)+' de '+e.from);
 if(e.type==='bank:adjusted')browserAlert('Maze Bank','Solde ajusté : '+(e.amount>0?'+':'')+money(e.amount));
 if(e.type==='job:decision')browserAlert('Pôle Emploi',e.job+' : '+(e.decision==='approved'?'candidature acceptée !':'candidature refusée.'));
 if(e.type==='app:decision')browserAlert('App Store',e.name+' : '+(e.decision==='approved'?'application publiée !':'demande refusée.'));
 if(e.type==='store:changed'&&(S.view==='home'||S.view==='store')){await load(S.view);render();return;}
 if(e.type==='data:changed'||e.type==='bank:received'||e.type==='bank:adjusted'||e.type==='job:decision'){
  try{await refreshMe();if(['bank','jobs','home'].includes(S.view))await load(S.view);render();}catch(err){console.warn(err);}}
 if(e.type==='mod:changed'&&S.view==='mod'&&S.mod){await loadMod();render();}
}
function sendSignal(type,data){if(S.ws?.readyState===WebSocket.OPEN&&S.call)S.ws.send(JSON.stringify({type:'rtc:signal',signal_type:type,call_id:S.call.id,data}));}
function setupPeer(){if(!S.call)throw Error('Appel interrompu.');if(S.call.pc)return;
 const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]});S.call.pc=pc;
 for(const track of S.call.stream.getTracks())pc.addTrack(track,S.call.stream);
 pc.onicecandidate=e=>{if(e.candidate)sendSignal('ice',e.candidate.toJSON());};
 pc.ontrack=e=>{let audio=$('#remoteAudio');audio.srcObject=e.streams[0];audio.play().catch(()=>{});};
 pc.onconnectionstatechange=()=>{if(pc.connectionState==='connected'&&S.call){S.call.phase='active';renderOverlay();}if(pc.connectionState==='failed'&&S.call)endCall(true);};
}
async function handleRTC(e){if(!S.call)return;try{
 if(!S.call.pc)setupPeer();let pc=S.call.pc;
 if(e.signal_type==='offer'){await pc.setRemoteDescription(new RTCSessionDescription(e.data));let ans=await pc.createAnswer();await pc.setLocalDescription(ans);sendSignal('answer',ans);}
 else if(e.signal_type==='answer')await pc.setRemoteDescription(new RTCSessionDescription(e.data));
 else if(e.signal_type==='ice'){if(pc.remoteDescription)await pc.addIceCandidate(new RTCIceCandidate(e.data));else (S.call.pendingIce??=[]).push(e.data);}
 if(pc.remoteDescription&&S.call.pendingIce?.length){for(let ice of S.call.pendingIce)await pc.addIceCandidate(new RTCIceCandidate(ice));S.call.pendingIce=[];}
 }catch(err){console.error('WebRTC',err);toast('Connexion audio difficile. Vérifie ton réseau.',true);}}
async function startCall(phone){if(S.call){toast('Un appel est déjà en cours.',true);return;}
 if(!navigator.mediaDevices?.getUserMedia){toast('Le micro nécessite un site HTTPS ou localhost.',true);return;}
 let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:true});}catch{toast('Autorise l’accès au microphone pour appeler.',true);return;}
 try{let response=await api('/calls',{method:'POST',body:{phone}});
  if(!response.online){stream.getTracks().forEach(t=>t.stop());toast('Ce joueur est hors ligne. Appel manqué.',true);if(S.view==='phone')await open('phone');return;}
  S.call={id:response.call_id,phone:response.phone,name:contactLabel(response.phone,response.rp_name),phase:'dialing',direction:'outgoing',stream,pc:null};startRing();renderOverlay();
 }catch(e){stream.getTracks().forEach(t=>t.stop());fail(e);}}
async function acceptCall(){if(!S.call||S.call.phase!=='incoming')return;
 try{if(!navigator.mediaDevices?.getUserMedia)throw Error('Le micro nécessite HTTPS.');
  S.call.stream=await navigator.mediaDevices.getUserMedia({audio:true});setupPeer();
  await api('/calls/'+S.call.id+'/accept',{method:'POST'});clearRing();S.call.phase='connecting';renderOverlay();
 }catch(e){fail(e);await endCall(true);}}
function cleanCall(){if(!S.call)return;try{S.call.pc?.close();}catch{}try{S.call.stream?.getTracks().forEach(t=>t.stop());}catch{}$('#remoteAudio').srcObject=null;S.call=null;}
function finishCall(){clearRing();cleanCall();renderOverlay();}
async function endCall(emit){if(!S.call)return;let c=S.call;finishCall();try{if(emit)await api('/calls/'+c.id+'/'+(c.phase==='incoming'?'reject':'end'),{method:'POST'});}catch(e){console.warn(e);}if(S.view==='phone')await open('phone');}
async function saveSetting(){const cfg=S.settings;try{await api('/settings',{method:'POST',body:cfg});}catch(e){fail(e);}}
async function handleForm(ev){let form=ev.target.closest('form[data-form]');if(!form)return;ev.preventDefault();let f=Object.fromEntries(new FormData(form));let name=form.dataset.form;let button=form.querySelector('button[type="submit"],button.primary-btn');if(button)button.disabled=true;
 try{
  if(name==='access'){await api('/entry',{method:'POST',body:{code:f.code}});S.entryCode=f.code;S.gateStep='choice';render();}
  if(name==='register'){const payload={...f,entry_code:S.entryCode};let r=await api('/register',{method:'POST',body:payload});S.token=r.token;localStorage.setItem('ls_token',S.token);S.user=r.user;await refreshMe();connectWS();startIntro();}
  if(name==='login'){let r=await api('/login',{method:'POST',body:f});S.token=r.token;localStorage.setItem('ls_token',S.token);S.user=r.user;await refreshMe();connectWS();startIntro();}
  if(name==='contact'){await api('/contacts',{method:'POST',body:f});toast('Contact enregistré.');await open('contacts');}
  if(name==='message'){let body=String(f.body||'').trim();if(!body)return;await api('/messages',{method:'POST',body:{phone:S.phone,body}});await open('chat',{phone:S.phone});}
  if(name==='newMessage'){let phone=String(f.phone||'').trim();let user=await api('/lookup/'+encodeURIComponent(phone));closeDialog();await open('chat',{phone:user.phone});}
  if(name==='transfer'){showConfirm('Confirmer le virement',`Envoyer ${money(f.amount)} à ${f.phone} ?`,'Envoyer','transfer',{...f});}
  if(name==='appRequest'){await api('/store/requests',{method:'POST',body:f});toast('Ta proposition a été envoyée.');await open('store');}
  if(name==='modUnlock'){await api('/mod/unlock',{method:'POST',body:f});S.mod=true;toast('Mode modérateur activé.');await open('mod');}
  if(name==='modMoney'){let d=S.dialog;await api('/mod/players/'+d.details.id+'/money',{method:'POST',body:{amount:Number(f.amount)}});closeDialog();toast('Solde du joueur mis à jour.');await open('mod');}
 }catch(e){fail(e);}finally{if(button)button.disabled=false;}
}
async function handleClick(ev){let b=ev.target.closest('[data-action]');if(!b||b.disabled)return;let a=b.dataset.action;
 if(a==='mask'&&ev.target===b){closeDialog();return;}
 try{
  if(a==='home'){if(S.user)await open('home');else if(S.gateStep!=='code'){S.gateStep='choice';render();}return;}
  if(a==='open'){await open(b.dataset.view);return;}
  if(a==='authStep'){S.gateStep=b.dataset.step;render();return;}
  if(a==='chatWith'){await open('chat',{phone:b.dataset.phone});return;}
  if(a==='call'){await startCall(b.dataset.phone);return;}
  if(a==='digit'){S.dial+=b.dataset.digit;if(S.dial.length>12)S.dial=S.dial.slice(0,12);let input=$('#dialInput');if(input)input.value=S.dial;return;}
  if(a==='erase'){S.dial=S.dial.slice(0,-1);let input=$('#dialInput');if(input)input.value=S.dial;return;}
  if(a==='callDial'){let val=$('#dialInput')?.value||S.dial;await startCall(val);return;}
  if(a==='newMessage'){S.dialog={mode:'newMessage',title:'Nouveau message'};renderOverlay();return;}
  if(a==='newContact'){await open('contacts');return;}
  if(a==='deleteContact'){showConfirm('Supprimer le contact','Retirer ce contact de ton répertoire ?','Supprimer','deleteContact',{id:Number(b.dataset.id)});return;}
  if(a==='applyJob'){showConfirm('Candidature Pôle Emploi','Postuler au métier de '+b.dataset.job+' ? La validation est faite par un modérateur.','Postuler','applyJob',{job:b.dataset.job});return;}
  if(a==='logout'){showConfirm('Se déconnecter','Tu pourras te reconnecter avec ton numéro et ton PIN personnel.','Déconnexion','logout');return;}
  if(a==='previewRingtone'){playTune(true);return;}
  if(a==='wallpaper'){S.settings.wallpaper=b.dataset.wallpaper;await saveSetting();render();return;}
  if(a==='modTab'){S.tab=b.dataset.tab;await open('mod');return;}
  if(a==='modRefresh'){await open('mod');toast('Données actualisées.');return;}
  if(a==='modMoney'){S.dialog={mode:'money',title:'Ajuster le solde',details:{id:Number(b.dataset.id),name:b.dataset.name}};renderOverlay();return;}
  if(a==='modBan'){showConfirm(b.dataset.banned==='true'?'Bannir ce joueur':'Débannir ce joueur',`${b.dataset.name} : cette action sera enregistrée dans le journal.`,b.dataset.banned==='true'?'Bannir':'Débannir','modBan',{id:Number(b.dataset.id),banned:b.dataset.banned==='true'});return;}
  if(a==='jobDecision'){await api('/mod/jobs/'+b.dataset.id+'/'+b.dataset.decision,{method:'POST'});toast('Candidature traitée.');await open('mod');return;}
  if(a==='appDecision'){await api('/mod/apps/'+b.dataset.id+'/'+b.dataset.decision,{method:'POST'});toast('Demande traitée.');await open('mod');return;}
  if(a==='openPhoto'){S.dialog={mode:'photo',title:'Photo RP',details:{id:Number(b.dataset.id)}};renderOverlay();return;}
  if(a==='deletePhoto'){showConfirm('Supprimer cette photo','La photo sera supprimée définitivement du serveur.','Supprimer','deletePhoto',{id:Number(b.dataset.id)});return;}
  if(a==='closeDialog'){closeDialog();return;}
  if(a==='confirmDialog'){let d=S.dialog;closeDialog();if(!d)return;
   if(d.yesAction==='transfer'){await api('/bank/transfer',{method:'POST',body:{...d.details,amount:Number(d.details.amount)}});toast('Virement envoyé !');await refreshMe();await open('bank');}
   if(d.yesAction==='deleteContact'){await api('/contacts/'+d.details.id,{method:'DELETE'});toast('Contact supprimé.');await open('contacts');}
   if(d.yesAction==='applyJob'){await api('/jobs',{method:'POST',body:{job:d.details.job}});toast('Candidature envoyée !');await open('jobs');}
   if(d.yesAction==='logout')await logout();
   if(d.yesAction==='modBan'){await api('/mod/players/'+d.details.id+'/ban',{method:'POST',body:{banned:d.details.banned}});toast('Statut du joueur modifié.');await open('mod');}
   if(d.yesAction==='deletePhoto'){await api('/photos/'+d.details.id,{method:'DELETE'});if(S.photoUrls[d.details.id])URL.revokeObjectURL(S.photoUrls[d.details.id]);delete S.photoUrls[d.details.id];toast('Photo supprimée.');await open('photos');}
   return;}
  if(a==='acceptCall'){await acceptCall();return;}
  if(a==='hangup'){await endCall(true);return;}
 }catch(e){fail(e);}
}
async function handleChange(ev){if(ev.target.id==='photoFile'){let file=ev.target.files?.[0];if(!file)return;if(file.size>6*1024*1024){toast('Fichier trop volumineux (6 Mo max).',true);return;}try{await api('/photos',{method:'POST',body:file,headers:{'Content-Type':file.type||'application/octet-stream'}});toast('Photo ajoutée à ta galerie.');await open('photos');}catch(e){fail(e);}return;}
 if(ev.target.id==='dialInput'){S.dial=ev.target.value;return;}
 if(['settingNotify','settingSounds','settingRingtone'].includes(ev.target.id)){
  S.settings.notifications=$('#settingNotify').checked?1:0;S.settings.sounds=$('#settingSounds').checked?1:0;S.settings.ringtone=$('#settingRingtone').value;await saveSetting();toast('Réglages enregistrés.');
  if(ev.target.id==='settingNotify'&&S.settings.notifications&&'Notification' in window&&Notification.permission==='default')Notification.requestPermission().catch(()=>{});
 }
}
app.addEventListener('click',handleClick);
overlay.addEventListener('click',handleClick);
app.addEventListener('submit',handleForm);
overlay.addEventListener('submit',handleForm);
app.addEventListener('change',handleChange);
app.addEventListener('input',ev=>{if(ev.target.id==='dialInput')S.dial=ev.target.value;
 if(ev.target.id==='modSearch'){S.search=ev.target.value;let el=ev.target;let start=el.selectionStart;render();let target=$('#modSearch');if(target){target.focus();target.setSelectionRange(start,start);}}});
setInterval(()=>{let clk=$('#clock');if(clk)clk.textContent=clock();},15000);
async function start(){try{
 if(S.token){await refreshMe();await load('home');connectWS();}
 }catch(e){console.warn('Session non récupérée',e);localStorage.removeItem('ls_token');S.token='';S.user=null;}
 S.loading=false;render();}
start();
