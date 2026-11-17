// =====================================================================
// Organizasyon: eski Şampiyonlar Ligi usulü gruplar + eleme turları.
// Veriler Firebase (Firestore) üzerinde durur; herkes aynı organizasyonu görür.
// Yetki: organizasyonu kuran (kurucu) + yönetici şifresini girenler (yöneticiler) skor girer.
// Herkese açık organizasyonları herkes görür; kapalı olanlar için kod + izleme şifresi gerekir.
// Firestore kuralları: depo kökündeki firestore.rules
// =====================================================================
var FB={apiKey:"AIzaSyBH9GhNhHbjmjps5FySin10vAgWlifxVR8",projectId:"turnuva-fiksturu"};   // Firebase → Proje ayarları → Web uygulaması (apiKey, projectId)
var O=null,OM={},OPOLL=null;        // O: açık organizasyon, OM: id, rol, sunucu sürümü (ut), sahibi
DB.orgs=DB.orgs||{};
var FIX=["id","org","ro","cf","fl","tab","da","pe","ha","hb"];
function fbOk(){return!!(FB.apiKey&&FB.projectId)}
function DOCS(){return"https://firestore.googleapis.com/v1/projects/"+FB.projectId+"/databases/(default)/documents"}
function DNAME(p){return"projects/"+FB.projectId+"/databases/(default)/documents"+p}
function jr(r){return r.text().then(function(t){var o={};try{o=t?JSON.parse(t):{}}catch(e){}if(!r.ok){var e=o.error||{};throw{st:r.status,code:e.status||"",msg:e.message||("HTTP "+r.status)}}return o})}
function myAuth(){try{return JSON.parse(localStorage.getItem("tf-auth")||"null")}catch(e){return null}}
function auth(){var a=myAuth();if(a&&a.tok&&a.exp>Date.now()+120000)return Promise.resolve(a);
  var p=a&&a.rt?fetch("https://securetoken.googleapis.com/v1/token?key="+FB.apiKey,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=refresh_token&refresh_token="+encodeURIComponent(a.rt)}).then(jr).then(function(r){return{uid:r.user_id,tok:r.id_token,rt:r.refresh_token,exp:Date.now()+(+r.expires_in)*1000}})
    :fetch("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key="+FB.apiKey,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({returnSecureToken:true})}).then(jr).then(function(r){return{uid:r.localId,tok:r.idToken,rt:r.refreshToken,exp:Date.now()+(+r.expiresIn)*1000}});
  return p.then(function(n){try{localStorage.setItem("tf-auth",JSON.stringify(n))}catch(e){}return n})}
function api(m,path,body,q){return auth().then(function(a){return fetch(DOCS()+path+(q?"?"+q:""),{method:m,headers:{"Authorization":"Bearer "+a.tok,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined})}).then(jr)}
function fv(o){var f={};for(var k in o){var v=o[k];f[k]=typeof v==="boolean"?{booleanValue:v}:typeof v==="number"?{integerValue:String(Math.round(v))}:{stringValue:String(v)}}return f}
function fr(f){var o={};for(var k in f||{}){var v=f[k];o[k]="booleanValue"in v?v.booleanValue:"integerValue"in v?+v.integerValue:v.stringValue}return o}
function code(n){var A="ABCDEFGHJKLMNPQRSTUVWXYZ23456789",s="",r=new Uint32Array(n);try{crypto.getRandomValues(r)}catch(e){for(var i=0;i<n;i++)r[i]=Math.random()*1e9}for(var j=0;j<n;j++)s+=A[r[j]%A.length];return s}
function pin(){return String(100000+Math.floor(Math.random()*900000))}
function errTx(e){if(!e)return"Bilinmeyen hata";if(e.st===403||e.code==="PERMISSION_DENIED")return"İzin yok (şifre yanlış olabilir).";if(e.st===404)return"Bulunamadı.";if(e.code==="FAILED_PRECONDITION"||e.code==="ABORTED")return"Bu arada başka bir yönetici değişiklik yaptı.";if(e instanceof TypeError||e.message==="Failed to fetch")return"İnternet bağlantısı yok.";return e.msg||String(e)}
function cleanJSON(o){return JSON.stringify(o,function(k,v){return FIX.indexOf(k)>=0?undefined:v})}
function remember(id,x){var r=DB.orgs[id]||{};for(var k in x)r[k]=x[k];r.used=Date.now();DB.orgs[id]=r;store()}

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
  var o=JSON.parse(f.d);o.name=f.name;o.pub=!!f.pub;OM.ut=doc.updateTime;OM.owner=f.owner;OM.id=id;return o})}
