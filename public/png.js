// PNG paylaşımı: puan durumu ve maç listeleri resim olarak çizilir, telefonun paylaş menüsü açılır.
// Bloklar: {t:"h",x:"başlık"}  {t:"tb",hd:[...],rows:[[...]],q:[vurgulu satırlar],p:puan sütunu}
//          {t:"m",a:"ev",b:"deplasman",s:"2 - 1",n:"not"}  {t:"c",x:"🏆 Şampiyon"}
var PNGC={bg:"#eaf3ed",card:"#ffffff",tx:"#10281a",mu:"#6b8a77",ac:"#16a34a",bd:"#dbe7df",q:"#dcfce7",p:"#eaf8ee"};
var PF="-apple-system,system-ui,Roboto,'Segoe UI',sans-serif";
function rr(x,X,Y,w,h,r){x.beginPath();x.moveTo(X+r,Y);x.lineTo(X+w-r,Y);x.quadraticCurveTo(X+w,Y,X+w,Y+r);x.lineTo(X+w,Y+h-r);x.quadraticCurveTo(X+w,Y+h,X+w-r,Y+h);x.lineTo(X+r,Y+h);x.quadraticCurveTo(X,Y+h,X,Y+h-r);x.lineTo(X,Y+r);x.quadraticCurveTo(X,Y,X+r,Y);x.closePath()}
function fit(x,t,w){t=String(t);if(x.measureText(t).width<=w)return t;while(t.length>1&&x.measureText(t+"…").width>w)t=t.slice(0,-1);return t+"…"}
function pngMake(title,sub,blocks){
  var W=1080,P=44,C=PNGC,i;
  var hOf=function(b){return b.t==="h"?86:b.t==="tb"?72+b.rows.length*64+24:b.t==="m"?(b.n?92:72):b.t==="c"?110:0};
  var H=200;blocks.forEach(function(b){H+=hOf(b)});H+=90;H=Math.min(H,16000);
  var cv=document.createElement("canvas");cv.width=W;cv.height=H;var x=cv.getContext("2d");
  x.fillStyle=C.bg;x.fillRect(0,0,W,H);
  x.fillStyle=C.tx;x.font="800 54px "+PF;x.textBaseline="alphabetic";x.fillText(fit(x,title,W-2*P),P,96);
  x.fillStyle=C.mu;x.font="500 30px "+PF;x.fillText(fit(x,sub||"",W-2*P),P,146);
  var y=190;
  blocks.forEach(function(b){if(y>H-120)return;
    if(b.t==="h"){x.fillStyle=C.ac;x.font="800 38px "+PF;x.fillText(fit(x,b.x,W-2*P),P,y+52);y+=86;return}
    if(b.t==="c"){x.fillStyle=C.card;rr(x,P,y,W-2*P,90,22);x.fill();x.fillStyle=C.ac;x.font="800 44px "+PF;x.textAlign="center";x.fillText(fit(x,b.x,W-4*P),W/2,y+60);x.textAlign="left";y+=110;return}
    if(b.t==="m"){var h=b.n?80:60;x.fillStyle=C.card;rr(x,P,y,W-2*P,h,16);x.fill();
      var mid=W/2,yy=y+40;x.font="700 32px "+PF;x.fillStyle=C.tx;x.textAlign="right";x.fillText(fit(x,b.a,mid-P-100),mid-80,yy);
      x.textAlign="left";x.fillText(fit(x,b.b,mid-P-100),mid+80,yy);
      x.textAlign="center";x.font="800 36px "+PF;x.fillStyle=b.s==="-"?C.mu:C.ac;x.fillText(b.s,mid,yy+1);
      if(b.n){x.font="500 24px "+PF;x.fillStyle=C.mu;x.fillText(b.n,mid,y+72)}x.textAlign="left";y+=h+12;return}
    if(b.t==="tb"){var n=b.hd.length,cw=72,nw=W-2*P-24-60-(n-2)*cw,h=72+b.rows.length*64;
      x.fillStyle=C.card;rr(x,P,y,W-2*P,h,22);x.fill();
      var colX=function(c){return c===0?P+12:c===1?P+12+60:P+12+60+nw+(c-2)*cw};
      if(b.p>=0){x.fillStyle=C.p;x.fillRect(colX(b.p),y+8,cw,h-16)}
      x.font="700 26px "+PF;x.fillStyle=C.mu;
      for(i=0;i<n;i++){x.textAlign=i===1?"left":"center";x.fillText(b.hd[i],i===1?colX(1):colX(i)+(i===0?24:cw/2),y+48)}
      b.rows.forEach(function(r,j){var ry=y+72+j*64;
        if(b.q&&b.q.indexOf(j)>=0){x.fillStyle=C.q;x.fillRect(P+8,ry,W-2*P-16,64)}
        x.fillStyle=C.bd;x.fillRect(P+16,ry,W-2*P-32,2);
        for(i=0;i<n;i++){x.fillStyle=i===b.p||(j===0&&b.q&&b.q.indexOf(0)>=0&&i===1)?C.tx:C.tx;x.font=(i===b.p||i===1?"800 ":"500 ")+"30px "+PF;
          x.textAlign=i===1?"left":"center";var v=i===1?fit(x,r[i],nw-12):String(r[i]);x.fillText(v,i===1?colX(1):colX(i)+(i===0?24:cw/2),ry+43)}});
      x.textAlign="left";y+=h+24}});
  x.fillStyle=C.mu;x.font="600 26px "+PF;x.textAlign="center";x.fillText("Turnuva Fikstürü · "+day(Date.now()),W/2,H-36);x.textAlign="left";
  return cv}
