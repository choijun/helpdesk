(function ($) {

  var now = moment().endOf('day').toDate();
  var yearAgo = moment().startOf('day').subtract(1, 'year').toDate();

  $.ajax({
    url: "tasks-completed.json",
    method: 'GET',
    cache: false,
    dataType: 'json',
    error: function(){
      $('#chart-one').html('<li>Упс, данные не получены</li>');
    },
    success: function(events) {
      console.log(events);
      for(var i in events) {
        var ev = events[i];
        ev.date = new Date(ev.date);
      }
      var heatmap = calendarHeatmap()
        .data(events)
        .selector('#chart-one')
        .tooltipEnabled(true)
        // .colorRange(['#F6F8F8', '#2196F3'])
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



})(jQuery);
