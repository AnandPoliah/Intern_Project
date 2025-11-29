import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Landing from './Components/Landing/Landing';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing/>}></Route>
      </Routes>
    </Router>
  );
}

export default App;
