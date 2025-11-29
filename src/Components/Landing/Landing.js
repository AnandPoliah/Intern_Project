// src/components/Landing.jsx
import React, { useEffect, useState } from "react";
import Modal from "../Modal/Modal";
import "./Landing.css";
import PdfManager from "../pdf/PdfManager";

const Landing = () => {
  // tasks loaded from localStorage (simple; no PDF stripping)
  const [tasks, setTasks] = useState(() => {
    const stored = localStorage.getItem("studyPlannerTasks");
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  });

  // modal + form states
  const [openModal, setOpenModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [priority, setPriority] = useState("");

  // persist tasks to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem("studyPlannerTasks", JSON.stringify(tasks));
    } catch {
      // ignore
    }
  }, [tasks]);

  const openAddModal = () => {
    setEditingId(null);
    setTitle("");
    setDate("");
    setPriority("");
    setOpenModal(true);
  };

  const openEditModal = (task) => {
    setEditingId(task.id);
    setTitle(task.title);
    setDate(task.date || "");
    setPriority(task.priority || "");
    setOpenModal(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("Please enter a title!");
      return;
    }
    if (!priority) {
      alert("Please select a priority!");
      return;
    }

    if (editingId === null) {
      const newTask = {
        id: Date.now(),
        title: title.trim(),
        date: date || null,
        priority,
        completed: false,
      };
      setTasks((prev) => [newTask, ...prev]);
    } else {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === editingId
            ? { ...t, title: title.trim(), date: date || null, priority }
            : t
        )
      );
    }

    setEditingId(null);
    setTitle("");
    setDate("");
    setPriority("");
    setOpenModal(false);
  };

  const handleDelete = (id) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    if (!window.confirm(`Delete task "${task.title}"? This cannot be undone.`))
      return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const toggleComplete = (id) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  return (
    <div className="home">
      <PdfManager />
      <h1 className="title">Study Planner</h1>
      <p className="subtitle">Organize your tasks, upload notes, and track your daily progress.</p>

      <div className="buttons">
        <button className="btn" onClick={openAddModal}>Add New Task</button>
        <button className="btn secondary">View Tasks</button>
      </div>

      <Modal isOpen={openModal} onClose={() => setOpenModal(false)}>
        <h2>{editingId === null ? "Add New Task" : "Edit Task"}</h2>

        <form onSubmit={handleSave} className="form-style">
          <input
            type="text"
            placeholder="Task Name"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />

          <select className="form-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">Select from below</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setEditingId(null);
                setTitle("");
                setDate("");
                setPriority("");
                setOpenModal(false);
              }}
            >
              Cancel
            </button>

            <button type="submit" className="btn">
              {editingId === null ? "Add Task" : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      <div className="preview-box">
        <h3>Tasks Left</h3>

        {tasks.length === 0 ? (
          <p>No tasks yet.</p>
        ) : (
          tasks.map((t) => (
            <div className="task" key={t.id}>
              <div className={`dot ${t.priority === "High" ? "p-high" : t.priority === "Medium" ? "p-medium" : "p-low"}`} title={`Priority: ${t.priority}`} />
              <div style={{ flex: 1 }}>
                <div className="title">{t.title}</div>
                <div className="meta">
                  {t.date ? `Due: ${t.date} • ` : ""}
                  {t.priority} priority
                </div>
              </div>

              <div className="actions">
                <button className="small-btn" onClick={() => openEditModal(t)}>Edit</button>
                <button className="small-btn" onClick={() => handleDelete(t.id)}>Delete</button>
                <button className="small-btn" onClick={() => toggleComplete(t.id)}>{t.completed ? "Undo" : "Done"}</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Landing;
