(function ($) {
  $(document).ready(function(){
    $.ajax({
      url: "http://localhost:8080/report.json",
      method: 'POST',
      data: {
        ExecutorId: "11184"
      },
      cache: false,
      dataType: 'json',
      error: function(){
        // alert('Упс, данные для отчета не получены');
        console.log('Упс, данные для отчета не получены');
      },
      success: function(resp) {
        console.log(resp);
      }
    })
  });
})(jQuery);
