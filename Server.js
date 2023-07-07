const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const hostname = '127.0.0.1';
const socketio = require('socket.io');

const app = express();
app.use(bodyParser.json());
app.use(cors());

//mongodb url
const mongourl = 'mongodb+srv://nir45:nir123@cluster0.ogko47r.mongodb.net/mernstack?retryWrites=true&w=majority';


mongoose.connect(mongourl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log("----- MongoDB connection established successfully --------")
}).catch((error) => {
    console.log(error)
})

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

const schema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    mobileNo: { type: String, required: true },
    email: { type: String, required: true },
    address: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        country: { type: String, required: true }
    },
    loginId: { type: String, required: true },
    password: { type: String, required: true }
});

const Data = mongoose.model('Data', schema);

app.post('/api/data', async (req, res) => {
    try {
        const newData = new Data(req.body);
        const savedData = await newData.save();

        // Emit 'userJoined' event with user details
        io.to('live users').emit('userJoined', {
            _id: savedData._id,
            firstName: savedData.firstName,
            lastName: savedData.lastName,
            email: savedData.email,
            socketId: '', // This will be updated later when the user connects
            name: `${savedData.firstName} ${savedData.lastName}` // Concatenate first name and last name
        });

        res.send(savedData);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error saving data to database.');
    }
});
app.get('/api/data', async (req, res) => {
    try {
        const data = await Data.find({});
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching data' });
    }
});

app.get('/api/data/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await Data.findOne({ email: userId });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching user data' });
    }
});
// Serve the index.html file
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Serve the display.html file
app.get('/display', (req, res) => {
    res.sendFile(__dirname + '/display.html');
});

// Start the server
const port = 3000;
const server = app.listen(port, hostname, () => {
    console.log(`Server is running on http://localhost:${port} ${hostname}`);
});

const io = socketio(server);

// Define the connectedUsers array
const connectedUsers = [];

// Handle socket connections
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Join the user to the "live users" room
    socket.join('live users');

    // When a user is joined into the "live users" room
    socket.on('join', async function (data) {
        // Extract user information from the data object
        const { email, firstName, socketId } = data;

        // Add the user to the connectedUsers array
        const user = { email, firstName, socketId: null };
        connectedUsers.push(user);

        // Emit the updated connectedUsers array to all clients
        io.to('live users').emit('users', connectedUsers);

        // Emit the 'userJoined' event with the connected user's details
        io.to(socket.id).emit('userJoined', user);

        // Emit the 'userSocketId' event to update the socket ID
        io.to(socket.id).emit('userSocketId', { userId: user._id, socketId: socket.id });

        // Update the socketId of the connected user in the connectedUsers array
        user.socketId = socket.id;

        // Emit the updated connectedUsers array to all clients
        io.to('live users').emit('users', connectedUsers);
    });

    // When a user is disconnected
    socket.on('disconnect', function () {
        console.log('A user disconnected:', socket.id);
        // Find the disconnected user in the connectedUsers array
        const disconnectedUser = connectedUsers.find(user => user.socketId === socket.id);

        // Remove the disconnected user from the connectedUsers array
        if (disconnectedUser) {
            connectedUsers.splice(connectedUsers.indexOf(disconnectedUser), 1);
        }

        // Emit the updated connectedUsers array to all clients
        io.to('live users').emit('users', connectedUsers);
    });
});