function pngShare(title,sub,blocks,name){
  var cv=pngMake(title,sub,blocks),url=cv.toDataURL("image/png"),b64=url.split(",")[1];
  name=(String(name||"turnuva").replace(/[^\wçğıöşüÇĞİÖŞÜ-]+/g,"-").replace(/-+/g,"-").slice(0,60)||"turnuva")+".png";
  try{if(window.TFPaylas&&window.TFPaylas.png){window.TFPaylas.png(b64,name);return}}catch(e){}
  try{var bin=atob(b64),u=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
    var f=new File([u],name,{type:"image/png"});if(navigator.canShare&&navigator.canShare({files:[f]})){navigator.share({files:[f],title:title}).catch(function(){});return}}catch(e){}
  var a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove()}
// tek turnuva / grup / eleme için bloklar (S üzerinde)
function blkStand(q){var t=table();return{t:"tb",hd:["#","Oyuncu","P","O","G","B","M","AG","YG","AV"],p:2,q:q||[],
  rows:t.map(function(r,i){return[i+1,r.n,r.p,r.o,r.g,r.b,r.m,r.gf,r.ga,(r.gf-r.ga>0?"+":"")+(r.gf-r.ga)]})}}
function blkFix(){var out=[],last=0;
  if(S.mode==="eleme"){var ch=champ();if(ch>=0)out.push({t:"c",x:"🏆 "+S.players[ch]})}
  S.matches.forEach(function(x){if(x.bye)return;
    if(x.r!==last){last=x.r;out.push({t:"h",x:S.mode==="eleme"?rname(x.r):x.r+". Hafta"})}
    var H=x.h>=0?S.players[x.h]:"?",A=x.a>=0?S.players[x.a]:"?",n=[];
    if(S.mode==="eleme"&&LG(x.r)===2)n.push(x.leg===2?"Rövanş":"İlk maç");
    if(x.d&&(x.ph||x.pa))n.push("Penaltılar "+x.ph+"-"+x.pa);
    out.push({t:"m",a:H,b:A,s:x.d?x.hg+" - "+x.ag:"-",n:n.join(" · ")})});
  return out}
function pngBtn(k){return'<div class="btns" style="margin:0 0 10px"><button class="g" onclick="pngTour(\''+k+'\')">📤 '+(k==="fix"?"Maçları":S.mode==="eleme"?"İstatistiği":"Puan durumunu")+" PNG olarak paylaş</button></div>"}
function pngTour(k){var sub=(S.mode==="eleme"?"Turnuva":"Lig")+" · "+(S.legs===2?"Rövanşlı":"Rövanşsız");
  if(k==="fix")pngShare(S.name,sub+" · Maçlar",blkFix(),S.name+"-maclar");
  else pngShare(S.name,sub+" · "+(S.mode==="eleme"?"İstatistik":"Puan durumu"),[blkStand()],S.name+"-puan-durumu")}
