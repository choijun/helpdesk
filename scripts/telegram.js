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
    CronJob = require('cron').CronJob,
    moment = require('moment'),

    EventEmitter = require('events'),
    emitter = new EventEmitter(),

    assert = require('assert'),

    config = require('../etc/config')
    ;

var mongoDb, users, tasks;

function app() {
  if(config.telegram.active != 1) return;

  // Запуск бота
  var bot = new TelegramBot(config.telegram.token, { polling: true });

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

    newTasks();
    reports();

  });

  // отчеты за неделю
  function reports() {
    return;
    moment.locale('ru');

    var date = '2017-07-03';

    console.log(moment(date).weekday(0).add(-7, 'day').format('DD/MM/YYYY'));
    //console.log('next start', moment(date).weekday(7).format('DD/MM/YYYY'));

    return;
    /*var curr = new Date;
    var firstday = new Date(curr.setDate(curr.getDate() - curr.getDay() - 7));
    var lastday = new Date(curr.setDate(curr.getDate() - curr.getDay() - 1));*/

    var date = new Date(2017, 5, 3, 5, 0, 0);
    var m = moment();

    console.log(date, m.startOf('isoWeek').toDate());

    return;

    var startOfWeek = moment().startOf('week').toDate();
    // var endOfWeek   = moment().endOf('week').toDate();
    // console.log(endOfWeek);

    return;

    var cursor = users.find(
      {
        TelegramChatId:{$exists: 1, $not: {$size: 0}},
        TelegramOptions: 'subscribeReport'
      }
    );

    // db.tasks.find({Expenses: {$elemMatch: {Date: {$gte: '2017-07-03T00:00:00', $lte: '2017-07-03T23:59:59'}}}}, {Expenses: 1})
    cursor.each(function(err, user){
      if(user == null) return;
      var cursor2 = tasks.find(
        {
          ExecutorIds: user.Id,
          Expenses: {
            $elemMatch: {
              Date: {$gte: '2017-07-03T00:00:00', $lte: '2017-07-03T23:59:59'}
            }
          }
        }
      );
      cursor2.each(function(err, task){
        if(task == null) return;

        console.log(task.Id);

      });

    });

    // new CronJob('0 0 7 * * 1', function() { // понедельник, 7 утра

    /*new CronJob('* * * * * *', function() { // test
    // new CronJob('00 36 16 * * *', function() { // test
      console.log('You will see this message every second');
    }, null, true, 'Europe/Moscow');*/


  }

  // новые задачи
  function newTasks() {
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
        if(user == null) return;
        var cursor2 = tasks.find(
          {
            ExecutorIds: user.Id,
            TelegramSended: {$exists: false},
            ChangedUTC: {$gt: dateMin}
          }
        );
        cursor2.each(function(err, task){
          if(task == null) return;
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
        });
      });


    }, config.telegram.checkDelay);
  }

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
          subscribeTasksChat(chatId);
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
          unSubscribeTasksChat(chatId);
          bot.sendMessage(chatId, 'Вы успешно отписались от уведомлений о новых задачах.');
        }
      },
      function(err){}
    );
  });

  /*
    /subscribeReport 1,5
      подписаться на задачи, над которыми работал на прошлой неделе,
      и на которые было потрачено более 1,5 часов в сумме по всем дням
      (не обязательно на прошлой неделе, 1,0 скажем в феврале + 0,5 в июне, и вот она попадет в репорт)
    /unSubscribeReport - отписаться
  */
  bot.onText(/\/subscribeReport\s?([0-9.,]*)/, function (msg, match) {
    var operativeHours;
    if(match[1] === '') {
      operativeHours = config.telegram.chat.report.operativeDefaultHours;
    } else {
      operativeHours = parseFloat(match[1].replace(',', '.'));
    }

    var chatId = msg.chat.id;
    checkAuth(chatId).then(
      function(user){
        if(user == null) {
          helloMessage(chatId);
        } else {
          subscribeReportChat(chatId, operativeHours);
          bot.sendMessage(chatId, 'Вы успешно подписались на еженедельный отчет: плановые задачи + оперативка более ' + operativeHours + ' часов');
        }
      },
      function(err){}
    );
  });

  // Отписаться
  bot.onText(/\/unSubscribeReport/, function (msg) {
    var chatId = msg.chat.id;
    checkAuth(chatId).then(
      function(user){
        if(user == null) {
          helloMessage(chatId);
        } else {
          unSubscribeReportChat(chatId);
          bot.sendMessage(chatId, 'Вы успешно отписались от еженедельного отчета.');
        }
      },
      function(err){}
    );
  });


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
        "/subscribeReport 1,5 подписаться на еженедельный отчет: закрытые плановые задачи + оперативка > 1,5 ч\n" +
        "/unSubscribeReport - отписаться от еженедельного отчета\n" +
        "Для смены пользователя в любой момент введите другой email."
        );
  }

  function subscribeTasksChat(chatId) {
    users.update({TelegramChatId: chatId}, {$addToSet: {TelegramOptions: 'subscribeTasks'}});
  }

  function unSubscribeTasksChat(chatId) {
    users.update({TelegramChatId: chatId}, {$pull: {TelegramOptions: 'subscribeTasks'}});
  }

  function subscribeReportChat(chatId, operativeHours) {
    users.update({TelegramChatId: chatId}, {$addToSet: {TelegramOptions: 'subscribeReport'}, $set: {"Options.subscribeReport.operativeHours": operativeHours}});
  }

  function unSubscribeReportChat(chatId) {
    users.update({TelegramChatId: chatId}, {$pull: {TelegramOptions: 'subscribeReport'}});
  }




  function unSubscribeUser(userId) {
    users.update({Id: userId}, {$pull: {TelegramOptions: ['subscribeTasks', 'subscribeReport']}});
  }



}



app();
