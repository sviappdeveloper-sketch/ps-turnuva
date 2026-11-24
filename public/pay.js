// =====================================================================
// 1) Serbest karşılaşma: turnuvaya bağlı olmayan tek maçlar. Sınırsız, istatistiklere girer.
// 2) Turnuva paylaşımı: kurucu turnuvasına kod üretir; kodu bilen herkes fikstür, puan durumu,
//    istatistik ve oyuncuları salt okunur görür. Her skor kaydında paylaşılan kopya güncellenir.
//    Paylaşımı ve turnuvayı yalnızca kurucu (oluşturan telefon) siler.
//    Sunucuda organizasyonlarla aynı yerde durur (orgs/{kod}, typ:"pay", pub:false); izlemek için
//    kodun son 4 hanesi izleme anahtarıdır (sec/{kod}.v), böylece herkese açık listede görünmez.
// 3) Geri: telefonun geri tuşu ekrandaki "← Geri" ile aynı işi yapar; ana menüde çıkış sorulur.
// =====================================================================
DB.free=DB.free||[];DB.seen=DB.seen||{};

// ---------------- serbest karşılaşma ----------------
function allNames(){var m={};DB.lists.forEach(function(L){L.players.forEach(function(p){m[canon(p)]=p})});
  Object.keys(DB.tours).forEach(function(id){DB.tours[id].players.forEach(function(p){m[canon(p)]=p})});
  DB.free.forEach(function(f){m[canon(f.a)]=f.a;m[canon(f.b)]=f.b});
  return Object.keys(m).map(function(k){return m[k]}).sort(function(a,b){return a.localeCompare(b,"tr")})}
function freeNew(){V={v:"free",fa:V.fa||"",fb:V.fb||""};window.scrollTo(0,0);render()}
function freeSave(){var a=$("#fa").value.trim(),b=$("#fb").value.trim();V.fa=a;V.fb=b;
  if(!a||!b){V.err="İki oyuncunun/takımın adını yaz.";render();return}
  if(canon(a)===canon(b)){V.err="İki taraf farklı olmalı.";render();return}
  var f={id:nid(),a:a,b:b,ag:num("fg1"),bg:num("fg2"),ay:num("fy1"),by:num("fy2"),ar:num("fk1"),br:num("fk2"),t:Date.now()};
  DB.free.push(f);V.err="";V.last=f.id;store();window.scrollTo(0,0);render();reklamSay()}
function freeDel(id){if(V.fd!==id){V.fd=id;render();setTimeout(function(){if(V.fd===id){V.fd=null;render()}},3500);return}
  DB.free=DB.free.filter(function(f){return f.id!==id});V.fd=null;if(V.last===id)V.last=null;store();render()}
function freeLine(f){return'<div class="done"><b>'+esc(f.a)+'</b><span class="sc">'+f.ag+" - "+f.bg+'</span><b>'+esc(f.b)+"</b></div>"
  +((f.ay||f.by||f.ar||f.br)?'<div class="mu"><span class="cy"></span> '+f.ay+"-"+f.by+' &nbsp; <span class="cr"></span> '+f.ar+"-"+f.br+"</div>":"")}
