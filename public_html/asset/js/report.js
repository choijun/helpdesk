(function ($) {

  var getUrlParameter = function getUrlParameter(sParam) {
    var sPageURL = decodeURIComponent(window.location.search.substring(1)),
        sURLVariables = sPageURL.split('&'),
        sParameterName,
        i;

    for (i = 0; i < sURLVariables.length; i++) {
        sParameterName = sURLVariables[i].split('=');

        if (sParameterName[0] === sParam) {
            return sParameterName[1] === undefined ? true : sParameterName[1];
        }
    }
  };

  var ExecutorId;

  $(document).ready(function(){
    var $userName = $('.js-username'),
        $userPhoto = $('.js-userphoto'),
        $usersList = $('.js-userslist'),
        $calendar = $('#calendar'),
        users = {},
        eventsDateMinutes = {}
        ;

    initUserList();

    $('#myonoffswitch1').on('change', function(){
      var isHideHolidays = $(this).is(':checked');
      $calendar.fullCalendar('option', 'hiddenDays', isHideHolidays ? [ 0, 6 ] : []);
    });

    window.onpopstate = function(event) {
      if(event.state === null) return;
      if(event.state.userID === null) return;
      $calendar.trigger('change-user', event.state);
    };

    $('body').on('click', '.js-changeuser', function(e){
      var state = {userID: $(this).attr('data-id')};
      $calendar.trigger('change-user', state);
      history.pushState(state, '', 'calendar.html?ExecutorId=' + state.userID);
    });

    $calendar.on('change-user', function(event, state){
      ExecutorId = state.userID;
      var curUser = users[ExecutorId];

      $('.js-changeuser').removeClass('online').filter("[data-id='" + ExecutorId + "']").addClass('online');
      $userName.html(curUser.Name);
      $userPhoto.attr('src', curUser.photo);

      $calendar.fullCalendar('removeEventSources');
      $calendar.fullCalendar('removeEvents');
      $calendar.fullCalendar('addEventSource', getEvents());
    });

    $calendar.on('day-calc', function(event, data) {
      var dateName = data.date.format('YYYY-MM-DD');
      data.cell.html('<div class="js-day-info dayinfo" data-date="' + dateName + '"></div>')
    });

    function getEvents() {
      // @see https://fullcalendar.io/docs/event_data/events_json_feed/
      return {
        url: 'report.json',
        type: 'GET',
        data: {
          ExecutorId: ExecutorId
        },
        success: function(resp){
          // агрегируем трудозатраты за день
          $('.js-day-info').html('');
          eventsDateMinutes = {};
          if(resp.length) {

            for(var i in resp) {
              var dayEvent = resp[i];
              if(typeof eventsDateMinutes[dayEvent.start] === 'undefined') {
                eventsDateMinutes[dayEvent.start] = 0;
              }
              eventsDateMinutes[dayEvent.start] += dayEvent.data.expMinutes;
            }

            for(var dateName in eventsDateMinutes) {
              var $dateCell = $('.js-day-info[data-date="' + dateName + '"]');
              if($dateCell.length) {
                var hours = Math.round(eventsDateMinutes[dateName] / 0.6) / 100;
                $dateCell.html('<span class="totaltime">' + hours + '</span>');
              }
            }
          }




        },
        error: function() {
          $calendar.html('<p>Упс, события не получены!</p>');
        }
      }
    }


    function initCalendar() {
      $calendar.fullCalendar({
        header: {
          left: 'prev,next today',
          center: 'title',
          right: 'month,agendaWeek,agendaDay'
        },
        firstDay: 1,
        hiddenDays: [ 0, 6 ],
        dayNames: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота' ],
        dayNamesShort: ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'суб' ],
        monthNames: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
        locale: 'ru',
        editable: false,
        dayRender: function(date, cell){
          $calendar.trigger('day-calc', {date: date, cell: cell});
        },
        droppable: false, // this allows things to be dropped onto the calendar
        eventRender: function(event, element) {
          element.html('<span class="task-hours">' + event.data.expHours +'</span>' + event.title);
        },
        eventClick: function(calEvent, jsEvent, view) {
          var win = window.open(calEvent.data.url, '_blank');
        },
      });
      _ExecutorId = getUrlParameter('ExecutorId');

      if(typeof _ExecutorId !== 'undefined') {
        $calendar.trigger('change-user', {userID: _ExecutorId});
      }
    }

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

          initCalendar();
        }
      });
    }



  });


})(jQuery);
