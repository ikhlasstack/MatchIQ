## ⚽ MatchIQ  
### Football AI Analytics Pipeline

---

## 📦 Installation

### 1. Create a Virtual Environment *(recommended)*

```bash
python -m venv venv
````

Activate it:

* **Linux / macOS**

  ```bash
  source venv/bin/activate
  ```

* **Windows**

  ```bash
  venv\Scripts\activate
  ```

---

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

---

### 3. Install Roboflow Sports Package

> ⚠️ This package is **not included** in `requirements.txt` and must be installed separately.

```bash
pip install git+https://github.com/roboflow/sports.git
```

---

## 📚 What This Installs

The Roboflow `sports` package provides modules used in this project:

* `sports.annotators.soccer`
* `sports.configs.soccer`
* `sports.common.view`
* `sports.common.team`

---

## 🧠 Notes

* Always activate your virtual environment before installing dependencies.
* Keeping `sports` separate ensures compatibility with its latest GitHub version.

