$(document).ready(function(){
    //autoscroll function by jquery
    $('#list').animate({scrollTop:10000}, 80);
    var socket=io();
    //connect client to server
    socket.on('connect',function(socket){
        console.log('Connected to server');
    });
    //emit user ID
    var ObjectID = $('#ObjectID').val();
    var carID= $('carID').val();
    socket.emit('ObjectID',{
        carID: carID,
        userID: ObjectID
    });
    //listen to car event
    socket.on('car', function(car){
        console.log(car);
        //make an ajaX request to fetch latitude and longitude
        $.ajax({
            url: `https://maps.googleapis.com/maps/api/geocode/json?address=${car.location}&key=AIzaSyCXj4eJqhlRjwDqGKf7FfLGjcSdd0Zu74g`,
            type: 'POST',
            data: JSON,
            proecessData: true,
            success: function(data){
                console.log(data);
                 //send lat and lng  to server
                 socket.emit('LatLng',{
                    data: data,
                    car: car
                });
            }
        });
    });    
           
    //Disconnet from server
    socket.on('disconnect', function(socket)
    {
        console.log('Disconnected from server');
    });
});    