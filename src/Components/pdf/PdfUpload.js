// src/components/pdf/PdfUpload.jsx
import React from "react";

export default function PdfUpload({ onUpload }) 
{
  const handle = async (e) => 
  { 
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.type !== "application/pdf") 
    {
      alert("Please select a PDF file.");
      e.target.value = "";
      return;
    }
    await onUpload(file);
    e.target.value = "";
  };

  return (
    <label style={{ display: "inline-block", cursor: "pointer", background: "#0f62ff", color: "#fff", padding: "8px 12px", borderRadius: 6 }}>
      Upload PDF
      <input type="file" accept="application/pdf" onChange={handle} style={{ display: "none" }} />
    </label>
  );
}
