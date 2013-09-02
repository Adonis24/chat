function Connection(options) {
  this.options = options || {};

  this.reconnectAttempt = 0;
  this.connect();
}

jQuery.extend(Connection.prototype, $.eventEmitter);

['CONNECTING', 'OPEN', 'CLOSED'].forEach(function(status) {
  Connection.prototype[status] = status;
});

Connection.prototype.RECONNECT_DELAYS = [1000, 2500, 5000, 10000, 30000, 60000];

Connection.prototype.connect = function() {
  this.socket = new SockJS(this.options.prefix, undefined, this.options.socket);
  this.status = this.CONNECTING;

  this.socket.onopen = this.onOpen.bind(this);
  this.socket.onmessage = this.onMessage.bind(this);
  this.socket.onclose = this.onClose.bind(this);
}

Connection.prototype.onOpen = function() {
  var self = this;

  this.reconnectAttempt = 0;

  $.ajax({
    method: 'POST',
    url: '/socketKey',
    success: function(socketKey) {
      self.send({
        type: 'handshake',
        socketKey: socketKey
      });
    }
  });

};

Connection.prototype.onMessage = function(e) {

  var message = JSON.parse(e.data);

  if (this.status == this.CONNECTING) {
    if (message.type == 'handshake') {
      this.status = this.OPEN;
      this.emit('open');
    } else {
      throw new Error("First response must be handshake: " + e.data);
    }
    return;
  }

  this.emit('message', message);
};

Connection.prototype.onClose = function(event) {
  var self = this;

  if (this.options.debug) {
    console.log(event);
  }

  if (event.code == 401) {
    // logged out
    this.status = this.CLOSED;
    this.emit('close', event);
    return;
  }

  this.status = this.CONNECTING;
  this.emit('disconnect');

  var delay = this.RECONNECT_DELAYS[this.reconnectAttempt]
  || this.RECONNECT_DELAYS[this.RECONNECT_DELAYS.length-1];

  if (this.options.debug) {
    console.log("Reconnect in " + delay);
  }

  setTimeout(function() {
    self.reconnectAttempt++;
    self.connect();
  }, delay);

};

Connection.prototype.send = function(message) {
  this.socket.send(JSON.stringify(message));
};
