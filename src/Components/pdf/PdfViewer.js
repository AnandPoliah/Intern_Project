import React, { useEffect, useRef, useState, useMemo } from "react";
import pdfDB from "../../utils/pdfDB";

// Responsible for "Lazy Loading": Only renders pixels when close to the screen.
const PdfPage = ({ pdf, num, container }) => {
  const ref = useRef(null); // Reference to the <canvas> element
  const [rendered, setRendered] = useState(false); // Prevents re-rendering if already drawn

  useEffect(() => {
    // If already rendered or DOM not ready, skip
    if (rendered || !ref.current) return;

    // Observer 1: The "Renderer".
    // Triggers when page is within 300px of the viewport (rootMargin).
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          // 1. Fetch the specific page data from PDF.js
          pdf.getPage(num).then(async (p) => {
            // 2. Calculate dimensions (Scale 1.5 = good quality)
            const vp = p.getViewport({ scale: 1.5 });
            ref.current.width = vp.width;
            ref.current.height = vp.height;

            // 3. Draw onto the HTML Canvas
            await p.render({
              canvasContext: ref.current.getContext("2d"),
              viewport: vp,
            }).promise;
            setRendered(true); // Mark as done so we don't redraw
          });
          obs.disconnect(); // Stop observing this page to save memory
        }
      },
      { root: container.current, rootMargin: "300px" }
    );

    obs.observe(ref.current);
    return () => obs.disconnect(); // Cleanup
  }, [rendered, container, num, pdf]);

  return (
    // ID used by parent tracker. minHeight prevents scrollbar jumping before load.
    <div
      id={num}
      className="page-wrapper page-track"
      style={{ minHeight: rendered ? "auto" : "800px" }}
    >
      <canvas ref={ref} className="the-canvas" />
      {!rendered && <div className="loading-txt">Page {num}</div>}
    </div>
  );
};

// --- PARENT COMPONENT: Main Viewer ---
// Responsible for Loading the Doc and Tracking the Current Page number.
export default function PdfViewer({ id, onClose }) {
  const [pdf, setPdf] = useState(null);
  const [curr, setCurr] = useState(1);
  const scrollRef = useRef(null); // Points to the scrollable container div

  // EFFECT 1: Load PDF & Restore Progress
  useEffect(() => {
    (async () => {
      // Fetch binary blob from IndexedDB
      const blob = await pdfDB.getFileBlob(id);
      // Initialize PDF.js
      const doc = await window.pdfjsLib.getDocument(URL.createObjectURL(blob))
        .promise;
      setPdf(doc);

      // Check DB for last read page and auto-scroll there
      const meta = (await pdfDB.getFiles()).find((f) => f.id === id);
      if (meta.page)
        setTimeout(
          () => document.getElementById(meta.page)?.scrollIntoView(),
          10
        );
    })();
  }, [id]);

  // EFFECT 2: The "Page Tracker"
  useEffect(() => {
    if (!pdf || !scrollRef.current) return;

    // Observer 2: The "Tracker".
    // Watches ALL pages to see which one is currently most visible.
    const obs = new IntersectionObserver(
      (entries) => {
        // 'reduce' finds the page with the highest visibility ratio (most on screen)
        const best = entries.reduce((a, b) =>
          b.intersectionRatio > a.intersectionRatio ? b : a
        );

        // Only update if the page is significantly visible (>40%)
        if (best.intersectionRatio > 0.4) {
          const p = Number(best.target.id);
          setCurr(p); // Update UI counter
          pdfDB.updatePage(id, p); // Save progress to DB
        }
      },
      { root: scrollRef.current, threshold: 0.5 }
    ); // Check when 50% visible

    // Attach this observer to every page div
    document.querySelectorAll(".page-track").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [pdf, id]);

  // Helper: Create array of numbers [1, 2, 3... N]
  const pages = useMemo(
    () => (pdf ? Array.from({ length: pdf.numPages }, (_, i) => i + 1) : []),
    [pdf]
  );

  return (
    <div className="viewer-layout">
      <div className="viewer-bar">
        <button onClick={onClose} className="btn-back">
          ← Back
        </button>
        <span className="pg-count">
          Page {curr} / {pdf?.numPages || "-"}
        </span>
        <div style={{ width: 50 }} />
      </div>

      {/* Scrollable Area */}
      <div className="viewer-scroll" ref={scrollRef}>
        {!pdf ? (
          <div className="loading-screen">Loading PDF...</div>
        ) : (
          // Render list of Child Components
          pages.map((n) => (
            <PdfPage key={n} pdf={pdf} num={n} container={scrollRef} />
          ))
        )}
      </div>
    </div>
  );
}
