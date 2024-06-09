import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import fileStore from "session-file-store";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import path from "path";
import moment from "moment-timezone";
import multer from "multer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 3000;
moment.tz.setDefault("Asia/Kolkata");

const FileStore = fileStore(session);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, "public")));
app.use(bodyParser.json());
app.use(session({
  store: new FileStore({ path: './sessions', retries: 0 }),
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));

// Set up storage engine for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, join(__dirname, 'public/uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Ensure the updates and logs directories exist
const updatesDir = path.join(__dirname, 'public', 'updates');
const logsDir = path.join(__dirname, 'public', 'logs');
if (await fs.access(updatesDir).then(() => false).catch(() => true)) {
  await fs.mkdir(updatesDir, { recursive: true });
}
if (await fs.access(logsDir).then(() => false).catch(() => true)) {
  await fs.mkdir(logsDir, { recursive: true });
}

// Function to log session data and IP address
const logSessionData = async (req, user) => {
  const logFilePath = path.join(logsDir, 'log.json');
  const logData = {
    timestamp: new Date().toISOString(),
    ip: req.ip,
    sessionID: req.sessionID,
    userType: user.userType,
    user: user.user
  };

  let logs = [];
  try {
    const data = await fs.readFile(logFilePath, 'utf8');
    logs = JSON.parse(data);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }

  logs.push(logData);
  await fs.writeFile(logFilePath, JSON.stringify(logs, null, 2), 'utf8');
};

// Load and save credentials functions for students and teachers
const loadCredentials = async (filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data).credentials;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    } else {
      throw err;
    }
  }
};

const validateUser = async (inputUser, inputPasskey) => {
  const studentFilePath = './public/studentCredentials.json';
  const teacherFilePath = './public/teacherCredentials.json';

  const studentCredentials = await loadCredentials(studentFilePath);
  const teacherCredentials = await loadCredentials(teacherFilePath);

  const student = studentCredentials.find(cred => cred.user === inputUser && cred.passkey === inputPasskey);
  if (student) return { userType: 'student', user: student };

  const teacher = teacherCredentials.find(cred => cred.user === inputUser && cred.passkey === inputPasskey);
  if (teacher) return { userType: 'teacher', user: teacher };

  return null;
};

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
};

// Routes
app.get('/login', (req, res) => {
  res.sendFile(join(__dirname, './public/signin.html'));
});

app.get('/logi', (req, res) => {
  res.sendFile(join(__dirname, './public/annou.html'));
});

app.get('/createpost', isAuthenticated, (req, res) => {
  res.sendFile(join(__dirname, './public/announcements.html'));
});

app.get('/posting', isAuthenticated, (req, res) => {
  res.sendFile(join(__dirname, './public/update.html'));
});

app.get('/dashboard', isAuthenticated, (req, res) => {
  res.sendFile(join(__dirname, './public/dashboard.html'));
});

app.get("/attendence", isAuthenticated, (req, res) => {
  let page;
  if (req.session.userType === 'student') {
    page = 'dashboard.html';
  } else if (req.session.userType === 'teacher') {
    const teacherUser = req.session.user.user;
    switch (teacherUser) {
      case 'teacher1':
        page = 'attendence-faculty2.html';
        break;
      case 'teacher2':
        page = 'attendence-faculty3.html';
        break;
      case 'teacher3':
        page = 'attendence-faculty4.html';
        break;
      default:
        page = 'announcements.html';
    }
  }
  res.sendFile(join(__dirname, `./public/${page}`));
});

app.get("/curriculum", isAuthenticated, (req, res) => {
  res.sendFile(join(__dirname, './public/dashboard.html'));
});

