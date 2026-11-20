
import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs";

// Load Python once and reuse it.
let pyodidePromise;

self.onmessage = async (event) => {
  const { id, code = "" } = event.data;
  const printedLines = [];
  
  try {
    // Initialize Python if it has not already been loaded.
    if (!pyodidePromise) {
      pyodidePromise = loadPyodide();
    }

    const pyodide = await pyodidePromise;

    // Capture Python print() output.
    pyodide.setStdout({
      batched: (line) => printedLines.push(line),
    });

    // Create a fresh Python namespace for each execution.
    const makeDict = pyodide.globals.get("dict");
    const globals = makeDict();

    try {
      await pyodide.runPythonAsync(code, { globals });
    } finally {
      globals.destroy();
    }

    // Send successful execution results to MainPage.jsx
    self.postMessage({
      id,
      codeWorks: true,
      output: printedLines.join("\n") ||
        "Code ran successfully. No output was printed.",
    });

  } catch (error) {
    // Hide technical errors
    self.postMessage({
      id,
      codeWorks: false,
      output: "FEJL: Kan ikke køre koden. Tjek for fejl i koden og prøv igen.",
    });
  }
};
