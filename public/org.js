// =====================================================================
// Organizasyon: eski Şampiyonlar Ligi usulü gruplar + eleme turları.
// Veriler Firebase (Firestore) üzerinde durur; herkes aynı organizasyonu görür.
// Yetki: organizasyonu kuran (kurucu) + yönetici şifresini girenler (yöneticiler) skor girer.
// Herkese açık organizasyonları herkes görür; kapalı olanlar için kod + izleme şifresi gerekir.
// Firestore kuralları: depo kökündeki firestore.rules
// =====================================================================
var FB={apiKey:"AIzaSyBH9GhNhHbjmjps5FySin10vAgWlifxVR8",projectId:"turnuva-fiksturu"};   // Firebase → Proje ayarları → Web uygulaması (apiKey, projectId)
var O=null,OM={},OPOLL=null;        // O: açık organizasyon, OM: id, rol, sunucu sürümü (ut), sahibi
DB.orgs=DB.orgs||{};DB.hid=DB.hid||{};   // hid: bu cihazda gizlenen (ya da bildirilen) açık organizasyonlar
var FIX=["id","org","ro","cf","fl","tab","da","pe","ha","hb"];
function fbOk(){return!!(FB.apiKey&&FB.projectId)}
function DOCS(){return"https://firestore.googleapis.com/v1/projects/"+FB.projectId+"/databases/(default)/documents"}
function DNAME(p){return"projects/"+FB.projectId+"/databases/(default)/documents"+p}
function jr(r){return r.text().then(function(t){var o={};try{o=t?JSON.parse(t):{}}catch(e){}if(!r.ok){var e=o.error||{};throw{st:r.status,code:e.status||"",msg:e.message||("HTTP "+r.status)}}return o})}
function myAuth(){try{return JSON.parse(localStorage.getItem("tf-auth")||"null")}catch(e){return null}}
function auth(){var a=myAuth();if(a&&a.tok&&a.exp>Date.now()+120000)return Promise.resolve(a);
  var p=a&&a.rt?fetch("https://securetoken.googleapis.com/v1/token?key="+FB.apiKey,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=refresh_token&refresh_token="+encodeURIComponent(a.rt)}).then(jr).then(function(r){return{uid:r.user_id,tok:r.id_token,rt:r.refresh_token,exp:Date.now()+(+r.expires_in)*1000,em:a.em||""}},
      function(e){if(a.em&&e&&e.st===400){setAuth(null);throw{st:401,msg:"Mail oturumun kapandı (şifre değişmiş olabilir). Organizasyon → Mail ile devam et'ten yeniden giriş yap."}}throw e})
    :idt("signUp",{returnSecureToken:true}).then(function(r){return tokOf(r,"")});
  return p.then(function(n){setAuth(n);return n})}
