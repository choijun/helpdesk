#!/bin/bash

# Запуск всех служб для докера

if [ "$1" == "docker" ]; then
  service mongodb start
  service cron start
fi

# Запусе веб-сервера

pm2 start scripts/server.js

# Запуск клиента телеграммы
pm2 start scripts/telegram.js

pm2 logs
