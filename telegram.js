'use strict';

// Отправка уведомлений

/*
Сброс признака отправки
db.tasks.update({}, {$unset: {TelegramSended: 1}}, {multi: 1});

Кто залогинился?
db.users.find({TelegramChatId:{$exists: 1, $not: {$size: 0}}}, {TelegramChatId: 1});

Кто подписан на уведомления?
db.users.find({TelegramChatId:{$exists: 1, $not: {$size: 0}}, TelegramOptions: 'subscribeTasks'}, {TelegramChatId: 1});

Удаление всей привязки
db.users.update({}, {$unset: {TelegramChatId: 1, TelegramOptions: 1}}, {multi: 1});


*/

var httpreq = require('httpreq'),

    _mongoDb = require('mongodb'),
    MongoClient = _mongoDb.MongoClient,
    ObjectID = _mongoDb.ObjectID,

    TelegramBot = require('node-telegram-bot-api'),

    EventEmitter = require('events'),
    emitter = new EventEmitter(),

    assert = require('assert'),

    config = require('./etc/config')
    ;

var bot = new TelegramBot(config.telegram.token, { polling: true });
var mongoDb, users, tasks;

function app() {
  var connectMongo = new Promise(function(resolve, reject) {
    MongoClient.connect(config.mongo.uri, function(err, db) {
      assert.equal(null, err);
      resolve(db);
    });
  });

  connectMongo.then(
    function(db){
      mongoDb = db;
      emitter.emit('init', 'mongo');
    },
    function(err){
      console.log('mongo error');
      process.exit(1);
    }
  );


  emitter.on('init', function(type) {

    tasks = mongoDb.collection('tasks');
    users = mongoDb.collection('users');

    var timerId = setInterval(function(){
      var dateMin = new Date();
      dateMin.setHours(dateMin.getHours() - 72);
      dateMin = dateMin.getTime();

      var cursor = users.find(
        {
          TelegramChatId:{$exists: 1, $not: {$size: 0}},
          TelegramOptions: 'subscribeTasks'
        }
      );

      cursor.each(function(err, user){
        if(user == null) {} else {
          var cursor2 = tasks.find(
            {
              ExecutorIds: user.Id,
              TelegramSended: {$exists: false},
              ChangedUTC: {$gt: dateMin}
            }
          );
          cursor2.each(function(err, task){
            if(task == null) {} else {
              tasks.update({Id: task.Id}, {$set: {TelegramSended: true}});

              var message = task.Name;
              if(task.Description !== null) {
                if (task.Description.length > 80) {
                  message += "\n" + task.Description.substring(0, 80) + '...';
                } else {
                  message += "\n" + task.Description;
                }
              }
              for(var i in user.TelegramChatId) {
                var chatId = user.TelegramChatId[i];

                bot.sendMessage(chatId, message).catch(function(error){
                  if(error.response.body.description == 'Forbidden: Bot was blocked by the user') {
                    // чат удалили
                    unSubscribeUser(user.Id);
                  }
                });
              }
            }
          });
        }
      });


    }, config.telegram.checkDelay);




  });



}

// Зарегистрирован ли чат в нашей БД?
function checkAuth(chatId) {
  return new Promise(function(resolve, reject) {
    users.findOne({TelegramChatId: chatId},
      function(err, user){
        resolve(user);
    });
  });
}

function helloMessage(chatId) {
  bot.sendMessage(chatId, "Привет! Представьтесь, указав свою рабочую почту!");
}

function helpMessage(chatId) {
  bot.sendMessage(chatId, "Список команд:\n" +
      "/start начало работы с сервисом\n" +
      "/help справка (это сообщение)\n" +
      "/whoami информация о вас\n" +
      "/subscribeTasks подписаться на уведомления о новых задачах\n" +
      "/unSubscribeTasks отписаться от уведомлений о новых задачах\n" +
      "Для смены пользователя в любой момент введите другой email."
      );
}

function unSubscribeChat(chatId) {
  users.update({TelegramChatId: chatId}, {$pull: {TelegramOptions: 'subscribeTasks'}});
}

function subscribeChat(chatId) {
  users.update({TelegramChatId: chatId}, {$addToSet: {TelegramOptions: 'subscribeTasks'}});
}

function unSubscribeUser(userId) {
  users.update({Id: userId}, {$pull: {TelegramOptions: 'subscribeTasks'}});
}

app();

// Начало работы
bot.onText(/\/start/, function (msg) {
  var chatId = msg.chat.id;
  checkAuth(chatId).then(
    function(user){
      if(user == null) {
        helloMessage(chatId);
      } else {
        helpMessage(chatId);
      }
    },
    function(err){}
  );
});

// Помощь
bot.onText(/\/help/, function (msg) {
  var chatId = msg.chat.id;
  helpMessage(chatId);
});

// Привязка к пользователю
bot.onText(/^([0-9a-z.]+@iek\.ru)$/i, function (msg, match) {
  var chatId = msg.chat.id;
  var email = match[1];

  users.findOne({Email: new RegExp(email, 'i')},
    function(err, user){
      if(user == null) {
        bot.sendMessage(chatId, 'Увы, такого пользователя нет!');
      } else {
        // удаляем привязку
        users.update({TelegramChatId: chatId}, {$pull: {TelegramChatId: chatId}}, function(){
          // привязываем
          users.update({Id: user.Id}, {$addToSet: {TelegramChatId: chatId}}, function(){
            bot.sendMessage(chatId, 'Я узнал вас, ' + user.Name + '! Для смены пользователя в любой момент введите другой email.');
          });
        });
      }
  });
});

// Кто я?
bot.onText(/\/whoami/, function (msg) {
  var chatId = msg.chat.id;
  users.findOne({TelegramChatId: chatId},
    function(err, user){
      if(user == null) {
        bot.sendMessage(chatId, 'Увы, вы не представились! Введите свою рабочую почту, чтобы я узнал вас.');
      } else {
        bot.sendMessage(chatId, user.Name + "\n" + user.Email + "\n" + user.Position);
      }
  });
});

// Подписаться. Сейчас подписка включается любым подписавшимся пользователем для всех чатов (своего и других, если есть)
// Сделано ради простоты
bot.onText(/\/subscribeTasks/, function (msg) {
  var chatId = msg.chat.id;
  checkAuth(chatId).then(
    function(user){
      if(user == null) {
        helloMessage(chatId);
      } else {
        subscribeChat(chatId);
        bot.sendMessage(chatId, 'Вы успешно подписались на уведомления о новых задачах.');
      }
    },
    function(err){}
  );
});

// Отписаться
bot.onText(/\/unSubscribeTasks/, function (msg) {
  var chatId = msg.chat.id;
  checkAuth(chatId).then(
    function(user){
      if(user == null) {
        helloMessage(chatId);
      } else {
        unSubscribeChat(chatId);
        bot.sendMessage(chatId, 'Вы успешно отписались от уведомлений о новых задачах.');
      }
    },
    function(err){}
  );
});

