import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom"; // 1. Import this

export default function Login() {
  const [form, setForm] = useState({ username: "", password: "" });
  const { login } = useAuth();
  const navigate = useNavigate(); // 2. Initialize it

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Simulation logic
    if (form.username === "admin") {
      login({ username: "admin", role: "PRINCIPAL" });
      navigate("/"); // 3. Redirect to Dashboard after login
    } else {
      login({ username: "event_user", role: "EVENT_HEAD" });
      navigate("/"); // 3. Redirect to Dashboard after login
    }
  };

  // ... rest of your return code
}