function setAuth(n){try{if(n)localStorage.setItem("tf-auth",JSON.stringify(n));else localStorage.removeItem("tf-auth")}catch(e){}if(window.ntSync)ntSync()}
function tokOf(r,em){return{uid:r.localId,tok:r.idToken,rt:r.refreshToken,exp:Date.now()+(+r.expiresIn||3600)*1000,em:em||""}}
// Firebase giriş servisi (identitytoolkit) çağrısı; e-postalar Türkçe gider
function idt(m,b){return fetch("https://identitytoolkit.googleapis.com/v1/accounts:"+m+"?key="+FB.apiKey,{method:"POST",headers:{"Content-Type":"application/json","X-Firebase-Locale":"tr"},body:JSON.stringify(b)}).then(jr)}
function myMail(){var a=myAuth();return a&&a.em||""}
function api(m,path,body,q){return auth().then(function(a){return fetch(DOCS()+path+(q?"?"+q:""),{method:m,headers:{"Authorization":"Bearer "+a.tok,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined})}).then(jr)}
function fv(o){var f={};for(var k in o){var v=o[k];f[k]=typeof v==="boolean"?{booleanValue:v}:typeof v==="number"?{integerValue:String(Math.round(v))}:{stringValue:String(v)}}return f}
function fr(f){var o={};for(var k in f||{}){var v=f[k];o[k]="booleanValue"in v?v.booleanValue:"integerValue"in v?+v.integerValue:v.stringValue}return o}
function code(n){var A="ABCDEFGHJKLMNPQRSTUVWXYZ23456789",s="",r=new Uint32Array(n);try{crypto.getRandomValues(r)}catch(e){for(var i=0;i<n;i++)r[i]=Math.random()*1e9}for(var j=0;j<n;j++)s+=A[r[j]%A.length];return s}
function pin(){return String(100000+Math.floor(Math.random()*900000))}
function errTx(e){if(!e)return"Bilinmeyen hata";if(e.st===403||e.code==="PERMISSION_DENIED")return"İzin yok (şifre yanlış olabilir).";if(e.st===404)return"Bulunamadı.";if(e.code==="FAILED_PRECONDITION"||e.code==="ABORTED")return"Bu arada başka bir yönetici değişiklik yaptı.";if(e instanceof TypeError||e.message==="Failed to fetch")return"İnternet bağlantısı yok.";return e.msg||String(e)}
function cleanJSON(o){return JSON.stringify(o,function(k,v){return FIX.indexOf(k)>=0?undefined:v})}
// uygunsuz ad süzgeci (organizasyon ve takım adları herkese görünebilir)
var KOTU_K=["amk","amq","aq","oç","piç","göt","sik","ibne","sex","seks","shit"];
var KOTU_U=["orospu","yarrak","yarak","amcık","amcik","amına","amina","siktir","sikiş","sikis","sikerim","sikeyim","pezevenk","kahpe","yavşak","gavat","fuck","bitch","nigger","nigga","pussy","whore","porno","cunt","faggot"];
function kotu(s){var t=String(s||"").toLocaleLowerCase("tr").replace(/[0@4]/g,function(c){return{"0":"o","@":"a","4":"a"}[c]}).replace(/1/g,"i").replace(/3/g,"e");
  return t.split(/[^a-zçğıöşü]+/).some(function(w){return w&&(KOTU_K.indexOf(w)>=0||KOTU_U.some(function(k){return w.indexOf(k)>=0}))})}
var KOTU_TX="Uygunsuz bir kelime var, lütfen değiştir.";
var OMSG="";
// açık listede bir organizasyonu bu cihazda gizle / uygunsuz diye bildir
function orgHide(id){DB.hid[id]=1;store();if(V.pubs&&V.pubs.filter)V.pubs=V.pubs.filter(function(p){return p.id!==id});
  OMSG="Organizasyon gizlendi; artık listende görünmeyecek.";if(V.v==="orgv")go("org");else render()}
function orgReport(id,name){if(V.rp!==id){V.rp=id;render();setTimeout(function(){if(V.rp===id){V.rp=null;render()}},3500);return}V.rp=null;
  auth().then(function(a){return api("PATCH","/reports/"+id+"_"+a.uid,{fields:fv({org:id,uid:a.uid,name:String(name||"").slice(0,80),t:Date.now()})})})
  .then(function(){DB.hid[id]=1;store();if(V.pubs&&V.pubs.filter)V.pubs=V.pubs.filter(function(p){return p.id!==id});
    OMSG="Bildirdin, teşekkürler. İnceleyip uygunsuzsa 24 saat içinde kaldıracağız. Bu organizasyon artık listende görünmeyecek.";if(V.v==="orgv")go("org");else render()},
    function(e){if(V.v==="orgv")V.oerr=errTx(e);else OMSG=errTx(e);render()})}
function orgUnhide(){DB.hid={};store();OMSG="";V.pubs=null;V.pl=0;render()}
function remember(id,x){var r=DB.orgs[id]||{};for(var k in x)r[k]=x[k];r.used=Date.now();DB.orgs[id]=r;store();if(window.ntSync)ntSync()}

// ---------------- organizasyon motoru ----------------
var GN="ABCDEFGHIJKLMNOP";
function orgBuild(o){var t=shuf(o.teams.slice()),G=[],i;
  for(i=0;i<o.ng;i++)G.push({n:GN[i],mode:"lig",legs:o.gl,dbl:o.gl===2,players:[],matches:[]});
  t.forEach(function(n,j){var r=Math.floor(j/o.ng),g=r%2?o.ng-1-j%o.ng:j%o.ng;G[g].players.push(n)});
  G.forEach(function(g){g.matches=gen(g.players.length,g.dbl)});o.groups=G;o.ko=null}
function gDone(g){return g.matches.length>0&&g.matches.every(function(x){return x.d})}
function koStarted(o){return!!(o.ko&&o.ko.matches.some(function(x){return x.d&&!x.bye}))}
function quals(o){return o.groups.map(function(g){return withS(g,table).slice(0,o.adv).map(function(r){return r.n})})}
// eski Şampiyonlar Ligi: grup birincisi komşu grubun ikincisiyle; aynı ikili gruplar ayrı yarılara
function koPairs(o,Q){var T=[],i,a=[],b=[];
  if(o.adv===1){for(i=0;i<o.ng;i+=2)T.push([Q[i][0],Q[i+1][0]])}
  else if(o.ng===1)T.push([Q[0][0],Q[0][1]]);
  else{for(i=0;i<o.ng;i+=2){a.push([Q[i+1][1],Q[i][0]]);b.push([Q[i][1],Q[i+1][0]])}T=a.concat(b);
    if(o.kl!==2)T=T.map(function(p){return[p[1],p[0]]})}   // tek maçta grup birincisi ev sahibi, rövanşlıda ikinci maç onun evinde
  return T}
function orgKO(o){if(koStarted(o))return;
  if(!o.groups.every(gDone)||(o.ng===1&&o.adv===1)){o.ko=null;return}
  var T=koPairs(o,quals(o)),pl=[];T.forEach(function(p){pl.push(p[0],p[1])});
  var k={mode:"eleme",legs:o.kl,fs:o.fs,players:pl,matches:[]};
  withS(k,function(){k.matches=knock(pl.length,T.map(function(p,i){return[2*i,2*i+1]}));adv()});o.ko=k}
function orgChamp(o){if(o.ko)return withS(o.ko,function(){var c=champ();return c>=0?o.ko.players[c]:""});
  if(o.ng===1&&o.adv===1&&gDone(o.groups[0]))return withS(o.groups[0],table)[0].n;return""}
function orgCounts(o){var n=0,d=0;o.groups.forEach(function(g){g.matches.forEach(function(x){n++;if(x.d)d++})});
  if(o.ko)o.ko.matches.forEach(function(x){if(!x.bye&&x.h>=0){n++;if(x.d)d++}});return{n:n,d:d}}
function rolTx(r){return r==="owner"?"Kurucu":r==="ed"?"Yönetici":"İzleyici"}
function canEd(){return OM.role==="owner"||OM.role==="ed"}

// ---------------- sunucu ----------------
function orgLoad(id){return api("GET","/orgs/"+id).then(function(doc){var f=fr(doc.fields);
  var o=JSON.parse(f.d);o.name=f.name;o.pub=!!f.pub;o.bas=f.bas||"";o.bit=f.bit||"";OM.ut=doc.updateTime;OM.owner=f.owner;OM.id=id;return o})}
function orgRole(id){var a=myAuth();if(a&&OM.owner===a.uid)return Promise.resolve("owner");
  return api("GET","/orgs/"+id+"/eds/"+a.uid).then(function(){return"ed"},function(){return"vw"})}
function orgOpen(id,ge){id=String(id||"").trim().toUpperCase();if(!id)return;
  V={v:"orgv",ot:0,g:0,busy:"Yükleniyor…"};O=null;OM={id:id};render();
  orgLoad(id).then(function(o){O=o;return orgRole(id)}).then(function(r){OM.role=r;V.busy="";if(ge&&canEd())geStart();
    orgRemember();render()},
  function(e){V={v:"orgjoin",code:id,err:e.st===403||e.st===404?"Bu kodla açık bir organizasyon bulunamadı. Kapalı bir organizasyonsa izleme ya da yönetici şifresini gir.":errTx(e)};render()})}
function orgRefresh(quiet){if(!O||!OM.id||V.v!=="orgv")return;
  return api("GET","/orgs/"+OM.id).then(function(doc){if(doc.updateTime===OM.ut)return;var f=fr(doc.fields),o=JSON.parse(f.d);o.name=f.name;o.pub=!!f.pub;o.bas=f.bas||"";o.bit=f.bit||"";
    O=o;OM.ut=doc.updateTime;orgRemember();render()},function(e){if(!quiet){V.oerr=errTx(e);render()}})}
var OSAVE=null;
function orgSave(){if(!O)return;orgKO(O);O.updated=Date.now();var sm=orgSum(O);orgRemember();
  var body={fields:fv({name:O.name,d:cleanJSON(stripMeta(O)),upd:O.updated,oy:sm.oy,mt:sm.mt,sp:sm.sp})};
  V.oerr="";V.sync="Kaydediliyor…";
  var q="updateMask.fieldPaths=d&updateMask.fieldPaths=upd&updateMask.fieldPaths=name&updateMask.fieldPaths=oy&updateMask.fieldPaths=mt&updateMask.fieldPaths=sp&currentDocument.updateTime="+encodeURIComponent(OM.ut);
  OSAVE=api("PATCH","/orgs/"+OM.id,body,q).then(function(doc){OM.ut=doc.updateTime;V.sync="";render()},function(e){V.sync="";
    V.oerr=errTx(e)+" Son hali yüklendi, gerekiyorsa skoru tekrar gir.";OM.ut="";orgRefresh(true);render()})}
function stripMeta(o){var c={};for(var k in o)if(k!=="name"&&k!=="pub"&&k!=="bas"&&k!=="bit")c[k]=o[k];return c}
function orgRemember(){if(!O||!OM.id)return;var sm=orgSum(O),x={name:O.name,pub:O.pub,bas:O.bas||"",bit:O.bit||"",oy:sm.oy,mt:sm.mt,sp:sm.sp};if(OM.role)x.role=OM.role;remember(OM.id,x)}
setInterval(function(){if(V.v==="orgv"&&O&&!V.sync){var a=document.activeElement;if(a&&(a.tagName==="INPUT"||a.tagName==="SELECT"))return;
  var typed=[].some.call(document.querySelectorAll('#app input[type=number]'),function(e){return e.value&&e.value!=="0"});if(!typed)orgRefresh(true)}},12000);

// ---------------- ekranlar ----------------
function orgRender(){
  if(V.v==="orgnew")return orgNewV();
  if(V.v==="orgjoin")return orgJoinV();
  if(V.v==="orgmail")return orgMailV();
  if(V.v==="orgv")return orgV();
  return orgHome()}
function noServer(){return'<div class="card"><b>Sunucu bağlantısı henüz ayarlanmadı.</b><div class="mu" style="text-align:left;margin-top:6px">Organizasyonlar internet üzerinden paylaşıldığı için ortak bir sunucu gerekiyor. Uygulamanın bir sonraki sürümünde açılacak.</div></div>'}
function orgHome(){var h=head("Organizasyon");
  if(!fbOk())return h+noServer();
  if(OMSG)h+='<div class="card" style="text-align:left">'+esc(OMSG)+' <button class="g" onclick="OMSG=\'\';render()">Tamam</button></div>';
  var em=myMail();
  if(em)h+='<div class="card"><div class="it"><div style="text-align:left;word-break:break-all">📧 <b>'+esc(em)+'</b></div><button class="'+(V.mo?"w":"g")+'" onclick="mailOut()">'+(V.mo?"Çıkılsın mı?":"Çıkış yap")+'</button></div><div class="btns"><button class="d" onclick="V={v:\'orgmail\',mm:\'del\',em:myMail()};render()">Hesabı sil</button></div></div>';
  else h+='<button class="big" onclick="mailOpen()"><span class="ic">📧</span><span>Mail ile devam et</span></button>';
  h+='<button class="big" onclick="orgNew()"><span class="ic">➕</span><span>Yeni organizasyon</span></button>';
  h+='<div class="card"><div class="lbl" style="margin-top:0">Kodla aç</div><div class="row"><input type="text" id="oc" placeholder="Örn. K7M2QX" autocapitalize="characters" style="text-transform:uppercase" value="'+esc(V.oc||"")+'" oninput="V.oc=this.value" onkeydown="if(event.key===\'Enter\')orgOpen(this.value)"><button onclick="orgOpen(V.oc)">Aç</button></div></div>';
  // Başlayacak / Devam eden / Biten
  var my=Object.keys(DB.orgs).sort(function(a,b){return(DB.orgs[b].used||0)-(DB.orgs[a].used||0)});
  var pubs=V.pubs&&V.pubs.filter?V.pubs.filter(function(p){return!DB.hid[p.id]}):[],say={bas:0,dev:0,bit:0};
  var gor={};my.forEach(function(id){gor[id]=1;say[orgDurum(DB.orgs[id])]++});pubs.forEach(function(p){if(!gor[p.id])say[orgDurum(p)]++});
  var kat=V.kat||(say.dev?"dev":say.bas?"bas":say.bit?"bit":"dev");
  h+='<div class="tabs" style="margin-top:14px">'+DURUM.map(function(d){return'<button class="'+(kat===d[0]?"on":"")+'" onclick="V.kat=\''+d[0]+'\';render()">'+d[1]+(say[d[0]]?" ("+say[d[0]]+")":"")+"</button>"}).join("")+"</div>";
  var myK=my.filter(function(id){return orgDurum(DB.orgs[id])===kat});
  if(myK.length){h+="<h2>Organizasyonlarım</h2>";myK.forEach(function(id){var r=DB.orgs[id],t=tarihTx(r);
    h+='<div class="card"><div class="it"><div><div class="nm">'+esc(r.name||id)+'</div><div class="mu" style="text-align:left"><span class="tg">'+(r.pub?"Herkese açık":"Kapalı")+'</span><span class="tg">'+rolTx(r.role)+"</span>Kod: <b>"+id+"</b>"+(t?"<br>"+t:"")+(r.sp?"<br>🏆 "+esc(r.sp):"")+'</div></div><button onclick="orgOpen(\''+id+'\')">Aç</button></div>'
      +'<div class="btns"><button class="d" onclick="orgForget(\''+id+'\')">'+(V.fg===id?"Listeden kaldırılsın mı?":"Listeden kaldır")+"</button></div></div>"})}
  h+="<h2>Herkese açık organizasyonlar</h2>";
  if(!V.pubs){if(!V.pl){V.pl=1;orgPubs()}h+='<div class="card mu">Yükleniyor…</div>'}
  else if(V.pubs.err)h+='<div class="card mu">'+esc(V.pubs.err)+' <button class="g" onclick="V.pubs=null;V.pl=0;render()">Tekrar dene</button></div>';
  else{var pk=pubs.filter(function(p){return orgDurum(p)===kat});
    if(!pk.length)h+='<div class="card mu">Bu bölümde organizasyon yok.</div>';
    pk.forEach(function(p){var t=tarihTx(p);h+='<div class="card"><div class="it"><div><div class="nm">'+esc(p.name)+'</div><div class="mu" style="text-align:left">'+day(p.upd)+" · Kod: <b>"+p.id+"</b>"+(t?"<br>"+t:"")+(p.sp?"<br>🏆 "+esc(p.sp):"")+'</div></div><button onclick="orgOpen(\''+p.id+'\')">Aç</button></div>'
    +'<div class="btns"><button class="g" onclick="orgHide(\''+p.id+'\')">🙈 Gizle</button><button class="'+(V.rp===p.id?"w":"d")+'" onclick="orgReport(\''+p.id+'\','+esc(JSON.stringify(p.name))+')">'+(V.rp===p.id?"Uygunsuz diye bildirilsin mi?":"🚩 Bildir")+"</button></div></div>"})}
  var nh=Object.keys(DB.hid).length;
  if(nh)h+='<div class="mu" style="text-align:left">'+nh+' organizasyonu gizledin. <button class="g" onclick="orgUnhide()">Gizlenenleri göster</button></div>';
  return h}
function orgForget(id){if(V.fg!==id){V.fg=id;render();setTimeout(function(){if(V.fg===id){V.fg=null;render()}},3500);return}delete DB.orgs[id];V.fg=null;store();ntSync();render()}
function orgPubs(){api("POST",":runQuery",{structuredQuery:{from:[{collectionId:"orgs"}],where:{fieldFilter:{field:{fieldPath:"pub"},op:"EQUAL",value:{booleanValue:true}}},limit:100}})
  .then(function(rs){var L=[];(rs||[]).forEach(function(r){if(!r.document)return;var f=fr(r.document.fields);var m=orgMemo(f);m.id=r.document.name.split("/").pop();m.upd=f.upd||0;L.push(m)});
    L.sort(function(a,b){return b.upd-a.upd});if(V.v==="org"){V.pubs=L;render()}},function(e){if(V.v==="org"){V.pubs={err:errTx(e)};render()}})}

// yeni organizasyon formu
function orgNew(){V={v:"orgnew",name:"",bas:"",bit:"",teams:[],ng:2,adv:2,gl:2,kl:2,fs:true,pub:true,man:false,ep:pin(),vp:pin(),err:""};render()}
function onm(){var e=$("#tn");if(e)V.name=e.value;e=$("#ob");if(e)V.bas=e.value;e=$("#obt");if(e)V.bit=e.value;e=$("#ep");if(e)V.ep=e.value;e=$("#vp");if(e)V.vp=e.value}
function oset(k,v){onm();V[k]=v;render()}
function oadd(){onm();var e=$("#nm"),v=e.value.trim();if(!v)return;if(kotu(v)){V.err=KOTU_TX;render();return}if(V.teams.some(function(p){return canon(p)===canon(v)})){V.err="Bu takım zaten listede.";render();return}V.teams.push(v);V.err="";render();$("#nm").focus()}
function odel(i){onm();V.teams.splice(i,1);render()}
function opick(i){onm();V.teams=DB.lists[i].players.slice();render()}
function seg(k,opts){return'<div class="seg">'+opts.map(function(o){return'<button class="'+(V[k]===o[0]?"on":"")+'" onclick="oset(\''+k+'\','+JSON.stringify(o[0])+')">'+o[1]+"</button>"}).join("")+"</div>"}
function orgPlan(){var n=V.teams.length,q=V.ng*V.adv,gs=Math.floor(n/V.ng),r=n%V.ng;
  var s=V.ng===1?"Tek grup":V.ng+" grup",per=r?gs+"-"+(gs+1):String(gs);
  var ko=V.ng===1&&V.adv===1?"Eleme yok, grup birincisi şampiyon.":q===2?"Gruplardan çıkan 2 takım finalde.":q+" takımlık eleme: "+(q===4?"yarı final, final":q===8?"çeyrek final, yarı final, final":"son 16, çeyrek final, yarı final, final")+".";
  return n?s+", grup başına "+per+" takım. Her gruptan "+V.adv+" takım çıkar. "+ko:""}
function orgNewV(){var h=head("Yeni organizasyon","go(\'org\')");
  h+='<div class="card"><div class="lbl" style="margin-top:0">Organizasyon adı</div><input type="text" id="tn" placeholder="Örn. Kış Kupası" value="'+esc(V.name)+'">';
  h+=tarihAlan(V.bas,V.bit,"oset");
  h+='<div class="lbl">Grup sayısı</div>'+seg("ng",[[1,"1"],[2,"2"],[4,"4"],[8,"8"]]);
  h+='<div class="lbl">Her gruptan çıkan</div>'+seg("adv",[[1,"1 takım"],[2,"2 takım"]]);
  h+='<div class="lbl">Gruplama</div>'+seg("man",[[false,"🎲 Kura"],[true,"✋ Elle dizerim"]]);
  h+='<div class="lbl">Grup maçları</div>'+seg("gl",[[1,"Tek maç"],[2,"Rövanşlı"]]);
  h+='<div class="lbl">Eleme turları</div>'+seg("kl",[[1,"Tek maç"],[2,"Rövanşlı"]]);
  h+='<label style="display:flex;gap:10px;align-items:center;margin-top:12px"><input type="checkbox" '+(V.fs?"checked":"")+' onchange="oset(\'fs\',this.checked)"> Final tek maç</label>';
  h+='<div class="lbl">Görünürlük</div>'+seg("pub",[[true,"🌍 Herkese açık"],[false,"🔒 Kapalı"]]);
  h+='<div class="lbl">Yönetici şifresi</div><input type="text" id="ep" inputmode="numeric" value="'+esc(V.ep)+'">';
  if(!V.pub)h+='<div class="lbl">İzleme şifresi</div><input type="text" id="vp" inputmode="numeric" value="'+esc(V.vp)+'">';
  if(!myMail())h+='<button class="g" style="width:100%;margin-top:12px" onclick="onm();mailOpen()">📧 Mail ile devam et</button>';
  h+="</div>";
  h+='<div class="card"><h2 style="margin-top:0">Takımlar ('+V.teams.length+')</h2><div class="row"><input type="text" id="nm" placeholder="Takım ya da oyuncu adı" onkeydown="if(event.key===\'Enter\')oadd()"><button onclick="oadd()">Ekle</button></div><div style="margin-top:10px">';
  V.teams.forEach(function(p,i){h+='<span class="chip">'+esc(p)+'<b onclick="odel('+i+')" aria-label="Sil">✕</b></span>'});
  h+='</div><div class="mu" style="color:var(--rd)">'+esc(V.err||"")+"</div></div>";
  if(DB.lists.length){h+='<div class="card"><div class="lbl" style="margin-top:0">Kayıtlı listeden seç</div>';
    DB.lists.forEach(function(L,i){h+='<span class="chip s" onclick="opick('+i+')">'+esc(L.name)+' <span class="mu">('+L.players.length+")</span></span>"});h+="</div>"}
  h+='<div class="mu" style="text-align:left">Organizasyon kurarak küfür, hakaret ya da uygunsuz içerik paylaşmayacağını kabul edersin. Bildirilen uygunsuz içerik 24 saat içinde kaldırılır ve paylaşanın erişimi engellenebilir.</div>';
  h+='<button style="width:100%;padding:14px" '+(V.busy?"disabled":"")+' onclick="orgCreate()">'+(V.busy||(V.man?"Organizasyonu kur ve grupları diz":"Kurayı çek ve organizasyonu başlat"))+"</button>";
  return h}
function orgCreate(){onm();var n=V.teams.length;
  var e=!V.name.trim()?"Organizasyona bir ad ver.":kotu(V.name)||V.teams.some(kotu)?KOTU_TX:n<V.ng*2?V.ng+" grup için en az "+V.ng*2+" takım gerekir.":Math.floor(n/V.ng)<=V.adv&&V.ng>1?"Her grupta çıkan takım sayısından fazla takım olmalı; takım ekle ya da grup sayısını azalt.":V.ng===1&&n<=V.adv?"En az "+(V.adv+1)+" takım gerekir.":!/^\S{4,}$/.test(V.ep)?"Yönetici şifresi en az 4 karakter olmalı.":!V.pub&&!/^\S{4,}$/.test(V.vp)?"İzleme şifresi en az 4 karakter olmalı.":V.bas&&V.bit&&V.bit<V.bas?"Bitiş tarihi başlangıçtan önce olamaz.":"";
  if(e){V.err=e;render();return}
  var o={v:1,teams:V.teams.slice(),ng:V.ng,adv:V.adv,gl:V.gl,kl:V.kl,fs:!!V.fs,created:Date.now(),updated:Date.now()};orgBuild(o);
  var id=code(6),pw=V.ep,vp=V.pub?pw:V.vp;V.busy="Kuruluyor…";V.err="";render();addList(V.teams);
  auth().then(function(a){return api("POST",":commit",{writes:[
    {update:{name:DNAME("/orgs/"+id),fields:fv({name:V.name.trim(),pub:!!V.pub,owner:a.uid,upd:o.updated,d:cleanJSON(o),bas:V.bas||"",bit:V.bit||"",oy:0,mt:orgCounts(o).n,sp:""})},currentDocument:{exists:false}},
    {update:{name:DNAME("/sec/"+id),fields:fv({e:pw,v:vp})},currentDocument:{exists:false}}]})})
  .then(function(){var man=V.man;remember(id,{name:V.name.trim(),pub:!!V.pub,role:"owner",bas:V.bas||"",bit:V.bit||"",oy:0,sp:""});orgOpen(id,man)},function(x){V.busy="";V.err="Kurulamadı: "+errTx(x);render()})}

// kapalı organizasyona / yönetici olarak katılma
function orgJoinV(){var h=head("Organizasyona katıl","go(\'org\')");
  h+='<div class="card"><div class="lbl" style="margin-top:0">Kod</div><input type="text" id="jc" value="'+esc(V.code||"")+'" style="text-transform:uppercase">';
  h+='<div class="lbl">Şifre</div><input type="text" id="jp" inputmode="numeric" placeholder="İzleme ya da yönetici şifresi" value="'+esc(V.pw||"")+'">';
  h+='<div class="lbl">Adın (yönetici olacaksan)</div><input type="text" id="jn" placeholder="Kurucu yetkilileri bu adla görür" value="'+esc(V.nm||localStorage.getItem("tf-ad")||"")+'">';
  h+='<div class="mu" style="color:var(--rd);text-align:left">'+esc(V.err||"")+'</div><div class="btns"><button class="g" onclick="orgJoin(0)">👁 İzleyici olarak</button><button onclick="orgJoin(1)">✏️ Yönetici olarak</button></div>'
    +'<button class="g" style="width:100%;margin-top:8px" onclick="orgForgot()">Şifremi unuttum</button></div>';
  if(V.fp)h+='<div class="card" style="text-align:left">Şifreleri organizasyonu kuran kişi görebilir; ondan iste.'
    +(myMail()?"":'<div style="margin-top:8px">Organizasyonu sen kurduysan ve mail ile devam ettiysen giriş yap; şifreler Bilgi sekmesinde görünür.</div><button style="width:100%;margin-top:8px" onclick="mailOpen(V.code)">📧 Mail ile giriş yap</button>')+"</div>";
  return h}
function orgForgot(){var e=$("#jc");if(e)V.code=e.value.trim().toUpperCase();e=$("#jp");if(e)V.pw=e.value;V.fp=!V.fp;render()}
function orgJoin(ed){var id=$("#jc").value.trim().toUpperCase(),p=$("#jp").value.trim(),n=$("#jn").value.trim();V.code=id;V.pw=p;V.nm=n;
  if(!id||!p){V.err="Kod ve şifre gerekli.";render();return}if(ed&&!n){V.err="Yönetici olarak katılmak için adını yaz.";render();return}
  if(n)try{localStorage.setItem("tf-ad",n)}catch(e){}
  V.err="";V.busy=1;auth().then(function(a){return api("PATCH","/orgs/"+id+"/"+(ed?"eds":"vw")+"/"+a.uid,{fields:fv(ed?{p:p,n:n,t:Date.now()}:{p:p})},"currentDocument.exists=false")})
  .then(function(){orgOpen(id)},function(e){
    // zaten katılmışsa (belge var) doğrudan aç
    auth().then(function(a){return api("GET","/orgs/"+id+"/"+(ed?"eds":"vw")+"/"+a.uid)}).then(function(){orgOpen(id)},function(){
      V.busy=0;V.err=e.st===403||e.st===404?"Kod ya da şifre yanlış"+(ed?" (yönetici şifresi gerekir).":"."):errTx(e);render()})})}

// organizasyon ekranı
function orgV(){
  if(!O){return head(OM.id||"Organizasyon","go(\'org\')")+'<div class="card mu">'+esc(V.busy||"Yükleniyor…")+"</div>"}
  var ce=canEd(),ch=orgChamp(O),c=orgCounts(O);
  var nb=window.TFBildirim&&DB.orgs[OM.id]?'<button class="g" onclick="ntToggle()" aria-label="Bildirim">'+(ntOn(OM.id)?"🔔 Açık":"🔕 Kapalı")+"</button> ":"";
  var h=head(esc(O.name),"go(\'org\')",'<span>'+nb+'<button class="g" onclick="orgRefresh()">↻ Yenile</button></span>'),dk=orgDurum({oy:c.d,sp:ch,bas:O.bas,bit:O.bit}),tt=tarihTx(O);
  h+='<div class="mu" style="text-align:left;margin-bottom:10px"><span class="tg">'+(O.pub?"🌍 Açık":"🔒 Kapalı")+'</span><span class="tg'+(ce?" ok":"")+'">'+rolTx(OM.role)+'</span><span class="tg">'+DURUM.filter(function(d){return d[0]===dk})[0][1]+"</span>Kod: <b>"+OM.id+"</b> · "+c.d+"/"+c.n+" maç"+(tt?"<br>"+tt:"")+"</div>";
  if(V.oerr)h+='<div class="card" style="color:var(--rd)">'+esc(V.oerr)+"</div>";
  if(V.sync)h+='<div class="mu">'+esc(V.sync)+"</div>";
  if(ch)h+='<div class="card" style="text-align:center"><div class="sc" style="font-size:32px">🏆 '+esc(ch)+'</div><div class="mu">Şampiyon</div></div>';
  var ot=V.ot||0;
  h+='<div class="tabs"><button class="'+(ot===0?"on":"")+'" onclick="otab(0)">Gruplar</button><button class="'+(ot===1?"on":"")+'" onclick="otab(1)">Eleme</button><button class="'+(ot===2?"on":"")+'" onclick="otab(2)">Bilgi</button></div>';
  if(ot===0)h+=orgGroups(ce);else if(ot===1)h+=orgKOV(ce);else h+=orgInfo(ce);
  return h}
function otab(t){V.ot=t;V.oerr="";window.scrollTo(0,0);render()}
function oG(g){V.g=g;render()}
function gTable(g){var t=withS(g,table),h='<div class="card wrap"><table><tr><th>#</th><th class="l">Takım</th><th class="p">P</th><th>O</th><th>G</th><th>B</th><th>M</th><th>AG</th><th>YG</th><th>AV</th></tr>';
  t.forEach(function(r,i){h+="<tr"+(i<O.adv?' class="f"':"")+"><td>"+(i+1)+'</td><td class="l">'+esc(r.n)+'</td><td class="p">'+r.p+"</td><td>"+r.o+"</td><td>"+r.g+"</td><td>"+r.b+"</td><td>"+r.m+"</td><td>"+r.gf+"</td><td>"+r.ga+"</td><td>"+(r.gf-r.ga)+"</td></tr>"});
  return h+"</table></div>"}
function orgGroups(ce){var g=Math.min(V.g||0,O.groups.length-1),G=O.groups[g],h="";
  if(O.groups.length>1){h+='<div style="margin-bottom:8px">';O.groups.forEach(function(x,i){h+='<span class="chip s" style="'+(i===g?"background:var(--ac2);color:#fff":"")+'" onclick="oG('+i+')">'+x.n+" Grubu"+(gDone(x)?" ✓":"")+"</span>"});h+="</div>"}
  h+='<div class="btns" style="margin:0 0 6px"><button class="g" onclick="orgPng(\'st\')">📤 Puan durumları PNG</button><button class="g" onclick="orgPng(\'gm\')">📤 '+G.n+' Grubu maçları PNG</button></div>';
  h+="<h2>"+G.n+" Grubu</h2>"+gTable(G);
  S=G;S.org=1;S.ro=!ce;h+=fix();
  return h}
function orgKOV(ce){var h="";
  if(!O.ko){if(O.ng===1&&O.adv===1)return'<div class="card mu">Bu organizasyonda eleme turu yok; grup birincisi şampiyon olur.</div>';
    var Q=quals(O),T=koPairs(O,Q),done=O.groups.filter(gDone).length;
    h+='<div class="card mu" style="text-align:left">Muhtemel eşleşmeler ('+done+"/"+O.groups.length+' grup bitti)</div>';
    T.forEach(function(p){h+='<div class="card"><div class="done"><b>'+esc(p[0])+'</b><span class="sc" style="color:var(--mu)">-</span><b>'+esc(p[1])+"</b></div></div>"});
    return h}
  h+='<div class="btns" style="margin:0 0 6px"><button class="g" onclick="orgPng(\'ko\')">📤 Eleme maçları PNG</button></div>';
  S=O.ko;S.org=1;S.ro=!ce;h+=fix();return h}
function orgPng(k){var sub=O.name&&OM.id?"Kod "+OM.id:"";
  if(k==="st"){var b=[];O.groups.forEach(function(g){b.push({t:"h",x:g.n+" Grubu"});withS(g,function(){var B=blkStand([]);B.hd[1]="Takım";B.q=[];for(var i=0;i<O.adv;i++)B.q.push(i);b.push(B)})});
    pngShare(O.name,"Puan durumu · "+sub,b,O.name+"-puan-durumu")}
  else if(k==="gm"){var G=O.groups[Math.min(V.g||0,O.groups.length-1)];pngShare(O.name,G.n+" Grubu maçları · "+sub,withS(G,blkFix),O.name+"-"+G.n+"-grubu")}
  else pngShare(O.name,"Eleme turu · "+sub,withS(O.ko,blkFix),O.name+"-eleme")}

// bilgi / yönetim sekmesi
function orgInfo(ce){if(V.ge&&ce)return geView();var h='<div class="card"><div class="lbl" style="margin-top:0">Düzen</div><div style="text-align:left">'
  +O.groups.length+" grup ("+O.groups.map(function(g){return g.n}).join(", ")+"), her gruptan "+O.adv+" takım çıkar. Grup maçları "+(O.gl===2?"rövanşlı":"tek maç")+", eleme turları "+(O.kl===2?"rövanşlı":"tek maç")+(O.fs?", final tek maç":"")+".</div>";
  h+='<div class="lbl">Kod</div><div style="text-align:left"><b style="font-size:20px;letter-spacing:2px">'+OM.id+"</b></div></div>";
  if(!ce){h+='<div class="card"><div class="lbl" style="margin-top:0">Düzenleme yetkisi</div><button style="width:100%;margin-top:8px" onclick="V={v:\'orgjoin\',code:\''+OM.id+'\'};render()">✏️ Yönetici şifresini gir</button></div>';
    return h+orgFlag()}
  h+='<div class="card"><div class="lbl" style="margin-top:0">Fikstür</div><div class="btns"><button class="'+(V.ocf==="rd"?"w":"g")+'" onclick="orgRedraw()">'+(V.ocf==="rd"?"Bütün skorlar silinir, emin misin?":"🔀 Grup kurasını yeniden çek")+'</button><button class="'+(V.ocf==="rs"?"w":"d")+'" onclick="orgReset()">'+(V.ocf==="rs"?"Bütün skorlar silinsin mi?":"↺ Sıfırla")+'</button></div><button class="g" style="width:100%;margin-top:6px" onclick="geStart()">✋ Grupları elle düzenle / takım adlarını düzelt</button></div>';
  if(OM.role!=="owner")return h+orgFlag();
  // kurucu
  if(!V.sec&&!V.secl){V.secl=1;api("GET","/sec/"+OM.id).then(function(d){V.sec=fr(d.fields);render()},function(e){V.sec={err:errTx(e)};render()});
    api("GET","/orgs/"+OM.id+"/eds",null,"pageSize=100").then(function(r){V.eds=(r.documents||[]).map(function(d){var f=fr(d.fields);return{uid:d.name.split("/").pop(),n:f.n||"İsimsiz",t:f.t||0}});render()},function(){V.eds=[];render()})}
  h+='<div class="card"><div class="lbl" style="margin-top:0">Kurucu ayarları</div>';
  h+='<div class="lbl">Ad</div><div class="row"><input type="text" id="on" value="'+esc(O.name)+'"><button onclick="orgName()">Kaydet</button></div>';
  h+=tarihAlan(O.bas,O.bit,"")+'<button style="width:100%;margin-top:6px" onclick="orgDates()">Tarihleri kaydet</button>';
  h+='<div class="lbl">Görünürlük</div><div class="seg"><button class="'+(O.pub?"on":"")+'" onclick="orgPub(true)">🌍 Herkese açık</button><button class="'+(O.pub?"":"on")+'" onclick="orgPub(false)">🔒 Kapalı</button></div>';
  if(V.sec&&!V.sec.err){h+='<div class="lbl">Yönetici şifresi</div><div class="row"><input type="text" id="se" value="'+esc(V.sec.e)+'"><button onclick="orgPw()">Değiştir</button></div>';
    if(!O.pub)h+='<div class="lbl">İzleme şifresi</div><div class="row"><input type="text" id="sv" value="'+esc(V.sec.v)+'"><button onclick="orgPw()">Değiştir</button></div>';}
  else if(V.sec&&V.sec.err)h+='<div class="mu" style="color:var(--rd)">'+esc(V.sec.err)+"</div>";
  if(!myMail())h+='<button class="g" style="width:100%;margin-top:8px" onclick="mailOpen(OM.id)">📧 Mail ile devam et</button>';
  h+='<div class="lbl">Yöneticiler</div>';
  if(!V.eds)h+='<div class="mu">Yükleniyor…</div>';else if(!V.eds.length)h+='<div class="mu" style="text-align:left">Henüz yönetici yok.</div>';
  else V.eds.forEach(function(e,i){h+='<div class="it" style="margin:6px 0"><span><b>'+esc(e.n)+'</b> <span class="mu" style="margin:0">'+(e.t?day(e.t):"")+'</span></span><button class="d" onclick="orgKick('+i+')">'+(V.kk===i?"Emin misin?":"Yetkiyi al")+"</button></div>"});
  h+='<div class="lbl">Organizasyonu sil</div><button class="'+(V.ocf==="del"?"w":"d")+'" style="width:100%" onclick="orgDel()">'+(V.ocf==="del"?"Herkes için silinsin mi? Geri alınamaz.":"🗑 Organizasyonu sil")+"</button></div>";
  return h}
function orgFlag(){return'<div class="card"><div class="lbl" style="margin-top:0">Uygunsuz içerik</div><div class="btns"><button class="g" onclick="orgHide(\''+OM.id+'\')">🙈 Gizle</button><button class="'+(V.rp===OM.id?"w":"d")+'" onclick="orgReport(\''+OM.id+'\','+esc(JSON.stringify(O.name))+')">'+(V.rp===OM.id?"Uygunsuz diye bildirilsin mi?":"🚩 Bildir")+"</button></div></div>"}
function ocfm(k,fn){if(V.ocf!==k){V.ocf=k;render();setTimeout(function(){if(V.ocf===k){V.ocf="";render()}},3500);return}V.ocf="";fn()}
function anyOrgPlayed(){return orgCounts(O).d>0}
function orgRedraw(){var f=function(){orgBuild(O);V.g=0;orgSave();render()};if(anyOrgPlayed())ocfm("rd",f);else f()}
function orgReset(){if(!anyOrgPlayed()){V.oerr="Henüz girilmiş skor yok.";render();return}
  ocfm("rs",function(){O.groups.forEach(function(g){g.matches.forEach(function(x){x.d=0;x.hg=x.ag=x.hy=x.hr=x.ay=x.ar=0})});O.ko=null;orgSave();render()})}
function orgName(){var v=$("#on").value.trim();if(!v)return;if(kotu(v)){V.oerr=KOTU_TX;render();return}O.name=v;orgSave();render()}
function orgPub(p){if(O.pub===p)return;var old=O.pub;O.pub=p;render();
  var q="updateMask.fieldPaths=pub&currentDocument.updateTime="+encodeURIComponent(OM.ut);
  api("PATCH","/orgs/"+OM.id,{fields:fv({pub:p})},q).then(function(d){OM.ut=d.updateTime;remember(OM.id,{pub:p});
    if(!p&&V.sec&&V.sec.v===V.sec.e){V.sec.v=pin();orgPw()}render()},function(e){O.pub=old;V.oerr=errTx(e);orgRefresh(true);render()})}
function orgPw(){var e=$("#se"),v=$("#sv"),n={e:e?e.value.trim():V.sec.e,v:v?v.value.trim():V.sec.v};
  if(n.e.length<4||n.v.length<4){V.oerr="Şifreler en az 4 karakter olmalı.";render();return}
  api("PATCH","/sec/"+OM.id,{fields:fv(n)}).then(function(){V.sec=n;V.oerr="";V.sync="Şifre kaydedildi.";render();setTimeout(function(){V.sync="";render()},2000)},function(x){V.oerr=errTx(x);render()})}
function orgKick(i){if(V.kk!==i){V.kk=i;render();setTimeout(function(){if(V.kk===i){V.kk=null;render()}},3500);return}V.kk=null;
  var e=V.eds[i];api("DELETE","/orgs/"+OM.id+"/eds/"+e.uid).then(function(){V.eds.splice(i,1);render()},function(x){V.oerr=errTx(x);render()})}
function orgDel(){ocfm("del",function(){api("POST",":commit",{writes:[{delete:DNAME("/orgs/"+OM.id)},{delete:DNAME("/sec/"+OM.id)}]})
  .then(function(){delete DB.orgs[OM.id];store();O=null;go("org")},function(x){V.oerr=errTx(x);render()})})}

// grupları elle dizme / düzeltme: her takımın grubu ve adı değiştirilebilir
function geStart(){V.ot=2;V.ge=[];O.groups.forEach(function(g,gi){g.players.forEach(function(n){V.ge.push({o:n,n:n,g:gi})})});V.gerr="";window.scrollTo(0,0);render()}
function geSync(){V.ge.forEach(function(t,i){var e=$("#gn"+i);if(e)t.n=e.value})}
function geSet(i,g){geSync();V.ge[i].g=g;render()}
function geView(){var h='<div class="card"><div class="lbl" style="margin-top:0">Grupları düzenle</div></div>';
  O.groups.forEach(function(G,gi){var m=V.ge.filter(function(t){return t.g===gi}).length;
    h+="<h2>"+G.n+' Grubu <span class="mu" style="margin:0;font-size:14px">('+m+" takım)</span></h2><div class=\"card\">";
    V.ge.forEach(function(t,i){if(t.g!==gi)return;
      h+='<div style="margin-bottom:10px;display:flex;gap:6px;align-items:center;flex-wrap:'+(O.groups.length>4?"wrap":"nowrap")+'"><input type="text" id="gn'+i+'" value="'+esc(t.n)+'" style="flex:1;min-width:140px"><div style="white-space:nowrap">';
      O.groups.forEach(function(x,xi){h+='<span class="chip s" style="'+(xi===gi?"background:var(--ac2);color:#fff":"")+'" onclick="geSet('+i+','+xi+')">'+x.n+"</span>"});
      h+="</div></div>"});
    if(!m)h+='<div class="mu">Boş</div>';h+="</div>"});
  h+='<div class="mu" style="color:var(--rd);text-align:left">'+esc(V.gerr||"")+'</div><div class="btns"><button class="g" onclick="V.ge=null;render()">Vazgeç</button><button class="'+(V.ocf==="ge"?"w":"")+'" onclick="geSave()">'+(V.ocf==="ge"?"Değişen grupların skorları silinir, emin misin?":"Kaydet")+"</button></div>";
  return h}
function geSave(){geSync();var names={},e="";
  V.ge.forEach(function(t){t.n=t.n.trim();if(!t.n)e="Takım adı boş olamaz.";else if(kotu(t.n))e=KOTU_TX;else if(names[canon(t.n)])e="Aynı ad iki kez var: "+t.n;names[canon(t.n)]=1});
  O.groups.forEach(function(G,gi){var m=V.ge.filter(function(t){return t.g===gi}).length;if(m<2)e=e||G.n+" Grubunda en az 2 takım olmalı.";else if(O.groups.length>1&&m<=O.adv)e=e||G.n+" Grubunda "+(O.adv+1)+" takımdan az olamaz (her gruptan "+O.adv+" takım çıkıyor)."});
  if(e){V.gerr=e;V.ocf="";render();return}
  // üyeleri değişen gruplar (sıra önemsiz, adlar eski haliyle karşılaştırılır)
  var ch=O.groups.map(function(G,gi){var now=V.ge.filter(function(t){return t.g===gi}).map(function(t){return t.o});return keyOf(now)!==keyOf(G.players)});
  var lose=O.groups.some(function(G,gi){return ch[gi]&&G.matches.some(function(x){return x.d})})||(ch.some(Boolean)&&koStarted(O));
  var f=function(){var ren={};V.ge.forEach(function(t){ren[t.o]=t.n});
    O.groups.forEach(function(G,gi){var now=V.ge.filter(function(t){return t.g===gi});
      if(ch[gi]){G.players=now.map(function(t){return t.n});G.matches=gen(G.players.length,G.dbl)}
      else G.players=G.players.map(function(n){return ren[n]})});
    O.teams=V.ge.map(function(t){return t.n});
    if(ch.some(Boolean))O.ko=null;else if(O.ko)O.ko.players=O.ko.players.map(function(n){return ren[n]||n});
    V.ge=null;V.gerr="";orgSave();V.ot=0;V.g=0;render()};
  if(lose)ocfm("ge",f);else f()}

// ---------------- tarihler ve durum (Başlayacak / Devam eden / Biten) ----------------
// Başlangıç (bas) ve bitiş (bit) tarihi isteğe bağlı, "YYYY-AA-GG" olarak belgenin üst alanlarında durur.
// Belgede ayrıca liste için özet tutulur: oy = oynanan maç, mt = toplam maç, sp = şampiyon (bittiyse).
function p2(n){return(n<10?"0":"")+n}
function bugun(){var d=new Date();return d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate())}
function gunTx(s){var p=String(s||"").split("-");if(p.length!==3)return s||"";try{return new Date(+p[0],+p[1]-1,+p[2]).toLocaleDateString("tr-TR",{day:"numeric",month:"short",year:"numeric"})}catch(e){return s}}
function tarihTx(r){if(!r||(!r.bas&&!r.bit))return"";return"📅 "+(r.bas?gunTx(r.bas):"…")+" – "+(r.bit?gunTx(r.bit):"…")}
function tarihAlan(b,t){function bir(id,lb,v){return'<div class="lbl">'+lb+'</div><div class="row"><input type="date" id="'+id+'" value="'+esc(v||"")+'"><button class="g" onclick="var e=$(\'#'+id+'\');if(e)e.value=\'\'" aria-label="Temizle">✕</button></div>'}
  return bir("ob","Başlangıç tarihi (isteğe bağlı)",b)+bir("obt","Bitiş tarihi (isteğe bağlı)",t)}