function orgRole(id){var a=myAuth();if(a&&OM.owner===a.uid)return Promise.resolve("owner");
  return api("GET","/orgs/"+id+"/eds/"+a.uid).then(function(){return"ed"},function(){return"vw"})}
function orgOpen(id,ge){id=String(id||"").trim().toUpperCase();if(!id)return;
  V={v:"orgv",ot:0,g:0,busy:"Yükleniyor…"};O=null;OM={id:id};render();
  orgLoad(id).then(function(o){O=o;return orgRole(id)}).then(function(r){OM.role=r;V.busy="";if(ge&&canEd())geStart();
    remember(id,{name:O.name,pub:O.pub,role:r});render()},
  function(e){V={v:"orgjoin",code:id,err:e.st===403||e.st===404?"Bu kodla açık bir organizasyon bulunamadı. Kapalı bir organizasyonsa izleme ya da yönetici şifresini gir.":errTx(e)};render()})}
function orgRefresh(quiet){if(!O||!OM.id||V.v!=="orgv")return;
  return api("GET","/orgs/"+OM.id).then(function(doc){if(doc.updateTime===OM.ut)return;var f=fr(doc.fields),o=JSON.parse(f.d);o.name=f.name;o.pub=!!f.pub;
    O=o;OM.ut=doc.updateTime;render()},function(e){if(!quiet){V.oerr=errTx(e);render()}})}
var OSAVE=null;
function orgSave(){if(!O)return;orgKO(O);O.updated=Date.now();remember(OM.id,{name:O.name});
  var body={fields:fv({name:O.name,d:cleanJSON(stripMeta(O)),upd:O.updated})};
  V.oerr="";V.sync="Kaydediliyor…";
  var q="updateMask.fieldPaths=d&updateMask.fieldPaths=upd&updateMask.fieldPaths=name&currentDocument.updateTime="+encodeURIComponent(OM.ut);
  OSAVE=api("PATCH","/orgs/"+OM.id,body,q).then(function(doc){OM.ut=doc.updateTime;V.sync="";render()},function(e){V.sync="";
    V.oerr=errTx(e)+" Son hali yüklendi, gerekiyorsa skoru tekrar gir.";OM.ut="";orgRefresh(true);render()})}
function stripMeta(o){var c={};for(var k in o)if(k!=="name"&&k!=="pub")c[k]=o[k];return c}
setInterval(function(){if(V.v==="orgv"&&O&&!V.sync){var a=document.activeElement;if(a&&(a.tagName==="INPUT"||a.tagName==="SELECT"))return;
  var typed=[].some.call(document.querySelectorAll('#app input[type=number]'),function(e){return e.value&&e.value!=="0"});if(!typed)orgRefresh(true)}},12000);

// ---------------- ekranlar ----------------
function orgRender(){
  if(V.v==="orgnew")return orgNewV();
  if(V.v==="orgjoin")return orgJoinV();
  if(V.v==="orgv")return orgV();
  return orgHome()}
