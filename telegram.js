'use strict';

// Отправка уведомлений

var httpreq = require('httpreq'),

    _mongoDb = require('mongodb'),
    MongoClient = _mongoDb.MongoClient,
    ObjectID = _mongoDb.ObjectID,

    EventEmitter = require('events'),
    emitter = new EventEmitter(),

    assert = require('assert'),

    config = require('./etc/config')
    ;

var mongoDb, tasks;

app();

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

  emitter.on('init', function(){
    var tasks = mongoDb.collection('tasks');
    var cursor = tasks.find({ExecutorIds: config.telegram.ExecutorId.toString(), TelegramSended: {$exists: false}});
    cursor.each(function(err, task){
      if(task == null) {
        mongoDb.close();
        return;
      } else {
        tasks.update({Id: task.Id}, {$set: {TelegramSended: true}});
        notifyTelegram(task);
      }
    });

  });

  function notifyTelegram(task) {

    var uri = 'https://api.telegram.org/bot' + config.telegram.apiString + '/sendMessage';


    var message = task.Name;

    if(task.Description !== null) {
      if (task.Description.length > 80) {
        message += "\n" + task.Description.substring(0, 80) + '...';
      } else {
        message += "\n" + task.Description;
      }
    }

    var options = {
      parameters: {
        chat_id: getTelegramChatId(),
        text: message
      }
    };
    httpreq.post(uri, options,
      function (err, res) {
        if (err) {
          // console.log('send error');
        } else {
          // console.log('sended...');
        }
    });
  }

  // TODO подписка на события
  function getTelegramChatId() {
    return config.telegram.chatId;
  }

}

