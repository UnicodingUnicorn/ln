$(document).ready(function(){
  $('.modal').modal();
  var today = new Date();
  $('.datepicker').pickadate({
    format : 'yyyy-mm-dd',
    max : new Date(today.getFullYear(), today.getMonth()+1, today.getDate()),
    selectMonths: true, // Creates a dropdown to control month
    selectYears: 25, // Creates a dropdown of 15 years to control year,
    today: 'Today',
    clear: 'Clear',
    close: 'Ok',
    closeOnSelect: true // Close upon selecting a date,
  });
});