function orgDates(){var b=$("#ob").value,t=$("#obt").value;if(b&&t&&t<b){V.oerr="Bitiş tarihi başlangıçtan önce olamaz.";render();return}
  var q="updateMask.fieldPaths=bas&updateMask.fieldPaths=bit&currentDocument.updateTime="+encodeURIComponent(OM.ut);
  api("PATCH","/orgs/"+OM.id,{fields:fv({bas:b,bit:t})},q).then(function(d){OM.ut=d.updateTime;O.bas=b;O.bit=t;orgRemember();V.oerr="";V.sync="Tarihler kaydedildi.";render();setTimeout(function(){V.sync="";render()},2000)},
    function(e){V.oerr=errTx(e);orgRefresh(true);render()})}
function orgSum(o){var c=orgCounts(o),sp="";try{sp=orgChamp(o)||""}catch(e){}return{oy:c.d,mt:c.n,sp:sp}}
function orgMemo(f,role){var r={name:f.name,pub:!!f.pub,bas:f.bas||"",bit:f.bit||"",oy:f.oy,mt:f.mt,sp:f.sp};
  if(r.oy===undefined&&f.d)try{var x=orgSum(JSON.parse(f.d));r.oy=x.oy;r.mt=x.mt;r.sp=x.sp}catch(e){}
  r.oy=r.oy||0;r.mt=r.mt||0;r.sp=r.sp||"";if(role)r.role=role;return r}