function noServer(){return'<div class="card"><b>Sunucu bağlantısı henüz ayarlanmadı.</b><div class="mu" style="text-align:left;margin-top:6px">Organizasyonlar internet üzerinden paylaşıldığı için ortak bir sunucu gerekiyor. Uygulamanın bir sonraki sürümünde açılacak.</div></div>'}
function orgHome(){var h=head("Organizasyon");
  h+='<div class="mu" style="text-align:left;margin-bottom:12px">Takımlar kurayla gruplara ayrılır, gruplardan çıkanlar eleme turlarında oynar (eski Şampiyonlar Ligi usulü). Yönetici şifresini verdiğin kişiler de skor girebilir.</div>';
  if(!fbOk())return h+noServer();
  h+='<button class="big" onclick="orgNew()"><span class="ic">➕</span><span>Yeni organizasyon<small>Takımlar, grup sayısı, eleme ve final ayarları</small></span></button>';
  h+='<div class="card"><div class="lbl" style="margin-top:0">Kodla aç</div><div class="row"><input type="text" id="oc" placeholder="Örn. K7M2QX" autocapitalize="characters" style="text-transform:uppercase" value="'+esc(V.oc||"")+'" oninput="V.oc=this.value" onkeydown="if(event.key===\'Enter\')orgOpen(this.value)"><button onclick="orgOpen(V.oc)">Aç</button></div></div>';
  var my=Object.keys(DB.orgs).sort(function(a,b){return(DB.orgs[b].used||0)-(DB.orgs[a].used||0)});
  if(my.length){h+="<h2>Organizasyonlarım</h2>";my.forEach(function(id){var r=DB.orgs[id];
    h+='<div class="card"><div class="it"><div><div class="nm">'+esc(r.name||id)+'</div><div class="mu" style="text-align:left"><span class="tg">'+(r.pub?"Herkese açık":"Kapalı")+'</span><span class="tg">'+rolTx(r.role)+"</span>Kod: <b>"+id+'</b></div></div><button onclick="orgOpen(\''+id+'\')">Aç</button></div>'
      +'<div class="btns"><button class="d" onclick="orgForget(\''+id+'\')">'+(V.fg===id?"Listeden kaldırılsın mı?":"Listeden kaldır")+"</button></div></div>"})}
  h+="<h2>Herkese açık organizasyonlar</h2>";
  if(!V.pubs){if(!V.pl){V.pl=1;orgPubs()}h+='<div class="card mu">Yükleniyor…</div>'}
  else if(V.pubs.err)h+='<div class="card mu">'+esc(V.pubs.err)+' <button class="g" onclick="V.pubs=null;V.pl=0;render()">Tekrar dene</button></div>';
  else if(!V.pubs.length)h+='<div class="card mu">Henüz herkese açık organizasyon yok.</div>';
  else V.pubs.forEach(function(p){h+='<div class="card"><div class="it"><div><div class="nm">'+esc(p.name)+'</div><div class="mu" style="text-align:left">'+day(p.upd)+" · Kod: <b>"+p.id+'</b></div></div><button onclick="orgOpen(\''+p.id+'\')">Aç</button></div></div>'});
  return h}
function orgForget(id){if(V.fg!==id){V.fg=id;render();setTimeout(function(){if(V.fg===id){V.fg=null;render()}},3500);return}delete DB.orgs[id];V.fg=null;store();render()}
function orgPubs(){api("POST",":runQuery",{structuredQuery:{from:[{collectionId:"orgs"}],where:{fieldFilter:{field:{fieldPath:"pub"},op:"EQUAL",value:{booleanValue:true}}},limit:100}})
  .then(function(rs){var L=[];(rs||[]).forEach(function(r){if(!r.document)return;var f=fr(r.document.fields);L.push({id:r.document.name.split("/").pop(),name:f.name,upd:f.upd||0})});
    L.sort(function(a,b){return b.upd-a.upd});if(V.v==="org"){V.pubs=L;render()}},function(e){if(V.v==="org"){V.pubs={err:errTx(e)};render()}})}

