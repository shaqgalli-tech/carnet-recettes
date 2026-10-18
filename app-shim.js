/* Remplace les capacités "db" et "downloads" de claude.ai par Firebase (Firestore + connexion Google) et le partage/téléchargement natif. */
(function(){
  var cfg=window.FIREBASE_CONFIG||{},ALLOWED=(window.ALLOWED_EMAIL||"").toLowerCase();
  var box=null;
  function show(html){
    if(!box){box=document.createElement("div");box.style.cssText="position:fixed;inset:0;z-index:999;display:flex;align-items:center;justify-content:center;padding:24px;background:#F3EFE3;color:#1F2A1B;font-family:Figtree,system-ui,sans-serif;text-align:center";document.body.appendChild(box)}
    box.innerHTML='<div style="max-width:340px"><h1 style="font-family:\'Bricolage Grotesque\',Georgia,serif;font-size:28px;margin:0 0 8px">Carnet de semaine</h1>'+html+'</div>';
  }
  function hide(){if(box){box.remove();box=null}}
  var btn='border:0;border-radius:14px;padding:14px 22px;min-height:48px;font-size:16px;font-weight:700;background:#32502D;color:#F6F1E2;margin-top:14px';
  var ready=null;
  function ensure(){
    if(ready)return ready;
    ready=new Promise(function(resolve){
      if(!cfg.apiKey||/COLLE/.test(cfg.apiKey)||!window.firebase){show('<p>La configuration Firebase est manquante. Ouvre <b>firebase-config.js</b> et colle les valeurs de ton projet.</p>');return}
      firebase.initializeApp(cfg);
      var auth=firebase.auth(),fs=firebase.firestore();
      fs.enablePersistence({synchronizeTabs:true}).catch(function(){});
      function login(){
        show('<p>Connecte-toi pour ouvrir tes recettes.</p><button id="gbtn" style="'+btn+'">Se connecter avec Google</button><p id="gerr" style="color:#A5483A;font-size:14px"></p>');
        document.getElementById("gbtn").onclick=function(){
          var p=new firebase.auth.GoogleAuthProvider();
          auth.signInWithPopup(p).catch(function(e){
            if(e&&(e.code==="auth/popup-blocked"||e.code==="auth/operation-not-supported-in-this-environment"))return auth.signInWithRedirect(p);
            var el=document.getElementById("gerr");if(el)el.textContent="Connexion impossible ("+(e&&e.code||"erreur")+").";
          });
        };
      }
      auth.getRedirectResult().catch(function(){});
      auth.onAuthStateChanged(function(u){
        if(!u){login();return}
        if(!u.emailVerified||String(u.email||"").toLowerCase()!==ALLOWED){
          auth.signOut();show('<p>Ce compte n’a pas accès au carnet.</p><button id="gbtn" style="'+btn+'">Changer de compte</button>');
          document.getElementById("gbtn").onclick=login;return;
        }
        show('<p>Chargement de ton carnet…</p>');
        sync(fs).catch(function(){}).then(function(){hide();resolve(fs)});
      });
    });
    return ready;
  }
  /* Synchronisation : ajoute les recettes de recettes.json qui ne sont pas encore dans ta base (une recette supprimée ne revient pas ;
     une recette dont le "rev" augmente est remplacée). Le planning fourni n'est importé qu'à la toute première ouverture. */
  async function sync(fs){
    var data,revs={},first=false,ms=fs.doc("meta/sync"),mi=fs.doc("meta/import");
    try{var r=await fetch("recettes.json?"+Date.now(),{cache:"no-store"});if(!r.ok)return;data=await r.json()}catch(e){return}
    try{var s=await ms.get({source:"server"});if(s.exists)revs=(s.data()||{}).revs||{};var i=await mi.get({source:"server"});first=!i.exists}catch(e){return}
    var batch=fs.batch(),n=0,rv=Object.assign({},revs),changed=false;
    Object.keys(data.recipes||{}).forEach(function(id){var d=data.recipes[id],rev=d.rev||1;if(!(id in revs)||revs[id]<rev){batch.set(fs.doc("recipes/"+id),d);rv[id]=rev;n++}});
    if(first){Object.keys(data.plans||{}).forEach(function(id){batch.set(fs.doc("plans/"+id),data.plans[id]);n++});batch.set(mi,{at:Date.now()})}
    if(n||first){await batch.commit();changed=true}
    /* correctifs ponctuels : ajoute des champs à une recette déjà présente, une seule fois (sans toucher au reste) */
    for(var pi=0;pi<(data.patches||[]).length;pi++){var pt=data.patches[pi];if(rv[pt.key])continue;try{await fs.doc("recipes/"+pt.id).update(pt.set);rv[pt.key]=1;changed=true}catch(e){}}
    if(changed)await ms.set({revs:rv,at:Date.now()});
  }
  var dl={save:async function(req){
    var blob=req.data instanceof Blob?req.data:new Blob([req.data]);
    var file;try{file=new File([blob],req.filename,{type:blob.type||"application/pdf"})}catch(e){file=null}
    if(file&&navigator.canShare&&navigator.canShare({files:[file]})){
      try{await navigator.share({files:[file],title:req.filename});return{status:"saved"}}
      catch(e){if(e&&e.name==="AbortError")throw{code:"declined"}}
    }
    var url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=req.filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(url)},60000);
    return{status:"saved"};
  }};
  window.claude={use:function(name){
    if(name==="db")return ensure();
    if(name==="downloads")return Promise.resolve(dl);
    return Promise.resolve(null);
  }};
})();
