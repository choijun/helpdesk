# Описание

Работа с helpdesk.

# Установка

Mongodb:

```
db.tasks.createIndex({Id: 1}, {unique: true});
```

Bash:

```
mkdir etc && cp etc.dist/config.json etc
vim etc/config.json
```

Повесить на крон:

```
node gettasks.js
node telegram.js
node taskexpenses.js
```

Запустисть веб-сервер:

```
node report.js
```

Browser:
```
http://localhost:8080/calendar.html?ExecutorId=14195
```

# Скрипты

## gettasks.js

Получение заявок. Первый раз следует указать в фильтре "&pagesize=500", затем настроить расписание и уменьшить до (50), так как будут регистрироваться только последние.

## taskexpenses.js

Получение трудозатрат. Требования:

* максимально точная информация
* оперативное получение
* не грузить HTTP

Загребается по "расписанию" (в пользу оперативности). Дальше видно будет, стоит ли переделывать на live-версию. Увы, одним запросом к API Intraservice все не вытащить.

## telegram.js

Отправка уведомлений о новых задачах в Telegram

## report.js

Отчет о задачах в формате JSON

# Полезные поля для фильтрации

* ChangedMoreThan - Дата последнего изменения заявок больше или равна указанной
* Closed - Дата закрытия заявок равна указанному дню (время не учитывается, т.е. с 00:00 до 23:59 указанного дня)
* Hours - Трудозатраты в часах
* Deadline - Дедлайн

# Тестовые ID

* 11184
* 11273
* 14195

# TODO

* Получить статусы http://helpdesk/api/taskstatus
* Получить пользователей http://helpdesk/api/user