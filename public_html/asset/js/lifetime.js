(function ($) {


  $.ajax({
    url: "timeline.json",
    method: 'GET',
    cache: false,
    dataType: 'json',
    error: function(){
      $('#target1').html('<li>Упс, данные не получены</li>');
    },
    success: function(events) {
      // console.log(events);

      var timeline = new Chronoline(document.getElementById("target1"), events,
        {
          animated: true,
          draggable: true,
          tooltips: true,
          markToday: 'labelBox'
        });

    }
  });



})(jQuery);
