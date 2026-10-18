const V="carnet-v2";
const SHELL=["./","index.html","manifest.webmanifest","firebase-config.js","app-shim.js","icon-192.png","icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
const CDN=["fonts.googleapis.com","fonts.gstatic.com","cdnjs.cloudflare.com","www.gstatic.com"];
self.addEventListener("fetch",e=>{
  const r=e.request;if(r.method!=="GET")return;
  const u=new URL(r.url),same=u.origin===location.origin;
  if(same&&u.pathname.endsWith("/recettes.json"))return;
  if(!same&&!CDN.includes(u.hostname))return;
  e.respondWith(caches.open(V).then(async c=>{
    const hit=await c.match(r);
    const net=fetch(r).then(res=>{if(res&&(res.ok||res.type==="opaque"))c.put(r,res.clone());return res}).catch(()=>hit);
    return hit||net;
  }));
});
