# Описание

Intraservice report server.

# Установка и запуск

```
mkdir etc && cp etc.dist/config.json etc && vim etc/config.json
```

* `helpdesk` - указать актуальные адреса Intraservice
* `mongo` - подключение к mongodb
* `telegram` - token (опционально) и выставить `"active": "1"`
* `web` - параметры веб-сервера
* `report.users` - `id` пользователей для построения отчетов
* `ntlmOptions` - авторизация

```
npm install
node start
```

Альтернативный запуск (see: `start.sh`):

```
sudo npm install -g pm2
pm2 start scripts/server.js
pm2 start scripts/telegram.js
pm2 start scripts/taskmanager.js
```

[Открыть в браузере](http://localhost:8080/calendar.html?ExecutorId=14195)

# Через Docker

```
mkdir etc && cp etc.dist/config.json etc && vim etc/config.json
docker build --tag helpdesk .
```

# Механика

Работают как демоны:

* `server.js` веб-сервер отчетов
* `telegram.js` Телеграм-бот
* `taskmanager.js` получает задачи, трудоемкость и пользователей

## server.js

Отчет о задачах, пользователях в формате JSON, запрашивается JS со страницы (которую также отдает в виде статики, но возможно делегировать статику на Nginx).

## telegram.js

Отправка уведомлений о новых задачах в Telegram. Следует [создать бота](https://core.telegram.org/bots#3-how-do-i-create-a-bot), и вписать его токен в `telegram.token`. `telegram.checkDelay` - задержка для проверки новых задач из базы данных.

## taskmanager.js

Получает асинхронно задачи, трудоемкость и пользователей с заданными интервалами `checkDelay` (в мс).

TODO. Весь этот механизм будет переделан (как именно - подробности в файлах).

### Получение заявок

Необходимо в интерфейсе `helpdesk` настроить фильтр (исключить по статусу, включить пользователей, etc), который указать в конфиге `helpdesk.getTasks.uri`.

Первый раз запрашивается `smallLimit`, если этого оказалось мало - `bigLimit`, подробности в файле.

### Получение трудозатрат

Требования:

* максимально точная информация
* оперативное получение
* не грузить HTTP

Периодически по `checkDelay`. Увы, одним запросом к API Intraservice все не вытащить. Но за счет `sort({Changed: -1}).limit(20)` получаем "новости" об измененных задачах. Допущение: заявки меняются в меньших объемах, чем переваривает скрипт.

### Получение пользователей

Периодически по `checkDelay`.

# Полезные поля для фильтрации

* ChangedMoreThan - Дата последнего изменения заявок больше или равна указанной
* Closed - Дата закрытия заявок равна указанному дню (время не учитывается, т.е. с 00:00 до 23:59 указанного дня)
* Hours - Трудозатраты в часах
* Deadline - Дедлайн

# TODO

* Получить статусы http://helpdesk/api/taskstatus
