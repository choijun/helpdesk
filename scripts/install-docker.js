// Используется исключительно для установки через докер, так как другим способом добавить индексы нельзя:
// npm install игнорирует скрипт install если работать от root, можно, конечно, добавить пользователя, но там такая канитель, поэтому сделано проще
// cat scripts/install-docker.js | mongo

db.users.createIndex({Id: 1}, {unique: true});
db.tasks.createIndex({Id: 1}, {unique: true});
db.users.getIndexes();
db.tasks.getIndexes();
