'use strict';

// Получение трудозатрат

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

var mongoDb, tasks, httpApiOptions, initEvents = [], mongoQuery = 0;

app();

function app() {

  var connectMongo = new Promise(function(resolve, reject) {
    MongoClient.connect(config.mongo.uri, function(err, db) {
      assert.equal(null, err);
      resolve(db);
    });
  });

  var helpdeskAuth = new Promise(function(resolve, reject) {
    httpntlm.get(config.ntlmOptions, function(err, res) {
      assert.equal(null, err);
      assert.equal(302, res.statusCode);

      resolve({
        cookies: res.headers['set-cookie'],
        headers: {'Accept': 'application/json;q=0.9'}
      });
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

  helpdeskAuth.then(
    function(options){
      httpApiOptions = options;
      emitter.emit('init', 'auth');
    },
    function(err){
      console.log('auth error');
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
    // TODO критерии, например "все открытые" + "закрытые недавно"
    var cursor = tasks.find(); // {Id: 116080}

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
    httpreq.get(uri, httpApiOptions, function(err, res) {
      assert.equal(null, err);
      assert.equal(200, res.statusCode);
      var Expenses = {Expenses: JSON.parse(res.body).Expenses};
      tasks.update({Id: taskId}, {$set: Expenses});
      emitter.emit('mongoQuery', -1);
      emitter.emit('closemongo');
    });

  }

}

