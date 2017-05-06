'use strict';

var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),

    _mongoDb = require('mongodb'),
    MongoClient = _mongoDb.MongoClient,
    ObjectID = _mongoDb.ObjectID,

    Memcached = require('memcached'),
    memcached,

    EventEmitter = require('events'),
    emitter = new EventEmitter(),

    assert = require('assert'),
    path = require('path'),

    config = require('../etc/config.json'),
    statPath = path.resolve(__dirname, '../public_html')
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

  if(config.memcached.active == 1) {
    memcached = new Memcached(config.memcached.connection);
  }
}

app.get('/report.json', function(req, res) {

  var ExecutorId = parseInt(req.query.ExecutorId);
  assert(ExecutorId > 0);

  var emitter = new EventEmitter();
  var tasks = mongoDb.collection('tasks');
  var taskItems = [];

  emitter.on('response', function(type){
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(taskItems));
  });

  // {ExecutorIds: ExecutorId},
  var filter = {
    Expenses: {
      $elemMatch: {
        UserId: ExecutorId,
        Date: {
          $gte: req.query.start + 'T00:00:00',
          $lte: req.query.end + 'T23:59:59'
        }
      }
    }
  };

  var cursor = tasks.find(filter, {Created: 1, Creator: 1, Expenses: 1, ExecutorIds: 1, Name: 1, Id: 1, StatusId: 1, TypeId: 1});

  cursor.toArray(function(err, tasks){
    assert.equal(null, err);
    taskItems = [];
    for(var i in tasks) {
      var task = tasks[i];

      if(typeof task.Expenses !== 'undefined' && task.Expenses.length) {

        for(var i2 in task.Expenses) {
          var expense = task.Expenses[i2];
          if(expense.UserId != ExecutorId) continue;

          var expHours = Math.round(expense.Minutes / 0.6) / 100;
          var event = {
            title: task.Name,
            start: expense.Date.substr(0,10),
            className: 'task-status task-status--' + task.StatusId,
            data: {
              url: config.helpdesk.taskUri.replace('{taskid}', task.Id),
              expHours: expHours,
              expMinutes: expense.Minutes
            }
          };

          taskItems.push(event);
        }
      }

    }




    emitter.emit('response');
  });

});


app.get('/users.json', function(req, res) {
  var emitter = new EventEmitter();
  var users = mongoDb.collection('users');
  var userItems = {};

  emitter.on('response', function(){
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({users: userItems}));
  });

  var usersIDs = Object.keys(config.report.users).map(function (val) { return parseInt(val); });

  var cursor = users.find({Id: {$in: usersIDs}});

  cursor.each(function(err, user){
    if(user == null) {
      emitter.emit('response');
    } else {
      // сливаем параметры из конфига с параметрами из БД
      user = Object.assign(config.report.users[user.Id], user);
      userItems[user.Id] = user;
    }
  });
});

// Время заявки: открыта, закрыта (закрыта != выполнена)
app.get('/created-closed.json', function(req, res) {
  var emitter = new EventEmitter();
  var tasks = mongoDb.collection('tasks');
  var data = [];

  emitter.on('response', function(){
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(data));
  });

  var cursorClosed = tasks.find({Closed: {$ne: null}}, {Id: 1, Closed: 1});
  cursorClosed.toArray(function(err, tasksClosed){
    for(var i in tasksClosed) {
      var task = tasksClosed[i];
      data.push(
        {Id: task.Id, timestamp: task.Closed, type: "Closed"}
      );
    }

    var cursorCreated = tasks.find({Created: {$ne: null}}, {Id: 1, Created: 1});

    cursorCreated.toArray(function(err, tasksCreated){
      for(var i in tasksCreated) {
        var task = tasksCreated[i];
        data.push(
          {Id: task.Id, timestamp: task.Created, type: "Created"}
        );
      }
      emitter.emit('response');
    });

  });


});

// "время жизни заявки"
app.get('/timeline.json', function(req, res) {
  var emitter = new EventEmitter();
  var tasks = mongoDb.collection('tasks');
  var events = [];

  emitter.on('response', function(){
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(events));
  });

  var ExecutorId = 11184;
  var filter = {
    $or: [
      { Expenses: { $elemMatch: { UserId: ExecutorId } } },
      { ExecutorIds: ExecutorId }
    ]
  };

  var cursor = tasks.find(filter, {Id: 1, Name: 1, Created: 1, Closed: 1});

  cursor.toArray(function(err, tasksData){
    var nowDate = new Date();
    for(var i in tasksData) {
      var task = tasksData[i];
      var dates = [];
      dates.push(task.Created);
      if(task.Closed) {
        dates.push(task.Closed);
      } else {
        dates.push(nowDate);
      }

      events.push(
        // link, attrs, title, section
        {dates: dates, title: "[" + task.Id + "] " + task.Name}
      );
    }
    emitter.emit('response');
  });

});


/*
db.tasks.find({Lifetime: {$elemMatch: {StatusId: 29}}}, {Lifetime: {$elemMatch: {StatusId: 29}}})

*/
app.get('/tasks-completed.json', function(req, res) {
  var emitter = new EventEmitter();
  var tasks = mongoDb.collection('tasks');
  var eventsObj = {}, response = {events: []};
  var statusCompleted = 29;

  var ExecutorId = parseInt(req.query.ExecutorId);
  var memcachedKey = '/tasks-completed.json-' + ExecutorId;

  emitter.on('response', function(){
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(response));
  });

  if(config.memcached.active == 1) {
    memcached.get(memcachedKey, function (err, data) {
      if(data === undefined) {
        getData();
      } else {
        response = data;
        emitter.emit('response');
      }
    });
  }

  function getData() {
    // могут быть проблемы с високосным годом - на клиенте есть баги в плагине
    var now = new Date();
    now.setHours(0,0,0,0);
    now.setFullYear(now.getFullYear() - 1);

    var filter = {
      $or: [
        { Expenses: { $elemMatch: { UserId: ExecutorId } } },
        { ExecutorIds: (ExecutorId > 0) ? ExecutorId : {$in: config.helpdesk.users.map(function(UserId){return Number(UserId);})} }
      ],
      Lifetime: {$elemMatch: {StatusId: statusCompleted, Date: {$gte: now.toJSON()}}}
    };

    // console.log(JSON.stringify(filter));

    var cursor = tasks.find(filter, {Id: 1, Name: 1, Lifetime: {$elemMatch: {StatusId: statusCompleted}}});

    cursor.toArray(function(err, tasksData){


      for(var i in tasksData) {
        var task = tasksData[i];

        var date = new Date(task.Lifetime[0].Date);
        date.setHours(0,0,0,0);
        var dateKey = date.toDateString();
        if(eventsObj[dateKey] === undefined) {
          eventsObj[dateKey] = {date: date, count: 1}
        } else {
          eventsObj[dateKey]["count"]++;
        }
      }


      for(var i in eventsObj) {
        response.events.push(eventsObj[i]);
      }

      // сортировка обязательна
      response.events.sort(function(a, b){
        if(a.date == b.date) return 0;
        return a.date > b.date ? 1 : -1;
      });

      if(config.memcached.active == 1) {
        memcached.set(memcachedKey, response, 43200, function (err) { /* stuff */ });
      }

      emitter.emit('response');
    });

  }

});



// Статика
app.use(express.static(statPath, {fallthrough: false}));


app.use(function(err, req, res, next){
  if (err.statusCode == 404) {
    res.sendFile('404.html', {root: statPath});
  } else {
    next(err);
  }
});


// Запуск
initApp();
app.listen(config.web.port);
