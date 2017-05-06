(function ($) {

  // js-pulse

  var $pulse = $('.js-pulse'),
    // TODO RequireJS
    $usersList = $('.js-userslist'),
    users = {};

  initUserList();

  function initUserList() {
    $.ajax({
      url: "users.json",
      method: 'GET',
      cache: false,
      dataType: 'json',
      error: function(){
        $usersList.html('<li>Упс, пользователи не получены</li>');
      },
      success: function(resp) {
        users = resp.users;
        var keys = Object.keys(users).sort(function(a,b){return users[a].Name > users[b].Name ? 1: -1});

        keys.forEach(function(i){
          var user = users[i];
          var $userHtml = $('<li class="js-changeuser" data-id="' + user.Id + '"><img src="' + user.photo + '" alt="">'
              +'<div class="name"><h5><b>' + user.Name + '</b></h5></div></li>');
          $usersList.append($userHtml);
        });

        $('body').trigger('users-loaded');
      }
    });
  }

  $('body').on('users-loaded', function() {
    // console.log(users.Name);
    var delay = 0;
    for(var i in users) {
    // for(var i in {11273: 1, 11349: 1, 14195: 1, 11184: 1}) {
      // todo сделать "по цепочке"
      var user = users[i];
      $pulse.trigger('addReport', {prefix: 'pulse', user: user});
    }
  });

  $pulse.on('addReport', function(e, settings){
    $.ajax({
      url: "tasks-completed.json?ExecutorId=" + settings.user.Id,
      method: 'GET',
      cache: false,
      dataType: 'json',
      error: function(){
        // $('#chart-one').html('<li>Упс, данные не получены</li>');
      },
      success: function(resp) {
        var idAttr = settings.prefix + settings.user.Id;
        $pulse.append('<h2>' + settings.user.Name + '</h2><div id="' + idAttr + '"></div>');
        for(var i in resp.events) {
          var ev = resp.events[i];
          ev.date = new Date(ev.date);
        }
        var heatmap = calendarHeatmap()
          .data(resp.events)
          .selector('#' + idAttr)
          .legendEnabled(false)
          .tooltipEnabled(true)
          .colorRange(['#F6F8F8', '#2196F3'])
          .tooltipUnit('task')
          .locale({
              months: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сент', 'Окт', 'Нояб', 'Дек'],
              days: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
              No: 'Нет',
              on: '',
              Less: 'мало',
              More: 'много'
        })
          .onClick(function (data) {
            // console.log('data', data);
          });
        heatmap();  // render the chart
      }
    });
  });





})(jQuery);
