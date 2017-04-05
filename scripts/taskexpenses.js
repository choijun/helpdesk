'use strict';

// Получение трудозатрат

var helpdeskapi = require('./lib/helpdeskapi'),

    _mongoDb = require('mongodb'),
    MongoClient = _mongoDb.MongoClient,
    ObjectID = _mongoDb.ObjectID,

    EventEmitter = require('events'),
    emitter = new EventEmitter(),

    assert = require('assert'),

    config = require('../etc/config')
    ;

var mongoDb, tasks, apiGetData, initEvents = [], mongoQuery = 0;

app();

function app() {

  helpdeskapi.set('config', config.ntlmOptions).connect().then(function(getData){
    apiGetData = getData;
    emitter.emit('init', 'auth');
  }, function(err){
    console.log('Intraservice connection error');
    process.exit(1);
  });

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

  emitter.on('init', function(type){
    initEvents.push(type);

    if(initEvents.indexOf('auth') > -1 && initEvents.indexOf('mongo') > -1) {
      tasks = mongoDb.collection('tasks');
      getNupdate();
    }

  });

  emitter.on('closemongo', function(){
    if(mongoQuery == 0) mongoDb.close();
  });

  emitter.on('mongoQuery', function(count){
    mongoQuery += count;
  });

  function getNupdate() {
    //var cursor = tasks.find({ExecutorIds: 11184}).sort({HDExpUpdate: 1}).limit(10); // {Id: 116080}


    // Обновляем все недавно измененные
    var cursor = tasks.find({}).sort({Changed: -1}).limit(20); // {Id: 116080}

    // Могут быть "пропуски", поэтому периодически надо "обновлять все", но планомерно
    // TODO критерии, например "все открытые" + "закрытые недавно"
    // var cursor = tasks.find({}).sort({HDExpUpdate: 1}).limit(10); // {Id: 116080}

    cursor.each(function(err, task){
      if(task == null) {
        emitter.emit('closemongo');
        return;
      } else {
        emitter.emit('mongoQuery', 1);
        updateExpenses(task.Id);
      }
    });

  }

  function updateExpenses(taskId) {

    var uri = config.helpdesk.getExpenses.replace('{taskid}', taskId);
    apiGetData(uri, function (data) {
      if(data !== null) {
          var Expenses = {Expenses: data.Expenses};
          tasks.update({Id: taskId}, {
            $currentDate: {
              lastModified: true,
              "HDExpUpdate": { $type: "timestamp" }
            },
            $set: Expenses
          });
      }
      emitter.emit('mongoQuery', -1);
      emitter.emit('closemongo');

    });

  }

}