// Route to fetch announcements
app.get('/api/announcements', async (req, res) => {
  const filePath = path.join(__dirname, 'public', 'updates', 'update.json');
  try {
    const data = await fs.readFile(filePath, 'utf8');
    let announcements = JSON.parse(data);

    // If the user is a teacher, set a flag indicating that the announcement can be deleted
    if (req.session.userType === 'teacher') {
      announcements = announcements.map(announcement => ({
        ...announcement,
        deletable: true
      }));
    }

    res.json(announcements);
  } catch (error) {
    console.error('Error reading announcements file:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Route to delete an announcement
app.post('/delete-announcement', isAuthenticated, async (req, res) => {
  if (req.session.userType === 'teacher') {
    const { announcementId } = req.body;
    const filePath = path.join(__dirname, 'public', 'updates', 'update.json');

    try {
      const data = await fs.readFile(filePath, 'utf8');
      let announcements = JSON.parse(data);

      // Filter out the announcement with the provided ID
      announcements = announcements.filter(announcement => announcement.id !== announcementId);

      // Write the updated announcements back to the file
      await fs.writeFile(filePath, JSON.stringify(announcements, null, 2));

      res.status(200).send('Announcement deleted successfully');
    } catch (error) {
      console.error('Error deleting announcement:', error);
      res.status(500).send('Internal Server Error');
    }
  } else {
    res.status(403).send('Unauthorized');
  }
});

// Routes to save attendance and absence data
app.post('/saveAttendance2', async (req, res) => {
  try {
    const attendanceData = req.body;
    const currentDate = moment().format('YYYY-MM-DD');
    const filePath = path.join(__dirname, 'public', 'db2.json');

    let existingData = [];
    try {
      const data = await fs.readFile(filePath, 'utf8');
      existingData = JSON.parse(data);
    } catch (error) {
      console.error('Error reading file:', error);
    }

    const newData = {
      ...existingData,
      [currentDate]: attendanceData
    };

    await fs.writeFile(filePath, JSON.stringify(newData, null, 2));

    res.status(200).send('Attendance data saved successfully');
  } catch (error) {
    console.error('Error saving attendance data:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/saveAttendance3', async (req, res) => {
  try {
    const attendanceData = req.body;
    const currentDate = moment().format('YYYY-MM-DD');
    const filePath = path.join(__dirname, 'public', 'db3.json');

    let existingData = [];
    try {
      const data = await fs.readFile(filePath, 'utf8');
      existingData = JSON.parse(data);
    } catch (error) {
      console.error('Error reading file:', error);
    }

    const newData = {
      ...existingData,
      [currentDate]: attendanceData
    };

    await fs.writeFile(filePath, JSON.stringify(newData, null, 2));

    res.status(200).send('Attendance data saved successfully');
  } catch (error) {
    console.error('Error saving attendance data:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/saveAttendance4', async (req, res) => {
  try {
    const attendanceData = req.body;
    const currentDate = moment().format('YYYY-MM-DD');
    const filePath = path.join(__dirname, 'public', 'db4.json');

    let existingData = [];
    try {
      const data = await fs.readFile(filePath, 'utf8');
      existingData = JSON.parse(data);
    } catch (error) {
      console.error('Error reading file:', error);
    }

    const newData = {
      ...existingData,
      [currentDate]: attendanceData
    };

    await fs.writeFile(filePath, JSON.stringify(newData, null, 2));

    res.status(200).send('Attendance data saved successfully');
  } catch (error) {
    console.error('Error saving attendance data:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/saveAbsence2', async (req, res) => {
  try {
    const absenceData = req.body;
    const currentDate = moment().format('YYYY-MM-DD');
    const filePath = path.join(__dirname, 'public', 'absences2.json');

    let existingData = [];
    try {
      const data = await fs.readFile(filePath, 'utf8');
      existingData = JSON.parse(data);
    } catch (error) {
      console.error('Error reading file:', error);
    }

    const newData = {
      ...existingData,
      [currentDate]: absenceData
    };

    await fs.writeFile(filePath, JSON.stringify(newData, null, 2));

    res.status(200).send('Absence data saved successfully');
  } catch (error) {
    console.error('Error saving absence data:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/saveAbsence3', async (req, res) => {
  try {
    const absenceData = req.body;
    const currentDate = moment().format('YYYY-MM-DD');
    const filePath = path.join(__dirname, 'public', 'absences3.json');

    let existingData = [];
    try {
      const data = await fs.readFile(filePath, 'utf8');
      existingData = JSON.parse(data);
    } catch (error) {
      console.error('Error reading file:', error);
    }

    const newData = {
      ...existingData,
      [currentDate]: absenceData
    };

    await fs.writeFile(filePath, JSON.stringify(newData, null, 2));

    res.status(200).send('Absence data saved successfully');
  } catch (error) {
    console.error('Error saving absence data:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/saveAbsence4', async (req, res) => {
  try {
    const absenceData = req.body;
    const currentDate = moment().format('YYYY-MM-DD');
    const filePath = path.join(__dirname, 'public', 'absences4.json');

    let existingData = [];
    try {
      const data = await fs.readFile(filePath, 'utf8');
      existingData = JSON.parse(data);
    } catch (error) {
      console.error('Error reading file:', error);
    }

    const newData = {
      ...existingData,
      [currentDate]: absenceData
    };

    await fs.writeFile(filePath, JSON.stringify(newData, null, 2));

    res.status(200).send('Absence data saved successfully');
  } catch (error) {
    console.error('Error saving absence data:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/login', async (req, res) => {
  const { user, passkey } = req.body;

  const validatedUser = await validateUser(user, passkey);
  if (validatedUser) {
    req.session.user = validatedUser.user;
    req.session.userType = validatedUser.userType;

    await logSessionData(req, validatedUser.user);

    if (validatedUser.userType === 'student') {
      res.redirect('/logi');
    } else if (validatedUser.userType === 'teacher') {
      res.redirect('/createpost');
    }
  } else {
    res.send('Invalid credentials');
  }
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  res.json({ file: req.file });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
