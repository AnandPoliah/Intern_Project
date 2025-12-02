import React, { useEffect, useState } from "react";
import pdfDB from "../../utils/pdfDB";
import PdfViewer from "./PdfViewer";
import "./pdf.css";

export default function PdfManager() {
  const [docs, setDocs] = useState([]);
  const [viewId, setViewId] = useState(null);

  const loadDocs = () => pdfDB.getFiles().then(setDocs);

  useEffect(() => {
    loadDocs();
  }, [viewId]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (file && file.type === "application/pdf") {
      await pdfDB.addFile(file);
      loadDocs();
    }
    e.target.value = null;
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (window.confirm("Delete this document?")) {
      await pdfDB.deleteFile(id);
      loadDocs();
    }
  };

  // If viewing, render the viewer inside the same box
  if (viewId) {
    return (
      <div className="pdf-box viewer-mode">
        <PdfViewer id={viewId} onClose={() => setViewId(null)} />
      </div>
    );
  }

  return (
    <div className="pdf-box">
      <div className="pdf-header">
        <h3>My Library</h3>
        <label className="btn-upload">
          + Upload
          <input
            type="file"
            hidden
            accept="application/pdf"
            onChange={handleUpload}
          />
        </label>
      </div>

      <div className="pdf-list">
        {docs.length === 0 ? (
          <div className="empty-msg">
            No documents yet. <br /> Upload a PDF to start reading.
          </div>
        ) : (
          docs.map((d) => (
            <div key={d.id} className="pdf-row" onClick={() => setViewId(d.id)}>
              <span className="icon">📄</span>
              <div className="info">
                <div className="name">{d.name}</div>
                <div className="meta">
                  {d.size} • Pg {d.page}
                </div>
              </div>
              <button
                className="btn-del"
                onClick={(e) => handleDelete(e, d.id)}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
