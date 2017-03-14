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
```

Повесить на крон:

```
* * * * * node /path/scripts/gettasks.js >> /dev/null 2>&1
* */6 * * * node /path/scripts/getusers.js >> /dev/null 2>&1
* * * * * node /path/scripts/taskexpenses.js >> /dev/null 2>&1
```

```
node start
```

Альтернативный запуск:

```
sudo npm install -g pm2
pm2 start scripts/server.js
pm2 start scripts/telegram.js
```

[Открыть в браузере](http://localhost:8080/calendar.html?ExecutorId=14195)

# Через Docker

```
mkdir etc && cp etc.dist/config.json etc && vim etc/config.json
docker build --tag helpdesk .
```

# Механика

`gettasks.js` подливает заявки и отправляет в телеграмм новые `telegram.js`, `taskexpenses.js` получает трудоемкость для пользователей `getusers.js`. А `server.js` строит отчеты.

## gettasks.js

Получение заявок. Необходимо в интерфейсе `helpdesk` настроить фильтр (исключить по статусу, включить пользователей, etc), который указать в конфиге `helpdesk.getTasks`.

Первый раз следует указать в фильтре `&pagesize=500`, затем настроить расписание и уменьшить до (50), так как будут регистрироваться/обновляться только последние (за счет `sort=Changed%20desc`).

## taskexpenses.js

Получение трудозатрат. Требования:

* максимально точная информация
* оперативное получение
* не грузить HTTP

Загребается по "расписанию" (в пользу оперативности получения). Дальше видно будет, стоит ли переделывать на live-версию. Увы, одним запросом к API Intraservice все не вытащить. Но за счет `sort({Changed: -1}).limit(20)` получаем "новости" об измененных задачах. Полагаю, что заявки меняются в меньших объемах, чем переваривает скрипт.

## telegram.js

Отправка уведомлений о новых задачах в Telegram. Следует создать бота, и вписать его токен в `telegram.token`.

## server.js

Отчет о задачах, пользователях в формате JSON, запрашивается JS со страницы.

# Полезные поля для фильтрации

* ChangedMoreThan - Дата последнего изменения заявок больше или равна указанной
* Closed - Дата закрытия заявок равна указанному дню (время не учитывается, т.е. с 00:00 до 23:59 указанного дня)
* Hours - Трудозатраты в часах
* Deadline - Дедлайн

# TODO

* Получить статусы http://helpdesk/api/taskstatus
