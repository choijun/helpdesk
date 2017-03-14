'use strict';

var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),

    _mongoDb = require('mongodb'),
    MongoClient = _mongoDb.MongoClient,
    ObjectID = _mongoDb.ObjectID,

    EventEmitter = require('events'),
    emitter = new EventEmitter(),

    assert = require('assert'),

    config = require('../etc/config.json')
    ;

var mongoDb;

app.set('config', config);
app.use(bodyParser.urlencoded({extended: false}));

function initApp() {
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
}

app.get('/report.json', function(req, res) {
  var ExecutorId = parseInt(req.query.ExecutorId);
  assert(ExecutorId > 0);

  var emitter = new EventEmitter();
  var tasks = mongoDb.collection('tasks');
  var users = mongoDb.collection('users');
  var responseEvents = [], taskItems, userItems = {}, user;

  emitter.on('response', function(type){
    responseEvents.push(type);
    if(responseEvents.indexOf('tasks') > -1 && responseEvents.indexOf('users') > -1) {
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(
        {
          tasks: taskItems,
          users: userItems
        }
      ));
    }
  });



  var cursor = tasks.find(
    {ExecutorIds: ExecutorId},
    {Created: 1, Creator: 1, Expenses: 1, ExecutorIds: 1, Name: 1, Id: 1, StatusId: 1, TypeId: 1}
  );

  cursor.toArray(function(err, items){
    taskItems = items;
    emitter.emit('response', 'tasks');
    assert.equal(null, err);
  });


  var usersIds = Object.keys(config.report.users).map(function (val) { return parseInt(val); });

  var cursor2 = users.find({Id: {$in: usersIds}});

  cursor2.each(function(err, user){
    if(user == null) {
      emitter.emit('response', 'users');
    } else {
      user = Object.assign(config.report.users[user.Id], user);
      userItems[user.Id] = user;
    }
  });

});

initApp();

// Статика
app.use(express.static('public_html'));
app.listen(config.web.port);
