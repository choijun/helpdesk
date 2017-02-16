Описание
========

Работа с helpdesk.

# Установка

```
db.tasks.createIndex({Id: 1}, {unique: true});
```

# cron.js

Получение заявок. Первый раз следует указать в фильтре "&pagesize=500", затем - меньше (50), так как
будут регистрироваться только последние.

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