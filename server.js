"use strict";

const
	assert = require('assert'),
	Service = new (require('./lib/Service').Service),
	HelpDeskApi = require('./lib/HelpDeskApi'),
	config = require('./etc/config.json')
	;

class App {

	constructor() {
		return new Promise((appResolve, appReject) => {

			const init = async () => {
				await this.connectMongo();
				await this.initMongo();
				await this.initHelpDeskApi();
				appResolve(this);
			}

			init().catch(err => {
				console.log(err);
		    appReject(err);
		  });

		});
	}

	connectMongo() {
		const
			mongodb = require('mongodb'),
			MongoClient = mongodb.MongoClient
			;

	  return new Promise((resolve, reject) => {
	    MongoClient.connect(config.mongo.uri, (err, db) => {
	      assert.equal(null, err);
				Service.register('mongo', db);
	      resolve();
	    });
	  });
	}

	initMongo() {
		return new Promise((resolve, reject) => {
			let mongo = Service.get('mongo');
			mongo.collection('tasks').createIndex({Id: 1}, {unique: true}, (err, db) => {
				assert.equal(null, err);
				resolve();
			});
		}).then(() => {
			return new Promise((resolve, reject) => {
				let mongo = Service.get('mongo');
				mongo.collection('users').createIndex({Id: 1}, {unique: true}, (err, db) => {
					assert.equal(null, err);
					resolve();
				});
			});
		});
	}

	initHelpDeskApi() {
		const { HelpDeskApi } = require('./lib/HelpDeskApi');
		let api = new HelpDeskApi(config.HelpDeskApi);
		return new Promise((resolve, reject) => {

			api.connect().then((HelpDeskApi) => {
				Service.register('HelpDeskApi', HelpDeskApi);
				resolve();
			}, (err) => {
				console.log('Intraservice connection error');
				reject('Intraservice connection error')
				// process.exit(1);
			});

		});

	}

	// Веб-приложение
	runWebApp() {
		const { WebApp } = require('./lib/WebApp');
		let app = new WebApp(config);
		app.listen(config.web.port);
	}

	// Получение списка пользователей
	runGetUsers() {
		const { User } = require('./lib/User');
		let user = new User(config.User);
		user.fetchAll();
	}

	// Получение задач (базовая информация)
	runGetTasks() {
		const { Task } = require('./lib/Task');
		let task = new Task(config.Task, config.User.active);
		task.fetchAll();
	}

	// Получение трудоемкости задач
	runGetExpenses() {
		const { TaskExpense } = require('./lib/TaskExpense');
		let taskExpense = new TaskExpense(config.TaskExpense);
		taskExpense.fetchMarked();
	}

	// Получение жизненного цикла задачи
	runGetLifetime() {
		const { TaskLifetime } = require('./lib/TaskLifetime');
		let taskLifetime = new TaskLifetime(config.TaskLifetime);
		taskLifetime.fetchMarked();
	}



}

var app = new App();
app.then((app) => {
	app.runWebApp();
	app.runGetUsers();
	app.runGetTasks();
	app.runGetExpenses();
	app.runGetLifetime();
});
