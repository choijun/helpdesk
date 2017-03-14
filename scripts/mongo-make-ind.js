// use for docker install: cat scripts/mongo-make-ind.js | mongo

db.users.createIndex({Id: 1}, {unique: true});
db.tasks.createIndex({Id: 1}, {unique: true});
db.users.getIndexes();
db.tasks.getIndexes();