function orgDurum(r){var t=bugun();if(r.sp||(r.bit&&r.bit<t))return"bit";if(!r.oy&&(!r.bas||r.bas>t))return"bas";return"dev"}
var DURUM=[["bas","Başlayacak"],["dev","Devam eden"],["bit","Biten"]];

// ---------------- mail ile devam et ----------------
// Hesap oluştur: bu telefondaki anonim hesap maile bağlanır (aynı kimlik kalır, kurduğun organizasyonlar seninle kalır).
// Giriş yap: başka telefonda da aynı hesap açılır; kurduğun organizasyonlar listeye gelir. Bu telefonda anonim
// hesapla kurulmuş organizasyonlar varsa giriş yapılan hesaba taşınır.
function mailErr(e){var m=String(e&&e.msg||"");
  if(/EMAIL_EXISTS/.test(m))return"Bu mail ile zaten bir hesap var; Giriş yap'ı seç.";
  if(/EMAIL_NOT_FOUND|INVALID_PASSWORD|INVALID_LOGIN_CREDENTIALS/.test(m))return"Mail ya da şifre yanlış.";
  if(/WEAK_PASSWORD/.test(m))return"Şifre en az 6 karakter olmalı.";
  if(/INVALID_EMAIL|MISSING_EMAIL/.test(m))return"Mail adresi geçersiz.";
  if(/USER_DISABLED/.test(m))return"Bu hesap kapatılmış.";
  if(/OPERATION_NOT_ALLOWED|ADMIN_ONLY/.test(m))return"Mail ile giriş şu an kullanılamıyor.";
  if(/TOO_MANY_ATTEMPTS/.test(m))return"Çok fazla deneme yapıldı; biraz sonra tekrar dene.";
  if(/CREDENTIAL_TOO_OLD|TOKEN_EXPIRED/.test(m))return"Oturum eskidi; tekrar dene.";
  return errTx(e)}
