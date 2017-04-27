#!/bin/bash

cd "$(dirname "$0")"

# Запуск всех служб для докера

if [ "$1" == "docker" ]; then
  service mongodb start
  service cron start
fi

# Запусе веб-сервера
pm2 start scripts/server.js

# Запуск клиента телеграммы
pm2 start scripts/telegram.js

# Запуск менеджера задач
pm2 start scripts/taskmanager.js

pm2 logs