function freeV(){var h=head("Serbest karşılaşma"),L=null;
  h+='<div class="mu" style="text-align:left;margin-bottom:12px">Turnuvasız tek maç. Skor kaydedilir ve İstatistikler\'deki genel tabloya, oyuncular arası karşılaşmalara girer. Sınır yok.</div>';
  if(V.last)DB.free.forEach(function(f){if(f.id===V.last)L=f});
  if(L){h+='<div class="card"><div class="lbl" style="margin-top:0;color:var(--ac)">✓ Maç kaydedildi</div>'+freeLine(L)
      +'<button style="width:100%;margin-top:12px;padding:14px" onclick="V.last=null;V.err=\'\';render()">➕ Yeni maç aç</button>'
      +'<button class="g" style="width:100%;margin-top:8px" onclick="V.last=null;V.fa=\''+esc(L.a).replace(/'/g,"\\'")+'\';V.fb=\''+esc(L.b).replace(/'/g,"\\'")+'\';render()">🔁 Aynı ikiliyle yeni maç</button></div>'}
  else{var dl='<datalist id="fnames">'+allNames().map(function(n){return'<option value="'+esc(n)+'">'}).join("")+"</datalist>";
    h+='<div class="card">'+dl+'<div class="vs"><input type="text" id="fa" list="fnames" placeholder="1. oyuncu / takım" value="'+esc(V.fa||"")+'"><span>vs</span><input type="text" id="fb" list="fnames" placeholder="2. oyuncu / takım" value="'+esc(V.fb||"")+'"></div>'
      +'<div class="mt" style="margin-top:12px"><span class="n">Gol</span>'+inp("fg1",0)+"<span>-</span>"+inp("fg2",0)+'<span class="n"></span></div>'
      +'<div class="sub"><label><span><span class="cy"></span> Sarı</span>'+inp("fy1",0)+'</label><label>'+inp("fy2",0)+'</label><label><span><span class="cr"></span> Kırmızı</span>'+inp("fk1",0)+'</label><label>'+inp("fk2",0)+"</label></div>"
      +'<div class="mu" style="color:var(--rd)">'+esc(V.err||"")+'</div><button style="width:100%;padding:14px" onclick="freeSave()">Skoru kaydet</button></div>'}
  if(DB.free.length){h+="<h2>Kayıtlı serbest maçlar ("+DB.free.length+")</h2>";
    DB.free.slice().reverse().forEach(function(f){h+='<div class="card"><div class="mu" style="text-align:left;margin-bottom:4px">'+day(f.t)+"</div>"+freeLine(f)
      +'<div class="btns"><button class="'+(V.fd===f.id?"w":"d")+'" onclick="freeDel(\''+f.id+'\')">'+(V.fd===f.id?"Silinsin mi?":"Sil")+"</button></div></div>"})}
  return h}
// istatistiklerde serbest maçlar: turnuva gibi davranan ama şampiyon/turnuva sayılmayan sanal kayıt
function freeTour(){if(!DB.free.length)return null;var P=[],ix={};
  function id(n){var c=canon(n);if(!(c in ix)){ix[c]=P.length;P.push(n)}return ix[c]}
  var M=DB.free.map(function(f){return{r:1,k:0,leg:1,h:id(f.a),a:id(f.b),d:1,hg:f.ag,ag:f.bg,hy:f.ay,ay:f.by,hr:f.ar,ar:f.br,ph:0,pa:0}});
  return{id:"_free",name:"Serbest maçlar",mode:"lig",legs:1,players:P,matches:M,free:1,created:0}}

// ---------------- paylaşım (kurucu) ----------------
function payData(T){var o=JSON.parse(cleanJSON(T));delete o.pay;delete o.view;delete o.name;delete o.free;delete o.payErr;return JSON.stringify(o)}
function payCode(T){return T&&T.pay?T.pay.id+"-"+T.pay.k:""}
function payOpenScreen(){V={v:"pay"};window.scrollTo(0,0);render()}
function payCreate(){if(!S||S.view)return;if(!fbOk()){V.err="Sunucu bağlantısı yok.";render();return}
  var T=S,id=code(6),k=code(4),now=Date.now();V.busy="Kod oluşturuluyor…";V.err="";render();
  auth().then(function(a){return api("POST",":commit",{writes:[
    {update:{name:DNAME("/orgs/"+id),fields:fv({name:String(T.name).slice(0,80),pub:false,owner:a.uid,upd:now,typ:"pay",d:payData(T)})},currentDocument:{exists:false}},
    {update:{name:DNAME("/sec/"+id),fields:fv({e:code(12),v:k})},currentDocument:{exists:false}}]})})
  .then(function(){T.pay={id:id,k:k};V.busy="";save();render()},function(x){V.busy="";V.err="Kod oluşturulamadı: "+errTx(x)+" İnternet bağlantını kontrol et.";render()})}
var PAYT={};
function paySync(T){if(!T||!T.pay||T.view)return;clearTimeout(PAYT[T.id]);
  PAYT[T.id]=setTimeout(function(){api("PATCH","/orgs/"+T.pay.id,{fields:fv({name:String(T.name).slice(0,80),d:payData(T),upd:Date.now()})},
    "updateMask.fieldPaths=d&updateMask.fieldPaths=upd&updateMask.fieldPaths=name").then(function(){T.payErr="";},function(e){T.payErr=errTx(e)})},1200)}
function payRemote(P){return api("POST",":commit",{writes:[{delete:DNAME("/orgs/"+P.id)},{delete:DNAME("/sec/"+P.id)}]})}
function payStop(){if(!S||!S.pay)return;if(V.ps!==1){V.ps=1;render();setTimeout(function(){if(V.ps===1){V.ps=0;render()}},3500);return}
  V.ps=0;var P=S.pay;V.busy="Paylaşım kaldırılıyor…";render();
  payRemote(P).then(function(){delete S.pay;V.busy="";save();render()},function(e){V.busy="";V.err=errTx(e);render()})}
function payShare(){var c=payCode(S),t="\""+S.name+"\" turnuvamı Turnuva Fikstürü uygulamasında takip et. Ana menü → Kodla turnuva görüntüle → kod: "+c;
  try{if(window.TFPaylas&&window.TFPaylas.metin){window.TFPaylas.metin(t);return}}catch(e){}
  if(navigator.share){navigator.share({text:t}).catch(function(){});return}
  payCopy()}
function payCopy(){var c=payCode(S);try{navigator.clipboard.writeText(c).then(function(){V.ok="Kod kopyalandı.";render()},function(){})}catch(e){}}
function payV(){if(!S||S.view)return menu();var h=head("Turnuvanı paylaş","go(\'tour\')");
  h+='<div class="mu" style="text-align:left;margin-bottom:12px"><b>'+esc(S.name)+'</b> · Kodu verdiğin kişi fikstürü, puan durumunu, istatistikleri ve oyuncuları görür; skor giremez, değiştiremez, silemez. Sen skor girdikçe onun ekranı da güncellenir.</div>';
  if(V.busy)return h+'<div class="card mu">'+esc(V.busy)+"</div>";
  if(!S.pay){h+='<div class="card"><button style="width:100%;padding:14px" onclick="payCreate()">🔗 Paylaşım kodu oluştur</button><div class="mu" style="color:var(--rd)">'+esc(V.err||"")+"</div></div>";return h}
  h+='<div class="card" style="text-align:center"><div class="lbl" style="margin-top:0">Turnuva kodu</div><div class="sc" style="font-size:40px;letter-spacing:3px;user-select:all">'+payCode(S)+'</div>'
    +'<div class="btns"><button onclick="payShare()">📤 Kodu gönder</button><button class="g" onclick="payCopy()">📋 Kopyala</button></div>'
    +'<div class="mu" style="color:var(--ac)">'+esc(V.ok||"")+'</div>'+(S.payErr?'<div class="mu" style="color:var(--rd)">Son güncelleme gönderilemedi: '+esc(S.payErr)+"</div>":"")+"</div>";
  h+='<div class="card"><div class="lbl" style="margin-top:0">Paylaşımı kaldır</div><div class="mu" style="text-align:left">Kod geçersiz olur, kodu bilenler turnuvayı artık göremez. Turnuva senin telefonunda kalır.</div>'
    +'<button class="'+(V.ps===1?"w":"d")+'" style="width:100%;margin-top:8px" onclick="payStop()">'+(V.ps===1?"Paylaşım kaldırılsın mı?":"🚫 Paylaşımı kaldır")+'</button><div class="mu" style="color:var(--rd)">'+esc(V.err||"")+"</div></div>";
  return h}

// ---------------- kodla görüntüleme (izleyici) ----------------
function parseCode(c){c=String(c||"").toUpperCase().replace(/[^A-Z0-9]/g,"");return c.length===10?{id:c.slice(0,6),k:c.slice(6)}:null}
function viewOpenScreen(){V={v:"pview",code:V.code||""};window.scrollTo(0,0);render()}
function viewLoad(id){return api("GET","/orgs/"+id).then(function(doc){var f=fr(doc.fields);if(f.typ!=="pay")throw{st:404};
  var o=JSON.parse(f.d);o.name=f.name;o.upd=f.upd;o.id="_v"+id;o.view=1;o.ro=1;o.vid=id;o.tab=0;o.ut=doc.updateTime;return o})}
function viewOpen(c){var p=parseCode(c);V.code=c;if(!p){V.err="Kod 10 karakter olmalı (örn. K7M2QX-9F3A).";render();return}
  if(!fbOk()){V.err="Sunucu bağlantısı yok.";render();return}
  V.err="";V.busy="Açılıyor…";render();
  auth().then(function(a){return viewLoad(p.id).catch(function(){
      return api("PATCH","/orgs/"+p.id+"/vw/"+a.uid,{fields:fv({p:p.k})},"currentDocument.exists=false").then(function(){return viewLoad(p.id)})})})
  .then(function(T){DB.seen[p.id+"-"+p.k]={name:T.name,used:Date.now()};store();S=T;V={v:"tour"};window.scrollTo(0,0);render()},
    function(e){V.busy="";V.err=e&&(e.st===403||e.st===404)?"Bu kodla bir turnuva bulunamadı. Kod yanlış olabilir ya da kurucu paylaşımı kaldırmış / turnuvayı silmiş olabilir.":"Açılamadı: "+errTx(e);render()})}
function viewForget(c){if(V.vf!==c){V.vf=c;render();setTimeout(function(){if(V.vf===c){V.vf=null;render()}},3500);return}delete DB.seen[c];V.vf=null;store();render()}
function viewV(){var h=head("Kodla turnuva görüntüle");
  h+='<div class="mu" style="text-align:left;margin-bottom:12px">Arkadaşının verdiği kodu yaz; turnuvanın fikstürünü, puan durumunu, istatistiklerini ve oyuncularını görürsün. Skorlar kurucu girdikçe güncellenir.</div>';
  h+='<div class="card"><div class="row"><input type="text" id="vc" placeholder="Örn. K7M2QX-9F3A" autocapitalize="characters" style="text-transform:uppercase" value="'+esc(V.code||"")+'" oninput="V.code=this.value" onkeydown="if(event.key===\'Enter\')viewOpen(this.value)"><button onclick="viewOpen(V.code)">Aç</button></div>'
    +'<div class="mu" style="text-align:left">'+esc(V.busy||"")+'</div><div class="mu" style="color:var(--rd);text-align:left">'+esc(V.err||"")+"</div></div>";
  var ks=Object.keys(DB.seen).sort(function(a,b){return(DB.seen[b].used||0)-(DB.seen[a].used||0)});
  if(ks.length){h+="<h2>Daha önce açtıkların</h2>";ks.forEach(function(c){var r=DB.seen[c];
    h+='<div class="card"><div class="it"><div><div class="nm">'+esc(r.name||c)+'</div><div class="mu" style="text-align:left">Kod: <b>'+c+'</b></div></div><button onclick="viewOpen(\''+c+'\')">Aç</button></div>'
      +'<div class="btns"><button class="d" onclick="viewForget(\''+c+'\')">'+(V.vf===c?"Listeden kaldırılsın mı?":"Listeden kaldır")+"</button></div></div>"})}
  return h}
// açık izleme ekranı 15 sn'de bir yenilenir
setInterval(function(){if(V.v!=="tour"||!S||!S.view)return;var T=S;
  api("GET","/orgs/"+T.vid).then(function(doc){if(doc.updateTime===T.ut||S!==T)return;var f=fr(doc.fields),o=JSON.parse(f.d);
    o.name=f.name;o.upd=f.upd;o.id=T.id;o.view=1;o.ro=1;o.vid=T.vid;o.tab=T.tab;o.ha=T.ha;o.hb=T.hb;o.ut=doc.updateTime;S=o;render()},
  function(e){if(S===T&&(e.st===403||e.st===404)){S.gone=1;render()}})},15000);

// ---------------- geri tuşu ve çıkış sorusu ----------------
function exitAsk(on){var e=$("#exitAsk");if(on&&!e){e=document.createElement("div");e.id="exitAsk";
    e.innerHTML='<div class="card" style="max-width:320px;width:86%;text-align:center;padding:20px"><div style="font-weight:700;font-size:18px;margin-bottom:16px">Uygulamadan çıkmak istiyor musunuz?</div><div class="btns"><button class="g" onclick="exitAsk(0)">Hayır</button><button onclick="exitYes()">Evet</button></div></div>';
    e.onclick=function(ev){if(ev.target===e)exitAsk(0)};document.body.appendChild(e)}
  else if(!on&&e)e.remove()}
function exitYes(){exitAsk(0);try{if(window.TFCikis){window.TFCikis.cik();return}}catch(e){}}
// Android'in geri tuşu buraya gelir. "ok": sayfa halletti; "exit": uygulama kapanabilir (kullanılmıyor, çıkış hep sorulur)
window.appBack=function(){
  if($("#exitAsk")){exitAsk(0);return"ok"}
  if(V.v==="menu"||(V.v==="tour"&&!S)){exitAsk(1);return"ok"}
  var b=document.querySelector("#app .top .back");if(b)b.click();else go("menu");return"ok"};
// iPhone: soldan kenar kaydırması geri gider (ana menüde bir şey yapmaz; iOS uygulamaları kendini kapatmaz)
(function(){if(!/iPhone|iPad|iPod/.test(navigator.userAgent))return;var sx=-1,sy=0;
  document.addEventListener("touchstart",function(e){var t=e.touches[0];sx=t.clientX<28?t.clientX:-1;sy=t.clientY},{passive:true});
  document.addEventListener("touchend",function(e){if(sx<0)return;var t=e.changedTouches[0];if(t.clientX-sx>80&&Math.abs(t.clientY-sy)<70&&V.v!=="menu"&&!(V.v==="tour"&&!S)){var b=document.querySelector("#app .top .back");if(b)b.click()}sx=-1},{passive:true})})();
