Описание
========

Работа с helpdesk.

# Установка

```
db.tasks.createIndex({Id: 1}, {unique: true});
```

# gettasks.js

Получение заявок. Первый раз следует указать в фильтре "&pagesize=500", затем настроить расписание и уменьшить до (50), так как будут регистрироваться только последние.

# taskexpenses.js

Получение трудозатрат. Требования:

* максимально точная информация
* оперативное получение
* не грузить HTTP

поэтому также загребается по "расписанию". Дальше видно будет, стоит ли переделывать на live-версию. Увы, одним запросом к API Intraservice все не вытащить.

# telegram.js

Отправка уведомлений в Telegram

# report.js

Отчет о задачах

# Разная всячина

* http://helpdesk/api/task?ExecutorIds=11184&sort=Created%20desk
* http://helpdesk/api/task?ExecutorIds=11184&sort=Created%20desk&Id=116080
* http://helpdesk/api/tasklifetime?taskid=116080


# Полезные поля для фильтрации

* ChangedMoreThan Дата последнего изменения заявок больше или равна указанной
* Closed Дата закрытия заявок равна указанному дню (время не учитывается, т.е. с 00:00 до 23:59 указанного дня)
* Hours Трудозатраты в часах
* Deadline