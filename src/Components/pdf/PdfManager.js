// src/components/pdf/PdfManager.jsx
import React, { useEffect, useState } from "react";
import pdfdb from "../../utils/pdfDB";
import PdfUpload from "./PdfUpload";
import PdfViewer from "./PdfViewer";
import "./pdf.css";


/**
 * PdfManager: initializes DB and shows upload/list + viewer.
 */
export default function PdfManager() {
  const [ready, setReady] = useState(false);
  const [docs, setDocs] = useState([]);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    (async () => {
      await pdfdb.init();
      setReady(true);
      refreshList();
    })();
  }, []);

  const refreshList = async () => {
    const all = await pdfdb.getAllMeta();
    setDocs(all);
  };

  const onUpload = async (file) => {
    await pdfdb.saveFile(file);
    await refreshList();
  };

  const onDelete = async (id) => {
    if (!window.confirm("Delete document?")) return;
    await pdfdb.deleteFile(id);
    if (openId === id) setOpenId(null);
    await refreshList();
  };

  return (
    <div>
      <h2>PDF Manager</h2>
      {!ready ? <p>Loading...</p> : null}

      <PdfUpload onUpload={onUpload} />

      <div style={{ marginTop: 12 }}>
        {docs.length === 0 ? (
          <p>No PDFs uploaded yet.</p>
        ) : (
          docs.map((d) => (
            <div key={d.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{d.name}</div>
                <div style={{ fontSize: 12, color: "#666" }}>{d.size} • Page {d.lastPage}</div>
              </div>

              <button onClick={() => setOpenId(d.id)}>Open</button>
              <button onClick={() => onDelete(d.id)} style={{ color: "red" }}>Delete</button>
            </div>
          ))
        )}
      </div>

      {openId && (
        <div style={{ marginTop: 18 }}>
          <PdfViewer id={openId} onClose={() => setOpenId(null)} />
        </div>
      )}
    </div>
  );
}
