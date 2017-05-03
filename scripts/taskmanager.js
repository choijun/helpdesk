'use strict';

// Менеджер задач

// TODO сделать механизм против сбоев сети/helpdesk

var helpdeskapi = require('./lib/helpdeskapi'),

    _mongoDb = require('mongodb'),
    MongoClient = _mongoDb.MongoClient,
    ObjectID = _mongoDb.ObjectID,

    EventEmitter = require('events'),
    emitter = new EventEmitter(),

    assert = require('assert'),

    config = require('../etc/config')
    ;

var mongoDb, getData, initEvents = [];

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
      console.log('Mongo connection error');
      process.exit(1);
    }
  );

  helpdeskapi.set('config', config.ntlmOptions).connect().then(function(_getData){
    getData = _getData;
    emitter.emit('init', 'getData');
  }, function(err){
    console.log('Intraservice connection error');
    process.exit(1);
  });

  emitter.on('init', function(type){
    initEvents.push(type);

    // Все инициировано (монго, API)
    if(initEvents.indexOf('mongo') > -1 && initEvents.indexOf('getData') > -1) {

      // коллекция задач
      var tasks = mongoDb.collection('tasks');

      // коллекция пользователей
      var users = mongoDb.collection('users');

      // коллекция различных значений
      var options = mongoDb.collection('options');

      // получение задач
      var getTasks = require('./lib/getTasks');
      getTasks.init({config: config.helpdesk.getTasks, usersServed: config.helpdesk.users, mongoDb: mongoDb, getData: getData});
      getTasks.run();

      // получение пользователей
      var getUsers = require('./lib/getUsers');
      getUsers.init({config: config.helpdesk.getUsers, mongoDb: mongoDb, getData: getData});
      getUsers.run();

      // получение трудоемкости
      var getExpenses = require('./lib/getExpenses');
      getExpenses.init({config: config.helpdesk.getExpenses, mongoDb: mongoDb, getData: getData});
      getExpenses.run();

      // получение жизненного цикла заявки
      var getLifetime = require('./lib/getLifetime');
      getLifetime.init({config: config.helpdesk.getLifetime, mongoDb: mongoDb, getData: getData});
      getLifetime.run();

    }
  });

}
