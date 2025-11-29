// src/components/pdf/PdfViewer.jsx
import React, { useEffect, useRef, useState } from "react";
import pdfdb from "../../utils/pdfDB";
import "./pdf.css";

export default function PdfViewer({ id, onClose }) {
  const [meta, setMeta] = useState(null);
  const [doc, setDoc] = useState(null);
  const [page, setPage] = useState(1);
  const container = useRef(null);
  const canvases = useRef([]);
  const obs = useRef(null);
  const lock = useRef(false);
  const objUrl = useRef(null);
  const saveT = useRef(null);

  const save = (p) => {
    if (saveT.current) clearTimeout(saveT.current);
    saveT.current = setTimeout(() => pdfdb.updateProgress(id, p).catch(()=>{}), 200);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await pdfdb.init();
      const metas = await pdfdb.getAllMeta();
      const m = metas.find(x=>x.id===id) || null;
      setMeta(m);
      const blob = await pdfdb.getFile(id);
      if (!blob) return alert("File missing");
      objUrl.current = URL.createObjectURL(blob);
      const pdfjs = window.pdfjsLib;
      if (!pdfjs) return alert("Add pdf.js script");
      const loading = pdfjs.getDocument({url: objUrl.current});
      const P = await loading.promise;
      if (cancelled) { try{loading.destroy()}catch{}; return; }
      setDoc(P);

      const sc = 1.2;
      const wrap = container.current;
      wrap.innerHTML = "";
      canvases.current = [];
      const renders = [];
      for (let i=1;i<=P.numPages;i++){
        const w = document.createElement("div");
        w.className="pdf-page-wrapper"; w.dataset.page=i;
        const c = document.createElement("canvas"); c.className="pdf-canvas";
        const lab = document.createElement("div"); lab.className="pdf-page-label"; lab.textContent=`Page ${i}`;
        w.appendChild(c); w.appendChild(lab); wrap.appendChild(w);
        canvases.current.push({page:i,canvas:c,wrap:w});
        renders.push((async (n,cn) => {
          const p = await P.getPage(n);
          const vp = p.getViewport({scale:sc});
          cn.width = vp.width; cn.height = vp.height;
          cn.style.width = Math.min(vp.width, wrap.clientWidth-40)+"px";
          await p.render({canvasContext:cn.getContext("2d"),viewport:vp}).promise;
        })(i,c));
      }
      await Promise.all(renders);
      setupObserver();
      if (m && m.lastPage) {
        lock.current = true;
        const t = wrap.querySelector(`[data-page="${m.lastPage}"]`);
        if (t) t.scrollIntoView({behavior:"auto",block:"center"});
        setPage(m.lastPage);
        setTimeout(()=>{ lock.current=false; },120);
      }
    })();

    return () => {
      cancelled = true;
      if (obs.current) try{obs.current.disconnect()}catch{}
      if (objUrl.current) try{URL.revokeObjectURL(objUrl.current)}catch{}
      canvases.current.forEach(({canvas})=>{ try{canvas.getContext("2d")?.clearRect(0,0,canvas.width,canvas.height)}catch{} });
      canvases.current=[];
      if (saveT.current) clearTimeout(saveT.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const setupObserver = () => {
    if (!container.current) return;
    if (obs.current) try{obs.current.disconnect()}catch{};
    obs.current = new IntersectionObserver(entries=>{
      if (lock.current) return;
      let best=null;
      for (const e of entries) if (!best || e.intersectionRatio>best.intersectionRatio) best=e;
      if (best && best.isIntersecting){
        const num = Number(best.target.dataset.page);
        if (num && num!==page){ setPage(num); save(num); }
      }
    }, {root: container.current, threshold: [0.5]});
    container.current.querySelectorAll(".pdf-page-wrapper").forEach(w=>obs.current.observe(w));
  };

  const goto = (n) => {
    const tgt = container.current.querySelector(`[data-page="${n}"]`);
    if (tgt){ lock.current = true; tgt.scrollIntoView({behavior:"smooth",block:"center"}); setPage(n); save(n); setTimeout(()=>lock.current=false,300); }
  };

  return (
    <div className="pdf-viewer">
      <div className="pdf-viewer-toolbar">
        <div className="pdf-meta"><strong>{meta?.name||"Document"}</strong><div className="muted">{meta?.size}</div></div>
        <div className="pdf-controls">
          <button onClick={()=>goto(Math.max(1,page-1))} className="btn small">Prev</button>
          <span className="page-indicator">Page {page}{doc?` / ${doc.numPages}`:""}</span>
          <button onClick={()=>goto((doc&&page<doc.numPages)?page+1:page)} className="btn small">Next</button>
          <button onClick={()=>onClose?.()} className="btn small">Close</button>
        </div>
      </div>
      <div ref={container} className="pdf-scroll-container" style={{overflowY:"auto",maxHeight:"72vh",padding:12}}/>
    </div>
  );
}