function mailOpen(nx){var bk=V.v==="orgnew"?V:null;V={v:"orgmail",mm:"in",em:"",nx:nx||"",bk:bk};window.scrollTo(0,0);render()}
function mailBack(){var bk=V.bk,nx=V.nx;if(bk){V=bk;render()}else if(nx&&O&&OM.id===nx){V={v:"orgv",ot:2};render()}else if(nx)orgOpen(nx);else go("org")}
function mailMode(m){var e=$("#me");if(e)V.em=e.value;V.mm=m;V.err="";V.inf="";render()}
function orgMailV(){if(V.mm==="del")return mailDelV();var h=head("Mail ile devam et","mailBack()"),up=V.mm==="up";
  h+='<div class="card"><div class="seg"><button class="'+(up?"":"on")+'" onclick="mailMode(\'in\')">Giriş yap</button><button class="'+(up?"on":"")+'" onclick="mailMode(\'up\')">Hesap oluştur</button></div>';
  h+='<div class="lbl">Mail</div><input type="email" id="me" autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="ornek@mail.com" value="'+esc(V.em||"")+'">';
  h+='<div class="lbl">Şifre</div><input type="password" id="mp" autocomplete="'+(up?"new-password":"current-password")+'" placeholder="'+(up?"En az 6 karakter":"")+'" onkeydown="if(event.key===\'Enter\')mailGo()">';
  if(V.err)h+='<div class="mu" style="color:var(--rd);text-align:left">'+esc(V.err)+"</div>";
  if(V.inf)h+='<div class="mu" style="text-align:left">'+esc(V.inf)+"</div>";
  h+='<button style="width:100%;margin-top:10px" '+(V.busy?"disabled":"")+' onclick="mailGo()">'+esc(V.busy||(up?"Hesap oluştur":"Giriş yap"))+"</button>";
  if(!up)h+='<button class="g" style="width:100%;margin-top:8px" '+(V.busy?"disabled":"")+' onclick="mailForgot()">Şifremi unuttum</button>';
  return h+"</div>"}