// yeni organizasyon formu
function orgNew(){V={v:"orgnew",name:"",teams:[],ng:2,adv:2,gl:2,kl:2,fs:true,pub:true,man:false,ep:pin(),vp:pin(),err:""};render()}
function onm(){var e=$("#tn");if(e)V.name=e.value;e=$("#ep");if(e)V.ep=e.value;e=$("#vp");if(e)V.vp=e.value}
function oset(k,v){onm();V[k]=v;render()}
function oadd(){onm();var e=$("#nm"),v=e.value.trim();if(!v)return;if(V.teams.some(function(p){return canon(p)===canon(v)})){V.err="Bu takım zaten listede.";render();return}V.teams.push(v);V.err="";render();$("#nm").focus()}
function odel(i){onm();V.teams.splice(i,1);render()}
function opick(i){onm();V.teams=DB.lists[i].players.slice();render()}
function seg(k,opts){return'<div class="seg">'+opts.map(function(o){return'<button class="'+(V[k]===o[0]?"on":"")+'" onclick="oset(\''+k+'\','+JSON.stringify(o[0])+')">'+o[1]+"</button>"}).join("")+"</div>"}
function orgPlan(){var n=V.teams.length,q=V.ng*V.adv,gs=Math.floor(n/V.ng),r=n%V.ng;
  var s=V.ng===1?"Tek grup":V.ng+" grup",per=r?gs+"-"+(gs+1):String(gs);
  var ko=V.ng===1&&V.adv===1?"Eleme yok, grup birincisi şampiyon.":q===2?"Gruplardan çıkan 2 takım finalde.":q+" takımlık eleme: "+(q===4?"yarı final, final":q===8?"çeyrek final, yarı final, final":"son 16, çeyrek final, yarı final, final")+".";
  return n?s+", grup başına "+per+" takım. Her gruptan "+V.adv+" takım çıkar. "+ko:""}
function orgNewV(){var h=head("Yeni organizasyon","go(\'org\')");
  h+='<div class="card"><div class="lbl" style="margin-top:0">Organizasyon adı</div><input type="text" id="tn" placeholder="Örn. Kış Kupası" value="'+esc(V.name)+'">';
  h+='<div class="lbl">Grup sayısı</div>'+seg("ng",[[1,"1"],[2,"2"],[4,"4"],[8,"8"]]);
  h+='<div class="lbl">Her gruptan çıkan</div>'+seg("adv",[[1,"1 takım"],[2,"2 takım"]]);
  h+='<div class="lbl">Gruplama</div>'+seg("man",[[false,"🎲 Kura"],[true,"✋ Elle dizerim"]]);
  h+='<div class="lbl">Grup maçları</div>'+seg("gl",[[1,"Tek maç"],[2,"Rövanşlı"]]);
  h+='<div class="lbl">Eleme turları</div>'+seg("kl",[[1,"Tek maç"],[2,"Rövanşlı"]]);
  h+='<label style="display:flex;gap:10px;align-items:center;margin-top:12px"><input type="checkbox" '+(V.fs?"checked":"")+' onchange="oset(\'fs\',this.checked)"> Final tek maç</label>';
  h+='<div class="lbl">Görünürlük</div>'+seg("pub",[[true,"🌍 Herkese açık"],[false,"🔒 Kapalı"]]);
  h+='<div class="mu" style="text-align:left">'+(V.pub?"Herkes listede görür ve izleyebilir.":"Listede görünmez; yalnızca kodu ve izleme şifresini bilenler görebilir.")+"</div>";
  h+='<div class="lbl">Yönetici şifresi</div><input type="text" id="ep" inputmode="numeric" value="'+esc(V.ep)+'"><div class="mu" style="text-align:left">Bu şifreyi verdiğin kişiler de skor girip düzeltebilir.</div>';
  if(!V.pub)h+='<div class="lbl">İzleme şifresi</div><input type="text" id="vp" inputmode="numeric" value="'+esc(V.vp)+'"><div class="mu" style="text-align:left">Yalnızca izleyebilir, değişiklik yapamaz.</div>';
  h+="</div>";
  h+='<div class="card"><h2 style="margin-top:0">Takımlar ('+V.teams.length+')</h2><div class="row"><input type="text" id="nm" placeholder="Takım ya da oyuncu adı" onkeydown="if(event.key===\'Enter\')oadd()"><button onclick="oadd()">Ekle</button></div><div style="margin-top:10px">';
  V.teams.forEach(function(p,i){h+='<span class="chip">'+esc(p)+'<b onclick="odel('+i+')" aria-label="Sil">✕</b></span>'});
  h+='</div><div class="mu" style="text-align:left">'+esc(orgPlan())+'</div><div class="mu" style="color:var(--rd)">'+esc(V.err||"")+"</div></div>";
  if(DB.lists.length){h+='<div class="card"><div class="lbl" style="margin-top:0">Kayıtlı listeden seç</div>';
    DB.lists.forEach(function(L,i){h+='<span class="chip s" onclick="opick('+i+')">'+esc(L.name)+' <span class="mu">('+L.players.length+")</span></span>"});h+="</div>"}
  h+='<button style="width:100%;padding:14px" '+(V.busy?"disabled":"")+' onclick="orgCreate()">'+(V.busy||(V.man?"Organizasyonu kur ve grupları diz":"Kurayı çek ve organizasyonu başlat"))+"</button>";
  return h}
