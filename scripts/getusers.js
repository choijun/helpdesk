'use strict';

// Получение пользователей... как я люблю копи-пасту... аппетитненько!

var helpdeskapi = require('./lib/helpdeskapi'),

    _mongoDb = require('mongodb'),
    MongoClient = _mongoDb.MongoClient,
    ObjectID = _mongoDb.ObjectID,

    EventEmitter = require('events'),
    emitter = new EventEmitter(),

    assert = require('assert'),

    config = require('../etc/config')
    ;

var mongoDb, insertUsers, initEvents = [];

app();

function app() {

  helpdeskapi.set('config', config.ntlmOptions).connect().then(function(getData){
    getData(config.helpdesk.getUsers, function(data){
      insertUsers = data.Users;
      emitter.emit('init', 'users');
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
      console.log('mongo error');
      process.exit(1);
    }
  );

  emitter.on('init', function(type){
    initEvents.push(type);

    if(initEvents.indexOf('users') > -1 && initEvents.indexOf('mongo') > -1) {
      var users = mongoDb.collection('users');

      for(var i in insertUsers) {
        var user = insertUsers[i];

        users.update({Id: user.Id}, {
          $currentDate: {
            lastModified: true,
            "HDUserUpdate": { $type: "timestamp" }
          }, $set: user
        }, {upsert: true, multi: false});
      }

      mongoDb.close();
    }
  });

}