function mailVal(){var e=$("#me"),em=(e?e.value:V.em||"").trim().toLowerCase();V.em=em;return/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)?em:""}
function mailGo(){var em=mailVal(),pw=($("#mp")||{}).value||"";V.inf="";
  if(!em){V.err="Mail adresi geçersiz.";render();return}
  if(pw.length<6){V.err="Şifre en az 6 karakter olmalı.";render();return}
  var old=myAuth(),up=V.mm==="up";V.err="";V.busy=up?"Hesap oluşturuluyor…":"Giriş yapılıyor…";render();
  var p=up&&old&&old.rt&&!old.em?auth().then(function(a){return idt("update",{idToken:a.tok,email:em,password:pw,returnSecureToken:true})})
    :idt(up?"signUp":"signInWithPassword",{email:em,password:pw,returnSecureToken:true});
  p.then(function(r){var n=tokOf(r,em);
      return(old&&old.rt&&!old.em&&old.uid!==n.uid?orgCarry(n):Promise.resolve()).then(function(){setAuth(n);return orgMine()})})
   .then(function(c){var bk=V.bk,nx=V.nx;OMSG=(up?"Hesabın oluşturuldu: ":"Giriş yapıldı: ")+em+(c?" · "+c+" organizasyonun listeye eklendi.":"");V.pubs=null;V.pl=0;
      if(bk){V=bk;render()}else if(nx)orgOpen(nx);else go("org")},
     function(e){V.busy="";V.err=mailErr(e);render()})}
