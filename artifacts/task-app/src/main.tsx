import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const theme =
  localStorage.getItem("theme") ??
  (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

document.documentElement.classList.toggle("dark", theme === "dark");

createRoot(document.getElementById("root")!).render(<App />);
