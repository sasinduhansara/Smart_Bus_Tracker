from flask_socketio import SocketIO


# Keep the Socket.IO server in a neutral module so route handlers always emit
# through the same instance, including when the backend is started with
# ``python app.py`` (where the application module is named ``__main__``).
socketio = SocketIO(async_mode="threading")