function orgCreate(){onm();var n=V.teams.length;
  var e=!V.name.trim()?"Organizasyona bir ad ver.":n<V.ng*2?V.ng+" grup için en az "+V.ng*2+" takım gerekir.":Math.floor(n/V.ng)<=V.adv&&V.ng>1?"Her grupta çıkan takım sayısından fazla takım olmalı; takım ekle ya da grup sayısını azalt.":V.ng===1&&n<=V.adv?"En az "+(V.adv+1)+" takım gerekir.":!/^\S{4,}$/.test(V.ep)?"Yönetici şifresi en az 4 karakter olmalı.":!V.pub&&!/^\S{4,}$/.test(V.vp)?"İzleme şifresi en az 4 karakter olmalı.":"";
  if(e){V.err=e;render();return}
  var o={v:1,teams:V.teams.slice(),ng:V.ng,adv:V.adv,gl:V.gl,kl:V.kl,fs:!!V.fs,created:Date.now(),updated:Date.now()};orgBuild(o);
  var id=code(6),pw=V.ep,vp=V.pub?pw:V.vp;V.busy="Kuruluyor…";V.err="";render();addList(V.teams);
  auth().then(function(a){return api("POST",":commit",{writes:[
    {update:{name:DNAME("/orgs/"+id),fields:fv({name:V.name.trim(),pub:!!V.pub,owner:a.uid,upd:o.updated,d:cleanJSON(o)})},currentDocument:{exists:false}},
    {update:{name:DNAME("/sec/"+id),fields:fv({e:pw,v:vp})},currentDocument:{exists:false}}]})})
  .then(function(){var man=V.man;remember(id,{name:V.name.trim(),pub:!!V.pub,role:"owner"});orgOpen(id,man)},function(x){V.busy="";V.err="Kurulamadı: "+errTx(x);render()})}