function mailForgot(){var em=mailVal();if(!em){V.err="Önce mail adresini yaz.";render();return}
  V.err="";V.inf="";V.busy="Gönderiliyor…";render();
  idt("sendOobCode",{requestType:"PASSWORD_RESET",email:em}).then(function(){V.busy="";V.inf="Şifre yenileme bağlantısı "+em+" adresine gönderildi. Gelen kutunu ve gereksiz (spam) klasörünü kontrol et.";render()},
    function(e){V.busy="";V.err=mailErr(e);render()})}
function mailOut(){if(V.mo!==1){V.mo=1;render();setTimeout(function(){if(V.mo===1){V.mo=0;render()}},3500);return}V.mo=0;
  Object.keys(DB.orgs).forEach(function(id){if(DB.orgs[id].role==="owner")delete DB.orgs[id]});store();setAuth(null);
  OMSG="Çıkış yapıldı. Mail ile tekrar giriş yapınca organizasyonların geri gelir.";V.pubs=null;V.pl=0;render()}
function ownQ(uid){return{structuredQuery:{from:[{collectionId:"orgs"}],where:{fieldFilter:{field:{fieldPath:"owner"},op:"EQUAL",value:{stringValue:uid}}},limit:300}}}
// anonim hesabın organizasyonlarını ve yöneticilik / izleme üyeliklerini giriş yapılan hesaba taşır
function orgCarry(n){return auth().then(function(a){var hasOwn=Object.keys(DB.orgs).some(function(id){return DB.orgs[id].role==="owner"});
  var own=api("POST",":runQuery",ownQ(a.uid)).then(function(rs){
      return Promise.all((rs||[]).filter(function(r){return r.document}).map(function(r){var id=r.document.name.split("/").pop();
        return api("PATCH","/orgs/"+id,{fields:fv({owner:n.uid})},"updateMask.fieldPaths=owner").then(function(){if(DB.orgs[id])DB.orgs[id].role="owner"})}))},
    function(e){if(hasOwn)throw{msg:"Organizasyonların yeni hesaba taşınamadı ("+errTx(e)+"). Tekrar dene."}});
  var mem=Object.keys(DB.orgs).filter(function(id){return DB.orgs[id].role&&DB.orgs[id].role!=="owner"}).map(function(id){
    return["eds","vw"].reduce(function(pr,k){return pr.then(function(done){if(done)return done;
      return api("GET","/orgs/"+id+"/"+k+"/"+a.uid).then(function(d){
        return fetch(DOCS()+"/orgs/"+id+"/"+k+"/"+n.uid+"?currentDocument.exists=false",{method:"PATCH",headers:{"Authorization":"Bearer "+n.tok,"Content-Type":"application/json"},body:JSON.stringify({fields:d.fields})}).then(function(){return 1},function(){return 1})},function(){return 0})})},Promise.resolve(0))});
  return own.then(function(){return Promise.all(mem)})})}
