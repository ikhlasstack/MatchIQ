python3 -m venv venv
source venv/bin/activate
pip install -r requirements2.txt
deactivate

if command -v node >/dev/null 2>&1; then
  NODE_MAJOR=$(node -v | cut -d. -f1 | sed 's/v//')
  if [ "$NODE_MAJOR" -ge 24 ]; then
    cd matchiq_website
    npm install
    npm run build
  fi
  else
    echo "Node.js version 24 or higher is required to build the website. Please update Node.js."
fi