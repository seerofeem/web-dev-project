#!/bin/bash
# ─────────────────────────────────────────────────────────────
# SteamDB Mini — Quick Setup Script
# Team: Bekeshov Arsen, Shynbulat Kazbek, Naseken Olzhas
# ─────────────────────────────────────────────────────────────

echo "═══════════════════════════════════════"
echo "  ⬡  SteamDB Mini — Setup"
echo "═══════════════════════════════════════"

# ── Backend ──────────────────────────────
echo ""
echo "▶ Setting up Django backend..."
cd backend

python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

pip install -r requirements.txt

python manage.py migrate
echo "✓ Database migrated"

echo ""
echo "Create a superuser? (y/n)"
read -r answer
if [ "$answer" = "y" ]; then
  python manage.py createsuperuser
fi

echo "✓ Backend ready at http://localhost:8000"
echo ""
echo "Starting Django server in background..."
python manage.py runserver &
DJANGO_PID=$!

# ── Frontend ─────────────────────────────
cd ../frontend
echo ""
echo "▶ Setting up Angular frontend..."
npm install
echo "✓ npm packages installed"
echo ""
echo "Starting Angular dev server..."
ng serve &
ANGULAR_PID=$!

echo ""
echo "═══════════════════════════════════════"
echo "  ✓ Both servers running!"
echo "  Django  → http://localhost:8000"
echo "  Angular → http://localhost:4200"
echo "  Admin   → http://localhost:8000/admin"
echo "═══════════════════════════════════════"
echo ""
echo "Press Ctrl+C to stop all servers"
wait $DJANGO_PID $ANGULAR_PID