// giriş yapılan hesabın kurduğu organizasyonları "Organizasyonlarım"a ekler
function orgMine(){var a=myAuth();if(!a)return Promise.resolve(0);
  return api("POST",":runQuery",ownQ(a.uid)).then(function(rs){var c=0;(rs||[]).forEach(function(r){if(!r.document)return;var id=r.document.name.split("/").pop();
    if(!DB.orgs[id])c++;remember(id,orgMemo(fr(r.document.fields),"owner"))});return c},function(){return 0})}

// ---------------- bildirimler ----------------
// Her organizasyon için 🔔 düğmesi (varsayılan açık). Takip listesi telefona (TFBildirim) verilir; telefon uygulama
// kapalıyken de yaklaşık 15 dakikada bir organizasyonlara bakar, yeni skor girildiyse ya da şampiyon belli olduysa bildirim gösterir.
// Listeyle birlikte giden oy/sp değerleri "kullanıcı bunları gördü" demektir; kendi girdiğin skor için bildirim gelmez.
function ntOn(id){var r=DB.orgs[id];return!!r&&r.nt!==false}
function ntToggle(){var r=DB.orgs[OM.id];if(!r)return;r.nt=!ntOn(OM.id);store();ntSync();
  if(r.nt)try{if(window.TFBildirim&&TFBildirim.izinIste)TFBildirim.izinIste()}catch(e){}render()}
function ntSync(){if(!window.TFBildirim||!fbOk())return;var a=myAuth();
  var L=Object.keys(DB.orgs).filter(ntOn).sort(function(x,y){return(DB.orgs[y].used||0)-(DB.orgs[x].used||0)}).slice(0,20)
    .map(function(id){var r=DB.orgs[id];return{id:id,name:r.name||id,oy:r.oy||0,sp:r.sp||""}});
  try{TFBildirim.ayarla(JSON.stringify({key:FB.apiKey,pid:FB.projectId,rt:a&&a.rt||"",orgs:L}))}catch(e){}}
setTimeout(ntSync,1500);

// hesabı silme (App Store ve Google Play kuralı): kurduğun organizasyonlar da herkes için silinir
function mailDelV(){var h=head("Hesabı sil","go(\'org\')");
  h+='<div class="card"><div style="text-align:left"><b>'+esc(V.em||"")+'</b> hesabı ve bu hesapla kurduğun bütün organizasyonlar herkes için silinir. Geri alınamaz.</div>';
  h+='<div class="lbl">Şifre</div><input type="password" id="mp" autocomplete="current-password">';
  if(V.err)h+='<div class="mu" style="color:var(--rd);text-align:left">'+esc(V.err)+"</div>";
  h+='<button class="w" style="width:100%;margin-top:10px" '+(V.busy?"disabled":"")+' onclick="mailDel()">'+esc(V.busy||"Hesabı ve organizasyonlarımı sil")+"</button>";
  h+='<button class="g" style="width:100%;margin-top:8px" '+(V.busy?"disabled":"")+' onclick="mailForgot()">Şifremi unuttum</button>';
  if(V.inf)h+='<div class="mu" style="text-align:left">'+esc(V.inf)+"</div>";
  return h+"</div>"}
function mailDel(){var em=V.em,pw=($("#mp")||{}).value||"";if(!pw){V.err="Şifreni yaz.";render();return}
  V.err="";V.busy="Siliniyor…";render();var n;
  idt("signInWithPassword",{email:em,password:pw,returnSecureToken:true}).then(function(r){n=tokOf(r,em);setAuth(n);
      return api("POST",":runQuery",ownQ(n.uid))})
    .then(function(rs){var w=[];(rs||[]).forEach(function(r){if(!r.document)return;var id=r.document.name.split("/").pop();
        w.push({delete:DNAME("/sec/"+id)},{delete:DNAME("/orgs/"+id)});delete DB.orgs[id]});
      return w.length?api("POST",":commit",{writes:w}):null})
    .then(function(){return idt("delete",{idToken:n.tok})})
    .then(function(){store();setAuth(null);OMSG="Hesabın silindi.";go("org")},function(e){V.busy="";V.err=mailErr(e);render()})}