// kapalı organizasyona / yönetici olarak katılma
function orgJoinV(){var h=head("Organizasyona katıl","go(\'org\')");
  h+='<div class="card"><div class="lbl" style="margin-top:0">Kod</div><input type="text" id="jc" value="'+esc(V.code||"")+'" style="text-transform:uppercase">';
  h+='<div class="lbl">Şifre</div><input type="text" id="jp" inputmode="numeric" placeholder="İzleme ya da yönetici şifresi" value="'+esc(V.pw||"")+'">';
  h+='<div class="lbl">Adın (yönetici olacaksan)</div><input type="text" id="jn" placeholder="Kurucu yetkilileri bu adla görür" value="'+esc(V.nm||localStorage.getItem("tf-ad")||"")+'">';
  h+='<div class="mu" style="color:var(--rd);text-align:left">'+esc(V.err||"")+'</div><div class="btns"><button class="g" onclick="orgJoin(0)">👁 İzleyici olarak</button><button onclick="orgJoin(1)">✏️ Yönetici olarak</button></div></div>';
  return h}
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
  var h=head(esc(O.name),"go(\'org\')",'<button class="g" onclick="orgRefresh()">↻ Yenile</button>');
  h+='<div class="mu" style="text-align:left;margin-bottom:10px"><span class="tg">'+(O.pub?"🌍 Açık":"🔒 Kapalı")+'</span><span class="tg'+(ce?" ok":"")+'">'+rolTx(OM.role)+"</span>Kod: <b>"+OM.id+"</b> · "+c.d+"/"+c.n+" maç</div>";
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
  h+="<h2>"+G.n+" Grubu</h2>"+gTable(G)+'<div class="mu">İlk '+O.adv+" takım (yeşil) eleme turuna çıkar.</div>";
  S=G;S.org=1;S.ro=!ce;h+=fix();
  return h}
