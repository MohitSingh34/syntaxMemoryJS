Here is a comprehensive and professional `README.md` that perfectly captures all the powerful "Second Brain" and autonomous features we just built, along with your original instructions.

---

# 🧠 Smart Syntax Memory & Context Notes

A complete "Second Brain" for your development workflow. This context-aware intelligent autocompletion tool for the MERN stack (JavaScript, TypeScript, React, Node, CSS, HTML, and JSON) not only remembers what you type and prioritizes your most used properties, but it also **autonomously generates documentation for concepts you haven't learned yet using ChatGPT.**

You can view the source code, fork it, and edit it to your liking on GitHub:
👉 [MohitSingh34/syntaxMemoryJS](https://github.com/MohitSingh34/syntaxMemoryJS.git)

---

## 🎥 Demos & Previews

Watch the extension in action in high quality:

- **YouTube (Play at 0.7x speed):** [Watch Demo](https://youtu.be/ZJg5khUn0G0)
- **Google Drive (Raw Quality):** [View Video](https://drive.google.com/file/d/1fQv_4y4V5MaSWkvGQ0Zras-V6pHztizP/view?usp=drive_link)

## _Example Tooltips & UI:_

## ![Instructions to use SyntaxMemory](ay_demo_better.gif)

## ✨ Core Features

### 🚀 Intelligent IntelliSense & Tracking

- **Context-Aware Suggestions:** Recognizes if you are typing after `Math.`, `console.`, or custom object variables, and provides highly relevant history.
- **Frequency-Based Priority:** Your most frequently used methods are automatically pinned to the top of the IntelliSense list with a 🔥 icon.
- **MERN Stack Support:** Fully supports `.js`, `.ts`, `.jsx`, `.tsx`, `.css`, `.html`, and `.json` files natively.

### 🤖 Autonomous ChatGPT Integration (The "Second Brain")

- **Smart Detection:** Whenever you accept an autocomplete suggestion (like `Date.bind`) that doesn't exist in your personal notes, the extension prompts you: _"Syntax Memory: 'Date.bind' ka note nahi mila. ChatGPT se banwayein?"_
- **Background Processing:** If you click "Yes", it silently queues the word. A background Python bot (`chatgpt.py`) takes over, safely navigating ChatGPT via Selenium to prevent UI freezes.
- **Dual-Length Explanations:** The bot automatically generates two versions of notes for every concept:
  - **Short Version:** Standard syntax and a quick summary (saved to `language-short.md`).
  - **Long Version:** Deep-dive logic, industry best practices, and extensive code snippets (saved to `language-long.md`).

### 📓 Smart Hover Notes & UI

- **Instant Hover Access:** Write your personal notes using the `@de <word>` syntax. Hover over that word in your code to instantly peek at your notes, perfectly formatted with syntax highlighting\!
- **Split-Screen Mode:** Click the source link inside the hover tooltip to open your full notes file right beside your code, automatically scrolled to the exact definition.
- **Premium "Tokyo Night" Dashboard:** Run `Syntax Memory: View Usage History` from the Command Palette to open a stunning, glassmorphic analytics dashboard. It tracks your mastery of concepts (Green dot for 5+ days used) and lets you view formatted notes in a beautiful, dedicated modal.

---

## 🛠️ Installation & Setup

This project uses a dual-architecture: A VS Code Extension (TypeScript) and a Background Bot (Python).

### Step 1: VS Code Extension

1.  Clone the repository.
2.  Delete `node_modules` and `package-lock.json` (if they exist).
3.  Open your terminal in the directory where `package.json` is located.
4.  Run the installation:
    ```bash
    npm install
    ```
5.  Press `F5` in VS Code to launch the Extension Development Host.

### Step 2: Autonomous ChatGPT Bot (Python)

To enable the background note-generation engine:

1.  Ensure you have Google Chrome installed.
2.  Set up a Python virtual environment and install the dependencies:
    ```bash
    pip install fastapi uvicorn undetected-chromedriver selenium pydantic
    ```
3.  Update the `NOTES_DIR` and `--user-data-dir` paths in `chatgpt.py` to match your local system paths.
4.  Run the background server:
    ```bash
    python chatgpt.py
    ```

---

## 📝 How to Write & Manage Notes

You can let the ChatGPT bot write notes for you, or you can write them manually.

### Text Formatting

1.  Create a simple markdown file anywhere on your system (e.g., `javascript-short.md`).

2.  Add notes using this exact format:

    ````markdown
    @de console.log
    Use console.log to output messages to the web console.

    ```javascript
    console.log("Hello World");
    ```
    ````

    @de map
    Creates a new array populated with the results of calling a provided function.

    ```

    ```

### Image Rendering Rules

If you copy an image directly from the web and paste it into the markdown file, it might paste as `![img](imag.png)`. **This will not load in the hover popup.**

To ensure images render correctly in the VS Code hover tooltip:

1.  Download or save the image to an actual directory on your computer.
2.  Copy the absolute path of that image.
3.  Paste it into your markdown using the `file:///` protocol:
    ```markdown
    ![Descriptive Alt Text](file:///home/user/Projects/files/imagecopy.png)
    ```

---

## 📜 License

This project is released under the **GNU General Public License v3.0 (GPLv3)**.
See the [LICENSE](https://www.google.com/search?q=LICENSE) file for details or visit [https://www.gnu.org/licenses/gpl-3.0.txt](https://www.gnu.org/licenses/gpl-3.0.txt).
