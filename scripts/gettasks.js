'use strict';

// Получение заявок

var helpdeskapi = require('./lib/helpdeskapi'),

    _mongoDb = require('mongodb'),
    MongoClient = _mongoDb.MongoClient,
    ObjectID = _mongoDb.ObjectID,

    EventEmitter = require('events'),
    emitter = new EventEmitter(),

    assert = require('assert'),

    config = require('../etc/config')
    ;

var mongoDb, insertTasks, initEvents = [];

app();

function app() {

  helpdeskapi.set('config', config.ntlmOptions).connect().then(function(getData){
    getData(config.helpdesk.getTasks, function(data){
      insertTasks = data.Tasks;
      emitter.emit('init', 'tasks');
    });
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
      console.log('Mongo connection error');
      process.exit(1);
    }
  );

  emitter.on('init', function(type){
    initEvents.push(type);

    if(initEvents.indexOf('tasks') > -1 && initEvents.indexOf('mongo') > -1) {
      var tasks = mongoDb.collection('tasks');

      for(var i in insertTasks) {
        var task = insertTasks[i];
        task.ExecutorIds = task.ExecutorIds.split(",");
        task.ExecutorIds = task.ExecutorIds.map(function (val) { return parseInt(val.trim()); });
        task.ChangedUTC = Date.parse(task.Changed);

        tasks.update({Id: task.Id}, {
          $currentDate: {
            lastModified: true,
            "HDTaskUpdate": { $type: "timestamp" }
          }, $set: task
        }, {upsert: true, multi: false});
      }

      mongoDb.close();
    }
  });

}