function orgKOV(ce){var h="";
  if(!O.ko){if(O.ng===1&&O.adv===1)return'<div class="card mu">Bu organizasyonda eleme turu yok; grup birincisi şampiyon olur.</div>';
    var Q=quals(O),T=koPairs(O,Q),done=O.groups.filter(gDone).length;
    h+='<div class="card mu" style="text-align:left">Eleme eşleşmeleri bütün grup maçları bitince kendiliğinden oluşur ('+done+"/"+O.groups.length+' grup bitti). Şu anki sıralamaya göre:</div>';
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
  h+='<div class="lbl">Paylaş</div><div style="text-align:left">Arkadaşların uygulamada <b>Organizasyon → Kodla aç</b> bölümüne <b style="font-size:20px;letter-spacing:2px">'+OM.id+"</b> yazarak "+(O.pub?"izleyebilir.":"ve izleme şifresiyle görebilir.")+"</div></div>";
  if(!ce){h+='<div class="card"><div class="lbl" style="margin-top:0">Düzenleme yetkisi</div><div class="mu" style="text-align:left">Skor girmek için kurucudan yönetici şifresini iste.</div><button style="width:100%;margin-top:8px" onclick="V={v:\'orgjoin\',code:\''+OM.id+'\'};render()">✏️ Yönetici şifresini gir</button></div>';return h}
  h+='<div class="card"><div class="lbl" style="margin-top:0">Fikstür</div><div class="btns"><button class="'+(V.ocf==="rd"?"w":"g")+'" onclick="orgRedraw()">'+(V.ocf==="rd"?"Bütün skorlar silinir, emin misin?":"🔀 Grup kurasını yeniden çek")+'</button><button class="'+(V.ocf==="rs"?"w":"d")+'" onclick="orgReset()">'+(V.ocf==="rs"?"Bütün skorlar silinsin mi?":"↺ Sıfırla")+'</button></div><button class="g" style="width:100%;margin-top:6px" onclick="geStart()">✋ Grupları elle düzenle / takım adlarını düzelt</button><div class="mu" style="text-align:left">Kura takımları gruplara yeniden dağıtır. Sıfırla gruplar aynı kalarak bütün skorları siler.</div></div>';
  if(OM.role!=="owner")return h+'<div class="mu">Şifreleri, görünürlüğü ve yöneticileri kurucu yönetir.</div>';
  // kurucu
  if(!V.sec&&!V.secl){V.secl=1;api("GET","/sec/"+OM.id).then(function(d){V.sec=fr(d.fields);render()},function(e){V.sec={err:errTx(e)};render()});
    api("GET","/orgs/"+OM.id+"/eds",null,"pageSize=100").then(function(r){V.eds=(r.documents||[]).map(function(d){var f=fr(d.fields);return{uid:d.name.split("/").pop(),n:f.n||"İsimsiz",t:f.t||0}});render()},function(){V.eds=[];render()})}
  h+='<div class="card"><div class="lbl" style="margin-top:0">Kurucu ayarları</div>';
  h+='<div class="lbl">Ad</div><div class="row"><input type="text" id="on" value="'+esc(O.name)+'"><button onclick="orgName()">Kaydet</button></div>';
  h+='<div class="lbl">Görünürlük</div><div class="seg"><button class="'+(O.pub?"on":"")+'" onclick="orgPub(true)">🌍 Herkese açık</button><button class="'+(O.pub?"":"on")+'" onclick="orgPub(false)">🔒 Kapalı</button></div>';
  if(V.sec&&!V.sec.err){h+='<div class="lbl">Yönetici şifresi</div><div class="row"><input type="text" id="se" value="'+esc(V.sec.e)+'"><button onclick="orgPw()">Değiştir</button></div>';
    if(!O.pub)h+='<div class="lbl">İzleme şifresi</div><div class="row"><input type="text" id="sv" value="'+esc(V.sec.v)+'"><button onclick="orgPw()">Değiştir</button></div>';}
  else if(V.sec&&V.sec.err)h+='<div class="mu" style="color:var(--rd)">'+esc(V.sec.err)+"</div>";
  h+='<div class="mu" style="text-align:left">Şifreyi değiştirmek, daha önce girmiş yöneticilerin yetkisini almaz; aşağıdan tek tek çıkarabilirsin.</div>';
  h+='<div class="lbl">Yöneticiler</div>';
  if(!V.eds)h+='<div class="mu">Yükleniyor…</div>';else if(!V.eds.length)h+='<div class="mu" style="text-align:left">Henüz yönetici yok. Yönetici şifresini verdiğin kişiler buraya eklenir.</div>';
  else V.eds.forEach(function(e,i){h+='<div class="it" style="margin:6px 0"><span><b>'+esc(e.n)+'</b> <span class="mu" style="margin:0">'+(e.t?day(e.t):"")+'</span></span><button class="d" onclick="orgKick('+i+')">'+(V.kk===i?"Emin misin?":"Yetkiyi al")+"</button></div>"});
  h+='<div class="lbl">Organizasyonu sil</div><button class="'+(V.ocf==="del"?"w":"d")+'" style="width:100%" onclick="orgDel()">'+(V.ocf==="del"?"Herkes için silinsin mi? Geri alınamaz.":"🗑 Organizasyonu sil")+"</button></div>";
  return h}
function ocfm(k,fn){if(V.ocf!==k){V.ocf=k;render();setTimeout(function(){if(V.ocf===k){V.ocf="";render()}},3500);return}V.ocf="";fn()}
function anyOrgPlayed(){return orgCounts(O).d>0}
function orgRedraw(){var f=function(){orgBuild(O);V.g=0;orgSave();render()};if(anyOrgPlayed())ocfm("rd",f);else f()}
function orgReset(){if(!anyOrgPlayed()){V.oerr="Henüz girilmiş skor yok.";render();return}
  ocfm("rs",function(){O.groups.forEach(function(g){g.matches.forEach(function(x){x.d=0;x.hg=x.ag=x.hy=x.hr=x.ay=x.ar=0})});O.ko=null;orgSave();render()})}
function orgName(){var v=$("#on").value.trim();if(!v)return;O.name=v;orgSave();render()}
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
function geView(){var h='<div class="card"><div class="lbl" style="margin-top:0">Grupları düzenle</div><div class="mu" style="text-align:left">Her takımın yanındaki harfe dokunarak grubunu değiştir, adını da düzeltebilirsin. Üyeleri değişen grupların maçları baştan kurulur, diğer grupların skorları korunur.</div></div>';
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
  V.ge.forEach(function(t){t.n=t.n.trim();if(!t.n)e="Takım adı boş olamaz.";else if(names[canon(t.n)])e="Aynı ad iki kez var: "+t.n;names[canon(t.n)]=1});
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
