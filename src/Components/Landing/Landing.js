import React, { use, useEffect, useState } from 'react';
import './Landing.css';
import Modal from '../Modal/Modal';

const Landing = () => {

  // the states i will be using inside the program
  const [tasks, setTasks] = useState(() => {
    // check whether the task already exists in the localstorage if yes get it if not keep it empty
    const storedTasks = localStorage.getItem("studyPlannerTasks");
    return storedTasks ? JSON.parse(storedTasks): [];
  });
  const [openModal, setOpenModal] = useState(false);

  //update the task whenever it changes  // useEffect( {what to do}, [when to do])
  useEffect(() => {
    localStorage.setItem('studyPlannerTasks', JSON.stringify(tasks));
  },[tasks]);

  // the attributes state that will be inside the tasks
  const [title, setTitle] = useState('');
  const [date,setDate] = useState('');
  const [priority, setPriority] = useState('');
  const [file, setFile] = useState(null);
 

  //function to handle the input of files and verifying that the user have input a file
  const handleFileChange = (e) => {
    const selected = e.target.files[0] && e.target.files[0];
    if(!selected)
    {
      setFile(null);
      return;
    }

    setFile(selected);
  }

  // function to add a new task with all the attributes
  const handleAddTask = (e) => {
    e.preventDefault();

    if(!title.trim()) { alert("title enter karo!"); return; }  // to check the presence of title
    if(!priority) { alert("select a priority!"); return; }  // to check the presence of title

    // the file is temoparily stored inside the local host url for viewing
    let fileMeta = null;
    if(file)
    {
      const url = URL.createObjectURL(file);
      fileMeta = {
        name: file.name, url,
        size: file.size,
        type: file.type
      };
    }

    const newTask = {
      id : Date.now(), 
      title : title.trim(),
      date : date || null,
      priority,
      file: fileMeta
    }

    setTasks((prev) => [newTask, ...prev]);

    //used to clear the datas after a task is entered
    setTitle('');
    setDate('');
    setPriority('');
    setFile(null);
    setOpenModal(false);
  }

  //used to clear the datas after closing the model midway
  const handleCloseModal = () => {
    setTitle('');
    setDate('');
    setPriority('');
    setFile(null);
    
    setOpenModal(false);
  };

  return (
    <div className="home">
      <h1 className="title">Study Planner</h1>
      <p className="subtitle">
        Organize your tasks, upload notes, and track your daily progress.
      </p>

      <div className="buttons">
        <button className="btn" onClick={() => setOpenModal(true)}>
          Add New Task
        </button>

        <button className="btn">View Tasks</button>
      </div>
      
      {/* this is used to display a popup for adding a task*/}
      <Modal isOpen={openModal} onClose={() => setOpenModal(false)}>
        <h2>Add New Task</h2>

        <form onSubmit={handleAddTask} className='form-style'>
          <input
            type='text'
            placeholder="Task Name"
            className='input'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            type='date'
            className='input'
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <input
            type='file'
            className='file-upload'
            accept='application/pdf'
            onChange={handleFileChange}
          />

          <select className="form-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">Select from below</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <button 
            className="btn" 
            onClick={handleCloseModal}
          >
            Cancel
          </button>
          <button className="btn">Add task</button>
        </form>        
      </Modal>

      <div className="preview-box">
        <h3>Tasks Left</h3>

        {/* map is used to iterate through the elements inside the array*/}
        {tasks.map((t) => (
          <div className="task" key={t.id}> 
            <div className="dot"></div>
            <div>{t.title}</div>
            <div>{t.date}</div>
            <div>{t.priority}</div>

            {t.file && (
              <a href={t.file.url} target="_blank" rel="noopener noreferrer">
                {t.file.name}
              </a>
            )}
          </div>
                   
        ))}

      </div>
    </div>
  );
}

export default Landing;
