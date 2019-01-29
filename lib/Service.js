"use strict";

/*

Сервис (контейнер) для dependency injection, работает на "глобальном" уровне

Вариант использования:

const
  Service = new (require('./lib/Service').Service)
  ;

// Регистрация сервиса
Service.register('mysql', mysqlConnection);

// Получение сервиса
Service.get('mysql');

*/

const services = {};

class Service {

  register(name, service) {
    if(services[name]) throw new Error(`Service ${name} already exists`);
    services[name] = service;
  }

  get(name) {
    if(!services[name]) throw new Error(`Service ${name} not registered`);
    return services[name];
  }

  unregister(name) {
    if(!services[name]) throw new Error(`Service ${name} not registered`);
    delete(services[name]);
  }

}

module.exports.Service = Service;
