#!/bin/bash

echo "🚀 Начало установки DeepSeek Messenger..."

# Проверка наличия Docker и Docker Compose
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен. Установите Docker перед продолжением."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose не установлен. Установите Docker Compose перед продолжением."
    exit 1
fi

# Создание необходимых директорий
echo "📁 Создание структуры директорий..."
mkdir -p frontend/src/{components,pages,services,utils}
mkdir -p backend/src/{controllers,models,routes,middleware,services}
mkdir -p webrtc-server
mkdir -p database
mkdir -p ssl

# Создание .env файлов
echo "🔧 Настройка переменных окружения..."

# Backend .env
cat > backend/.env << EOF
NODE_ENV=production
PORT=5000

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=deepseek_messenger
DB_USER=postgres
DB_PASSWORD=your_secure_password_change_this

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# JWT
JWT_SECRET=your_jwt_secret_key_change_this
JWT_EXPIRES_IN=7d

# AWS S3 (для файлов)
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
S3_BUCKET=deepseek-messenger-files
S3_REGION=us-east-1

# Frontend URL
FRONTEND_URL=http://localhost:3000

# WebRTC
TURN_SERVER_URL=turn:your-turn-server.com
TURN_USERNAME=turn_user
TURN_CREDENTIAL=turn_password

# Email (опционально)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_email_password
EOF

# Frontend .env
cat > frontend/.env << EOF
REACT_APP_API_URL=http://localhost:5000
REACT_APP_WS_URL=ws://localhost:5000
REACT_APP_WEBRTC_URL=ws://localhost:5001
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
REACT_APP_SENTRY_DSN=your_sentry_dsn
EOF

# WebRTC server .env
cat > webrtc-server/.env << EOF
PORT=5001
FRONTEND_URL=http://localhost:3000

# TURN серверы для продакшена
TURN_SERVERS=turn:your-turn-server.com:3478
TURN_USERNAME=turn_user
TURN_CREDENTIAL=turn_password
EOF

echo "📦 Установка зависимостей..."

# Установка зависимостей для backend
cd backend
npm install
cd ..

# Установка зависимостей для frontend
cd frontend
npm install
cd ..

# Установка зависимостей для WebRTC сервера
cd webrtc-server
npm init -y
npm install express socket.io cors dotenv
cd ..

echo "🔐 Генерация SSL сертификатов (для разработки)..."
cd ssl
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
cd ..

echo "🐳 Запуск Docker контейнеров..."
docker-compose up -d --build

echo "⏳ Ожидание запуска сервисов..."
sleep 30

echo "📊 Проверка статуса сервисов..."
docker-compose ps

echo "✅ Установка завершена!"
echo "🌐 Frontend доступен по адресу: http://localhost:3000"
echo "🔧 Backend API доступен по адресу: http://localhost:5000"
echo "📞 WebRTC сервер доступен по адресу: ws://localhost:5001"
echo "📊 База данных доступна по адресу: localhost:5432"

echo ""
echo "🔧 Дополнительные команды:"
echo "   docker-compose logs -f      # Просмотр логов"
echo "   docker-compose down         # Остановка всех сервисов"
echo "   docker-compose restart      # Перезапуск сервисов"