'use strict';

// Получение заявок

var httpntlm = require('httpntlm'),
    httpreq = require('httpreq'),

    _mongoDb = require('mongodb'),
    MongoClient = _mongoDb.MongoClient,
    ObjectID = _mongoDb.ObjectID,

    EventEmitter = require('events'),
    emitter = new EventEmitter(),

    assert = require('assert'),

    config = require('./etc/config')
    ;

var mongoDb, insertTasks, initEvents = [];

app();

function app() {

  var connectMongo = new Promise(function(resolve, reject) {
    MongoClient.connect(config.mongo.uri, function(err, db) {
      assert.equal(null, err);
      resolve(db);
    });
  });

  var getApiTasks = new Promise(function(resolve, reject) {
    httpntlm.get(config.ntlmOptions, function(err, res) {
      assert.equal(null, err);
      assert.equal(302, res.statusCode);

      var options = {
        cookies: res.headers['set-cookie'],
        headers: {'Accept': 'application/json;q=0.9'}
      }

      // Необходимо создать и настроить фильтр
      httpreq.get(config.helpdesk.getTasks, options, function(err, res) {
        assert.equal(null, err);
        assert.equal(200, res.statusCode);
        resolve(JSON.parse(res.body).Tasks);
      });
    });
  });

  getApiTasks.then(function(tasks){
    insertTasks = tasks;
    emitter.emit('init', 'tasks');
  }, function(err){
    console.log('tasks error');
    process.exit(1);
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

    if(initEvents.indexOf('tasks') > -1 && initEvents.indexOf('mongo') > -1) {
      var tasks = mongoDb.collection('tasks');

      for(var i in insertTasks) {
        var task = insertTasks[i];
        task.ExecutorIds = task.ExecutorIds.split(",");
        task.ExecutorIds = task.ExecutorIds.map(function (val) { return val.trim(); });

        tasks.update({Id: task.Id}, {$set: task}, {upsert: true, multi: false});
      }

      mongoDb.close();
    }
  });

}

