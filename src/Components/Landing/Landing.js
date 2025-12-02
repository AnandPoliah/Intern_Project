import React, { useEffect, useState } from "react";
import Modal from "../Modal/Modal";
import "./Landing.css";
import PdfManager from "../pdf/PdfManager";

const P_VAL = { High: 3, Medium: 2, Low: 1 };
const S_VAL = { Pending: 3, Ongoing: 2, Completed: 1 };

const INIT_FORM = {
  id: null,
  title: "",
  date: "",
  priority: "Medium",
  status: "Pending",
};

export default function Landing() {
  const [tasks, setTasks] = useState(() =>
    JSON.parse(localStorage.getItem("tasks") || "[]")
  );
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(INIT_FORM);
  const [filters, setFilters] = useState({
    status: "All",
    priority: "All",
    search: "",
  });

  useEffect(
    () => localStorage.setItem("tasks", JSON.stringify(tasks)),
    [tasks]
  );

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return alert("Title required");

    setTasks((prev) =>
      form.id
        ? prev.map((t) => (t.id === form.id ? form : t))
        : [{ ...form, id: Date.now() }, ...prev]
    );
    setOpen(false);
  };

  const handleDelete = (id) => {
    if (window.confirm("Delete task?"))
      setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const openModal = (task = INIT_FORM) => {
    setForm(task);
    setOpen(true);
  };

  const filtered = tasks
    .filter(
      (t) =>
        (filters.status === "All" || t.status === filters.status) &&
        (filters.priority === "All" || t.priority === filters.priority) &&
        t.title.toLowerCase().includes(filters.search.toLowerCase())
    )
    .sort(
      (a, b) =>
        S_VAL[b.status] - S_VAL[a.status] ||
        P_VAL[b.priority] - P_VAL[a.priority]
    );

  return (
    <div className="app">
      <PdfManager />
      <header>
        <h1>Study Planner</h1>
        <div className="controls">
          <input
            placeholder="Search..."
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
          <select
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="All">All Status</option>
            <option>Pending</option>
            <option>Ongoing</option>
            <option>Completed</option>
          </select>
          <select
            onChange={(e) =>
              setFilters({ ...filters, priority: e.target.value })
            }
          >
            <option value="All">All Priority</option>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
          <button className="btn-primary" onClick={() => openModal()}>
            + Add
          </button>
        </div>
      </header>

      <div className="grid">
        {filtered.map((t) => (
          <div key={t.id} className={`card ${t.status.toLowerCase()}`}>
            <div className="top">
              <span className={`tag ${t.priority.toLowerCase()}`}>
                {t.priority}
              </span>
              <div>
                <button onClick={() => openModal(t)}>✎</button>
                <button onClick={() => handleDelete(t.id)}>×</button>
              </div>
            </div>
            <h3>{t.title}</h3>
            <div className="bot">
              <small>{t.date || "No Date"}</small>
              <select
                value={t.status}
                onChange={(e) =>
                  setTasks(
                    tasks.map((x) =>
                      x.id === t.id ? { ...x, status: e.target.value } : x
                    )
                  )
                }
              >
                <option>Pending</option>
                <option>Ongoing</option>
                <option>Completed</option>
              </select>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={open} onClose={() => setOpen(false)}>
        <h2>{form.id ? "Edit Task" : "New Task"}</h2>
        <form onSubmit={handleSave} className="modal-form">
          <input
            autoFocus
            placeholder="Task Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <div className="row">
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </div>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option>Pending</option>
            <option>Ongoing</option>
            <option>Completed</option>
          </select>
          <button className="btn-primary">Save</button>
        </form>
      </Modal>
    </div>
  );
}
