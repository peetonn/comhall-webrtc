var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var producerSocket;
var consumerIds = [];
var consumerSockets = [];
var consumerNo = 0;

app.get('/', function(req, res){
  res.send('Use your local index.html');
});

io.on('connection', function(socket){

	socket.on('disconnect', function(){
    consumerId = consumerIds[this.id];
    if (consumerId)
    {
      console.log('user '+consumerId+' disconnected ');   
      if (producerSocket) 
        producerSocket.emit('bye', {from:consumerId, data:{}});

      delete consumerIds[this.id]
      delete consumerSockets[consumerId]
    }
    else
    {
      console.log('producer disconnected');
      io.emit('producer dead', {for: 'everyone'});
    }
  });

  socket.on('id', function(msg){
    if (msg == 'producer')
    {
     producerSocket = socket;
     io.emit('producer alive', {for: 'everyone'});
     console.log('producer connected');

     for (var consumerId in Object.keys(consumerSockets))
      producerSocket.emit('new consumer', {from:consumerId, data:{}});
  }
  else
  {	
    if (!consumerIds[socket.id])
    {
  		var consumerId = 'consumer'+consumerNo; //Object.keys(consumerIds).length;
      consumerNo++;
      consumerIds[socket.id] = consumerId;
      consumerSockets[consumerId] = socket;
      socket.emit('id', consumerId);

      console.log(consumerId+' connected. total consumers: '+Object.keys(consumerIds).length);
      console.log('sending request to producer...');
      
      if (producerSocket)
      {
        socket.emit('producer alive', {});
        producerSocket.emit('new consumer', {from:consumerId, data:{}});
      }
      else
        console.log('producer is not connected yet');

    }
    else
    {
      socket.emit('id', consumerIds[socket.id]);
    }
  }
});

  socket.on('offer', function(msg){
    if (socket == producerSocket)
    {
      console.log('received offer from producer '+JSON.stringify(msg.data));
      sendToConsumer(msg.to, 'offer', msg.data);
    }
    else
      console.error("violation: consumers aren't allowed to send offers");
  });

  socket.on('answer', function(msg){
    if (socket == producerSocket)
      console.error("producer is not allowed to send answers");
    else
    {
      console.log('sending answer from '+consumerIds[socket.id]+': '+JSON.stringify(msg));
      producerSocket.emit('answer', {from: consumerIds[socket.id], data: msg});
    }
  });

  socket.on('ice', function(msg){
    if (socket == producerSocket)
    {
      console.log('received ICE from producer');
      sendToConsumer(msg.to, 'ice', msg.data);
    }
    else
    {
      console.log('received ICE from '+consumerIds[socket.id]+': '+msg);
      producerSocket.emit('ice', {from: consumerIds[socket.id], data: msg});
    }
  });

});

http.listen(3001, function(){
  console.log('listening on *:3001');
});

function sendToConsumer(consumerId, type, data){
  var consumerSocket = consumerSockets[consumerId];
  
  if (consumerSocket)
    consumerSocket.emit(type, data);
}
