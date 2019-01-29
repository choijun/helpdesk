"use strict";

const
  assert = require('assert'),
  Service = new (require('./Service').Service),
  express = require('express'),
  app = express(),
  bodyParser = require('body-parser'),
  EventEmitter = require('events'),
  path = require('path'),
  statPath = path.resolve(__dirname, '../public_html')
  ;

class WebApp {

  constructor(config) {
    this.mongo = Service.get('mongo');
    this.config = config;
    app.use(bodyParser.urlencoded({extended: false}));

    // Проверка работоспособности
    app.get('/healthcheck', (req, res) => {
      res.send("ok");
    });

    // Отчет за период по пользователяю
    app.get('/report.json', (req, res) => {

      let ExecutorId = parseInt(req.query.ExecutorId);
      assert(ExecutorId > 0);

      let emitter = new EventEmitter();
      let tasks = this.mongo.collection('tasks');
      let taskItems = [];

      emitter.on('response', (type) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(taskItems));
      });

      // {ExecutorIds: ExecutorId},
      let filter = {
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

      let cursor = tasks.find(filter, {Created: 1, Creator: 1, Expenses: 1, ExecutorIds: 1, Name: 1, Id: 1, StatusId: 1, TypeId: 1});

      cursor.toArray((err, tasks) => {
        assert.equal(null, err);
        taskItems = [];
        for(let i in tasks) {
          let task = tasks[i];

          if(typeof task.Expenses !== 'undefined' && task.Expenses.length) {

            for(let i2 in task.Expenses) {
              let expense = task.Expenses[i2];
              if(expense.UserId != ExecutorId) continue;

              let expHours = Math.round(expense.Minutes / 0.6) / 100;
              let event = {
                title: task.Name,
                start: expense.Date.substr(0,10),
                className: 'task-status task-status--' + task.StatusId,
                data: {
                  url: this.config.helpdesk.taskUri.replace('{taskid}', task.Id),
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

    // Все пользователи системы
    app.get('/users.json', (req, res) => {
      let emitter = new EventEmitter();
      let users = this.mongo.collection('users');
      let userItems = {};

      emitter.on('response', () => {
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({users: userItems}));
      });

      let usersIDs = Object.keys(this.config.report.users).map( (val) => { return parseInt(val); } );

      let cursor = users.find({Id: {$in: usersIDs}});

      cursor.each((err, user) => {
        if(user == null) {
          emitter.emit('response');
        } else {
          // сливаем параметры из конфига с параметрами из БД
          user = Object.assign(this.config.report.users[user.Id], user);
          userItems[user.Id] = user;
        }
      });
    });

    // Время заявки: открыта, закрыта (закрыта != выполнена)
    app.get('/created-closed.json', (req, res) => {
      let emitter = new EventEmitter();
      let tasks = this.mongo.collection('tasks');
      let data = [];

      emitter.on('response', () => {
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(data));
      });

      let cursorClosed = tasks.find({Closed: {$ne: null}}, {Id: 1, Closed: 1});
      cursorClosed.toArray((err, tasksClosed) => {
        for(let i in tasksClosed) {
          let task = tasksClosed[i];
          data.push(
            {Id: task.Id, timestamp: task.Closed, type: "Closed"}
          );
        }

        let cursorCreated = tasks.find({Created: {$ne: null}}, {Id: 1, Created: 1});

        cursorCreated.toArray((err, tasksCreated) => {
          for(let i in tasksCreated) {
            let task = tasksCreated[i];
            data.push(
              {Id: task.Id, timestamp: task.Created, type: "Created"}
            );
          }
          emitter.emit('response');
        });

      });


    });

    // "время жизни заявки"
    app.get('/timeline.json', (req, res) => {
      let emitter = new EventEmitter();
      let tasks = this.mongo.collection('tasks');
      let events = [];

      emitter.on('response', () => {
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(events));
      });

      let ExecutorId = 11184;
      let filter = {
        $or: [
          { Expenses: { $elemMatch: { UserId: ExecutorId } } },
          { ExecutorIds: ExecutorId }
        ]
      };

      let cursor = tasks.find(filter, {Id: 1, Name: 1, Created: 1, Closed: 1});

      cursor.toArray((err, tasksData) => {
        let nowDate = new Date();
        for(let i in tasksData) {
          let task = tasksData[i];
          let dates = [];
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
    app.get('/tasks-completed.json', (req, res) => {
      let emitter = new EventEmitter();
      let tasks = this.mongo.collection('tasks');
      let eventsObj = {}, response = {events: []};
      let statusCompleted = 29;

      let ExecutorId = parseInt(req.query.ExecutorId);
      let memcachedKey = '/tasks-completed.json-' + ExecutorId;

      emitter.on('response', () => {
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(response));
      });

      if(this.config.memcached.active == 1) {
        memcached.get(memcachedKey, (err, data) => {
          if(data === undefined) {
            getData();
          } else {
            response = data;
            emitter.emit('response');
          }
        });
      } else {
        getData();
      }

      function getData() {
        // могут быть проблемы с високосным годом - на клиенте есть баги в плагине
        let now = new Date();
        now.setHours(0,0,0,0);
        now.setFullYear(now.getFullYear() - 1);

        let filter = {
          $or: [
            { Expenses: { $elemMatch: { UserId: ExecutorId } } },
            { ExecutorIds: (ExecutorId > 0) ? ExecutorId : {$in: this.config.helpdesk.users.map(function(UserId){return Number(UserId);})} }
          ],
          Lifetime: {$elemMatch: {StatusId: statusCompleted, Date: {$gte: now.toJSON()}}}
        };

        // console.log(JSON.stringify(filter));

        let cursor = tasks.find(filter, {Id: 1, Name: 1, Lifetime: {$elemMatch: {StatusId: statusCompleted}}});

        cursor.toArray(function(err, tasksData){

          for(let i in tasksData) {
            let task = tasksData[i];

            let date = new Date(task.Lifetime[0].Date);
            date.setHours(0,0,0,0);
            let dateKey = date.toDateString();
            if(eventsObj[dateKey] === undefined) {
              eventsObj[dateKey] = {date: date, count: 0, ids: []};
            }
            eventsObj[dateKey]["count"]++;
            eventsObj[dateKey]["ids"].push(task.Id);
          }


          for(let i in eventsObj) {
            response.events.push(eventsObj[i]);
          }

          // сортировка обязательна
          response.events.sort(function(a, b){
            if(a.date == b.date) return 0;
            return a.date > b.date ? 1 : -1;
          });

          if(this.config.memcached.active == 1) {
            memcached.set(memcachedKey, response, 43200, function (err) { /* stuff */ });
          }

          emitter.emit('response');
        });

      }

    });

    // Статика
    app.use(express.static(statPath, {fallthrough: false}));

    app.use((err, req, res, next) => {
      if (err.statusCode == 404) {
        res.sendFile('404.html', {root: statPath});
      } else {
        next(err);
      }
    });
  }

  listen(port) {
    app.listen(port);
  }
}

module.exports.WebApp = WebApp;
